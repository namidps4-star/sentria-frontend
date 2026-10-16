/* The sites a company runs, saved with the account like the wholesalers.
 *
 * Only what the person typed or switched on is stored: the name, the place,
 * the sector, and which data sources they connected. The figures a site shows
 * (assets, alerts, health) are not stored: nothing feeds them yet, and a
 * stored zero would read as a measure. */

import { requestAccountSave } from "@/lib/account"
import { SITES_CHANGED_EVENT, SITES_RESET_EVENT, activeDepartment, activeSiteId, rememberActiveDepartment, rememberActiveSite } from "@/lib/active-site"
import { API_BASE, apiFetch } from "@/lib/api"
import { PLAN_UPDATED_EVENT } from "@/lib/plans"
import { applySiteConfig, readAccountSetup } from "@/lib/site-config"
import { useEffect, useSyncExternalStore } from "react"

export const SITES_KEY = "sentria_sites"
export const MAX_STORED_SITES = 100

export const SITE_SECTORS = ["industry", "health", "agriculture", "transportation", "logistics", "energy", "commerce"] as const
export const SITE_STATUSES = ["connected", "warning", "offline"] as const
export const SOURCE_TYPES = ["csv", "api", "erp", "iot"] as const

/** `wanted`: the way the site was set up to receive data. `connected` and
 *  `synced`: it is actually connected, and has sent data. */
export type StoredSource = { type: (typeof SOURCE_TYPES)[number]; wanted: boolean; connected: boolean; synced: boolean }

export type StoredSite = {
  id: string
  name: string
  location: string
  sector: (typeof SITE_SECTORS)[number]
  status: (typeof SITE_STATUSES)[number]
  synced: boolean
  sources: StoredSource[]
  /** What the site runs and monitors, as the onboarding asks. */
  departments: string[]
  priorities: string[]
  /** Set up through "Add a site": the app then shows this site's own
   *  sector and departments. A site from before keeps the account's. */
  configured: boolean
  /** Alerts the API holds for this site (server mode only). */
  alerts?: number
  /** Figures read from the site's own alerts (server mode only). Absent when
   *  the site has none, or the API cannot say: never a made-up zero. */
  stats?: SiteStats
}

export type SiteStats = { alerts: number; critical: number; warnings: number; assets: number; last: string | null }

function parseStats(value: unknown): SiteStats | undefined {
  if (!value || typeof value !== "object") return undefined
  const v = value as Record<string, unknown>
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0)

  return { alerts: n(v.alerts), critical: n(v.critical), warnings: n(v.warnings), assets: n(v.assets), last: typeof v.last === "string" ? v.last : null }
}

function idList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []

  return value.filter((v): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9_-]{0,59}$/.test(v)).slice(0, limit)
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

    return { type, wanted: found?.wanted === true, connected: found?.connected === true, synced: found?.synced === true }
  })

  return {
    id: r.id,
    name: r.name.slice(0, 80),
    location: typeof r.location === "string" ? r.location.slice(0, 120) : "",
    sector,
    status,
    synced: r.synced === true,
    sources,
    departments: idList(r.departments, 8),
    priorities: idList(r.priorities, 40),
    configured: r.configured === true,
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
  /** The department of that site the dashboard opens on, or null. */
  activeDepartment: string | null
}

export type SiteResult = { ok: true } | { ok: false; code: string; needs?: string }

const NOT_READY: SitesState = { ready: false, mode: "local", sites: [], activeId: null, activeDepartment: null }
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

/** The remembered department when it is one of the site's, else null. */
function pickDepartment(sites: StoredSite[], activeId: string | null): string | null {
  const site = sites.find((s) => s.id === activeId)
  const remembered = activeDepartment()

  return site && remembered && site.departments.includes(remembered) ? remembered : null
}

