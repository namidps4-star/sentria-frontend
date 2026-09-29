"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react"

import { activityLabel } from "@/lib/activities"
import { API_BASE, apiFetch } from "@/lib/api"
import { useTx } from "@/lib/i18n"
import { PLAN_NAMES, PLAN_ORDER, trialDaysLeft, type PlanId } from "@/lib/plans"
import { sectorLabel } from "@/lib/priorities"
import { cn } from "@/lib/utils"

import { StatusTag } from "./status-tag"

type AdminAccount = {
  user_id: string
  email: string | null
  /** Given at sign-up; null when none was. */
  name: string | null
  /** Chosen at sign-up (migrations/006); null for older accounts. */
  username?: string | null
  company_id: string
  company_name: string
  sector: string | null
  department: string | null
  country: string | null
  onboarded: boolean
  plan: PlanId
  effective_plan: PlanId
  trial_ends_at: string | null
  is_admin: boolean
  created_at: string | null
  alerts: number
}

/** SentrIA staff only (accounts.is_admin, migrations/005_admin.sql).
 *
 *  Every account with its plan, trial and usage; plans and trials are
 *  changed here instead of in SQL. Account details and counts only: the
 *  companies' own data stays theirs. The API checks the admin flag on
 *  every call, so this page opens nothing by itself. */
