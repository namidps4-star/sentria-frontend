"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Loader2,
  Sparkles,
  Trash2,
} from "@/lib/icons"

import { hueOf } from "@/lib/branch-board"
import {
  AVAILABILITY_LABEL,
  applyHandover,
  crmErrorText,
  deactivateContractor,
  fetchHandover,
  type AssignmentPriority,
  type Availability,
  type Contractor,
  type Handover,
  type HandoverResult,
  type HandoverTask,
} from "@/lib/crm"
import { resolve, type Localized, type Tx } from "@/lib/i18n"
import { addSmsDrafts, type SmsDraft } from "@/lib/sms-drafts"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"
import { StatusTag, type TagTone } from "./status-tag"

/* --------------------------------------------------------------------------
 * Removing a contractor who still holds open tasks (F-CDELETE).
 *
 * The trash button opens this. On the left: who is leaving, how many open
 * tasks they hold, and what happens once it is confirmed. On the right: each
 * task, with a person to take it over. "Suggest" asks the API's ranking (same
 * role, free, lightest load, no clash of deadlines) and fills every task;
 * "Choose myself" leaves them empty. Nothing happens until the person confirms.
 *
 * After the hand-over, a timeline shows who took what and what is left with
 * nobody. The drafted texts stay on the Contractors page (lib/sms-drafts.ts),
 * because texting is not live yet.
 * -------------------------------------------------------------------------- */

/** A task the person chose to leave with nobody. */
const NONE = "__none__"

const PRIORITY_TONE: Record<AssignmentPriority, TagTone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
}

/** One person who takes tasks over, and the tasks they take. */
type Receiver = { id: string; name: string; tasks: HandoverTask[] }

type Done = {
  result: HandoverResult
  drafts: SmsDraft[]
  receivers: Receiver[]
  left: HandoverTask[]
}

function norm(value: string | null | undefined): string {
  return (value ?? "").split(/\s+/).filter(Boolean).join(" ").toLowerCase()
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("")
}

/** The people who take tasks over, each with their tasks, in the order first chosen. */
function receiversOf(
  tasks: HandoverTask[],
  picks: Record<string, string>,
  byId: Map<string, Contractor>
): Receiver[] {
  const groups = new Map<string, Receiver>()

  for (const task of tasks) {
    const pick = picks[task.task_key]

    if (!pick || pick === NONE) continue

    const group = groups.get(pick) ?? {
      id: pick,
      name: byId.get(pick)?.name ?? pick,
      tasks: [],
    }

    group.tasks.push(task)
    groups.set(pick, group)
  }

  return [...groups.values()]
}

export function HandoverDialog({
  contractor,
  open,
  people,
  tx,
  onClose,
  onChanged,
}: {
  contractor: Contractor | null
  open: boolean
  /** The active contractors, the one leaving included. */
  people: Contractor[]
  /** The page's own translator. A fresh useTx() here would start in French
   *  for one render, ask the API for French and then ask again in English. */
  tx: Tx
  onClose: () => void
  /** Someone was removed: reload the list. */
  onChanged: () => void
}) {
  const dialog = usePresence(open, "--modal-close-dur")

  if (!dialog.present || !contractor) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 t-modal-backdrop",
        dialog.className
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <HandoverBody
        key={contractor.id}
        contractor={contractor}
        people={people}
        tx={tx}
        className={dialog.className}
        onClose={onClose}
        onChanged={onChanged}
      />
    </div>
  )
}

type Load =
  | { state: "loading" }
  | { state: "error"; text: string }
  | { state: "ready"; plan: Handover }

