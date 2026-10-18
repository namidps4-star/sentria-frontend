"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, ShieldCheck } from "@/lib/icons"

import { API_BASE, apiFetch } from "@/lib/api"
import { useTx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { StatusTag } from "./status-tag"

/** One line of the Guard's log (GET /admin/guard). No phone number, no email,
 *  no message text: the API never stores them. */
type GuardRow = {
  id?: string | number
  created_at: string
  company_id: string | null
  action: string
  allowed: boolean
  reason: string
  detail: Record<string, string>
}

type GuardState = {
  enabled: boolean
  forced_off: boolean
  persisted: boolean
  log: GuardRow[]
}

/** What each automatic action is, in words. `switch` is the founder's own
 *  flip of the kill switch. */
const ACTIONS: Record<string, [string, string]> = {
  sms_alert: ["Texte d'alerte", "Alert text"],
  sms_task: ["Texte à un intervenant", "Text to a contractor"],
  reply_advance: ["Réponse qui fait avancer une tâche", "Reply that moves a task"],
  email_report: ["E-mail du rapport", "Report email"],
  switch: ["Interrupteur", "Kill switch"],
}

/** The Admin page's Guard (F-GUARD): is SentrIA allowed to send and act on its
 *  own right now, what it did lately, and the kill switch. Staff only: the
 *  API checks the admin flag on every call, and no company ever sees this. */
export function AdminGuard() {
  const tx = useTx()
  const [state, setState] = useState<GuardState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const res = await apiFetch(`${API_BASE}/admin/guard`)
      const body = await res.json().catch(() => null)

      if (!res.ok || typeof body?.enabled !== "boolean") {
        throw new Error(body?.detail?.message ?? `HTTP ${res.status}`)
      }

      setState(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function flip(enabled: boolean) {
    setBusy(true)
    setError("")

    try {
      const res = await apiFetch(`${API_BASE}/admin/guard`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok || typeof body?.enabled !== "boolean") {
        throw new Error(body?.detail?.message ?? `HTTP ${res.status}`)
      }

      setState(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  const stopped = state ? state.log.filter((row) => !row.allowed && row.action !== "switch").length : 0

  return (
    <div className="rounded-3xl border border-border bg-card" data-testid="admin-guard">
      <div className="flex items-center justify-between gap-3 border-b border-border p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          <h3 className="font-heading text-lg font-bold">{tx("Garde", "Guard")}</h3>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          aria-label={tx("Actualiser la garde", "Refresh the guard")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
        </button>
      </div>

      {error && <p role="alert" className="border-b border-border px-5 py-2 text-sm text-destructive">{error}</p>}

      {!state ? (
        !error && (
          <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {tx("Chargement…", "Loading…")}
          </p>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-sm font-medium">
                {tx("Envois et actions automatiques", "Automatic sending and actions")}{" "}
                <StatusTag tone={state.enabled ? "success" : "danger"} size="xs" className="ml-1 align-middle">
                  <span data-testid="guard-state">{state.enabled ? tx("Actifs", "On") : tx("En pause", "Paused")}</span>
                </StatusTag>
              </p>
              <p className="text-xs text-muted-foreground">
                {tx(
                  "Textes d'alerte, textes aux intervenants, réponses par texto et e-mails de rapport. Les alertes restent enregistrées.",
                  "Alert texts, texts to contractors, text replies and report emails. Alerts are still saved."
                )}
              </p>
            </div>

            <button
              type="button"
              data-testid="guard-switch"
              disabled={busy || state.forced_off}
              onClick={() => void flip(!state.enabled)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                state.enabled ? "bg-[var(--tag-danger-bg)] text-[var(--tag-danger-fg)]" : "bg-brand text-[#141414]"
              )}
            >
              {busy
                ? tx("…", "…")
                : state.enabled
                  ? tx("Tout mettre en pause", "Pause everything")
                  : tx("Réactiver", "Turn back on")}
            </button>
          </div>

          {state.forced_off && (
            <p
              role="status"
              className="border-t border-[var(--tag-danger-bd)] bg-[var(--tag-danger-bg)] px-5 py-2 text-sm text-[var(--tag-danger-fg)]"
            >
              {tx(
                "Arrêté par la variable AGENT_WRITES=off sur le serveur. Retirez-la et redémarrez pour réactiver.",
                "Stopped by the AGENT_WRITES=off setting on the server. Remove it and restart to turn back on."
              )}
            </p>
          )}

          {!state.persisted && (
            <p
              role="status"
              data-testid="guard-memory"
              className="border-t border-[var(--tag-warning-bd)] bg-[var(--tag-warning-bg)] px-5 py-2 text-sm text-[var(--tag-warning-fg)]"
            >
              {tx(
                "Le journal et l'interrupteur sont en mémoire : un redémarrage les efface et remet tout en marche. Lancez la migration 018 (migrations/018_guard.sql) pour les garder.",
                "The log and the switch are in memory: a restart wipes them and turns everything back on. Run migration 018 (migrations/018_guard.sql) to keep them."
              )}
            </p>
          )}

          <div className="border-t border-border">
            <p className="px-5 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tx("Dernières actions", "Latest actions")}
              {state.log.length > 0 && ` · ${stopped} ${tx("arrêtées", "stopped")}`}
            </p>

            {state.log.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground" data-testid="guard-empty">
                {tx("Rien encore. Chaque envoi automatique sera noté ici.", "Nothing yet. Each automatic send is noted here.")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="mt-2 w-full min-w-[34rem] text-left text-sm" data-testid="guard-log">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-5 py-2 font-semibold">{tx("Quand", "When")}</th>
                      <th scope="col" className="px-3 py-2 font-semibold">{tx("Action", "Action")}</th>
                      <th scope="col" className="px-3 py-2 font-semibold">{tx("Entreprise", "Company")}</th>
                      <th scope="col" className="px-5 py-2 font-semibold">{tx("Résultat", "Result")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {state.log.slice(0, 40).map((row, index) => {
                      const name = ACTIONS[row.action]

                      return (
                        <tr key={row.id ?? `${row.created_at}-${index}`} data-allowed={row.allowed} data-action={row.action}>
                          <td className="whitespace-nowrap px-5 py-2 tabular-nums text-muted-foreground">
                            {new Date(row.created_at).toLocaleString(tx("fr-FR", "en-GB"), {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2">{name ? tx(name[0], name[1]) : row.action}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {row.company_id ? row.company_id.slice(0, 8) : "—"}
                          </td>
                          <td className="px-5 py-2">
                            {row.action === "switch" ? (
                              <StatusTag tone="info" size="xs">
                                {row.reason === "on" ? tx("Réactivé", "Turned on") : tx("Mis en pause", "Paused")}
                              </StatusTag>
                            ) : (
                              <StatusTag tone={row.allowed ? "success" : "danger"} size="xs">
                                {row.allowed ? tx("Envoyé", "Went ahead") : tx("Arrêté", "Stopped")}
                              </StatusTag>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
