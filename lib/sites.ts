/* The sites a company runs, saved with the account like the wholesalers.
 *
 * Only what the person typed or switched on is stored: the name, the place,
 * the sector, and which data sources they connected. The figures a site shows
 * (assets, alerts, health) are not stored: nothing feeds them yet, and a
 * stored zero would read as a measure. */

import { requestAccountSave } from "@/lib/account"
import { SITES_CHANGED_EVENT, SITES_RESET_EVENT, activeSiteId, rememberActiveSite } from "@/lib/active-site"
import { API_BASE, apiFetch } from "@/lib/api"
import { PLAN_UPDATED_EVENT } from "@/lib/plans"
import { useEffect, useSyncExternalStore } from "react"

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
  /** Alerts the API holds for this site (server mode only). */
  alerts?: number
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

/* ------------------------- the sites the account holds ------------------------ */

/* Two homes for the list. When the API has its sites table (migration 016) the
 * sites live there, and every alert, recommendation and upload is cut to one of
 * them. Before that, or when the API cannot be reached, the list stays in the
 * account profile as it did (`local`), and nothing is cut. */

export type SitesMode = "server" | "local"

export type SitesState = {
  /** false until the first answer. */
  ready: boolean
  mode: SitesMode
  sites: StoredSite[]
  /** The site the app shows: always one of `sites`, or null with none. */
  activeId: string | null
}

export type SiteResult = { ok: true } | { ok: false; code: string }

const NOT_READY: SitesState = { ready: false, mode: "local", sites: [], activeId: null }
let state: SitesState = NOT_READY
const listeners = new Set<() => void>()

function publish(next: SitesState) {
  state = next
  listeners.forEach((listener) => listener())
}

/** The first of the sites, or the one remembered when it is still there. */
function pickActive(sites: StoredSite[], mode: SitesMode): string | null {
  if (mode !== "server" || sites.length === 0) return null

  const remembered = activeSiteId()

  return sites.some((s) => s.id === remembered) ? remembered : sites[0].id
}

function fromApi(row: unknown): StoredSite | null {
  const site = parseSites(JSON.stringify([row]))[0]

  if (!site) return null

  const alerts = row && typeof row === "object" ? (row as Record<string, unknown>).alerts : undefined

  return { ...site, synced: site.sources.some((s) => s.synced), alerts: typeof alerts === "number" ? alerts : undefined }
}

async function api(path: string, init?: RequestInit) {
  return apiFetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
}

/** Reads the sites again, from the API when it has the table. The sites an
 *  account kept in its profile before are moved to the API once, the first
 *  time it has the table and holds none. */
let inflight: Promise<void> | null = null

export function refreshSites(): Promise<void> {
  if (!inflight) {
    inflight = readSitesNow().finally(() => {
      inflight = null
    })
  }

  return inflight
}

async function readSitesNow(): Promise<void> {
  let next: SitesState

  try {
    const res = await api("/sites")
    const body = res.ok ? await res.json() : null

    if (!body || body.persisted !== true || !Array.isArray(body.sites)) throw new Error("not persisted")

    let sites = (body.sites as unknown[]).map(fromApi).filter((s): s is StoredSite => s !== null)

    if (sites.length === 0) {
      const old = readSites()

      if (old.length > 0) {
        for (const site of old) {
          await api("/sites", { method: "POST", body: JSON.stringify(site) })
        }

        const again = await api("/sites")
        const body2 = again.ok ? await again.json() : null

        if (body2 && Array.isArray(body2.sites) && body2.sites.length > 0) {
          sites = (body2.sites as unknown[]).map(fromApi).filter((s): s is StoredSite => s !== null)
          writeSites([])
        }
      }
    }

    next = { ready: true, mode: "server", sites, activeId: pickActive(sites, "server") }
  } catch {
    const sites = readSites()

    next = { ready: true, mode: "local", sites, activeId: null }
  }

  const changed = rememberActiveSite(next.activeId)
  publish(next)

  // A view that shows a site's data fetches again only when the site it shows
  // changes, not at every read of the list.
  if (changed) window.dispatchEvent(new Event(SITES_CHANGED_EVENT))
}

/** The words an API refusal maps to are the view's: this only says why. */
async function refusal(res: Response): Promise<SiteResult> {
  let code = `HTTP ${res.status}`

  try {
    const body = await res.json()
    if (body && typeof body.error_code === "string") code = body.error_code
  } catch {
    /* no body */
  }

  return { ok: false, code }
}

export async function addSite(fields: Pick<StoredSite, "name" | "location" | "sector">): Promise<SiteResult & { id?: string }> {
  if (state.mode === "server") {
    const res = await api("/sites", { method: "POST", body: JSON.stringify(fields) })

    if (!res.ok) return refusal(res)

    const made = fromApi(await res.json())
    await refreshSites()

    return { ok: true, id: made?.id }
  }

  const site: StoredSite = {
    id: `site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ...fields,
    status: "offline",
    synced: false,
    sources: SOURCE_TYPES.map((type) => ({ type, connected: false, synced: false })),
  }

  localCommit([...state.sites, site])

  return { ok: true, id: site.id }
}

export async function editSite(id: string, patch: Partial<Pick<StoredSite, "name" | "location" | "sector" | "status" | "sources">>): Promise<SiteResult> {
  if (state.mode === "server") {
    const res = await api(`/sites/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) })

    if (!res.ok) return refusal(res)

    await refreshSites()

    return { ok: true }
  }

  localCommit(
    state.sites.map((site) =>
      site.id === id
        ? { ...site, ...patch, synced: patch.sources ? patch.sources.some((s) => s.synced) : site.synced }
        : site
    )
  )

  return { ok: true }
}

export async function deleteSite(id: string): Promise<SiteResult> {
  if (state.mode === "server") {
    const res = await api(`/sites/${encodeURIComponent(id)}`, { method: "DELETE" })

    if (!res.ok) return refusal(res)

    await refreshSites()

    return { ok: true }
  }

  localCommit(state.sites.filter((site) => site.id !== id))

  return { ok: true }
}

function localCommit(sites: StoredSite[]) {
  writeSites(sites)
  publish({ ...state, sites })
}

/** Chooses the site the app shows. Every view that shows a site's data fetches
 *  again. */
export function chooseSite(id: string) {
  if (state.mode !== "server" || !state.sites.some((s) => s.id === id)) return

  if (rememberActiveSite(id)) {
    publish({ ...state, activeId: id })
    window.dispatchEvent(new Event(SITES_CHANGED_EVENT))
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

const getState = () => state
const getServerState = () => NOT_READY
let started = false

function start() {
  if (started) return

  started = true
  void refreshSites()
}

if (typeof window !== "undefined") {
  // One pair of listeners for the whole app, however many views ask for the sites.
  window.addEventListener(PLAN_UPDATED_EVENT, () => {
    if (started) void refreshSites()
  })
  window.addEventListener(SITES_RESET_EVENT, () => {
    started = false
    publish(NOT_READY)
  })
}

/** The sites, from one list every view shares. The first view to ask starts
 *  the read; the list is read again when the account finishes loading, and
 *  emptied on sign out. */
export function useSites(): SitesState {
  useEffect(start, [])

  return useSyncExternalStore(subscribe, getState, getServerState)
}

/** A change of site, for a view that shows a site's data: it fetches again
 *  when the returned number changes. */
export function useSiteVersion(): string | null {
  const { activeId } = useSites()

  return activeId
}
