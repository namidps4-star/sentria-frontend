"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Check, FileDown, FileUp, Loader2, SearchCheck } from "@/lib/icons"

import { useTx } from "@/lib/i18n"
import type { UploadState } from "@/lib/upload"
import { fieldLabel } from "@/lib/upload-fields"
import { setUploadPanel } from "@/lib/upload-panel"
import { templateCsv, type UploadTeach } from "@/lib/upload-problem"
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
  const matching = state.phase === "matching"
  const finished = state.phase === "done" || state.phase === "refused" || state.phase === "failed" || matching
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
      {!compact && state.fileName && state.phase !== "matching" && state.phase !== "refused" && (
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

      {state.phase === "refused" && state.missing && state.fileColumns && state.retry && (
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
      )}

      {state.phase === "refused" && state.teach && <HowToFix teach={state.teach} />}
    </div>
  )
}

/** The matching screen. One row per field, the server's suggestion already chosen,
 *  a status for each, and Import off until every required field has a column. Nothing
 *  has been sent when it shows; Import sends the file with the matching (`mapping`). */
export function MatchColumns({
  fileName,
  rows,
  expected,
  required,
  missing,
  fileColumns,
  suggested,
  confidence,
  retry,
}: {
  fileName?: string
  rows?: number
  expected: string[]
  required: string[]
  missing: string[][]
  fileColumns: string[]
  suggested?: Record<string, string>
  confidence?: Record<string, "exact" | "close">
  retry: NonNullable<UploadState["retry"]>
}) {
  const tx = useTx()
  const names = expected.length > 0 ? expected : missing.map((group) => group[0])
  const requiredNames = required.length > 0 ? required : missing.map((group) => group[0])
  const [choice, setChoice] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {}
    for (const name of names) {
      if (fileColumns.includes(name)) start[name] = name
      else if (suggested?.[name] && fileColumns.includes(suggested[name])) start[name] = suggested[name]
    }
    return start
  })

  // A column the user picked is confirmed, so it is recognised like an exact match.
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const statusOf = (name: string): "ok" | "check" | "missing" | "recommended" => {
    const column = choice[name]
    if (!column) return requiredNames.includes(name) ? "missing" : "recommended"
    return column === name || confidence?.[name] === "exact" || confirmed[name] ? "ok" : "check"
  }
  const recognised = names.filter((name) => statusOf(name) === "ok").length
  const questions = names.filter((name) => statusOf(name) === "check" || statusOf(name) === "missing").length
  const ready = requiredNames.every((name) => choice[name])
  // The upload needs only the required fields, but the alerts need the others: say what a gap costs.
  const unmatchedRecommended = names.filter((name) => !requiredNames.includes(name) && !choice[name])
  const taken = new Set(Object.values(choice))
  const count = (value: number) => value.toLocaleString(tx("fr-FR", "en-GB"))

  const fileLabel =
    fileName && rows !== undefined
      ? `${fileName} · ${count(rows)} ${tx(rows === 1 ? "ligne" : "lignes", rows === 1 ? "row" : "rows")}`
      : fileName ?? ""
  const importLabel =
    rows !== undefined ? tx(`Importer ${count(rows)} lignes`, `Import ${count(rows)} rows`) : tx("Importer le fichier", "Import the file")

  return (
    <section className="mt-2 flex flex-col gap-5" data-testid="upload-match">
      <div>
        {fileLabel && (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fileLabel}</p>
        )}
        <p className="mt-1 font-heading text-3xl font-semibold leading-tight tracking-tight">
          {tx("Associez vos colonnes.", "Match your columns.")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {tx(
            `SentrIA a reconnu ${recognised} champ${recognised === 1 ? "" : "s"}. Il reste ${questions} question${questions === 1 ? "" : "s"}.`,
            `SentrIA recognised ${recognised} field${recognised === 1 ? "" : "s"}. ${questions} question${questions === 1 ? "" : "s"} left.`
          )}
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {names.map((name) => {
          const label = fieldLabel(name, tx)
          const status = statusOf(name)
          const tone =
            status === "ok"
              ? "bg-brand/30 text-foreground"
              : status === "check"
                ? "bg-muted text-foreground ring-1 ring-border"
                : status === "missing"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-brand/10 text-foreground ring-1 ring-border"
          const text =
            status === "ok"
              ? tx("Reconnu", "Recognised")
              : status === "check"
                ? tx("À vérifier", "To check")
                : status === "missing"
                  ? tx("Manquant", "Missing")
                  : tx("Recommandé", "Recommended")

          return (
            <li key={name} className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center sm:gap-4">
              <p className="font-heading text-lg font-semibold leading-tight">{label}</p>
              <select
                aria-label={label}
                data-testid={`match-${name}`}
                value={choice[name] ?? ""}
                onChange={(event) => {
                  setChoice((current) => ({ ...current, [name]: event.target.value }))
                  setConfirmed((current) => ({ ...current, [name]: true }))
                }}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{tx("Choisir une colonne", "Choose a column")}</option>
                {fileColumns
                  .filter((column) => column === choice[name] || !taken.has(column))
                  .map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
              </select>
              <span
                data-testid={`status-${name}`}
                className={cn("justify-self-start rounded-full px-3 py-1 text-xs font-semibold sm:justify-self-end", tone)}
              >
                {text}
              </span>
            </li>
          )
        })}
      </ul>

      {unmatchedRecommended.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          {tx(
            "Sans ces colonnes, certaines alertes (stock, péremption) ne se déclencheront pas.",
            "Without these columns, some alerts (stock, expiry) won't fire."
          )}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setUploadPanel({ open: false })}
          className="shrink-0 text-sm font-semibold underline underline-offset-4 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tx("Annuler", "Cancel")}
        </button>
        <button
          type="button"
          data-testid="upload-match-submit"
          disabled={!ready}
          onClick={() => void retry(choice)}
          className="h-12 flex-1 rounded-full bg-brand text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          {importLabel}
        </button>
      </div>
    </section>
  )
}

