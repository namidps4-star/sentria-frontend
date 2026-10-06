"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Loader2,
  Sparkles,
  Trash2,
} from "@/lib/icons"

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
import { SmsDraftRow } from "./sms-drafts-card"
import { StatusTag, type TagTone } from "./status-tag"

/* --------------------------------------------------------------------------
 * Removing a contractor who still holds open tasks (F-CDELETE).
 *
 * The trash button used to remove someone on the spot and leave their tasks
 * pointing at nobody. Now it opens this: every open task they hold, with its
 * priority and deadline, and a person to take each one over. Two ways to fill
 * it in. "Suggest" asks the API's ranking (same role, free, lightest load, no
 * clash of deadlines) and pre-fills each task; "Choose myself" leaves them
 * empty. Either way each task can be edited, and nothing happens until the
 * person confirms. Then each person who gained a task gets a drafted text,
 * kept (lib/sms-drafts.ts) because texting is not live yet.
 * -------------------------------------------------------------------------- */

/** A task the person chose to leave with nobody. */
const NONE = "__none__"

const PRIORITY_TONE: Record<AssignmentPriority, TagTone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
}

function norm(value: string | null | undefined): string {
  return (value ?? "").split(/\s+/).filter(Boolean).join(" ").toLowerCase()
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
  const [done, setDone] = useState<{
    result: HandoverResult
    drafts: SmsDraft[]
    left: string[]
  } | null>(null)

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
      left: plan.tasks.filter((task) => left.has(task.task_key)).map(describe),
    })

    onChanged()
  }

  const title = done
    ? tx(`${contractor.name} a été retiré`, `${contractor.name} was removed`)
    : plan && plan.tasks.length > 0
      ? tx(
          `${contractor.name} a ${plan.tasks.length} tâche${plan.tasks.length > 1 ? "s" : ""} ouverte${plan.tasks.length > 1 ? "s" : ""}`,
          `${contractor.name} has ${plan.tasks.length} open task${plan.tasks.length > 1 ? "s" : ""}`
        )
      : tx(`Retirer ${contractor.name} ?`, `Remove ${contractor.name}?`)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="handover-title"
      data-handover=""
      className={cn(
        "max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl t-modal sm:p-6",
        className
      )}
    >
      <h3 id="handover-title" className="font-heading text-lg font-bold text-foreground">
        {title}
      </h3>

      {load.state === "loading" && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {tx("Je regarde ses tâches en cours…", "Checking their open tasks…")}
        </p>
      )}

      {load.state === "error" && (
        <div className="mt-4 space-y-4">
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
        </div>
      )}

      {plan && !done && plan.tasks.length === 0 && (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {tx(
            "Aucune tâche ouverte. Cette personne quitte la liste. Ses tâches passées gardent son nom.",
            "No open task. They leave the list. Their past tasks keep their name."
          )}
        </p>
      )}

      {plan && !done && plan.tasks.length > 0 && (
        <>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {tx(
              "Choisissez qui reprend chacune, puis retirez la personne. Rien ne change avant la confirmation.",
              "Choose who takes each one over, then remove them. Nothing changes until you confirm."
            )}
          </p>

          <div
            role="group"
            aria-label={tx("Comment remplir la liste", "How to fill in the list")}
            className="mt-4 flex flex-wrap gap-2"
          >
            <button
              type="button"
              onClick={suggestAll}
              aria-pressed={mode === "suggested"}
              data-handover-suggest=""
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === "suggested"
                  ? "bg-brand text-[#141414]"
                  : "border border-border text-foreground hover:bg-muted"
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
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === "manual"
                  ? "bg-brand text-[#141414]"
                  : "border border-border text-foreground hover:bg-muted"
              )}
            >
              {tx("Choisir moi-même", "Choose myself")}
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {plan.tasks.map((task) => {
              const pick = picks[task.task_key] ?? ""
              const eligible = others.filter(
                (person) => !task.co_holders.includes(person.id)
              )
              const person = pick && pick !== NONE ? byId.get(pick) : undefined
              const ranked = person
                ? task.candidates.find((candidate) => candidate.id === person.id)
                : undefined

              const roleMatch = person
                ? ranked
                  ? ranked.role_match
                  : !!norm(person.role) && norm(person.role) === norm(contractor.role)
                : false
              const availability: Availability | null = person
                ? (ranked?.availability ?? person.availability)
                : null
              const open = person
                ? (ranked?.open ?? person.open_assignments)
                : 0
              const clashes = ranked?.conflicts ?? 0
              const selectId = `handover-${task.task_key}`

              return (
                <li
                  key={task.task_key}
                  data-handover-task={task.task_key}
                  className="rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading text-sm font-bold">{describe(task)}</p>

                      {task.message && (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {task.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <StatusTag tone={PRIORITY_TONE[task.priority] ?? "neutral"} size="xs">
                        <span data-handover-priority="">{priorityLabel(task.priority, tx)}</span>
                      </StatusTag>

                      <StatusTag tone="neutral" size="xs" icon={CalendarDays}>
                        <span data-handover-deadline="">{deadlineLabel(task.deadline, tx)}</span>
                      </StatusTag>
                    </div>
                  </div>

                  <label htmlFor={selectId} className="mt-3 block">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {tx("Reprise par", "Taken over by")}
                    </span>

                    <select
                      id={selectId}
                      value={pick}
                      onChange={(event) =>
                        setPicks((current) => ({
                          ...current,
                          [task.task_key]: event.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none transition-colors focus:border-ring"
                    >
                      <option value="" disabled>
                        {tx("Choisir…", "Choose…")}
                      </option>

                      {eligible.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                          {candidate.role ? ` · ${candidate.role}` : ""}
                          {candidate.availability === "off"
                            ? ` (${px(AVAILABILITY_LABEL.off)})`
                            : ""}
                        </option>
                      ))}

                      <option value={NONE}>
                        {tx("Personne pour l'instant", "No one for now")}
                      </option>
                    </select>
                  </label>

                  {task.co_holders.length > 0 && (
                    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                      {tx("Aussi sur cette tâche : ", "Also on this task: ")}
                      {task.co_holders
                        .map((id) => byId.get(id)?.name)
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}

                  {person && availability && (
                    <div data-handover-facts="" className="mt-2 flex flex-wrap gap-1.5">
                      {pick === task.suggested && (
                        <StatusTag tone="brand" size="xs" icon={Sparkles}>
                          {tx("Suggéré", "Suggested")}
                        </StatusTag>
                      )}

                      {roleMatch && (
                        <StatusTag tone="success" size="xs" icon={false}>
                          {tx("Même fonction", "Same role")}
                        </StatusTag>
                      )}

                      <StatusTag
                        tone={availability === "available" ? "success" : availability === "busy" ? "warning" : "neutral"}
                        size="xs"
                        icon={false}
                      >
                        {px(AVAILABILITY_LABEL[availability])}
                      </StatusTag>

                      <StatusTag tone="neutral" size="xs" icon={false}>
                        {open === 0
                          ? tx("Rien en cours", "Nothing open")
                          : tx(
                              `${open} tâche${open > 1 ? "s" : ""} en cours`,
                              `${open} open task${open > 1 ? "s" : ""}`
                            )}
                      </StatusTag>

                      {clashes > 0 && (
                        <StatusTag tone="warning" size="xs" icon={AlertTriangle}>
                          {tx(
                            `Échéance proche de ${clashes} autre${clashes > 1 ? "s" : ""}`,
                            `Due near ${clashes} other${clashes > 1 ? "s" : ""}`
                          )}
                        </StatusTag>
                      )}
                    </div>
                  )}

                  {pick === NONE && task.co_holders.length === 0 && (
                    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                      {tx(
                        "Cette tâche restera sans personne.",
                        "This task will be left with nobody."
                      )}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {done && (
        <div className="mt-3 space-y-4" data-handover-done="">
          <p className="text-sm leading-6 text-muted-foreground">
            {done.result.handed_over > 0
              ? tx(
                  `${done.result.handed_over} tâche${done.result.handed_over > 1 ? "s ont" : " a"} changé de main.`,
                  `${done.result.handed_over} task${done.result.handed_over > 1 ? "s" : ""} handed over.`
                )
              : tx("Aucune tâche n'a changé de main.", "No task was handed over.")}
          </p>

          {done.left.length > 0 && (
            <p
              data-handover-left=""
              className="flex items-start gap-2 rounded-2xl border border-[var(--tag-warning-bd)] bg-[var(--tag-warning-bg)] px-4 py-3 text-xs leading-5 text-[var(--tag-warning-fg)]"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {tx("Sans personne maintenant : ", "Now with nobody: ")}
                {done.left.join(", ")}
              </span>
            </p>
          )}

          {done.drafts.length > 0 && (
            <div>
              <h4 className="font-heading text-sm font-bold">
                {tx("Messages prêts", "Messages ready")}
              </h4>

              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {tx(
                  "L'envoi SMS n'est pas encore actif. Les textes sont gardés sur la page Intervenants.",
                  "SMS sending is not live yet. The texts are kept on the Contractors page."
                )}
              </p>

              <ul className="mt-3 space-y-3">
                {done.drafts.map((draft) => (
                  <SmsDraftRow key={draft.id} draft={draft} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {problem && (
        <p
          role="alert"
          data-handover-problem=""
          className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-xs leading-5 text-destructive"
        >
          {problem}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {plan && !done && plan.tasks.length > 0 && (
          <span className="mr-auto text-xs text-muted-foreground" data-handover-count="">
            {tx(
              `${decided} sur ${tasks.length} choisies`,
              `${decided} of ${tasks.length} chosen`
            )}
          </span>
        )}

        {done ? (
          <button
            type="button"
            autoFocus
            onClick={onClose}
            data-handover-close=""
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tx("Terminé", "Done")}
          </button>
        ) : (
          <>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              disabled={saving}
              data-handover-cancel=""
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
            >
              {tx("Annuler", "Cancel")}
            </button>

            {load.state === "error" && (
              <button
                type="button"
                onClick={reload}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tx("Réessayer", "Try again")}
              </button>
            )}

            {plan && (
              <button
                type="button"
                onClick={confirm}
                disabled={saving || (plan.tasks.length > 0 && !allDecided)}
                data-handover-confirm=""
                className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : plan.tasks.length > 0 ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {plan.tasks.length > 0
                  ? tx("Confirmer et retirer", "Confirm and remove")
                  : tx("Retirer", "Remove")}
              </button>
            )}
          </>
        )}
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
