"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Check, FileUp, Loader2, SearchCheck } from "@/lib/icons"

import { useTx } from "@/lib/i18n"
import type { UploadState } from "@/lib/upload"
import { cn } from "@/lib/utils"

/** The two real stages of an import, then its result.
 *
 *  1. Sending the file: the percentage the browser reports.
 *  2. Checking and analysing: the server doesn't report progress, so this
 *     shows the seconds elapsed, never a made-up percentage.
 *  Then the real counts the server returns: rows read, alerts raised. */
export function UploadProgress({ state, compact = false }: { state: UploadState; compact?: boolean }) {
  const tx = useTx()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (state.phase !== "analysing" && state.phase !== "sending") return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [state.phase])

  if (state.phase === "idle") return null

  const n = (value: number | undefined) => (value ?? 0).toLocaleString(tx("fr-FR", "en-GB"))

  const sending = state.phase === "sending"
  const analysing = state.phase === "analysing"
  const finished = state.phase === "done" || state.phase === "refused" || state.phase === "failed"
  const knownPct = sending ? state.sentPct : 100
  const sentPct = knownPct ?? 0
  const since = sending ? state.sendingSince : analysing ? state.analysingSince : undefined
  const seconds = since ? Math.max(0, Math.floor((now - since) / 1000)) : 0

  const stage = (
    active: boolean,
    complete: boolean,
    icon: typeof FileUp,
    title: string,
    detail: string
  ) => {
    const Icon = icon
    return (
      <li className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
            complete ? "border-brand bg-brand text-brand-foreground" : active ? "border-foreground" : "border-border text-muted-foreground"
          )}
        >
          {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : active ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold", !active && !complete && "text-muted-foreground")}>{title}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>
        </div>
      </li>
    )
  }

  return (
    <div className={cn("w-full", !compact && "space-y-4")} aria-live="polite">
      {!compact && state.fileName && (
        <p className="truncate text-sm font-medium" title={state.fileName}>{state.fileName}</p>
      )}

      {!finished && (
        <>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={tx("Progression de l'import", "Import progress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={sending && knownPct !== undefined ? sentPct : undefined}
          >
            {sending && knownPct !== undefined ? (
              <div className="h-full rounded-full bg-foreground transition-[width] duration-200" style={{ width: `${sentPct}%` }} />
            ) : (
              <div className="h-full w-1/3 animate-[sentria-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-foreground motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40" />
            )}
          </div>

          <ol className={cn("flex flex-col gap-3", compact && "mt-3")}>
            {stage(
              sending,
              !sending,
              FileUp,
              tx("Envoi du fichier", "Sending the file"),
              sending
                ? knownPct !== undefined
                  ? `${sentPct} %`
                  : tx(`En cours · ${seconds} s`, `Working · ${seconds} s`)
                : tx("Envoyé", "Sent")
            )}
            {stage(
              analysing,
              false,
              SearchCheck,
              tx("Vérification des colonnes et analyse", "Checking the columns and analysing"),
              analysing ? tx(`En cours · ${seconds} s`, `Working · ${seconds} s`) : tx("En attente", "Waiting")
            )}
          </ol>
        </>
      )}

      {state.phase === "done" && (
        <div className="flex items-start gap-3 rounded-2xl bg-brand/20 p-4" role="status">
          <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">{tx("Import réussi", "Import complete")}</p>
            <p className="mt-0.5 text-sm tabular-nums">
              {tx(
                `${n(state.rows)} ligne${(state.rows ?? 0) > 1 ? "s" : ""} analysée${(state.rows ?? 0) > 1 ? "s" : ""} · ${n(state.alerts)} alerte${(state.alerts ?? 0) > 1 ? "s" : ""}`,
                `${n(state.rows)} row${(state.rows ?? 0) === 1 ? "" : "s"} analysed · ${n(state.alerts)} alert${(state.alerts ?? 0) === 1 ? "" : "s"}`
              )}
            </p>
            {(state.failedSaves ?? 0) > 0 && (
              <p className="mt-1 text-xs text-destructive">
                {tx(
                  `${state.failedSaves} alerte(s) non enregistrée(s). Réessayez plus tard.`,
                  `${state.failedSaves} alert(s) could not be saved. Try again later.`
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {(state.phase === "refused" || state.phase === "failed") && (
        <div className="flex items-start gap-3 rounded-2xl bg-destructive/10 p-4" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-destructive">
              {state.phase === "refused" ? tx("Fichier refusé, rien n'a été enregistré", "File refused, nothing was saved") : tx("L'import a échoué", "The import failed")}
            </p>
            {state.message && <p className="mt-0.5 text-sm">{state.message}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