export function AdminView() {
  const tx = useTx()
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const res = await apiFetch(`${API_BASE}/admin/accounts`)
      const body = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? tx("Réservé aux administrateurs.", "Admins only.")
            : body?.detail?.message ?? `HTTP ${res.status}`
        )
      }

      setAccounts(Array.isArray(body?.accounts) ? body.accounts : [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [tx])

  useEffect(() => {
    void load()
  }, [load])

  async function update(account: AdminAccount, change: { plan?: PlanId; trial_days?: number }) {
    setSaving(account.user_id)
    setNotice("")

    try {
      const res = await apiFetch(`${API_BASE}/admin/accounts/${encodeURIComponent(account.user_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok || !body?.account) {
        throw new Error(body?.detail?.message ?? `HTTP ${res.status}`)
      }

      setAccounts((current) =>
        current.map((a) =>
          a.user_id === account.user_id
            ? { ...a, ...body.account, email: a.email, alerts: a.alerts }
            : a
        )
      )
      setNotice(
        tx(
          `${account.company_name || account.email || "Compte"} : enregistré.`,
          `${account.company_name || account.email || "Account"}: saved.`
        )
      )
    } catch (caught) {
      setNotice(
        tx("Échec : ", "Failed: ") + (caught instanceof Error ? caught.message : String(caught))
      )
    } finally {
      setSaving(null)
    }
  }

  const shown = useMemo(() => {
    // "@ama" finds the username ama_pharma.
    const q = query.trim().toLowerCase().replace(/^@/, "")
    if (!q) return accounts
    return accounts.filter((a) =>
      [a.company_name, a.name, a.username, a.email, a.sector, a.department, a.plan]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [accounts, query])

  const stats = useMemo(() => {
    const trialing = accounts.filter((a) => trialDaysLeft(a.trial_ends_at) > 0).length
    const paying = accounts.filter((a) => a.plan !== "decouverte").length
    const onboarded = accounts.filter((a) => a.onboarded).length
    return [
      { label: tx("Comptes", "Accounts"), value: accounts.length },
      { label: tx("En essai", "On trial"), value: trialing },
      { label: tx("Offre payante", "Paid plan"), value: paying },
      { label: tx("Onboarding fini", "Onboarded"), value: onboarded },
    ]
  }, [accounts, tx])

  const dateFormat = tx("fr-FR", "en-GB")

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{loading ? "–" : stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <h3 className="font-heading text-lg font-bold">{tx("Comptes clients", "Client accounts")}</h3>
          </div>

          <div className="flex items-center gap-2">
            <label className="relative">
              <span className="sr-only">{tx("Rechercher un compte", "Search accounts")}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tx("Entreprise, nom, @utilisateur, email, offre…", "Company, name, @username, email, plan…")}
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64 [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              aria-label={tx("Actualiser", "Refresh")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
            </button>
          </div>
        </div>

        {notice && (
          <p role="status" className="border-b border-border px-5 py-2 text-sm">{notice}</p>
        )}

        {error ? (
          <p role="alert" className="p-5 text-sm text-destructive">{error}</p>
        ) : loading ? (
          <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {tx("Chargement des comptes…", "Loading accounts…")}
          </p>
        ) : shown.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{tx("Aucun compte.", "No accounts.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-semibold">{tx("Entreprise", "Company")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("Activité", "Activity")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("Offre", "Plan")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("Essai", "Trial")}</th>
                  <th className="px-3 py-3 text-right font-semibold">{tx("Alertes", "Alerts")}</th>
                  <th className="px-5 py-3 font-semibold">{tx("Créé le", "Created")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((account) => {
                  const days = trialDaysLeft(account.trial_ends_at)
                  const busy = saving === account.user_id

                  return (
                    <tr key={account.user_id} className="border-b border-border last:border-0 align-top">
                      <td className="px-5 py-3">
                        <p className="font-semibold">
                          {account.company_name || tx("(sans nom)", "(no name)")}
                          {account.is_admin && (
                            <StatusTag tone="brand" size="xs" icon={ShieldCheck} className="ml-2 align-middle">
                              Admin
                            </StatusTag>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {account.name && (
                            <span className="font-medium text-foreground">{account.name}</span>
                          )}
                          {account.username && (
                            <>
                              {account.name ? " · " : ""}
                              <span className="font-medium text-foreground">@{account.username}</span>
                            </>
                          )}
                          {account.name || account.username
                            ? account.email ? ` · ${account.email}` : ""
                            : account.email ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {account.sector ? (
                          <>
                            <p>{sectorLabel(account.sector, tx)}</p>
                            <p className="text-xs text-muted-foreground">
                              {activityLabel(account.sector, account.department, tx) ?? account.department ?? "—"}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">{tx("Onboarding pas fini", "Not onboarded")}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={account.plan}
                          disabled={busy}
                          onChange={(e) => void update(account, { plan: e.target.value as PlanId })}
                          aria-label={tx(`Offre de ${account.company_name || account.email}`, `Plan for ${account.company_name || account.email}`)}
                          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                          {PLAN_ORDER.map((plan) => (
                            <option key={plan} value={plan}>{PLAN_NAMES[plan]}</option>
                          ))}
                        </select>
                        {account.effective_plan !== account.plan && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tx("En ce moment : ", "Right now: ")}{PLAN_NAMES[account.effective_plan]}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {days > 0 ? (
                          <StatusTag tone="info" size="xs">
                            {tx(`${days} j restants`, `${days} days left`)}
                          </StatusTag>
                        ) : account.trial_ends_at ? (
                          <StatusTag tone="neutral" size="xs">
                            {tx("Terminé", "Ended")}
                          </StatusTag>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                        <div className="mt-1.5 flex gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void update(account, { trial_days: Math.min(365, days + 14) })}
                            className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                          >
                            {tx("+14 j", "+14 days")}
                          </button>
                          {days > 0 && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void update(account, { trial_days: 0 })}
                              className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                            >
                              {tx("Terminer", "End")}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{account.alerts}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {account.created_at ? new Date(account.created_at).toLocaleDateString(dateFormat) : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {tx(
          "Comptes et compteurs seulement : les données des entreprises restent les leurs. Les droits admin se donnent en SQL (migrations/005_admin.sql).",
          "Accounts and counts only: companies' data stays theirs. Admin rights are granted in SQL (migrations/005_admin.sql)."
        )}
      </p>
    </div>
  )
}
