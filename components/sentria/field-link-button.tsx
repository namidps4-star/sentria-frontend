"use client"

import { useState } from "react"

import { fieldUrl, makeFieldLink } from "@/lib/field-link"
import { useTx } from "@/lib/i18n"
import { Send } from "@/lib/icons"

/* "Copy field link" on a person who is on a task (F-CONTRACTOR). It makes a
 * signed link for that one person and task, copies it, and offers to open the
 * page it leads to: what a field person sees from the text. Nothing is sent
 * from here. */

type State =
  | { kind: "idle" }
  | { kind: "making" }
  | { kind: "ready"; url: string; copied: boolean; expires: number }
  | { kind: "error"; message: string }

export function FieldLinkButton({ taskKey, contractorId, name }: { taskKey: string; contractorId: string; name: string }) {
  const tx = useTx()
  const [state, setState] = useState<State>({ kind: "idle" })
  const lang = tx("fr", "en") === "en" ? "en" : "fr"

  async function make() {
    setState({ kind: "making" })

    const made = await makeFieldLink(taskKey, contractorId, lang)

    if (!made.ok) {
      setState({
        kind: "error",
        message:
          made.code === "field_link_unconfigured"
            ? tx("Les liens terrain ne sont pas encore activés sur le serveur.", "Field links are not switched on for the server yet.")
            : tx("Le lien n'a pas pu être créé. Enregistrez la tâche avec cette personne, puis réessayez.", "The link could not be made. Save the task with this person, then try again."),
      })

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

    setState({ kind: "ready", url, copied, expires: made.expires_at })
  }

  const days = state.kind === "ready" ? Math.max(1, Math.round((state.expires * 1000 - Date.now()) / 86400000)) : 0

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5 pl-10" data-field-link="">
      <button
        type="button"
        onClick={make}
        disabled={state.kind === "making"}
        data-testid="field-link-make"
        aria-label={tx(`Copier le lien terrain de ${name}`, `Copy ${name}'s field link`)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
      >
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
        {state.kind === "making" ? tx("Création…", "Making…") : tx("Copier le lien terrain", "Copy field link")}
      </button>

      {state.kind === "ready" && (
        <span role="status" data-testid="field-link-ready" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {state.copied ? tx("Lien copié", "Link copied") : tx("Copiez ce lien :", "Copy this link:")}
          {!state.copied && (
            <input readOnly value={state.url} aria-label={tx("Lien terrain", "Field link")} onFocus={(e) => e.currentTarget.select()} className="w-44 rounded-lg border border-border bg-card px-2 py-1 text-xs" />
          )}
          {tx(` · valable ${days} j`, ` · valid ${days} d`)}
          <a href={state.url} target="_blank" rel="noopener noreferrer" data-testid="field-link-open" className="font-semibold text-foreground underline underline-offset-2">
            {tx("Ouvrir la page", "Open the page")}
          </a>
        </span>
      )}

      {state.kind === "error" && (
        <span role="status" data-testid="field-link-error" className="text-xs text-muted-foreground">
          {state.message}
        </span>
      )}
    </div>
  )
}
