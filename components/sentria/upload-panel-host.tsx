"use client"

import { useTx } from "@/lib/i18n"
import { setUploadPanel, useUploadPanel } from "@/lib/upload-panel"

import { UploadProgress } from "./upload-progress"

/** The import panel over the app (see lib/upload-panel.ts). */
export function UploadPanelHost() {
  const tx = useTx()
  const { open, title, state, busy } = useUploadPanel()

  if (!open || state.phase === "idle") return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={tx("Import de données", "Data import")}
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tx("Import", "Import")}
          {title ? ` · ${title}` : ""}
        </p>
        <div className="mt-3">
          <UploadProgress state={state} />
        </div>
        {!busy && (
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
