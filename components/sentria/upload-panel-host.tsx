"use client"

import { useTx } from "@/lib/i18n"
import { setUploadPanel, useUploadPanel, type UploadPanel } from "@/lib/upload-panel"
import { useEnter } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

import { MatchColumns, UploadProgress } from "./upload-progress"

/** The import panel over the app (see lib/upload-panel.ts). */
export function UploadPanelHost() {
  const { open, title, state, busy } = useUploadPanel()

  if (!open || state.phase === "idle") return null

  // A file that needs matching gets its own screen; the upload screen is replaced, not changed.
  if (state.phase === "matching") return <MatchingDialog title={title} state={state} />

  return <UploadPanelDialog title={title} state={state} busy={busy} />
}

/** The matching as its own screen, opened when the check finds columns to match.
 *  Back closes it: the file is chosen again from the import button. */
function MatchingDialog({ title, state }: Pick<UploadPanel, "title" | "state">) {
  const tx = useTx()
  const enter = useEnter()

  if (!state.missing || !state.fileColumns || !state.retry) return null

  return (
    <div
      className={cn("fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center t-modal-backdrop", enter)}
      role="dialog"
      aria-modal="true"
      aria-label={tx("Associer les colonnes", "Match the columns")}
    >
      <div className={cn("max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl t-modal", enter)}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tx("Import", "Import")}
            {title ? ` · ${title}` : ""}
          </p>
          <button
            type="button"
            onClick={() => setUploadPanel({ open: false })}
            className="shrink-0 text-sm font-semibold underline underline-offset-4 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tx("Retour", "Back")}
          </button>
        </div>
        <MatchColumns
          fileName={state.fileName}
          rows={state.rows}
          expected={state.expected ?? []}
          required={state.required ?? []}
          missing={state.missing}
          fileColumns={state.fileColumns}
          suggested={state.suggested}
          confidence={state.confidence}
          retry={state.retry}
        />
      </div>
    </div>
  )
}

/** Mounted each time the panel opens, so the modal entrance plays each time
 *  (transitions.dev modal, app/transitions.css). */
function UploadPanelDialog({ title, state, busy }: Pick<UploadPanel, "title" | "state" | "busy">) {
  const tx = useTx()
  const enter = useEnter()

  return (
    <div
      className={cn("fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center t-modal-backdrop", enter)}
      role="dialog"
      aria-modal="true"
      aria-label={tx("Import de données", "Data import")}
    >
      <div className={cn("max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl t-modal", state.phase === "matching" ? "max-w-2xl" : "max-w-md", enter)}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tx("Import", "Import")}
          {title ? ` · ${title}` : ""}
        </p>
        <div className="mt-3">
          <UploadProgress state={state} />
        </div>
        {!busy && state.phase !== "matching" && (
          <button
            type="button"
            autoFocus
            onClick={() => setUploadPanel({ open: false })}
            className="mt-5 w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {state.phase === "done" ? tx("Voir les alertes", "See the alerts") : tx("Fermer", "Close")}
          </button>
        )}
      </div>
    </div>
  )
}
