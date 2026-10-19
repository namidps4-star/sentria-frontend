"use client"

import { useEffect, useMemo, useState } from "react"

import { rememberActiveSite } from "@/lib/active-site"
import { API_BASE, apiFetch } from "@/lib/api"
import { useTx } from "@/lib/i18n"
import { Eye } from "@/lib/icons"
import { sectorLabel } from "@/lib/priorities"
import { setViewAs } from "@/lib/view-as"

/* Every site of every company, for SentrIA staff (the founder's overview).
 * Names and counts only. "View" opens that company on that site, read only
 * (lib/view-as.ts). The API checks the admin flag on every call. */

type AdminSite = {
  id: string
  company_id: string
  company_name: string | null
  name: string
  location: string
  sector: string | null
  status: string | null
  alerts: number
  critical: number
}

export function AdminSites() {
  const tx = useTx()
  const [sites, setSites] = useState<AdminSite[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const res = await apiFetch(`${API_BASE}/admin/sites`)
        const body = await res.json().catch(() => null)

        if (!alive) return

        if (res.ok && Array.isArray(body?.sites)) setSites(body.sites)
        else setFailed(true)
      } catch {
        if (alive) setFailed(true)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return (sites ?? []).filter(
      (site) => !needle || `${site.company_name ?? ""} ${site.name} ${site.location}`.toLowerCase().includes(needle)
    )
  }, [sites, query])

  return (
    <section data-testid="admin-sites" className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h3 className="font-heading text-lg font-bold">{tx("Tous les sites", "All sites")}</h3>
          <p className="text-xs text-muted-foreground">
            {tx("Les sites de toutes les entreprises. Lecture seule.", "The sites of every company. Read only.")}
          </p>
        </div>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={tx("Rechercher un site", "Search sites")}
          placeholder={tx("Entreprise ou site…", "Company or site…")}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm sm:w-64 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {failed ? (
        <p className="p-5 text-sm text-muted-foreground">{tx("Les sites n'ont pas pu être chargés.", "The sites could not be loaded.")}</p>
      ) : sites === null ? (
        <p className="p-5 text-sm text-muted-foreground">{tx("Chargement des sites…", "Loading sites…")}</p>
      ) : shown.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{tx("Aucun site.", "No sites.")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((site) => (
            <li key={site.id} data-testid="admin-site" className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{site.company_name || tx("(sans nom)", "(no name)")} · {site.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[site.sector ? sectorLabel(site.sector, tx) : null, site.location].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {tx(`${site.alerts} alertes`, `${site.alerts} alerts`)}
                {site.critical > 0 && <span className="font-semibold text-[var(--tag-danger-fg)]"> · {site.critical} {tx("critiques", "critical")}</span>}
              </span>
              <button
                type="button"
                data-testid="admin-site-view"
                onClick={() => {
                  setViewAs({ company_id: site.company_id, name: site.company_name || site.name })
                  rememberActiveSite(site.id)
                  window.location.assign("/")
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {tx("Voir (lecture seule)", "View (read only)")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
