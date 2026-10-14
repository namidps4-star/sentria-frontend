/* The sites a company runs, saved with the account like the wholesalers.
 *
 * Only what the person typed or switched on is stored: the name, the place,
 * the sector, and which data sources they connected. The figures a site shows
 * (assets, alerts, health) are not stored: nothing feeds them yet, and a
 * stored zero would read as a measure. */

import { requestAccountSave } from "@/lib/account"

export const SITES_KEY = "sentria_sites"
export const MAX_STORED_SITES = 100

export const SITE_SECTORS = ["industry", "health", "agriculture", "transportation", "logistics", "energy"] as const
export const SITE_STATUSES = ["connected", "warning", "offline"] as const
export const SOURCE_TYPES = ["csv", "api", "iot"] as const

export type StoredSource = { type: (typeof SOURCE_TYPES)[number]; connected: boolean; synced: boolean }

export type StoredSite = {
  id: string
  name: string
  location: string
  sector: (typeof SITE_SECTORS)[number]
  status: (typeof SITE_STATUSES)[number]
  synced: boolean
  sources: StoredSource[]
}

function parseOne(raw: unknown): StoredSite | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== "string" || !r.id || typeof r.name !== "string" || !r.name.trim()) return null

  const sector = (SITE_SECTORS as readonly unknown[]).includes(r.sector) ? (r.sector as StoredSite["sector"]) : "industry"
  const status = (SITE_STATUSES as readonly unknown[]).includes(r.status) ? (r.status as StoredSite["status"]) : "offline"
  const given = Array.isArray(r.sources) ? r.sources : []
  const sources = SOURCE_TYPES.map((type): StoredSource => {
    const found = given.find((s) => s && typeof s === "object" && (s as Record<string, unknown>).type === type) as
      | Record<string, unknown>
      | undefined

    return { type, connected: found?.connected === true, synced: found?.synced === true }
  })

  return {
    id: r.id,
    name: r.name.slice(0, 80),
    location: typeof r.location === "string" ? r.location.slice(0, 120) : "",
    sector,
    status,
    synced: r.synced === true,
    sources,
  }
}

export function parseSites(text: string | null): StoredSite[] {
  if (!text) return []

  try {
    const data = JSON.parse(text)
    if (!Array.isArray(data)) return []

    return data.map(parseOne).filter((s): s is StoredSite => s !== null).slice(0, MAX_STORED_SITES)
  } catch {
    return []
  }
}

export function readSites(): StoredSite[] {
  if (typeof window === "undefined") return []

  try {
    return parseSites(localStorage.getItem(SITES_KEY))
  } catch {
    return []
  }
}

export function writeSites(list: StoredSite[]) {
  try {
    localStorage.setItem(SITES_KEY, JSON.stringify(list.slice(0, MAX_STORED_SITES)))
    requestAccountSave()
  } catch {
    /* storage full or blocked: the page keeps what it shows */
  }
}
