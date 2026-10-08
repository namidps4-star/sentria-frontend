"use client"

import { useState } from "react"
import { Send } from "@/lib/icons"

import { AVAILABILITY_LABEL, smsErrorText, textContractor, type Contractor } from "@/lib/crm"
import { suggestedId } from "@/lib/dispatch"
import { resolve, useTx } from "@/lib/i18n"
import { StatusTag } from "./status-tag"
import { TextOutcome, type TextState } from "./task-text-button"

/* --------------------------------------------------------------------------
 * "Send someone" for one task (F-DISPATCH). The people are already ranked
 * (lib/dispatch.ts). One press puts the person on the task, moves it to In
 * progress, and texts them. The person decides; nothing goes out on its own.
 *
 * The task is saved BEFORE the text is asked for: the API only texts a
 * person who is on the task. If the save fails nothing is texted, and the
 * panel says so. A person with no usable number is still put on the task,
 * and the panel says they were not texted.
 * -------------------------------------------------------------------------- */

type Outcome =
  | { kind: "none" }
  | { kind: "assigned-only"; name: string }
  | { kind: "not-saved"; name: string }
  | { kind: "text"; name: string; state: TextState }

const SHOWN = 3

export function DispatchPanel({
  taskKey,
  ranked,
  loading = false,
  onDispatch,
}: {
  taskKey: string
  /** Best first, already without anyone on the task or unavailable. */
  ranked: Contractor[]
  /** The people are still on their way: say so, never "nobody free". */
  loading?: boolean
  /** Puts the person on the task and moves it on; true when it was saved. */
  onDispatch: (personId: string) => Promise<boolean>
}) {
  const tx = useTx()
  const px = (text: Parameters<typeof resolve>[0]) => resolve(text, tx)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>({ kind: "none" })

  const suggested = suggestedId(ranked)
  const shown = all ? ranked : ranked.slice(0, SHOWN)

  async function dispatch(person: Contractor) {
    setBusyId(person.id)
    setOutcome({ kind: "none" })

    const saved = await onDispatch(person.id)

    if (!saved) {
      setOutcome({ kind: "not-saved", name: person.name })
      setBusyId(null)
      return
    }

    if (person.sms_ready !== true) {
      setOutcome({ kind: "assigned-only", name: person.name })
      setBusyId(null)
      return
    }

    const result = await textContractor(taskKey, person.id, tx("fr", "en") === "en" ? "en" : "fr")

    setOutcome({
      kind: "text",
      name: person.name,
      state: result.ok
        ? { kind: "done", result: result.data }
        : { kind: "error", message: px(smsErrorText(result.code, result.detail)) },
    })
    setBusyId(null)
  }

  return (
    <section data-dispatch="" aria-labelledby="dispatch-title">
      <h4
        id="dispatch-title"
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {tx("Envoyer quelqu'un", "Send someone")}
      </h4>

      {loading && ranked.length === 0 ? (
        <p data-dispatch-loading="" className="text-xs leading-5 text-muted-foreground">
          {tx("Chargement des intervenants…", "Loading people…")}
        </p>
      ) : ranked.length === 0 ? (
        <p data-dispatch-empty="" className="text-xs leading-5 text-muted-foreground">
          {tx(
            "Personne de libre à envoyer. Ajoutez des intervenants ou changez leur disponibilité.",
            "Nobody free to send. Add people, or change their availability."
          )}
        </p>
      ) : (
        <>
          <ul className="overflow-hidden rounded-xl border border-border">
            {shown.map((person) => {
              const busy = busyId === person.id
              const textable = person.sms_ready === true

              return (
                <li
                  key={person.id}
                  data-dispatch-person={person.id}
                  className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{person.name}</span>
                      {person.id === suggested && (
                        <span data-dispatch-suggested="" className="inline-flex shrink-0">
                          <StatusTag tone="brand" size="xs">
                            {tx("Suggéré", "Suggested")}
                          </StatusTag>
                        </span>
                      )}
                    </span>

                    <span className="block truncate text-xs text-muted-foreground">
                      {px(AVAILABILITY_LABEL[person.availability]) || person.availability}
                      {person.open_assignments > 0 &&
                        tx(` · ${person.open_assignments} en cours`, ` · ${person.open_assignments} open`)}
                      {!textable && tx(" · pas de SMS possible", " · cannot be texted")}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => dispatch(person)}
                    disabled={busyId !== null}
                    data-dispatch-send=""
                    aria-label={
                      textable
                        ? tx(`Envoyer ${person.name} et le prévenir par SMS`, `Send ${person.name} and text them`)
                        : tx(`Assigner ${person.name} (sans SMS)`, `Assign ${person.name} (no text)`)
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    {busy
                      ? tx("Envoi…", "Sending…")
                      : textable
                        ? tx("Envoyer", "Send")
                        : tx("Assigner", "Assign")}
                  </button>
                </li>
              )
            })}
          </ul>

          {ranked.length > SHOWN && (
            <button
              type="button"
              onClick={() => setAll((value) => !value)}
              data-dispatch-more=""
              className="mt-1.5 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {all
                ? tx("Voir moins", "Show fewer")
                : tx(`Voir tout (${ranked.length})`, `Show all (${ranked.length})`)}
            </button>
          )}
        </>
      )}

      <div data-dispatch-outcome="" className="mt-1.5 flex flex-wrap items-center gap-2 text-xs leading-5">
        {outcome.kind === "text" && (
          <>
            <span className="font-semibold">{outcome.name}</span>
            <TextOutcome state={outcome.state} />
          </>
        )}

        {outcome.kind === "assigned-only" && (
          <span data-dispatch-note="" className="text-muted-foreground">
            {tx(
              `${outcome.name} est sur la tâche. Pas de SMS : aucun numéro valide.`,
              `${outcome.name} is on the task. Not texted: no valid number.`
            )}
          </span>
        )}

        {outcome.kind === "not-saved" && (
          <span data-dispatch-error="" role="alert" className="text-destructive">
            {tx(
              `${outcome.name} n'a pas pu être ajouté à la tâche. Aucun SMS envoyé.`,
              `${outcome.name} could not be added to the task. Nothing was sent.`
            )}
          </span>
        )}
      </div>
    </section>
  )
}
