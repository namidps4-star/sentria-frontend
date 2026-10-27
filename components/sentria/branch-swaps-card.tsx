"use client"

import { useEffect, useMemo, useState } from "react"

import { peopleOn, stageOf, swapsFrom, totalsOf, type Swap, type SwapAlert, type SwapStage } from "@/lib/branch-swaps"
import { announceAlertsUpdated } from "@/lib/alerts-event"
import { readCompanyName } from "@/lib/company"
import { fetchAssignments, fetchContractors, saveAssignment, type Assignment, type Contractor } from "@/lib/crm"
import { fieldUrl, makeFieldLink } from "@/lib/field-link"
import { useTx, type Tx } from "@/lib/i18n"
import { ArrowRight, Check, Send, X } from "@/lib/icons"
import { formatAmount } from "@/lib/locale"
import { enterAt } from "@/lib/motion"
import { useCanSeeAmounts } from "@/lib/use-plan"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"
import { StatusTag } from "./status-tag"

/* Branch swaps (F-BRANCHSWAP), on the Dashboard: stock that will expire at this site and sells
 * at another. It opens in a sheet from the sidebar's "Branch swaps" row, which
 * shows only when this site has a swap (BranchSwapsSheet, below). One row per swap, with where it stands: found, assigned to a
 * person, answered. A swap is a task like any other: it is tracked under the
 * key the board and the calendar use, and the person answers from the same
 * field link ("I'll take it", "I can't"). The card is silent when this site
 * has no swap to send, and reads nothing from the server until it has one. */

const STAGE_TAG: Record<SwapStage, { tone: "neutral" | "info" | "success"; fr: string; en: string }> = {
  waiting: { tone: "neutral", fr: "En attente", en: "Waiting" },
  with: { tone: "neutral", fr: "Chez un responsable", en: "With a manager" },
  taken: { tone: "info", fr: "Pris en charge", en: "Taken" },
  done: { tone: "success", fr: "Fait", en: "Done" },
}

function dayLabel(iso: string | null, tx: Tx): string | null {
  if (!iso) return null

  const date = new Date(`${iso}T12:00:00`)

  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(tx("fr-FR", "en-GB"), { day: "numeric", month: "short" })
}

/* Price of one unit, worked out from the swap's value and its units: the alert
 * carries a total, never a unit price. A figure that does not divide evenly is
 * shown with a leading "≈" because formatAmount rounds to a whole number. */
function unitPrice(swap: Swap, tx: Tx): string | null {
  if (swap.value === null) return null

  const unit = swap.value / swap.units

  return `${Math.abs(unit - Math.round(unit)) < 0.005 ? "" : "≈ "}${formatAmount(unit, swap.currency, tx)}`
}

type LinkState = { kind: "making" } | { kind: "ready"; url: string; copied: boolean; days: number } | { kind: "error"; message: string }

