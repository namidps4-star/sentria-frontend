"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useTx, type Tx } from "@/lib/i18n"
import { Check, ClipboardCheck, FileDown, RotateCcw, Upload, X } from "@/lib/icons"
import { formatAmount } from "@/lib/locale"
import {
  FLAGS,
  FLAG_HINT,
  FLAG_LABEL,
  buildCsv,
  checkReceiving,
  checkedCount,
  raiseReceivingAlerts,
  readSaved,
  valueLeft,
  writeSaved,
  type Flag,
  type Item,
  tableOf,
  type Saved,
  type Ticks,
  type Worklist,
} from "@/lib/receiving"
import { useCanSeeAmounts } from "@/lib/use-plan"
import { cn } from "@/lib/utils"
import { StatusTag, type TagTone } from "./status-tag"

/* The goods-receiving check (PH-RECEIVE). The pharmacy sends the file from its
 * own stock system and sees only the rows to look at against the box. One
 * list, three ways to look at it: columns by problem (the default), a table,
 * or one row at a time. What staff have looked at is kept in the browser (see
 * lib/receiving.ts); the API saves nothing. */

const TONE: Record<Flag, TagTone> = { nodate: "danger", unclear: "warning", conflict: "info", expired: "danger" }

const VIEW_KEY = "sentria_receiving_view"
type Mode = "board" | "grid" | "focus"
const MODES: Mode[] = ["board", "grid", "focus"]

/* In "one by one", the worst problem first. */
const FOCUS_ORDER: Flag[] = ["expired", "conflict", "unclear", "nodate"]

const label = (flag: Flag, tx: Tx) => tx(FLAG_LABEL[flag].fr, FLAG_LABEL[flag].en)

/** What is wrong, in a few words, from the fields the API sent. */
function why(item: Item, tx: Tx): string {
  const lot = !item.batch || item.batch === "?"
  const noDate = !item.expiry

  switch (item.flag) {
    case "expired":
      return item.daysExpired !== null
        ? tx(`Périmé depuis ${item.daysExpired} jours (${item.expiry})`, `Expired ${item.daysExpired} days ago (${item.expiry})`)
        : tx(`Périmé (${item.expiry})`, `Expired (${item.expiry})`)
    case "conflict":
      return tx(`Le fichier donne ${(item.dates ?? []).join(" et ")}`, `The file gives ${(item.dates ?? []).join(" and ")}`)
    case "unclear":
      return tx(`${item.expiry} : jour ou mois ?`, `${item.expiry}: day or month?`)
    default:
      if (lot && noDate) return tx("Ni lot ni date de péremption dans le fichier", "No lot number and no expiry date in the file")
      return lot ? tx("Pas de numéro de lot dans le fichier", "No lot number in the file") : tx("Pas de date de péremption dans le fichier", "No expiry date in the file")
  }
}

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/

/** The date read on the box, typed once and ticked with the row. Optional. */
function DateField({ item, onDone, className }: { item: Item; onDone: (date?: string) => void; className?: string }) {
  const tx = useTx()
  const [value, setValue] = useState("")
  const bad = value !== "" && !DATE_OK.test(value)
  const id = `date-${item.id.replace(/[^a-z0-9]/gi, "")}`

  return (
    <div className={cn("flex flex-col items-stretch gap-2", className)}>
      {item.flag !== "expired" && (
        <>
          <label htmlFor={id} className="sr-only">
            {tx("Date sur la boîte (AAAA-MM-JJ)", "Date on the box (YYYY-MM-DD)")}
          </label>
          <input
            id={id}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={tx("Date boîte, AAAA-MM-JJ", "Box date, YYYY-MM-DD")}
            aria-invalid={bad}
            data-testid="receiving-date"
            className={cn(
              "h-9 w-full min-w-0 rounded-xl border bg-background px-2.5 text-[11px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
              bad ? "border-destructive" : "border-border"
            )}
          />
        </>
      )}
      <button
        type="button"
        data-testid="receiving-done"
        disabled={bad}
        onClick={() => onDone(value && !bad ? value : undefined)}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-bold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
      >
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {item.flag === "expired" ? tx("Mis de côté, fait", "Set aside, done") : value && !bad ? tx("Enregistrer et cocher", "Save and tick") : tx("Fait", "Done")}
      </button>
    </div>
  )
}