function HandoverBody({
  contractor,
  people,
  tx,
  className,
  onClose,
  onChanged,
}: {
  contractor: Contractor
  people: Contractor[]
  tx: Tx
  className: string
  onClose: () => void
  onChanged: () => void
}) {
  const lang = tx("fr", "en") as "fr" | "en"
  const px = (text: Localized | undefined) => resolve(text, tx)

  const [load, setLoad] = useState<Load>({ state: "loading" })
  const [attempt, setAttempt] = useState(0)
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<"suggested" | "manual" | null>(null)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  const savingRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    fetchHandover(contractor.id, lang).then((result) => {
      if (cancelled) return

      if (result.ok) {
        setLoad({ state: "ready", plan: result.data })
        setPicks({})
        setMode(null)
      } else {
        setLoad({ state: "error", text: px(result.detail) })
      }
    })

    return () => {
      cancelled = true
    }
    // px is rebuilt every render; the request depends on these only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractor.id, attempt, lang])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !savingRef.current) onClose()
    }

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function reload() {
    setLoad({ state: "loading" })
    setProblem(null)
    setAttempt((value) => value + 1)
  }

  const others = people.filter((person) => person.id !== contractor.id)
  const byId = new Map(people.map((person) => [person.id, person]))

  const plan = load.state === "ready" ? load.plan : null
  const tasks = plan?.tasks ?? []
  const decided = tasks.filter((task) => picks[task.task_key]).length
  const allDecided = tasks.length > 0 && decided === tasks.length
  const receivers = receiversOf(tasks, picks, byId)
  const nobodyCount = tasks.filter((task) => picks[task.task_key] === NONE).length

  /* What the person will read once they confirm, from the choices so far. */
  const after: string[] = []

  if (plan && tasks.length > 0) {
    if (!allDecided) {
      after.push(tx("Choisissez qui reprend chaque tâche pour voir le résultat.", "Choose who takes each task to see the result."))
    }

    for (const receiver of receivers) {
      const n = receiver.tasks.length

      after.push(
        tx(
          `${receiver.name} reprend ${n} tâche${n > 1 ? "s" : ""}.`,
          `${receiver.name} takes over ${n} task${n > 1 ? "s" : ""}.`
        )
      )
    }

    if (nobodyCount > 0) {
      after.push(
        tx(
          `${nobodyCount} tâche${nobodyCount > 1 ? "s" : ""} resteront sans personne.`,
          `${nobodyCount} task${nobodyCount > 1 ? "s" : ""} will be left with nobody.`
        )
      )
    }

    if (receivers.length > 0) {
      after.push(
        tx(
          "Un texte sera préparé pour chacune. L'envoi SMS n'est pas encore actif.",
          "A text will be drafted for each. SMS sending is not live yet."
        )
      )
    }
  }

  function suggestAll() {
    if (!plan) return

    const next: Record<string, string> = {}

    for (const task of plan.tasks) next[task.task_key] = task.suggested ?? NONE

    setPicks(next)
    setMode("suggested")
  }

  function chooseMyself() {
    setPicks({})
    setMode("manual")
  }

  function describe(task: HandoverTask): string {
    return task.equipment || task.task_key
  }

  function problemText(code: string, detail: Localized): string {
    switch (code) {
      case "handover_target_invalid":
        return tx(
          "Cette personne ne peut plus reprendre de tâche. Choisissez quelqu'un d'autre.",
          "That person can no longer take tasks over. Pick someone else."
        )
      case "task_not_open_for_contractor":
      case "contractor_has_open_tasks":
        return tx(
          "Les tâches ont changé pendant que vous choisissiez. Vérifiez la liste puis réessayez.",
          "The tasks changed while you were choosing. Check the list and try again."
        )
      case "contractor_not_found":
        return tx(
          "Cette personne n'est plus dans la liste.",
          "This person is no longer in the list."
        )
      default:
        return crmErrorText(detail, tx)
    }
  }

  async function confirm() {
    if (!plan || saving) return

    savingRef.current = true
    setSaving(true)
    setProblem(null)

    // No open task: the plain removal, as before.
    if (plan.tasks.length === 0) {
      const removed = await deactivateContractor(contractor.id)

      savingRef.current = false
      setSaving(false)

      if (!removed.ok) {
        if (removed.code === "contractor_has_open_tasks") {
          reload()
          setProblem(problemText(removed.code, removed.detail))
        } else {
          setProblem(problemText(removed.code, removed.detail))
        }
        return
      }

      onChanged()
      onClose()
      return
    }

    const moves = plan.tasks.map((task) => {
      const pick = picks[task.task_key]

      return {
        task_key: task.task_key,
        contractor_ids: pick && pick !== NONE ? [pick] : [],
      }
    })

    const result = await applyHandover(contractor.id, moves, lang)

    savingRef.current = false
    setSaving(false)

    if (!result.ok) {
      const text = problemText(result.code, result.detail)

      if (
        result.code === "task_not_open_for_contractor" ||
        result.code === "contractor_has_open_tasks"
      ) {
        reload()
        setProblem(text)
      } else if (result.code === "contractor_not_found") {
        setProblem(text)
        onChanged()
      } else if (result.code === "handover_target_invalid") {
        setProblem(text)
      } else {
        // The tasks move one at a time, so a failure can leave some moved.
        // Running it again finishes the job.
        setProblem(
          `${text} ${tx(
            "Certaines tâches ont peut-être déjà changé de main. Réessayez pour terminer.",
            "Some tasks may already have moved. Try again to finish."
          )}`
        )
      }

      return
    }

    const drafts: SmsDraft[] = result.data.drafts.map((draft) => ({
      id: `${Date.now().toString(36)}-${draft.contractor_id}`,
      createdAt: new Date().toISOString(),
      contractorId: draft.contractor_id,
      name: draft.name,
      phone: draft.phone,
      smsReady: draft.sms_ready,
      from: contractor.name,
      body: draft.body,
    }))

    addSmsDrafts(drafts)

    // Tasks left with nobody: what the API says this run left, plus what
    // was chosen here (a retry only reports the tasks it still had to move).
    const left = new Set(result.data.unassigned)

    for (const task of plan.tasks) {
      if (picks[task.task_key] === NONE && task.co_holders.length === 0) {
        left.add(task.task_key)
      }
    }

    setDone({
      result: result.data,
      drafts,
      receivers: receiversOf(plan.tasks, picks, byId),
      left: plan.tasks.filter((task) => left.has(task.task_key)),
    })

    onChanged()
  }

  const title = done
    ? tx(`${contractor.name} a été retiré`, `${contractor.name} was removed`)
    : tx(`Retirer ${contractor.name} ?`, `Remove ${contractor.name}?`)

  const roleLine = [
    contractor.role,
    px(AVAILABILITY_LABEL[contractor.availability]),
  ]
    .filter(Boolean)
    .join(" · ")

  if (done) {
    const { result, drafts } = done
    const n = drafts.length

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="handover-title"
        data-handover=""
        className={cn(
          "squircle w-full max-w-[600px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[30px] border border-border bg-card p-6 text-card-foreground shadow-2xl t-modal [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-7",
          className
        )}
      >
        <div data-handover-done="">
          <h3 id="handover-title" className="font-heading text-[22px] font-bold leading-tight">
            {title}
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            {result.handed_over > 0
              ? tx(
                  `${result.handed_over} tâche${result.handed_over > 1 ? "s ont" : " a"} changé de main.`,
                  `${result.handed_over} task${result.handed_over > 1 ? "s" : ""} handed over.`
                )
              : tx("Aucune tâche n'a changé de main.", "No task was handed over.")}
          </p>

          <ol className="mt-6">
            <li
              className="relative grid grid-cols-[32px_1fr] gap-x-3.5 pb-4"
              style={{ "--c": "var(--muted)" } as CSSProperties}
            >
              <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-8 w-0.5 bg-[var(--c)]" />
              <span
                aria-hidden="true"
                className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--c)] text-[11px] font-bold text-card"
              >
                {initialsOf(contractor.name)}
              </span>
              <div className="min-w-0 pt-1.5">
                <p className="font-heading text-[15px] font-semibold text-muted-foreground line-through decoration-1">
                  {contractor.name}
                </p>
                <div className="mt-1">
                  <StatusTag tone="neutral" size="xs" icon={false}>
                    {tx("Retiré", "Removed")}
                  </StatusTag>
                </div>
              </div>
            </li>

            {done.receivers.map((receiver, index) => (
              <li
                key={receiver.id}
                className="relative grid grid-cols-[32px_1fr] gap-x-3.5 pb-4"
                style={{ "--c": `var(--branch-${hueOf(index)})` } as CSSProperties}
              >
                <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-8 w-0.5 bg-[var(--c)]" />
                <span
                  aria-hidden="true"
                  className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--c)] text-[11px] font-bold text-[#141414]"
                >
                  {initialsOf(receiver.name)}
                </span>
                <div className="min-w-0 pt-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="font-heading text-[15px] font-bold">{receiver.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {tx(
                        `${receiver.tasks.length} tâche${receiver.tasks.length > 1 ? "s" : ""}`,
                        `${receiver.tasks.length} task${receiver.tasks.length > 1 ? "s" : ""}`
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {receiver.tasks.map((task) => (
                      <StatusTag key={task.task_key} tone={PRIORITY_TONE[task.priority] ?? "neutral"} size="xs" icon={false}>
                        {describe(task)}
                      </StatusTag>
                    ))}
                  </div>
                </div>
              </li>
            ))}

            {done.left.length > 0 && (
              <li
                data-handover-left=""
                className="relative grid grid-cols-[32px_1fr] gap-x-3.5"
                style={{ "--c": "var(--warning)" } as CSSProperties}
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-dashed border-[var(--c)] text-[var(--c)]"
                >
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="font-heading text-[15px] font-bold">
                    {tx("Personne pour l'instant", "No one for now")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {done.left.map((task) => (
                      <StatusTag key={task.task_key} tone="neutral" size="xs" icon={false}>
                        {describe(task)}
                      </StatusTag>
                    ))}
                  </div>
                </div>
              </li>
            )}
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {n > 0 && (
              <StatusTag tone="success" size="xs" icon={false}>
                {tx(`${n} texte${n > 1 ? "s" : ""} prêt${n > 1 ? "s" : ""}`, `${n} text${n > 1 ? "s" : ""} ready`)}
              </StatusTag>
            )}
            <span>
              {tx(
                "L'envoi SMS n'est pas encore actif. Les textes sont sur la page Intervenants.",
                "SMS sending is not live yet. The texts are on the Contractors page."
              )}
            </span>
          </div>

          <button
            type="button"
            autoFocus
            onClick={onClose}
            data-handover-close=""
            className="h-10 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tx("Terminé", "Done")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="handover-title"
      data-handover=""
      className={cn(
        "squircle w-full max-w-[760px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[30px] border border-border bg-card text-card-foreground shadow-2xl t-modal [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <div className="flex flex-col md:flex-row">
        <aside className="flex flex-col gap-5 bg-sidebar-shell p-6 text-sidebar-foreground md:w-[260px] md:shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/65">
            {tx("Retirer de l'équipe", "Remove from the team")}
          </p>

          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand font-heading text-base font-bold text-brand-foreground"
            >
              {initialsOf(contractor.name)}
            </span>
            <div className="min-w-0">
              <h3 id="handover-title" className="truncate font-heading text-xl font-bold leading-tight">
                {contractor.name}
              </h3>
              <p className="mt-0.5 truncate text-xs text-sidebar-foreground/65">{roleLine}</p>
            </div>
          </div>

          <div className="hidden md:block">
            <p className="font-heading text-4xl font-bold leading-none tabular-nums text-brand">
              {plan ? tasks.length : "–"}
            </p>
            <p className="mt-1.5 text-xs text-sidebar-foreground/75">
              {tx("tâches ouvertes à reprendre", "open tasks to hand over")}
            </p>
          </div>

          {plan && (
            <div className="hidden border-t border-sidebar-foreground/15 pt-4 md:block">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/65">
                {tx("Après la confirmation", "After you confirm")}
              </p>
              <ul className="mt-2.5 space-y-2 text-sm leading-snug">
                {tasks.length === 0 ? (
                  <li>
                    {tx(
                      "Cette personne quitte la liste. Ses tâches passées gardent son nom.",
                      "They leave the list. Their past tasks keep their name."
                    )}
                  </li>
                ) : (
                  after.map((line) => <li key={line}>{line}</li>)
                )}
              </ul>
            </div>
          )}

          {plan && (
            <div className="mt-auto grid gap-2">
              <button
                type="button"
                onClick={confirm}
                disabled={saving || (tasks.length > 0 && !allDecided)}
                data-handover-confirm=""
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : tasks.length > 0 ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {tasks.length > 0
                  ? tx("Confirmer et retirer", "Confirm and remove")
                  : tx("Retirer", "Remove")}
              </button>

              <button
                type="button"
                autoFocus
                onClick={onClose}
                disabled={saving}
                data-handover-cancel=""
                className="h-10 rounded-full text-sm font-semibold text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              >
                {tx("Annuler", "Cancel")}
              </button>
            </div>
          )}

          {load.state === "error" && (
            <button
              type="button"
              autoFocus
              onClick={onClose}
              data-handover-cancel=""
              className="mt-auto h-10 rounded-full text-sm font-semibold text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Annuler", "Cancel")}
            </button>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          {load.state === "loading" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {tx("Je regarde ses tâches en cours…", "Checking their open tasks…")}
            </p>
          )}

          {load.state === "error" && (
            <div className="space-y-4">
              <p
                role="alert"
                className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-xs leading-5"
              >
                <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  {tx("Impossible de lire ses tâches.", "Their tasks could not be read.")}
                </span>{" "}
                {load.text}
              </p>

              <p className="text-xs leading-5 text-muted-foreground">
                {tx(
                  "Rien n'a été retiré. Réessayez dans un instant.",
                  "Nothing was removed. Try again in a moment."
                )}
              </p>

              <button
                type="button"
                onClick={reload}
                className="h-10 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tx("Réessayer", "Try again")}
              </button>
            </div>
          )}

          {plan && tasks.length === 0 && (
            <p className="text-sm leading-6 text-muted-foreground">
              {tx(
                "Aucune tâche ouverte. Cette personne quitte la liste.",
                "No open task. They leave the list."
              )}
            </p>
          )}

          {plan && tasks.length > 0 && (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                {tx(
                  "Choisissez qui reprend chacune, puis retirez la personne. Rien ne change avant la confirmation.",
                  "Choose who takes each one over, then remove them. Nothing changes until you confirm."
                )}
              </p>

              <div role="group" aria-label={tx("Comment remplir la liste", "How to fill in the list")} className="flex w-full rounded-full bg-muted p-1 sm:inline-flex sm:w-auto sm:self-start">
                <button
                  type="button"
                  onClick={suggestAll}
                  aria-pressed={mode === "suggested"}
                  data-handover-suggest=""
                  className={cn(
                    "inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none sm:px-4",
                    mode === "suggested" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {tx("Proposer une répartition", "Suggest a handover")}
                </button>

                <button
                  type="button"
                  onClick={chooseMyself}
                  aria-pressed={mode === "manual"}
                  data-handover-manual=""
                  className={cn(
                    "h-9 flex-1 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none sm:px-4",
                    mode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tx("Choisir moi-même", "Choose myself")}
                </button>
              </div>

              <ul className="divide-y divide-border border-y border-border">
                {tasks.map((task) => {
                  const pick = picks[task.task_key] ?? ""
                  const eligible = others.filter((person) => !task.co_holders.includes(person.id))
                  const person = pick && pick !== NONE ? byId.get(pick) : undefined
                  const ranked = person ? task.candidates.find((candidate) => candidate.id === person.id) : undefined

                  const roleMatch = person
                    ? ranked
                      ? ranked.role_match
                      : !!norm(person.role) && norm(person.role) === norm(contractor.role)
                    : false
                  const availability: Availability | null = person ? (ranked?.availability ?? person.availability) : null
                  const open = person ? (ranked?.open ?? person.open_assignments) : 0
                  const clashes = ranked?.conflicts ?? 0
                  const selectId = `handover-${task.task_key}`

                  const facts: string[] = []

                  if (person && availability) {
                    if (pick === task.suggested) facts.push(tx("Suggéré", "Suggested"))
                    if (roleMatch) facts.push(tx("Même fonction", "Same role"))
                    facts.push(px(AVAILABILITY_LABEL[availability]))
                    facts.push(
                      open === 0
                        ? tx("Rien en cours", "Nothing open")
                        : tx(`${open} tâche${open > 1 ? "s" : ""} en cours`, `${open} open task${open > 1 ? "s" : ""}`)
                    )
                    if (clashes > 0) {
                      facts.push(
                        tx(
                          `Échéance proche de ${clashes} autre${clashes > 1 ? "s" : ""}`,
                          `Due near ${clashes} other${clashes > 1 ? "s" : ""}`
                        )
                      )
                    }
                  }

                  return (
                    <li
                      key={task.task_key}
                      data-handover-task={task.task_key}
                      className="grid gap-3 py-4 sm:grid-cols-[1fr_16rem] sm:items-start"
                    >
                      <div className="min-w-0">
                        <p className="font-heading text-[15px] font-bold leading-snug">{describe(task)}</p>

                        {task.message && (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.message}</p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <StatusTag tone={PRIORITY_TONE[task.priority] ?? "neutral"} size="xs" icon={false}>
                            <span data-handover-priority="">{priorityLabel(task.priority, tx)}</span>
                          </StatusTag>

                          <StatusTag tone="neutral" size="xs" icon={CalendarDays}>
                            <span data-handover-deadline="">{deadlineLabel(task.deadline, tx)}</span>
                          </StatusTag>
                        </div>

                        {task.co_holders.length > 0 && (
                          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                            {tx("Aussi sur cette tâche : ", "Also on this task: ")}
                            {task.co_holders
                              .map((id) => byId.get(id)?.name)
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}

                        {facts.length > 0 && (
                          <p data-handover-facts="" className="mt-2 text-xs leading-5 text-muted-foreground">
                            {facts.join(" · ")}
                          </p>
                        )}

                        {pick === NONE && task.co_holders.length === 0 && (
                          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                            {tx("Cette tâche restera sans personne.", "This task will be left with nobody.")}
                          </p>
                        )}
                      </div>

                      <label htmlFor={selectId} className="block">
                        <span className="sr-only">{tx("Reprise par", "Taken over by")}</span>

                        <select
                          id={selectId}
                          value={pick}
                          onChange={(event) =>
                            setPicks((current) => ({
                              ...current,
                              [task.task_key]: event.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-ring"
                        >
                          <option value="" disabled>
                            {tx("Choisir…", "Choose…")}
                          </option>

                          {eligible.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name}
                              {candidate.role ? ` · ${candidate.role}` : ""}
                              {candidate.availability === "off" ? ` (${px(AVAILABILITY_LABEL.off)})` : ""}
                            </option>
                          ))}

                          <option value={NONE}>{tx("Personne pour l'instant", "No one for now")}</option>
                        </select>
                      </label>
                    </li>
                  )
                })}
              </ul>

              <p data-handover-count="" className="text-xs text-muted-foreground">
                {tx(`${decided} sur ${tasks.length} choisies`, `${decided} of ${tasks.length} chosen`)}
              </p>
            </>
          )}

          {problem && (
            <p
              role="alert"
              data-handover-problem=""
              className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-xs leading-5 text-destructive"
            >
              {problem}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function priorityLabel(priority: AssignmentPriority, tx: Tx): string {
  switch (priority) {
    case "critical":
      return tx("Critique", "Critical")
    case "high":
      return tx("Haute", "High")
    case "low":
      return tx("Basse", "Low")
    default:
      return tx("Moyenne", "Medium")
  }
}

/** A calendar day as the reader writes it. Parsed by hand: `new Date("2026-10-10")`
 *  is midnight UTC, which reads as the day before west of Greenwich. */
function deadlineLabel(deadline: string | null, tx: Tx): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(deadline ?? "")

  if (!match) return tx("Sans échéance", "No deadline")

  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  return tx(
    `Échéance ${day.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`,
    `Due ${day.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
  )
}
