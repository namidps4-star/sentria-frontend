"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, Loader2, RefreshCw, Search, ShieldCheck } from "@/lib/icons"

import { activityLabel } from "@/lib/activities"
import { API_BASE, apiFetch } from "@/lib/api"
import { useTx } from "@/lib/i18n"
import { PLAN_NAMES, PLAN_ORDER, trialDaysLeft, type PlanId } from "@/lib/plans"
import { sectorLabel } from "@/lib/priorities"
import { enterAt } from "@/lib/motion"
import { setViewAs } from "@/lib/view-as"
import { cn } from "@/lib/utils"

import { AdminChecks } from "./admin-checks"
import { AdminGuard } from "./admin-guard"
import { AdminSites } from "./admin-sites"
import { AdminThresholds } from "./admin-thresholds"
import { SectorBadge } from "./sector-badge"
import { StatusTag, type TagTone } from "./status-tag"

type Filter = "all" | "trial" | "paid" | "setup"

const PLAN_TONE: Record<PlanId, TagTone> = { decouverte: "neutral", pro: "info", business: "brand", entreprise: "success" }

const initialsOf = (a: { company_name: string; email: string | null }) =>
  (a.company_name || a.email || "?").trim().slice(0, 2).toUpperCase()

/** The sectors an account runs, each with its activities. */
function accountSectors(account: AdminAccount): { sector: string; departments: string[] }[] {
  if (account.sectors && account.sectors.length > 0) return account.sectors

  return account.sector ? [{ sector: account.sector, departments: account.department ? [account.department] : [] }] : []
}

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
  /** Every sector the account runs with its activities (several on Entreprise).
   *  Absent from an older API: the single sector and department stand in. */
  sectors?: { sector: string; departments: string[] }[]
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
 *  changed here instead of in SQL. Account details and counts here. "View"
 *  opens one company's dashboard read only (S-3). The API checks the admin flag on
 *  every call, so this page opens nothing by itself. */
export function AdminView() {
  const tx = useTx()
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
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
    const kept = accounts.filter((a) =>
      filter === "trial" ? trialDaysLeft(a.trial_ends_at) > 0
        : filter === "paid" ? a.plan !== "decouverte"
        : filter === "setup" ? !a.onboarded
        : true
    )
    if (!q) return kept
    return kept.filter((a) =>
      [a.company_name, a.name, a.username, a.email, a.sector, a.department, a.plan, ...accountSectors(a).flatMap((e) => [e.sector, ...e.departments])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [accounts, query, filter])

  const stats = useMemo(() => {
    const trialing = accounts.filter((a) => trialDaysLeft(a.trial_ends_at) > 0).length
    const paying = accounts.filter((a) => a.plan !== "decouverte").length
    const onboarded = accounts.filter((a) => a.onboarded).length
    return [
      { label: tx("Comptes", "Accounts"), value: accounts.length, skin: "bg-brand text-brand-foreground" },
      { label: tx("En essai", "On trial"), value: trialing, skin: "bg-[var(--ink)] text-white" },
      { label: tx("Offre payante", "Paid plan"), value: paying, skin: "border border-border bg-card" },
      { label: tx("Onboarding fini", "Onboarded"), value: onboarded, skin: "border border-border bg-card" },
    ]
  }, [accounts, tx])

  const counts = useMemo(() => ({
    all: accounts.length,
    trial: accounts.filter((a) => trialDaysLeft(a.trial_ends_at) > 0).length,
    paid: accounts.filter((a) => a.plan !== "decouverte").length,
    setup: accounts.filter((a) => !a.onboarded).length,
  }), [accounts])

  const dateFormat = tx("fr-FR", "en-GB")

  return (
    <div className="flex flex-col gap-6">
      <div className="t-enter grid grid-cols-2 gap-4 lg:grid-cols-4" style={enterAt(0)}>
        {stats.map((stat) => (
          <div key={stat.label} className={cn("squircle rounded-[28px] p-5", stat.skin)} style={{ borderRadius: 28 }}>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{stat.label}</p>
            <p className="mt-2 text-4xl font-bold tabular-nums">{loading ? "–" : stat.value}</p>
          </div>
        ))}
      </div>

      <div className="t-enter squircle overflow-hidden rounded-[28px] border border-border bg-card" style={{ ...enterAt(1), borderRadius: 28 }}>
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

        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3" role="group" aria-label={tx("Filtrer les comptes", "Filter accounts")}>
          {([
            ["all", tx("Tous", "All")],
            ["trial", tx("En essai", "On trial")],
            ["paid", tx("Payants", "Paid")],
            ["setup", tx("Onboarding à finir", "Not onboarded")],
          ] as [Filter, string][]).map(([id, text]) => (
            <button
              key={id}
              type="button"
              data-testid={`admin-filter-${id}`}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === id ? "border-transparent bg-[var(--ink)] text-white" : "border-border hover:bg-muted"
              )}
            >
              {text} <span className="tabular-nums opacity-60">{counts[id]}</span>
            </button>
          ))}
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
              <thead className="table-head bg-muted text-xs uppercase tracking-wide">
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
                        <div className="flex items-start gap-3">
                        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-xs font-bold text-white">
                          {initialsOf(account)}
                        </span>
                        <div className="min-w-0">
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
                        {account.company_id && (
                          <button
                            type="button"
                            data-testid="view-as"
                            onClick={() => {
                              setViewAs({ company_id: account.company_id, name: account.company_name || account.email || "" })
                              window.location.assign("/")
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            {tx("Voir (lecture seule)", "View (read only)")}
                          </button>
                        )}
                        </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {accountSectors(account).length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {accountSectors(account).map((entry) => (
                              <div key={entry.sector} className="flex items-center gap-2.5" data-testid="account-sector">
                                <SectorBadge sector={entry.sector} size={accountSectors(account).length > 1 ? "sm" : "md"} />
                                <div>
                                  <p className="font-medium">{sectorLabel(entry.sector, tx)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {entry.departments.length > 0
                                      ? entry.departments.map((id) => activityLabel(entry.sector, id, tx) ?? id).join(", ")
                                      : "—"}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{tx("Onboarding pas fini", "Not onboarded")}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusTag tone={PLAN_TONE[account.effective_plan]} size="xs" className="mb-1.5">
                          {PLAN_NAMES[account.effective_plan]}
                        </StatusTag>
                        <br />
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
                        {days > 0 && (
                          <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (days / 30) * 100)}%` }} />
                          </div>
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
                      <td className="px-3 py-3 text-right tabular-nums">
                        {account.alerts > 0 ? (
                          <StatusTag tone="danger" size="xs">{account.alerts}</StatusTag>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
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

      <AdminSites />

      <AdminChecks />

      <AdminGuard />

      <AdminThresholds />

      <p className="text-xs text-muted-foreground">
        {tx(
          "Comptes et compteurs seulement : les données des entreprises restent les leurs. Les droits admin se donnent en SQL (migrations/005_admin.sql).",
          "Accounts and counts only: companies' data stays theirs. Admin rights are granted in SQL (migrations/005_admin.sql)."
        )}
      </p>
    </div>
  )
}