function Money({ item, className }: { item: Item; className?: string }) {
  const tx = useTx()
  const canSee = useCanSeeAmounts()

  if (!canSee || item.value === null || !item.currency) return null

  return <span className={cn("tabular-nums font-semibold", className)}>{formatAmount(item.value, item.currency, tx)}</span>
}

/* --------------------------------- board --------------------------------- */

/** The problem in a few words, for the badge on a card. */
function shortWhy(item: Item, tx: Tx): string {
  const lot = !item.batch || item.batch === "?"

  switch (item.flag) {
    case "expired":
      return item.daysExpired !== null ? tx(`Périmé depuis ${item.daysExpired} jours`, `Expired ${item.daysExpired} days ago`) : tx("Périmé", "Expired")
    case "conflict":
      return tx("Deux dates dans le fichier", "Two dates in file")
    case "unclear":
      return tx("Jour ou mois ?", "Day or month?")
    default:
      if (lot && !item.expiry) return tx("Ni lot ni date", "No lot, no date")
      return lot ? tx("Pas de numéro de lot", "No lot number") : tx("Pas de date de péremption", "No expiry date")
  }
}

const BADGE: Record<Flag, string> = {
  nodate: "bg-[var(--tag-critical-bg)] text-[var(--tag-critical-fg)]",
  expired: "bg-[var(--tag-critical-bg)] text-[var(--tag-critical-fg)]",
  unclear: "bg-[var(--tag-watch-bg)] text-[var(--tag-watch-fg)]",
  conflict: "bg-[var(--tag-info-bg)] text-[var(--tag-info-fg)]",
}

function Fact({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border py-1.5 text-xs">
      <dt className="text-muted-foreground">{name}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  )
}

/* One card, in the Stripe style: the product, a badge for the problem, then
 * Lot / Expiry / At stake as hairline rows, the amount under a lime marker.
 * The first card of each column is open (the advice and where to type the
 * good value); the others open on a tap. */
function BoardCard({ item, ticks, onTick, onUntick, defaultOpen }: { item: Item; ticks: Ticks; onTick: (id: string, date?: string) => void; onUntick: (id: string) => void; defaultOpen: boolean }) {
  const tx = useTx()
  const canSee = useCanSeeAmounts()
  const tick = ticks[item.id]
  const [open, setOpen] = useState(defaultOpen)
  const hasLot = !!item.batch && item.batch !== "?"
  const showMoney = canSee && item.value !== null && !!item.currency
  const panelId = `card-${item.id.replace(/[^a-z0-9]/gi, "")}`

  return (
    <article
      data-testid="receiving-card"
      data-flag={item.flag}
      data-checked={tick ? "true" : "false"}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id)
        e.dataTransfer.effectAllowed = "move"
      }}
      className={cn("rounded-xl border border-border bg-card px-3.5 pb-2 pt-3 shadow-sm", tick && "opacity-70")}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h4 className="break-words text-sm font-semibold leading-snug">{item.product}</h4>
        <span className={cn("mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[11.5px] font-semibold", BADGE[item.flag])}>{shortWhy(item, tx)}</span>
      </button>
      <dl className="mt-2">
        <Fact name={tx("Lot", "Lot")}>
          <span className="font-mono">{hasLot ? item.batch : tx("aucun", "none")}</span>
        </Fact>
        <Fact name={tx("Péremption", "Expiry")}>
          {item.flag === "conflict" ? (
            (item.dates ?? []).map((d) => (
              <span key={d} className="block font-mono text-[11.5px]">
                {d}
              </span>
            ))
          ) : (
            <span className="font-mono text-[11.5px]">{item.expiry || tx("aucune date", "No date")}</span>
          )}
        </Fact>
        {showMoney && (
          <Fact name={tx("En jeu", "At stake")}>
            <Money item={item} className="bg-[linear-gradient(transparent_55%,var(--brand)_55%)] px-0.5 font-bold" />
          </Fact>
        )}
      </dl>
      <div id={panelId} className="pb-1">
        {tick ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{tick.date ? tx(`Date notée : ${tick.date}`, `Date noted: ${tick.date}`) : tx("Vérifié", "Checked")}</span>
            <button
              type="button"
              data-testid="receiving-undo"
              onClick={() => onUntick(item.id)}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              {tx("Annuler", "Undo")}
            </button>
          </div>
        ) : (
          open && (
            <>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.flag === "conflict" ? tx("Quelle date est sur la boîte ?", "Which date is on the box?") : item.action}</p>
              {item.flag === "conflict" ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(item.dates ?? []).map((d) => (
                    <button
                      key={d}
                      type="button"
                      data-testid="receiving-pick-date"
                      onClick={() => onTick(item.id, d)}
                      className="h-9 rounded-xl border border-border bg-card text-xs font-semibold tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {d.slice(5).replace("-", "/")}
                    </button>
                  ))}
                </div>
              ) : (
                <DateField item={item} onDone={(date) => onTick(item.id, date)} className="mt-2" />
              )}
            </>
          )
        )}
      </div>
    </article>
  )
}