/** F-TEACH: what each missing column is for, one example value, and a
 *  ready-made template, so a first import can be fixed without support. */
function HowToFix({ teach }: { teach: UploadTeach }) {
  const tx = useTx()

  const download = () => {
    if (!teach.example) return
    const blob = new Blob([templateCsv(teach.example)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = tx("modele-sentria.csv", "sentria-template.csv")
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section
      className="mt-3 rounded-2xl border border-border bg-card p-4"
      aria-labelledby="upload-fix-title"
      data-testid="upload-teach"
    >
      <h3 id="upload-fix-title" className="text-sm font-bold">
        {tx("Comment corriger le fichier", "How to fix the file")}
      </h3>

      <ul className="mt-2 divide-y divide-border">
        {teach.explain.map((item) => (
          <li key={item.column} className="py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 text-sm">
                <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] font-semibold">
                  {item.column}
                </code>
                {item.alternatives.length > 1 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {tx("ou", "or")} {item.alternatives.slice(1).join(", ")}
                    {item.more_alternatives > 0 &&
                      tx(` (+${item.more_alternatives} autres)`, ` (+${item.more_alternatives} more)`)}
                  </span>
                )}
              </p>
              {item.example && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {tx("ex. ", "e.g. ")}
                  <code className="font-mono text-[12px] text-foreground">{item.example}</code>
                </span>
              )}
            </div>
            {item.why && <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.why}</p>}
          </li>
        ))}
      </ul>

      {teach.example && (
        <div className="mt-3">
          <p className="text-xs font-semibold">
            {tx("Une ligne d'exemple qui passe :", "An example line that works:")}
          </p>
          <pre className="mt-1.5 overflow-x-auto rounded-xl bg-muted px-3 py-2 font-mono text-[11px] leading-5">
            {teach.example.header.join(",")}
            {"\n"}
            {teach.example.row.join(",")}
          </pre>
          <button
            type="button"
            onClick={download}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85"
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
            {tx("Télécharger le modèle CSV", "Download the CSV template")}
          </button>
        </div>
      )}
    </section>
  )
}
