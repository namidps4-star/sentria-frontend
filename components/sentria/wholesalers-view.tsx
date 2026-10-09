"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Check, ChevronDown, Clock, GripVertical, Minus, Plus, Trash2, Truck, X } from "@/lib/icons"
import { enterAt } from "@/lib/motion"
import { useTx, type Tx } from "@/lib/i18n"
import {
  LADDER_DAYS,
  MAX_LEAD_DAYS,
  MAX_WHOLESALERS,
  advise,
  moveItem,
  newWholesaler,
  nowOnAccountClock,
  rankTag,
  readLadder,
  readWholesalers,
  writeWholesalers,
  type DayFlags,
  type Moment,
  type Reading,
  type Wholesaler,
} from "@/lib/wholesalers"
import { cn } from "@/lib/utils"

/* The wholesalers a pharmacy orders from, in order of preference, and a panel
 * that shows who would arrive in time for a product that is running out.
 *
 * Every number is typed by the pharmacy. SentrIA never says what a wholesaler
 * has in stock: when the first one has none, the next on the list is the
 * answer. See lib/wholesalers.ts for the arithmetic. */

/* ------------------------------- formatting ------------------------------ */

function formatTime(minutes: number, lang: string): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const mm = String(m).padStart(2, "0")

  if (lang === "fr") return `${String(h).padStart(2, "0")}:${mm}`

  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? "am" : "pm"}`
}

/** A weekday name, Monday first (0). */
function weekdayName(index: number, lang: string, style: "long" | "short" | "narrow"): string {
  // 1 January 2024 is a Monday.
  return new Intl.DateTimeFormat(lang, { weekday: style }).format(new Date(2024, 0, 1 + index))
}

function leadLabel(days: number, tx: Tx): string {
  if (days === 0) return tx("Le jour même", "Same day")
  if (days === 1) return tx("Le lendemain", "Next day")

  return tx(`Dans ${days} jours`, `In ${days} days`)
}

function daysWord(n: number, tx: Tx): string {
  return n === 1 ? tx("1 jour", "1 day") : tx(`${n} jours`, `${n} days`)
}

/** "today", "tomorrow", a weekday, or "in 9 days". */
function when(arrives: number, today: Moment, lang: string, tx: Tx): string {
  if (arrives === 0) return tx("aujourd'hui", "today")
  if (arrives === 1) return tx("demain", "tomorrow")
  if (arrives < LADDER_DAYS) return weekdayName((today.weekday + arrives) % 7, lang, "long")

  return tx(`dans ${arrives} jours`, `in ${arrives} days`)
}

function toHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function fromHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])

  return h < 24 && min < 60 ? h * 60 + min : null
}

/* ------------------------------ small controls ---------------------------- */

/** A rounded pill that shows its value and opens the browser's own list. The
 *  real <select> lies on top of it, so it works with a keyboard, a screen
 *  reader and a phone. */
function PillSelect({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  testId,
}: {
  icon: typeof Clock
  label: string
  value: number
  options: { value: number; label: string }[]
  onChange: (value: number) => void
  testId: string
}) {
  const current = options.find((o) => o.value === value)

  return (
    <label className="relative flex w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-[13px] font-semibold transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-accent/10">
      <Icon className="hidden h-[15px] w-[15px] shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{current?.label ?? ""}</span>
      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <select
        aria-label={label}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

/* The cutoff options: no cutoff, then every half hour from 6 am to 10 pm. A
 * stored time that is not on that grid (typed by an older build or another
 * tool) is added, so the row never shows a value it cannot hold. */
const NO_CUTOFF = -1
const HALF_HOURS = Array.from({ length: 33 }, (_, i) => 6 * 60 + i * 30)

/* -------------------------------- one row -------------------------------- */

function Row({
  w,
  index,
  count,
  confirming,
  dragging,
  onChange,
  onMove,
  onAskRemove,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  nameRef,
}: {
  w: Wholesaler
  index: number
  count: number
  confirming: boolean
  dragging: boolean
  onChange: (next: Wholesaler) => void
  onMove: (to: number) => void
  onAskRemove: (ask: boolean) => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
  nameRef?: (el: HTMLInputElement | null) => void
}) {
  const tx = useTx()
  const lang = tx("fr", "en")
  const [handleDown, setHandleDown] = useState(false)
  const tag = rankTag(index, count)

  const cutoffOptions = useMemo(() => {
    const times = w.cutoff !== null && !HALF_HOURS.includes(w.cutoff) ? [...HALF_HOURS, w.cutoff].sort((a, b) => a - b) : HALF_HOURS

    return [
      { value: NO_CUTOFF, label: tx("Pas d'heure limite", "No cutoff") },
      ...times.map((m) => ({ value: m, label: formatTime(m, lang) })),
    ]
  }, [w.cutoff, lang, tx])

  const leads = (from: number) =>
    Array.from({ length: MAX_LEAD_DAYS + 1 - from }, (_, i) => ({ value: from + i, label: leadLabel(from + i, tx) }))

  const setDay = (i: number) => {
    const days = [...w.days] as DayFlags
    days[i] = !days[i]
    onChange({ ...w, days })
  }

  const tagText = {
    nearby: tx("Le plus proche", "Nearby"),
    farther: tx("Plus loin", "Farther"),
    farthest: tx("Le plus loin", "Farthest"),
  }

  return (
    <div
      data-testid="wholesaler-row"
      draggable={handleDown}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", w.id)
        onDragStart()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      onDragEnd={() => {
        setHandleDown(false)
        onDragEnd()
      }}
      className={cn(
        "squircle rounded-[26px] border border-border bg-card p-[18px] pb-4 transition-opacity",
        dragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={tx(
            `Déplacer ${w.name || "ce grossiste"} : flèches haut et bas`,
            `Move ${w.name || "this wholesaler"}: up and down arrows`
          )}
          id={`wholesaler-handle-${w.id}`}
          data-testid="wholesaler-handle"
          onPointerDown={() => setHandleDown(true)}
          onPointerUp={() => setHandleDown(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault()
              onMove(index - 1)
            } else if (e.key === "ArrowDown") {
              e.preventDefault()
              onMove(index + 1)
            }
          }}
          className="flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13.5px] font-extrabold",
            index === 0 ? "bg-brand text-[#141414]" : "bg-foreground text-background"
          )}
        >
          {index + 1}
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            ref={nameRef}
            type="text"
            value={w.name}
            maxLength={80}
            onChange={(e) => onChange({ ...w, name: e.target.value })}
            placeholder={tx("Nom du grossiste", "Wholesaler name")}
            aria-label={tx("Nom du grossiste", "Wholesaler name")}
            data-testid="wholesaler-name"
            className="min-w-0 flex-1 rounded-md bg-transparent text-[15.5px] font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          {tag && (
            <span className="hidden shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground sm:inline">
              {tagText[tag]}
            </span>
          )}
        </div>

        {confirming ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">
              {tx("Retirer ?", "Remove?")}
            </span>
            <button
              type="button"
              onClick={onRemove}
              data-testid="wholesaler-remove-yes"
              className="rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Oui", "Yes")}
            </button>
            <button
              type="button"
              onClick={() => onAskRemove(false)}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Non", "No")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onAskRemove(true)}
            aria-label={tx(`Retirer ${w.name || "ce grossiste"}`, `Remove ${w.name || "this wholesaler"}`)}
            data-testid="wholesaler-remove"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(118px,100%),1fr))] gap-2.5">
        <Field label={tx("Commander avant", "Order before")}>
          <PillSelect
            icon={Clock}
            label={tx("Heure limite de commande", "Order cutoff time")}
            testId="wholesaler-cutoff"
            value={w.cutoff ?? NO_CUTOFF}
            options={cutoffOptions}
            onChange={(v) =>
              onChange(
                v === NO_CUTOFF
                  ? { ...w, cutoff: null, after: w.before }
                  : { ...w, cutoff: v, after: w.cutoff === null ? Math.min(w.before + 1, MAX_LEAD_DAYS) : w.after }
              )
            }
          />
        </Field>

        <Field label={tx("Avant, livré", "Before, arrives")}>
          <PillSelect
            icon={Truck}
            label={tx("Livraison si commandé avant l'heure limite", "Delivery when ordered before the cutoff")}
            testId="wholesaler-before"
            value={w.before}
            options={leads(0)}
            onChange={(v) => onChange({ ...w, before: v, after: w.cutoff === null ? v : Math.max(w.after, v) })}
          />
        </Field>

        {w.cutoff !== null && (
          <Field label={tx("Après, livré", "After, arrives")}>
            <PillSelect
              icon={Truck}
              label={tx("Livraison si commandé après l'heure limite", "Delivery when ordered after the cutoff")}
              testId="wholesaler-after"
              value={w.after}
              options={leads(w.before)}
              onChange={(v) => onChange({ ...w, after: v })}
            />
          </Field>
        )}
      </div>

      <div className="mt-3.5">
        <Field label={tx("Livre le", "Delivers on")}>
          <div className="flex flex-wrap gap-1.5">
            {w.days.map((on, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                aria-label={weekdayName(i, lang, "long")}
                data-testid={`wholesaler-day-${i}`}
                onClick={() => setDay(i)}
                className={cn(
                  "flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {weekdayName(i, lang, "narrow")}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  )
}

/* ---------------------------- the test panel ----------------------------- */

const DANGER = "#ff8a8a"

function Cell({ red, children }: { red: boolean; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-[38px] items-center justify-center rounded-xl",
        red ? "bg-[#ff5a5a]/15" : "bg-white/[0.07]"
      )}
    >
      {children}
    </div>
  )
}

function TestPanel({
  list,
  today,
  orderAt,
  onOrderAt,
  stockDays,
  onStockDays,
}: {
  list: Wholesaler[]
  today: Moment
  orderAt: Moment
  onOrderAt: (minutes: number) => void
  stockDays: number
  onStockDays: (n: number) => void
}) {
  const tx = useTx()
  const lang = tx("fr", "en")
  const readings = useMemo(() => readLadder(list, orderAt, stockDays), [list, orderAt, stockDays])
  const advice = useMemo(() => advise(readings), [readings])
  const name = (r: Reading) => r.wholesaler.name.trim() || tx(`Grossiste ${list.indexOf(r.wholesaler) + 1}`, `Wholesaler ${list.indexOf(r.wholesaler) + 1}`)
  const columns = Array.from({ length: LADDER_DAYS }, (_, i) => i)

  const arrivalText = (r: Reading) =>
    r.arrives === null
      ? tx("Ne livre aucun jour", "Never delivers")
      : r.inTime
        ? tx(`Livré ${when(r.arrives, today, lang, tx)}`, `Arrives ${when(r.arrives, today, lang, tx)}`)
        : tx(`Livré ${when(r.arrives, today, lang, tx)}, trop tard`, `Arrives ${when(r.arrives, today, lang, tx)}, too late`)

  let message: React.ReactNode = null
  let fallback: React.ReactNode = null
  let late = false

  if (advice.kind === "order") {
    const { pick, fallback: next } = advice
    const day = when(pick.arrives as number, today, lang, tx)
    const early = pick.wholesaler.cutoff !== null && pick.beforeCutoff && pick.arrives === pick.wholesaler.before
    const timing = early
      ? tx(`avant ${formatTime(pick.wholesaler.cutoff as number, lang)}`, `before ${formatTime(pick.wholesaler.cutoff as number, lang)}`)
      : tx("maintenant", "now")

    message = tx(
      `Commandez chez ${name(pick)} ${timing}. Livraison ${day}.`,
      `Order from ${name(pick)} ${timing}. It arrives ${day}.`
    )

    fallback = next ? (
      <>
        <b className="text-sidebar-foreground">{tx(`Si ${name(pick)} n'en a pas :`, `If ${name(pick)} has none:`)}</b>{" "}
        {next.arrives === null
          ? tx(`${name(next)} ne livre aucun jour.`, `${name(next)} never delivers.`)
          : next.inTime
            ? tx(
                `${name(next)} livre ${when(next.arrives, today, lang, tx)}, à temps.`,
                `${name(next)} arrives ${when(next.arrives, today, lang, tx)}, in time.`
              )
            : (
              <>
                {tx(
                  `${name(next)} livre ${when(next.arrives, today, lang, tx)}. Vous seriez en rupture `,
                  `${name(next)} arrives ${when(next.arrives, today, lang, tx)}. You would run out for `
                )}
                <b style={{ color: DANGER }}>{daysWord(next.gap, tx)}</b>.
              </>
            )}
      </>
    ) : (
      <>
        <b className="text-sidebar-foreground">{tx(`Si ${name(pick)} n'en a pas :`, `If ${name(pick)} has none:`)}</b>{" "}
        {tx("aucun autre grossiste dans la liste.", "no other wholesaler on the list.")}
      </>
    )
  } else if (advice.kind === "late") {
    late = true
    const f = advice.fastest
    message = f
      ? tx(
          `Aucun grossiste n'arrive à temps. ${name(f)} est le plus rapide : ${when(f.arrives as number, today, lang, tx)}.`,
          `No wholesaler arrives in time. ${name(f)} is the fastest: ${when(f.arrives as number, today, lang, tx)}.`
        )
      : tx("Aucun grossiste ne livre un jour que vous avez réglé.", "No wholesaler delivers on a day you set.")
    fallback = f ? (
      <>
        {tx("Vous seriez en rupture ", "You would run out for ")}
        <b style={{ color: DANGER }}>{daysWord(f.gap, tx)}</b>.
      </>
    ) : null
  }

  return (
    <div
      data-testid="wholesaler-test"
      className="squircle rounded-[30px] bg-sidebar p-6 text-sidebar-foreground lg:sticky lg:top-3"
    >
      <div className="font-heading text-xl font-bold">{tx("Testez votre réglage", "Test your setup")}</div>
      <div className="mt-0.5 text-[12.5px] text-sidebar-foreground/60">
        {tx("Changez les deux chiffres. Voyez qui arrive à temps.", "Change the two numbers. See who arrives in time.")}
      </div>

      <div className="mt-[18px] flex flex-wrap gap-2.5">
        <div className="min-w-[140px] flex-1 rounded-[20px] bg-white/[0.08] px-3.5 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-sidebar-foreground/55">
            {tx("Le stock tient", "Stock lasts")}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              aria-label={tx("Un jour de moins", "One day less")}
              data-testid="test-stock-less"
              disabled={stockDays <= 1}
              onClick={() => onStockDays(stockDays - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.12] transition-colors hover:bg-white/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <b className="text-[17px]" data-testid="test-stock-days">
              {daysWord(stockDays, tx)}
            </b>
            <button
              type="button"
              aria-label={tx("Un jour de plus", "One day more")}
              data-testid="test-stock-more"
              disabled={stockDays >= 14}
              onClick={() => onStockDays(stockDays + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.12] transition-colors hover:bg-white/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <label className="min-w-[140px] flex-1 rounded-[20px] bg-white/[0.08] px-3.5 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-sidebar-foreground/55">
            {tx("Je commande à", "I order at")}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Clock className="h-[15px] w-[15px] text-sidebar-foreground/70" aria-hidden="true" />
            <input
              type="time"
              value={toHHMM(orderAt.minutes)}
              data-testid="test-order-at"
              aria-label={tx("Heure de la commande", "Time of the order")}
              onChange={(e) => {
                const m = fromHHMM(e.target.value)
                if (m !== null) onOrderAt(m)
              }}
              style={{ colorScheme: "dark" }}
              className="min-w-0 bg-transparent text-[17px] font-bold text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-white"
            />
          </div>
        </label>
      </div>

      {list.length === 0 ? (
        <p className="mt-6 rounded-[22px] bg-white/[0.08] px-[18px] py-4 text-[13px] leading-relaxed text-sidebar-foreground/80">
          {tx("Ajoutez un grossiste pour voir qui arrive à temps.", "Add a wholesaler to see who arrives in time.")}
        </p>
      ) : (
        <>
          <div className="mt-[22px]">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-sidebar-foreground/60">
              {columns.map((c) => (
                <div key={c}>
                  {c === 0 ? tx("Auj.", "Today") : weekdayName((today.weekday + c) % 7, lang, "short")}
                  <div className="text-[10px] font-semibold opacity-70">
                    {c === 0 ? weekdayName(today.weekday, lang, "short") : " "}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-0.5 grid grid-cols-7 gap-1" aria-hidden="true">
              <div
                style={{ gridColumn: `${stockDays + 2} / 8` }}
                className={cn(
                  "text-center text-[10px] font-extrabold uppercase tracking-[0.06em]",
                  stockDays + 1 >= LADDER_DAYS && "hidden"
                )}
              >
                <span style={{ color: DANGER }}>▸ {tx("Rupture à partir d'ici", "Out of stock from here")}</span>
              </div>
            </div>

            {readings.map((r) => (
              <div key={r.wholesaler.id} className="mt-3" data-testid="test-track">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[12.5px] font-bold">{name(r)}</span>
                  <span
                    data-testid="test-arrival"
                    className="shrink-0 text-[11.5px] font-bold"
                    style={{ color: r.inTime ? "#c6f432" : DANGER }}
                  >
                    {arrivalText(r)}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {columns.map((c) => (
                    <Cell key={c} red={c > stockDays}>
                      {r.arrives === c && (
                        <span
                          data-testid={r.inTime ? "test-dot-ok" : "test-dot-late"}
                          className={cn(
                            "flex h-[26px] w-[26px] items-center justify-center rounded-full text-[#141414]",
                            r.inTime ? "bg-[#c6f432]" : "bg-[#ff6b6b]"
                          )}
                        >
                          {r.inTime ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
                        </span>
                      )}
                    </Cell>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            data-testid="test-advice"
            className={cn(
              "mt-[22px] rounded-[22px] px-[18px] py-4",
              late ? "bg-[#ff6b6b]/20 text-sidebar-foreground" : "bg-brand text-[#141414]"
            )}
          >
            <div className={cn("text-[10px] font-extrabold uppercase tracking-[0.1em]", late ? "text-sidebar-foreground/65" : "opacity-65")}>
              {tx("Ce que SentrIA vous dit", "What SentrIA tells you")}
            </div>
            <div className="mt-1 text-base font-extrabold leading-snug">{message}</div>
          </div>

          {fallback && (
            <div
              data-testid="test-fallback"
              className="mt-2.5 rounded-[22px] bg-white/[0.08] px-[18px] py-3.5 text-[13px] leading-normal text-sidebar-foreground/85"
            >
              {fallback}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* --------------------------------- the page -------------------------------- */

export function WholesalersView() {
  const tx = useTx()
  const [list, setList] = useState<Wholesaler[]>([])
  const [loaded, setLoaded] = useState(false)
  const [today, setToday] = useState<Moment>({ weekday: 0, minutes: 0 })
  const [orderMinutes, setOrderMinutes] = useState<number | null>(null)
  const [stockDays, setStockDays] = useState(2)
  const [removing, setRemoving] = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const names = useRef(new Map<string, HTMLInputElement>())
  const focusNew = useRef<string | null>(null)

  useEffect(() => {
    setList(readWholesalers())
    const now = nowOnAccountClock()
    setToday(now)
    setOrderMinutes(now.minutes)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (focusNew.current) {
      names.current.get(focusNew.current)?.focus()
      focusNew.current = null
    }
  }, [list])

  const commit = (next: Wholesaler[]) => {
    setList(next)
    writeWholesalers(next)
  }

  const add = () => {
    if (list.length >= MAX_WHOLESALERS) return
    const w = newWholesaler()
    focusNew.current = w.id
    commit([...list, w])
  }

  const orderAt: Moment = { weekday: today.weekday, minutes: orderMinutes ?? today.minutes }
  const full = list.length >= MAX_WHOLESALERS

  return (
    <div className="space-y-6">
      <section
        data-testid="wholesalers-card"
        className="t-enter squircle rounded-[34px] border border-border bg-card p-6 text-card-foreground lg:p-[30px]"
        style={enterAt(0)}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
              {tx("Stock", "Stock")}
            </div>
            <h2 className="mt-1 font-heading text-[30px] font-bold leading-tight tracking-tight">
              {tx("Grossistes", "Wholesalers")}
            </h2>
            <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
              {tx(
                "Listez qui vous livre, le plus proche d'abord. Quand le premier n'a pas le produit, SentrIA regarde le suivant. Elle utilise vos chiffres et ne devine jamais le stock d'un grossiste.",
                "List who delivers to you, nearest first. When the first one has no stock, SentrIA looks at the next. It only uses your numbers and never guesses what a wholesaler has."
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={add}
            disabled={full}
            data-testid="wholesaler-add"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-[18px] py-[11px] text-[13.5px] font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {tx("Ajouter un grossiste", "Add a wholesaler")}
          </button>
        </div>

        <div className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] items-start gap-[22px]">
          <div className="flex flex-col gap-3">
            {loaded && list.length === 0 && (
              <div
                data-testid="wholesalers-empty"
                className="rounded-[26px] border border-dashed border-border px-6 py-10 text-center"
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Truck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="mt-3 font-heading text-lg font-bold">
                  {tx("Aucun grossiste pour l'instant", "No wholesaler yet")}
                </div>
                <p className="mx-auto mt-1 max-w-[320px] text-[13px] text-muted-foreground">
                  {tx(
                    "Ajoutez celui qui vous livre le plus vite. SentrIA s'en servira pour dire quand commander.",
                    "Add the one that delivers fastest. SentrIA will use it to tell you when to order."
                  )}
                </p>
              </div>
            )}

            {list.map((w, i) => (
              <div key={w.id} className={cn(dragOver === i && dragFrom !== null && dragFrom !== i && "rounded-[28px] ring-2 ring-brand ring-offset-2 ring-offset-card")}>
                <Row
                  w={w}
                  index={i}
                  count={list.length}
                  confirming={removing === w.id}
                  dragging={dragFrom === i}
                  nameRef={(el) => {
                    if (el) names.current.set(w.id, el)
                    else names.current.delete(w.id)
                  }}
                  onChange={(next) => commit(list.map((x) => (x.id === w.id ? next : x)))}
                  onMove={(to) => {
                    commit(moveItem(list, i, to))
                    // Keep the focus on the same handle after it moves.
                    requestAnimationFrame(() => document.getElementById(`wholesaler-handle-${w.id}`)?.focus())
                  }}
                  onAskRemove={(ask) => setRemoving(ask ? w.id : null)}
                  onRemove={() => {
                    setRemoving(null)
                    commit(list.filter((x) => x.id !== w.id))
                  }}
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={() => setDragOver(i)}
                  onDrop={() => {
                    if (dragFrom !== null) commit(moveItem(list, dragFrom, i))
                    setDragFrom(null)
                    setDragOver(null)
                  }}
                  onDragEnd={() => {
                    setDragFrom(null)
                    setDragOver(null)
                  }}
                />
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-x-1 px-1.5 text-xs text-muted-foreground">
              {tx("Glissez", "Drag")}
              <GripVertical className="inline h-3.5 w-3.5" aria-hidden="true" />
              {tx(
                "pour changer l'ordre. Les changements sont enregistrés dès que vous quittez un champ.",
                "to change the order. Changes save when you leave a field."
              )}
              {full && (
                <span className="basis-full pt-1" data-testid="wholesaler-max">
                  {tx(`${MAX_WHOLESALERS} grossistes au maximum.`, `${MAX_WHOLESALERS} wholesalers at most.`)}
                </span>
              )}
            </div>
          </div>

          <TestPanel
            list={list}
            today={today}
            orderAt={orderAt}
            onOrderAt={setOrderMinutes}
            stockDays={stockDays}
            onStockDays={setStockDays}
          />
        </div>
      </section>
    </div>
  )
}