function Board({ items, ticks, onTick, onUntick }: { items: Item[]; ticks: Ticks; onTick: (id: string, date?: string) => void; onUntick: (id: string) => void }) {
  const tx = useTx()
  const [over, setOver] = useState<string | null>(null)

  const column = (key: string, title: React.ReactNode, hint: string, list: Item[], onDropId: (id: string) => void, tint?: string) => (
    <section
      key={key}
      data-testid={`receiving-col-${key}`}
      aria-label={typeof title === "string" ? title : key}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(key)
      }}
      onDragLeave={() => setOver((o) => (o === key ? null : o))}
      onDrop={(e) => {
        e.preventDefault()
        setOver(null)
        const id = e.dataTransfer.getData("text/plain")
        if (id) onDropId(id)
      }}
      className={cn("flex min-w-0 flex-col gap-2.5 rounded-3xl p-3", tint ?? "bg-muted/60", over === key && "ring-2 ring-ring")}
    >
      <header className="flex items-center gap-2 px-1">
        {title}
        <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
      </header>
      <p className="px-1 text-xs leading-4 text-muted-foreground">{hint}</p>
      {list.map((item, n) => (
        <BoardCard key={item.id} item={item} ticks={ticks} onTick={onTick} onUntick={onUntick} defaultOpen={n === 0} />
      ))}
    </section>
  )

  const done = items.filter((i) => ticks[i.id])

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {FLAGS.map((flag) =>
        column(
          flag,
          <StatusTag tone={TONE[flag]} size="xs">
            {label(flag, tx)}
          </StatusTag>,
          tx(FLAG_HINT[flag].fr, FLAG_HINT[flag].en),
          items.filter((i) => i.flag === flag && !ticks[i.id]),
          (id) => onTick(id)
        )
      )}
      {column(
        "checked",
        <StatusTag tone="success" size="xs">
          {tx("Vérifiés", "Checked")}
        </StatusTag>,
        tx("Fait pour ce fichier. Glissez ici pour cocher.", "Done for this file. Drop a card here to tick it."),
        done,
        (id) => onTick(id),
        "bg-[var(--tag-success-bg)]/40"
      )}
    </div>
  )
}

/* ---------------------------------- grid --------------------------------- */

const PAGE = 50

/* The cell colours follow the problem, from the status tag tokens. */
const CELL: Record<Flag, string> = {
  nodate: "bg-[var(--tag-critical-bg)] text-[var(--tag-critical-fg)]",
  expired: "bg-[var(--tag-critical-bg)] text-[var(--tag-critical-fg)]",
  unclear: "bg-[var(--tag-watch-bg)] text-[var(--tag-watch-fg)]",
  conflict: "bg-[var(--tag-info-bg)] text-[var(--tag-info-fg)]",
}