function fromApi(row: unknown): StoredSite | null {
  const site = parseSites(JSON.stringify([row]))[0]

  if (!site) return null

  const alerts = row && typeof row === "object" ? (row as Record<string, unknown>).alerts : undefined

  const stats = row && typeof row === "object" ? parseStats((row as Record<string, unknown>).stats) : undefined

  return { ...site, synced: site.sources.some((s) => s.synced), alerts: typeof alerts === "number" ? alerts : undefined, stats }
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
/** "1" once the setup the account chose in its onboarding has been made a site
 *  (or already was one): a site deleted later is not made again. */
const MAIN_SITE_KEY = "sentria_main_site_done"

const ID_OK = /^[a-z0-9][a-z0-9_-]{0,59}$/

/** The sector, departments and priorities the account chose in its onboarding
 *  become its first site, so the dashboard it already had is one of its sites
 *  and can be come back to from the menu and the Sites page. Returns the sites
 *  as they are after. */
async function adoptSetup(sites: StoredSite[]): Promise<StoredSite[]> {
  try {
    if (localStorage.getItem(MAIN_SITE_KEY) === "1" || !["true", "1"].includes(localStorage.getItem("sentria_onboarded") ?? "")) return sites

    const setup = readAccountSetup()

    if (!setup || !(SITE_SECTORS as readonly string[]).includes(setup.sector)) return sites

    const done = () => {
      localStorage.setItem(MAIN_SITE_KEY, "1")
      requestAccountSave()
    }

    if (sites.some((site) => site.sector === setup.sector)) {
      done()
      return sites
    }

    let wantedSources: string[] = []

    try {
      const saved = JSON.parse(localStorage.getItem("sentria_data_sources") ?? "[]")
      if (Array.isArray(saved)) wantedSources = saved.filter((v: unknown): v is string => typeof v === "string")
    } catch {
      /* none */
    }

    const res = await api("/sites", {
      method: "POST",
      body: JSON.stringify({
        name: localStorage.getItem("sentria_language") === "en" ? "Main site" : "Site principal",
        location: "",
        sector: setup.sector,
        departments: setup.departments.filter((d) => ID_OK.test(d)),
        priorities: setup.priorities.filter((d) => ID_OK.test(d)),
        sources: SOURCE_TYPES.map((type) => ({ type, wanted: wantedSources.includes(type), connected: false, synced: false })),
        configured: true,
      }),
    })

    // A plan that does not allow it, or an API that cannot: try again at the next read.
    if (!res.ok) return sites

    done()

    const again = await api("/sites")
    const body = again.ok ? await again.json() : null

    return body && Array.isArray(body.sites)
      ? (body.sites as unknown[]).map(fromApi).filter((s): s is StoredSite => s !== null)
      : sites
  } catch {
    return sites
  }
}

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

    sites = await adoptSetup(sites)

    const activeId = pickActive(sites, "server")

    next = { ready: true, mode: "server", sites, activeId, activeDepartment: pickDepartment(sites, activeId) }
  } catch {
    const sites = readSites()

    next = { ready: true, mode: "local", sites, activeId: null, activeDepartment: null }
  }

  const changed = rememberActiveSite(next.activeId)
  rememberActiveDepartment(next.activeDepartment)
  // The site shown brings its own sector and departments with it.
  const reshaped =
    next.mode === "server" ? applySiteConfig(next.sites.find((s) => s.id === next.activeId) ?? null) : false
  publish(next)

  // A view that shows a site's data fetches again only when the site it shows
  // changes, not at every read of the list.
  if (changed || reshaped) window.dispatchEvent(new Event(SITES_CHANGED_EVENT))
}

/** The words an API refusal maps to are the view's: this only says why. */
async function refusal(res: Response): Promise<SiteResult> {
  let code = `HTTP ${res.status}`
  let needs: string | undefined

  try {
    const body = await res.json()
    if (body && typeof body.error_code === "string") code = body.error_code
    if (body && typeof body.needs === "string") needs = body.needs
  } catch {
    /* no body */
  }

  return { ok: false, code, needs }
}

export type NewSite = Pick<StoredSite, "name" | "location" | "sector"> &
  Partial<Pick<StoredSite, "departments" | "priorities" | "configured" | "sources">>

export async function addSite(fields: NewSite): Promise<SiteResult & { id?: string }> {
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
    sources: fields.sources ?? SOURCE_TYPES.map((type) => ({ type, wanted: false, connected: false, synced: false })),
    departments: fields.departments ?? [],
    priorities: fields.priorities ?? [],
    configured: fields.configured ?? false,
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

/** Brings the company's earlier alerts of this site's sector into the site
 *  (server mode only). Returns how many moved, or null when it could not. */
export async function claimSite(id: string): Promise<number | null> {
  if (state.mode !== "server") return null

  try {
    const res = await api(`/sites/${encodeURIComponent(id)}/claim`, { method: "POST" })

    if (!res.ok) return null

    const body = (await res.json()) as { moved?: number }

    await refreshSites()
    window.dispatchEvent(new Event(SITES_CHANGED_EVENT))

    return typeof body.moved === "number" ? body.moved : 0
  } catch {
    return null
  }
}

function localCommit(sites: StoredSite[]) {
  writeSites(sites)
  publish({ ...state, sites })
}

/** Chooses the site the app shows. Every view that shows a site's data fetches
 *  again. */
export function chooseSite(id: string, department: string | null = null) {
  if (state.mode !== "server" || !state.sites.some((s) => s.id === id)) return

  const site = state.sites.find((s) => s.id === id) ?? null
  const dept = department && site?.departments.includes(department) ? department : null
  const moved = rememberActiveSite(id)
  const movedDepartment = rememberActiveDepartment(dept)
  const reshaped = applySiteConfig(site)

  if (moved || movedDepartment || reshaped) {
    publish({ ...state, activeId: id, activeDepartment: dept })
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
  const { activeId, activeDepartment: department } = useSites()

  return activeId ? `${activeId}|${department ?? ""}` : null
}
