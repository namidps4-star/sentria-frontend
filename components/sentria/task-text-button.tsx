"use client"

import { useState } from "react"
import { Send } from "@/lib/icons"

import { smsErrorText, textContractor, type TaskText } from "@/lib/crm"
import { resolve, useTx } from "@/lib/i18n"
import { StatusTag } from "./status-tag"

/* --------------------------------------------------------------------------
 * "Text" for one person on one task (F-SMS2). The person gets a short text
 * about the task and answers 1 (handled) or 9 (dismiss); the board then
 * shows the new status.
 *
 * Only the task and the person go to the API. The words are the API's, and
 * until the SMS provider is switched on the text is logged and not sent: the
 * answer says so (`live: false`), and so does this button, so nobody thinks
 * a person was texted when they were not.
 * -------------------------------------------------------------------------- */

export type TextState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; result: TaskText }
  | { kind: "error"; message: string }

type State = TextState

export function TaskTextButton({
  taskKey,
  contractorId,
  name,
}: {
  taskKey: string
  contractorId: string
  name: string
}) {
  const tx = useTx()
  const [state, setState] = useState<State>({ kind: "idle" })

  async function send() {
    setState({ kind: "sending" })

    const result = await textContractor(taskKey, contractorId, tx("fr", "en") === "en" ? "en" : "fr")

    if (!result.ok) {
      setState({ kind: "error", message: resolve(smsErrorText(result.code, result.detail), tx) })
      return
    }

    setState({ kind: "done", result: result.data })
  }

  const busy = state.kind === "sending"

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5 pl-10" data-task-text="">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        data-task-text-send=""
        aria-label={tx(`Envoyer un SMS à ${name} pour cette tâche`, `Text ${name} about this task`)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
      >
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? tx("Envoi…", "Sending…") : tx("Envoyer un SMS", "Text")}
      </button>

      <TextOutcome state={state} />
    </div>
  )
}

/** What a text came to: sent, logged only, or refused. The one wording for
 *  both the Text button and Dispatch, so neither can claim more than the
 *  API said. */
export function TextOutcome({ state }: { state: TextState }) {
  const tx = useTx()

  return (
    <>
      {state.kind === "done" && (
        <span data-task-text-result="" role="status" className="text-xs leading-5 text-muted-foreground">
          {state.result.live ? (
            <StatusTag tone="success" size="xs">
              {tx("SMS envoyé. 1 = traité, 9 = écarter.", "Text sent. Reply 1 = handled, 9 = dismiss.")}
            </StatusTag>
          ) : (
            <StatusTag tone="neutral" size="xs" icon={false}>
              {tx(
                "Enregistré, pas envoyé : le SMS n'est pas encore actif.",
                "Logged, not sent: SMS is not live yet."
              )}
            </StatusTag>
          )}
        </span>
      )}

      {state.kind === "error" && (
        <span data-task-text-error="" role="alert" className="text-xs leading-5 text-destructive">
          {state.message}
        </span>
      )}
    </>
  )
}
