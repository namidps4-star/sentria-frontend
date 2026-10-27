"use client"

import { useEffect, useMemo, useState } from "react"

import { peopleOn, stageOf, swapsFrom, totalsOf, type Swap, type SwapAlert, type SwapStage } from "@/lib/branch-swaps"
import { readCompanyName } from "@/lib/company"
import { fetchAssignments, fetchContractors, saveAssignment, type Assignment, type Contractor } from "@/lib/crm"
import { fieldUrl, makeFieldLink } from "@/lib/field-link"
import { useTx, type Tx } from "@/lib/i18n"
import { ArrowRight, Check, Send } from "@/lib/icons"
import { formatAmount } from "@/lib/locale"
import { useCanSeeAmounts } from "@/lib/use-plan"
import { cn } from "@/lib/utils"
import { StatusTag } from "./status-tag"

/* Branch swaps (F-BRANCHSWAP): stock that will expire at this site and sells
 * at another. One row per swap, with where it stands: found, assigned to a
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

type LinkState = { kind: "making" } | { kind: "ready"; url: string; copied: boolean; days: number } | { kind: "error"; message: string }

export function BranchSwapsCard({ alerts }: { alerts: SwapAlert[] }) {
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

  return (
    <section data-testid="branch-swaps" className="squircle rounded-[28px] bg-card p-5 shadow-sm sm:p-6">
      <h2 className="font-heading text-xl font-semibold tracking-tight">{tx("Échanges entre pharmacies", "Branch swaps")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {tx("Du stock de ce site qui va expirer ici et se vend dans une autre pharmacie.", "Stock at this site that will expire here and sells at another branch.")}
      </p>

      <div data-testid="swaps-ticket" className="mt-4 flex flex-col gap-4 rounded-[22px] bg-[var(--ink)] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
            {showMoney ? tx(`En jeu · ${totals.count} échange${totals.count > 1 ? "s" : ""}`, `At stake · ${totals.count} swap${totals.count > 1 ? "s" : ""}`) : tx("À envoyer", "To send")}
          </p>
          <p className="mt-1 font-heading text-4xl font-bold leading-none text-brand">
            {showMoney ? formatAmount(totals.value ?? 0, symbol, tx) : totals.count}
          </p>
        </div>
        {known && (
          <div className="min-w-0 sm:w-64">
            <div className="flex h-2 overflow-hidden rounded-full bg-white/15" role="img" aria-label={tx(`${totals.takenShare} % pris en charge`, `${totals.takenShare}% taken`)}>
              <div className="h-full bg-brand" style={{ width: `${totals.takenShare}%` }} />
            </div>
            <p className="mt-2 flex justify-between text-[11px] font-bold uppercase tracking-[0.1em] text-white/55">
              <span>{tx("En attente", "Waiting")} {100 - totals.takenShare}%</span>
              <span>{tx("Pris", "Taken")} {totals.takenShare}%</span>
            </p>
          </div>
        )}
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

          return (
            <li key={swap.taskKey} data-testid="swap-row" data-stage={stage} className="py-4">
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
                <div className="flex items-center gap-3">
                  {canSeeAmounts && swap.value !== null && <p className="font-heading text-xl font-bold">{formatAmount(swap.value, swap.currency, tx)}</p>}
                  <StatusTag tone={tag.tone} size="sm">
                    {known ? tx(tag.fr, tag.en) : "…"}
                  </StatusTag>
                </div>
              </div>

              <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3" aria-label={tx("Où en est cet échange", "Where this swap stands")}>
                <Step done title={tx("Repéré", "Found")}>
                  {tx(`${swap.units} unités${until ? `, à envoyer avant le ${until}` : ""}`, `${swap.units} units${until ? `, send before ${until}` : ""}`)}
                </Step>
                <Step done={known && stage !== "waiting"} title={tx("Confié", "Assigned")}>
                  {names.length > 0 ? names.join(", ") : tx("Personne pour l'instant", "Nobody yet")}
                </Step>
                <Step done={stage === "taken" || stage === "done"} title={tx("Réponse", "Answered")}>
                  {stage === "done" ? tx("Fait", "Done") : stage === "taken" ? tx("« Je m'en occupe »", "\"I'll take it\"") : tx("En attente du responsable", "Waiting for the manager")}
                </Step>
              </ol>

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

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", done ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-border text-transparent")}
        aria-hidden="true"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <div className="min-w-0">
        <p className="font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}