export function BranchSwapsCard({ alerts, embedded = false }: { alerts: SwapAlert[]; embedded?: boolean }) {
  const tx = useTx()
  const canSeeAmounts = useCanSeeAmounts()
  const swaps = useMemo(() => swapsFrom(alerts), [alerts])
  const hasSwaps = swaps.length > 0

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  /* False until both reads answered: a row never says "waiting" for a swap
     whose task we simply have not read yet. */
  const [known, setKnown] = useState(false)
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [links, setLinks] = useState<Record<string, LinkState>>({})

  useEffect(() => {
    if (!hasSwaps) return

    let alive = true
    const company = readCompanyName()

    Promise.all([fetchAssignments(company), fetchContractors(company)]).then(([a, c]) => {
      if (!alive) return

      if (a.ok) setAssignments(a.data)
      if (c.ok) setContractors(c.data.filter((person) => person.active))
      setKnown(a.ok)
    })

    return () => {
      alive = false
    }
  }, [hasSwaps])

  const byKey = useMemo(() => new Map(assignments.map((a) => [a.task_key, a])), [assignments])
  const stages = useMemo(() => Object.fromEntries(swaps.map((s) => [s.taskKey, stageOf(byKey.get(s.taskKey))])) as Record<string, SwapStage>, [swaps, byKey])
  const totals = useMemo(() => totalsOf(swaps, stages), [swaps, stages])

  if (!hasSwaps) return null

  const lang = tx("fr", "en") === "en" ? "en" : "fr"
  const symbol = totals.currency
  const showMoney = canSeeAmounts && totals.value !== null

  async function send(swap: Swap, contractorId: string) {
    const current = byKey.get(swap.taskKey)
    const ids = current?.contractor_ids.includes(contractorId) ? current.contractor_ids : [...(current?.contractor_ids ?? []), contractorId]

    setLinks((l) => ({ ...l, [swap.taskKey]: { kind: "making" } }))

    const saved = await saveAssignment(readCompanyName(), {
      task_key: swap.taskKey,
      status: current?.status && current.status !== "dismissed" ? current.status : "todo",
      priority: current?.priority ?? "high",
      deadline: current?.deadline ?? swap.expiry,
      contractor_ids: ids,
    })

    if (!saved.ok) {
      setLinks((l) => ({ ...l, [swap.taskKey]: { kind: "error", message: tx("La tâche n'a pas pu être enregistrée. Réessayez.", "The task could not be saved. Try again.") } }))

      return
    }

    setAssignments((rows) => [...rows.filter((r) => r.task_key !== swap.taskKey), saved.data])
    announceAlertsUpdated()

    const made = await makeFieldLink(swap.taskKey, contractorId, lang)

    if (!made.ok) {
      setLinks((l) => ({
        ...l,
        [swap.taskKey]: {
          kind: "error",
          message:
            made.code === "field_link_unconfigured"
              ? tx("Les liens terrain ne sont pas encore activés sur le serveur.", "Field links are not switched on for the server yet.")
              : tx("Le lien n'a pas pu être créé. Réessayez.", "The link could not be made. Try again."),
        },
      }))

      return
    }

    const url = fieldUrl(made.token)
    let copied = false

    try {
      await navigator.clipboard.writeText(url)
      copied = true
    } catch {
      /* the address is shown below to copy by hand */
    }

    setLinks((l) => ({ ...l, [swap.taskKey]: { kind: "ready", url, copied, days: Math.max(1, Math.round((made.expires_at * 1000 - Date.now()) / 86400000)) } }))
  }

  const answered = (stage: SwapStage) => stage === "taken" || stage === "done"
  /* The soonest day a swap that still needs sending must leave by. */
  const sendBefore = swaps
    .filter((s) => known && (stages[s.taskKey] === "waiting" || stages[s.taskKey] === "with") && s.expiry)
    .map((s) => s.expiry as string)
    .sort()[0]
  const sendBeforeLabel = dayLabel(sendBefore ?? null, tx)
  const figure = showMoney ? formatAmount(totals.value ?? 0, "", tx) : String(totals.count)

  return (
    <section
      data-testid="branch-swaps"
      className={embedded ? "p-3 sm:p-4" : "t-enter squircle rounded-[28px] bg-card p-5 shadow-sm sm:p-6"}
      style={embedded ? undefined : enterAt(1)}
    >
      <h2 id="branch-swaps-title" className="font-heading text-xl font-semibold tracking-tight">{tx("Échanges entre pharmacies", "Branch swaps")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {tx("Du stock de ce site qui va expirer ici et se vend dans une autre pharmacie.", "Stock at this site that will expire here and sells at another branch.")}
      </p>

      <div className="mt-4 [filter:drop-shadow(0_8px_12px_rgb(0_0_0/0.12))]">
        <div data-testid="swaps-ticket" className="swap-ticket squircle grid rounded-t-[22px] bg-[var(--ink)] text-white sm:grid-cols-[17rem_1fr]">
          <div className="relative border-b border-dashed border-white/25 px-5 pb-6 pt-5 sm:border-b-0 sm:border-r">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              {showMoney ? tx(`En jeu · ${totals.count} échange${totals.count > 1 ? "s" : ""}`, `At stake · ${totals.count} swap${totals.count > 1 ? "s" : ""}`) : tx("À envoyer", "To send")}
            </p>
            <p className="mt-3 flex items-baseline font-heading font-semibold leading-none tracking-tight text-brand">
              <span className="text-5xl tabular-nums">{figure}</span>
              {showMoney && symbol && <span className="ml-2 text-base text-white/80">{symbol}</span>}
            </p>
            {sendBeforeLabel && (
              <p className="mt-3 text-[13px] text-white/60">
                {tx("À envoyer avant le ", "Send before ")}
                <b className="font-bold text-white">{sendBeforeLabel}</b>
              </p>
            )}
            <span className="absolute -bottom-[11px] -left-2.5 h-5 w-5 rounded-full bg-card sm:hidden" aria-hidden="true" />
            <span className="absolute -bottom-[11px] -right-2.5 h-5 w-5 rounded-full bg-card sm:hidden" aria-hidden="true" />
            <span className="absolute -right-[11px] -top-2.5 hidden h-5 w-5 rounded-full bg-card sm:block" aria-hidden="true" />
            <span className="absolute -bottom-1 -right-[11px] hidden h-5 w-5 rounded-full bg-card sm:block" aria-hidden="true" />
          </div>

          <div className="px-5 pb-6 pt-5">
            <ul className="grid gap-x-8 gap-y-5 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
              {swaps.map((swap) => {
                const lit = known && answered(stages[swap.taskKey])
                const priced = canSeeAmounts && swap.value !== null
                const unit = priced ? unitPrice(swap, tx) : null

                return (
                  <li key={swap.taskKey} data-testid="ticket-line" className="min-w-0">
                    <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", lit ? "bg-brand" : "bg-white/45")} aria-hidden="true" />
                      <span className="truncate">{swap.product}</span>
                    </p>
                    <p className="mt-1.5 font-heading text-2xl font-semibold leading-none tabular-nums">
                      {priced ? formatAmount(swap.value ?? 0, swap.currency, tx) : tx(`${swap.units} unités`, `${swap.units} units`)}
                    </p>
                    {priced && (
                      <p className="mt-1.5 font-mono text-[11.5px] text-white/55">
                        {swap.units} × {unit}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>

            {known && (
              <div className="mt-5">
                <div className="flex h-2 gap-[3px]" role="img" aria-label={tx(`${totals.takenShare} % pris en charge`, `${totals.takenShare}% taken`)}>
                  {totals.takenShare < 100 && <div className="h-full rounded-full bg-white/35" style={{ width: `${100 - totals.takenShare}%` }} />}
                  {totals.takenShare > 0 && <div className="h-full rounded-full bg-brand" style={{ width: `${totals.takenShare}%` }} />}
                </div>
                <p className="mt-2 flex justify-between font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-white/55">
                  <span>
                    {tx("En attente", "Waiting")} {100 - totals.takenShare}%
                  </span>
                  <span>
                    {tx("Pris", "Taken")} {totals.takenShare}%
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-2 divide-y divide-border">
        {swaps.map((swap) => {
          const assignment = byKey.get(swap.taskKey)
          const stage = stages[swap.taskKey]
          const names = peopleOn(assignment, contractors)
          const link = links[swap.taskKey]
          const tag = STAGE_TAG[stage]
          const until = dayLabel(swap.expiry, tx)
          const chosen = picked[swap.taskKey] ?? contractors[0]?.id ?? ""
          const firstPerson = assignment?.contractor_ids[0]
          const needsLink = known && (stage === "waiting" || stage === "with")
          const priced = canSeeAmounts && swap.value !== null
          const assigned = known && stage !== "waiting"
          const replied = stage === "taken" || stage === "done"
          const current = !known ? -1 : replied ? 3 : assigned ? 2 : 1

          return (
            <li key={swap.taskKey} data-testid="swap-row" data-stage={stage} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <p className="font-heading text-lg font-semibold leading-tight">{swap.product}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    <span>{swap.fromSite}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{swap.toSite}</span>
                    {swap.days !== null && <span>{tx(`· expire dans ${swap.days} j`, `· expires in ${swap.days} d`)}</span>}
                  </p>
                </div>
                <StatusTag tone={tag.tone} size="sm">
                  {known ? tx(tag.fr, tag.en) : "…"}
                </StatusTag>
              </div>

              <div className={cn("mt-4 grid gap-5", priced && "lg:grid-cols-[1fr_13rem]")}>
                <ol className="flex flex-col text-sm sm:grid sm:grid-cols-3 sm:gap-4" aria-label={tx("Où en est cet échange", "Where this swap stands")}>
                  <Step done title={tx("Repéré", "Found")} joined={assigned}>
                    {tx(`${swap.units} unités${until ? `, à envoyer avant le ${until}` : ""}`, `${swap.units} units${until ? `, send before ${until}` : ""}`)}
                  </Step>
                  <Step done={assigned} current={current === 2} title={tx("Confié", "Assigned")} joined={replied}>
                    {names.length > 0 ? names.join(", ") : tx("Personne pour l'instant", "Nobody yet")}
                  </Step>
                  <Step done={replied} current={current === 3} last title={tx("Réponse", "Answered")}>
                    {stage === "done" ? tx("Fait", "Done") : stage === "taken" ? tx("« Je m'en occupe »", "\"I'll take it\"") : tx("En attente du responsable", "Waiting for the manager")}
                  </Step>
                </ol>

                {priced && (
                  <div data-testid="swap-price" className="grid grid-cols-[auto_auto] content-start justify-between gap-x-4 gap-y-1 text-sm lg:justify-end">
                    <span className="text-muted-foreground">{tx("Prix unitaire", "Unit price")}</span>
                    <span className="text-right font-semibold tabular-nums">{unitPrice(swap, tx)}</span>
                    <span className="text-muted-foreground">{tx("Unités", "Units")}</span>
                    <span className="text-right font-semibold tabular-nums">× {swap.units}</span>
                    <span className="col-span-2 mt-1 border-t border-border" aria-hidden="true" />
                    <span className="col-span-2 text-right font-heading text-2xl font-semibold tabular-nums">{formatAmount(swap.value ?? 0, swap.currency, tx)}</span>
                  </div>
                )}
              </div>

              {needsLink && (
                <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
                  {stage === "waiting" && contractors.length > 0 && (
                    <select
                      value={chosen}
                      onChange={(e) => setPicked((p) => ({ ...p, [swap.taskKey]: e.target.value }))}
                      aria-label={tx(`Responsable pour ${swap.product}`, `Manager for ${swap.product}`)}
                      data-testid="swap-person"
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {contractors.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {stage === "waiting" && contractors.length === 0 && (
                    <span className="text-xs text-muted-foreground">{tx("Ajoutez d'abord un responsable dans Prestataires.", "Add a manager in Contractors first.")}</span>
                  )}
                  {(stage === "with" || contractors.length > 0) && (
                    <button
                      type="button"
                      data-testid="swap-send"
                      disabled={link?.kind === "making" || (stage === "waiting" && !chosen)}
                      onClick={() => void send(swap, stage === "with" && firstPerson ? firstPerson : chosen)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-bold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      {link?.kind === "making" ? tx("Création…", "Making…") : stage === "with" ? tx("Copier le lien à nouveau", "Copy the link again") : tx("Envoyer le lien", "Send link")}
                    </button>
                  )}
                  {link?.kind === "ready" && (
                    <span role="status" data-testid="swap-link-ready" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {link.copied ? tx("Lien copié", "Link copied") : tx("Copiez ce lien :", "Copy this link:")}
                      {!link.copied && <input readOnly value={link.url} aria-label={tx("Lien terrain", "Field link")} onFocus={(e) => e.currentTarget.select()} className="w-44 rounded-lg border border-border bg-card px-2 py-1 text-xs" />}
                      {tx(` · valable ${link.days} j`, ` · valid ${link.days} d`)}
                    </span>
                  )}
                  {link?.kind === "error" && (
                    <span role="status" data-testid="swap-link-error" className="text-xs text-muted-foreground">
                      {link.message}
                    </span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** One step of a swap. On a phone the steps stack with a rail down the side;
 *  from sm up they sit in a row with a line to the next. `joined` fills the
 *  line after this step, `current` rings the step that is next to happen. */
function Step({
  done,
  current = false,
  last = false,
  joined = false,
  title,
  children,
}: {
  done: boolean
  current?: boolean
  last?: boolean
  joined?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3 sm:block">
      <div className="flex flex-col items-center sm:flex-row">
        <span
          className={cn(
            "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2",
            done ? "border-foreground bg-foreground text-background" : current ? "border-foreground bg-card text-transparent" : "border-border bg-card text-transparent"
          )}
          aria-hidden="true"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        {!last && <span className={cn("my-1 w-0.5 flex-1 sm:mx-2 sm:my-0 sm:h-0.5 sm:w-auto", joined ? "bg-foreground" : "bg-border")} aria-hidden="true" />}
      </div>
      <div className="min-w-0 pb-4 sm:mt-2 sm:pb-0">
        <p className="font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}

/** The card in a sheet, opened from the sidebar (the shell owns `open`). Reads
 *  nothing from the server until it is open. Escape, the close button or a
 *  click outside closes it. */
/* Swaps other branches send to this one (F-SWAPIN): read only. The receiver
 * sees what is coming, by when it must sell, and the value where the plan
 * shows amounts; the sending branch does the work. */
function IncomingSwaps({ swaps }: { swaps: Swap[] }) {
  const tx = useTx()
  const canSeeAmounts = useCanSeeAmounts()

  if (swaps.length === 0) return null

  return (
    <section data-testid="incoming-swaps" className="squircle mb-3 rounded-[24px] bg-muted/60 p-4 sm:p-5">
      <h3 className="font-heading text-base font-semibold">{tx("Arrive dans cette agence", "Coming into this branch")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {tx("Les autres agences les envoient. Rien à faire ici : l'agence qui les envoie s'en occupe.", "Other branches send these. Nothing to do here: the sending branch handles them.")}
      </p>

      <ul className="mt-3 divide-y divide-border">
        {swaps.map((swap) => (
          <li key={swap.taskKey} data-testid="incoming-line" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="font-semibold">{swap.product}</span>{" "}
              <span className="text-muted-foreground">{tx(`de ${swap.fromSite}`, `from ${swap.fromSite}`)}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">
              {tx(`${swap.units} unités`, `${swap.units} units`)}
              {canSeeAmounts && swap.value !== null && ` · ${formatAmount(swap.value, swap.currency, tx)}`}
              {swap.expiry && ` · ${tx("avant le", "before")} ${dayLabel(swap.expiry, tx)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function BranchSwapsSheet({ open, alerts, incoming, onClose }: { open: boolean; alerts: SwapAlert[]; incoming: SwapAlert[]; onClose: () => void }) {
  const tx = useTx()
  const sheet = usePresence(open, "--modal-close-dur")

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!sheet.present) return null

  return (
    <div
      className={cn("fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 t-modal-backdrop", sheet.className)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-swaps-title"
        data-testid="swaps-sheet"
        style={{ borderRadius: 32 }}
        className={cn(
          "relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden squircle rounded-[32px] border border-border bg-card p-2 shadow-2xl t-modal",
          sheet.className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          data-testid="swaps-close"
          aria-label={tx("Fermer", "Close")}
          autoFocus
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <IncomingSwaps swaps={swapsFrom(incoming)} />
        <BranchSwapsCard alerts={alerts} embedded />
      </div>
    </div>
  )
}