function Grid({ list, ticks, onTick, onUntick }: { list: Worklist; ticks: Ticks; onTick: (id: string, date?: string) => void; onUntick: (id: string) => void }) {
  const tx = useTx()
  const { rows, whole } = useMemo(() => tableOf(list), [list])
  const [only, setOnly] = useState(!whole)
  const [page, setPage] = useState(0)
  const itemById = useMemo(() => new Map(list.items.map((i) => [i.id, i])), [list.items])

  const shown = useMemo(() => (only ? rows.filter((r) => r.flag) : rows), [only, rows])
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const at = Math.min(page, pages - 1)
  const slice = shown.slice(at * PAGE, at * PAGE + PAGE)

  const choose = (flaggedOnly: boolean) => {
    setOnly(flaggedOnly)
    setPage(0)
  }

  const seg = (on: boolean) => cn("h-8 rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")

  return (
    <div className="flex flex-col gap-3">
      {whole && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label={tx("Lignes affichées", "Rows shown")} className="flex rounded-full bg-muted p-1">
            <button type="button" data-testid="receiving-grid-all" aria-pressed={!only} onClick={() => choose(false)} className={seg(!only)}>
              {tx("Toutes les lignes", "All rows")} <span className="tabular-nums opacity-70">{rows.length}</span>
            </button>
            <button type="button" data-testid="receiving-grid-flagged" aria-pressed={only} onClick={() => choose(true)} className={seg(only)}>
              {tx("À vérifier seulement", "Flagged only")} <span className="tabular-nums opacity-70">{list.flagged}</span>
            </button>
          </div>
          {list.tableTruncated && !only && (
            <p data-testid="receiving-truncated" className="text-xs text-muted-foreground">
              {tx(
                `Toutes les lignes à vérifier, et les ${rows.length - list.flagged} premières lignes sans problème, sur ${list.clean}.`,
                `Every row to check, and the first ${rows.length - list.flagged} clean rows of ${list.clean}.`
              )}
            </p>
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full table-fixed border-collapse text-sm" data-testid="receiving-grid">
          <caption className="sr-only">{only ? tx("Lignes à vérifier", "Rows to check") : tx("Toutes les lignes du fichier", "Every row of the file")}</caption>
          <thead className="table-head">
            <tr className="text-left text-xs">
              <th scope="col" className="w-11 px-3 py-2.5">
                <span className="sr-only">{tx("Vérifié", "Checked")}</span>
              </th>
              <th scope="col" className="hidden w-14 px-2 py-2.5 md:table-cell">{tx("Ligne", "Line")}</th>
              <th scope="col" className="px-2 py-2.5">{tx("Produit", "Product")}</th>
              <th scope="col" className="hidden w-28 px-2 py-2.5 md:table-cell">{tx("Lot", "Lot")}</th>
              <th scope="col" className="hidden w-32 px-2 py-2.5 md:table-cell">{tx("Péremption", "Expiry")}</th>
              <th scope="col" className="hidden w-20 px-2 py-2.5 text-right lg:table-cell">{tx("Qté", "Qty")}</th>
              <th scope="col" className="hidden w-24 px-2 py-2.5 text-right lg:table-cell">{tx("Prix", "Cost")}</th>
              <th scope="col" className="w-32 px-2 py-2.5">{tx("Contrôle", "Check")}</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const tick = r.item ? ticks[r.item] : undefined
              const item = r.item ? itemById.get(r.item) : undefined
              const tone = r.flag ? CELL[r.flag] : ""

              return (
                <tr key={`${r.row}-${r.item ?? "ok"}`} data-testid="receiving-row" data-flag={r.flag ?? "clean"} data-checked={tick ? "true" : "false"} className={cn("border-t border-border align-top", tick && "text-muted-foreground")}>
                  <td className="px-3 py-2.5">
                    {r.item && (
                      <input
                        type="checkbox"
                        checked={!!tick}
                        onChange={(e) => (e.target.checked ? onTick(r.item as string) : onUntick(r.item as string))}
                        aria-label={tx(`Marquer ${r.product} comme vérifié`, `Mark ${r.product} as checked`)}
                        className="h-4 w-4 accent-foreground"
                      />
                    )}
                  </td>
                  <td className="hidden px-2 py-2.5 tabular-nums text-muted-foreground md:table-cell">{r.row}</td>
                  <td className="px-2 py-2.5">
                    <span className="block break-words font-semibold text-foreground">{r.product || "—"}</span>
                    <span className={cn("mt-0.5 block text-xs md:hidden", r.bad.includes("batch") && tone && `rounded px-1 ${tone}`)}>{r.batch ? `Lot ${r.batch}` : tx("Sans lot", "No lot")}</span>
                    <span className={cn("block text-xs md:hidden", r.bad.includes("expiry") && tone && `rounded px-1 ${tone}`)}>{r.expiry || tx("Sans date", "No date")}</span>
                  </td>
                  <td className={cn("hidden px-2 py-2.5 md:table-cell", r.bad.includes("batch") && tone)} data-bad={r.bad.includes("batch") ? "true" : undefined}>{r.batch || (r.bad.includes("batch") ? tx("vide", "empty") : "")}</td>
                  <td className={cn("hidden px-2 py-2.5 tabular-nums md:table-cell", r.bad.includes("expiry") && tone)} data-bad={r.bad.includes("expiry") ? "true" : undefined}>{r.expiry || (r.bad.includes("expiry") ? tx("vide", "empty") : "")}</td>
                  <td className="hidden px-2 py-2.5 text-right tabular-nums lg:table-cell">{r.quantity}</td>
                  <td className="hidden px-2 py-2.5 text-right tabular-nums lg:table-cell">{r.unitCost}</td>
                  <td className="px-2 py-2.5">
                    {r.flag ? (
                      <div className="flex flex-col items-start gap-1">
                        <StatusTag tone={TONE[r.flag]} size="xs">
                          {label(r.flag, tx)}
                        </StatusTag>
                        {item && <Money item={item} className="text-xs text-foreground" />}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{tx("Sans problème", "Clean")}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span data-testid="receiving-page-info" className="tabular-nums">
          {tx(`Lignes ${shown.length === 0 ? 0 : at * PAGE + 1} à ${at * PAGE + slice.length} sur ${shown.length}`, `Rows ${shown.length === 0 ? 0 : at * PAGE + 1} to ${at * PAGE + slice.length} of ${shown.length}`)}
        </span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" data-testid="receiving-prev" disabled={at === 0} onClick={() => setPage(at - 1)} className="h-8 rounded-full border border-border bg-card px-3.5 font-semibold text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {tx("Précédent", "Previous")}
            </button>
            <span className="tabular-nums">{tx(`Page ${at + 1} sur ${pages}`, `Page ${at + 1} of ${pages}`)}</span>
            <button type="button" data-testid="receiving-next" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} className="h-8 rounded-full border border-border bg-card px-3.5 font-semibold text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {tx("Suivant", "Next")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- one by one ------------------------------ */

function Focus({ items, ticks, onTick, onExport }: { items: Item[]; ticks: Ticks; onTick: (id: string, date?: string) => void; onExport: () => void }) {
  const tx = useTx()
  const queue = useMemo(
    () => [...items].filter((i) => !ticks[i.id]).sort((a, b) => FOCUS_ORDER.indexOf(a.flag) - FOCUS_ORDER.indexOf(b.flag) || a.row - b.row),
    [items, ticks]
  )
  const [skipped, setSkipped] = useState(0)
  const current = queue.length ? queue[skipped % queue.length] : null
  const next = queue.length > 1 ? queue[(skipped + 1) % queue.length] : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null

      if (!current || e.metaKey || e.ctrlKey || e.altKey || (el && /^(input|textarea|select)$/i.test(el.tagName))) return

      if (e.key.toLowerCase() === "e") onTick(current.id)
      if (e.key.toLowerCase() === "s") setSkipped((n) => n + 1)
    }

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [current, onTick])

  if (!current) {
    return (
      <div data-testid="receiving-all-done" className="rounded-3xl border border-border bg-card p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Check className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="mt-4 font-heading text-xl font-bold">{tx("Tout est vérifié", "Everything is checked")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{tx("Gardez la liste pour vos dossiers.", "Keep the list for your records.")}</p>
        <button type="button" onClick={onExport} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background">
          <FileDown className="h-4 w-4" aria-hidden="true" />
          {tx("Exporter la liste (CSV)", "Export the list (CSV)")}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-stretch gap-3">
      <article data-testid="receiving-focus" className="rounded-[28px] bg-sidebar-shell p-6 text-sidebar-foreground sm:p-8">
        <StatusTag tone={TONE[current.flag]} size="sm">
          {label(current.flag, tx)}
        </StatusTag>
        <h3 className="mt-4 break-words font-heading text-2xl font-bold tracking-tight sm:text-3xl">{current.product}</h3>
        <p className="mt-1 text-sm text-sidebar-foreground/70">
          {current.batch && current.batch !== "?" ? `Lot ${current.batch} · ` : ""}
          {why(current, tx)}
        </p>
        <p className="mt-5 border-t border-sidebar-foreground/15 pt-4 text-base leading-7">{current.action}</p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs text-sidebar-foreground/60">{tx("En jeu", "At stake")}</span>
            <div className="text-xl font-bold">
              <Money item={current} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSkipped((n) => n + 1)}
              disabled={queue.length < 2}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-sidebar-foreground/30 px-5 text-sm font-semibold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Passer", "Skip")}
              <kbd className="rounded-md border border-sidebar-foreground/30 px-1.5 text-xs">S</kbd>
            </button>
            <button
              type="button"
              data-testid="receiving-focus-done"
              onClick={() => onTick(current.id)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-brand-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {current.flag === "expired" ? tx("Mis de côté, fait", "Set aside, done") : tx("Vérifié, fait", "Checked, done")}
              <kbd className="rounded-md border border-brand-foreground/30 px-1.5 text-xs">E</kbd>
            </button>
          </div>
        </div>
      </article>
      <p className="text-center text-xs text-muted-foreground">
        {next ? tx(`Suivant : ${next.product} · ${label(next.flag, tx).toLowerCase()}`, `Next: ${next.product} · ${label(next.flag, tx).toLowerCase()}`) : tx("C'est le dernier.", "This is the last one.")}
      </p>
    </div>
  )
}

/* -------------------------------- the screen ------------------------------ */

export function ReceivingView() {
  const tx = useTx()
  const [saved, setSaved] = useState<Saved | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("board")
  const input = useRef<HTMLInputElement>(null)
  // The file itself, only until the page is left: raising alerts sends it again.
  const [file, setFile] = useState<File | null>(null)
  const [raising, setRaising] = useState(false)

  useEffect(() => {
    setSaved(readSaved())
    try {
      const m = window.localStorage.getItem(VIEW_KEY) as Mode | null
      if (m && MODES.includes(m)) setMode(m)
    } catch {
      /* the default view */
    }
    setReady(true)
  }, [])

  const update = useCallback((next: Saved | null) => {
    setSaved(next)
    writeSaved(next)
  }, [])

  const tick = useCallback(
    (id: string, date?: string) => {
      setSaved((current) => {
        if (!current) return current
        const next = { ...current, ticks: { ...current.ticks, [id]: { at: Date.now(), ...(date ? { date } : {}) } } }
        writeSaved(next)
        return next
      })
    },
    []
  )

  const untick = useCallback((id: string) => {
    setSaved((current) => {
      if (!current) return current
      const { [id]: _removed, ...rest } = current.ticks
      void _removed
      const next = { ...current, ticks: rest }
      writeSaved(next)
      return next
    })
  }, [])

  const pick = (m: Mode) => {
    setMode(m)
    try {
      window.localStorage.setItem(VIEW_KEY, m)
    } catch {
      /* not kept */
    }
  }

  async function onFile(chosen: File | undefined) {
    if (!chosen) return
    setBusy(true)
    setError(null)

    const result = await checkReceiving(chosen, tx("fr", "en") as "fr" | "en")

    setBusy(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setFile(chosen)
    update({ name: chosen.name, at: Date.now(), list: result.list, ticks: {} })
  }

  async function raise() {
    if (!file || !saved) return
    setRaising(true)
    setError(null)

    const result = await raiseReceivingAlerts(file, tx("fr", "en") as "fr" | "en")

    setRaising(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    update({ ...saved, raised: result.fired })
  }

  const exportCsv = () => {
    if (!saved) return
    const blob = new Blob([buildCsv(saved.list.items, saved.ticks)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `receiving-check-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const upload = (
    <>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        data-testid="receiving-file"
        aria-label={tx("Choisir le fichier de réception (CSV)", "Choose the receiving file (CSV)")}
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </>
  )

  if (!ready) return null

  if (!saved) {
    return (
      <div className="mx-auto max-w-2xl" data-testid="receiving-empty">
        {upload}
        <div className="rounded-[28px] border border-dashed border-border bg-card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="mt-4 font-heading text-xl font-bold">{tx("Vérifiez une réception en quelques minutes", "Check a delivery in minutes")}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {tx(
              "Envoyez le fichier de votre logiciel de stock. SentrIA ne garde que les lignes à regarder : lot ou date manquants, date ambiguë, deux dates pour un lot, produit déjà périmé.",
              "Send the file from your stock system. SentrIA keeps only the rows to look at: a missing lot or date, an unclear date, two dates for one lot, a product already expired."
            )}
          </p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {busy ? tx("Lecture du fichier…", "Reading the file…") : tx("Choisir un fichier CSV", "Choose a CSV file")}
          </button>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {tx(
              "Colonnes lues : produit, lot, date de péremption, quantité, prix d'achat. Il faut au moins le produit et un lot ou une date. Le fichier est lu puis oublié.",
              "Columns read: product, lot, expiry date, quantity, purchase price. At least the product and a lot or a date. The file is read, then forgotten."
            )}
          </p>
          {error && (
            <p role="alert" data-testid="receiving-error" className="mt-4 rounded-xl bg-[var(--tag-critical-bg)] px-4 py-3 text-sm font-medium text-[var(--tag-critical-fg)]">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  const { list, ticks } = saved
  const done = checkedCount(list.items, ticks)
  const left = valueLeft(list.items, ticks)

  return (
    <div className="flex flex-col gap-4" data-testid="receiving">
      {upload}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{saved.name}</span>
            {" · "}
            {tx(`${list.rows} lignes lues, ${list.clean} sans problème`, `${list.rows} rows read, ${list.clean} clean`)}
            {" · "}
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className="underline underline-offset-4 hover:text-foreground">
              {busy ? tx("Lecture…", "Reading…") : tx("Remplacer le fichier", "Replace the file")}
            </button>
          </p>
          <div className="mt-2 flex items-center gap-3">
            <strong data-testid="receiving-progress" className="text-sm tabular-nums">
              {tx(`${done} sur ${list.flagged} vérifiés`, `${done} of ${list.flagged} checked`)}
            </strong>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={list.flagged} aria-valuenow={done}>
              <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${list.flagged ? (done / list.flagged) * 100 : 100}%` }} />
            </div>
            {left && <span className="text-xs text-muted-foreground">{tx("Reste à vérifier :", "Left to check:")} <span className="font-semibold tabular-nums text-foreground">{formatAmount(left.value, left.currency, tx)}</span></span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={tx("Affichage", "View")} className="flex rounded-full bg-muted p-1">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                data-testid={`receiving-mode-${m}`}
                aria-pressed={mode === m}
                onClick={() => pick(m)}
                className={cn("h-8 rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {m === "board" ? tx("Colonnes", "Board") : m === "grid" ? tx("Tableau", "Grid") : tx("Un par un", "One by one")}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="receiving-export"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            {tx("Exporter (CSV)", "Export (CSV)")}
          </button>
          <button
            type="button"
            onClick={() => update(null)}
            aria-label={tx("Fermer cette liste", "Close this list")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" data-testid="receiving-error" className="rounded-xl bg-[var(--tag-critical-bg)] px-4 py-3 text-sm font-medium text-[var(--tag-critical-fg)]">
          {error}
        </p>
      )}

      {list.flagged > 0 && saved.raised !== undefined && (
        <p data-testid="receiving-raised" className="flex items-center gap-2 rounded-2xl bg-[var(--tag-success-bg)] px-4 py-2.5 text-sm font-medium text-[var(--tag-success-fg)]">
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          {tx(`${saved.raised} alertes créées dans votre liste d'alertes.`, `${saved.raised} alerts created in your alert list.`)}
        </p>
      )}

      {list.flagged > 0 && saved.raised === undefined && file && (
        <div data-testid="receiving-raise" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <p className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">
            {tx(
              "Voulez-vous aussi une alerte par ligne dans votre liste d'alertes ? Les produits périmés peuvent envoyer un SMS à votre numéro.",
              "Want one alert per row in your alert list too? Expired products may text your phone."
            )}
          </p>
          <button
            type="button"
            data-testid="receiving-raise-button"
            onClick={() => void raise()}
            disabled={raising}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {raising ? tx("Création…", "Creating…") : tx(`Créer ${list.flagged} alertes`, `Create ${list.flagged} alerts`)}
          </button>
        </div>
      )}

      {list.flagged === 0 ? (
        <div data-testid="receiving-clean" className="rounded-3xl border border-border bg-card p-8 text-center">
          <h3 className="font-heading text-xl font-bold">{tx("Aucune ligne à vérifier", "No row to check")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tx(`Les ${list.rows} lignes ont un lot et une date lisibles.`, `All ${list.rows} rows have a lot and a readable date.`)}</p>
        </div>
      ) : mode === "board" ? (
        <Board items={list.items} ticks={ticks} onTick={tick} onUntick={untick} />
      ) : mode === "grid" ? (
        <Grid list={list} ticks={ticks} onTick={tick} onUntick={untick} />
      ) : (
        <Focus items={list.items} ticks={ticks} onTick={tick} onExport={exportCsv} />
      )}
    </div>
  )
}
