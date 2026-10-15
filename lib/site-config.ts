/* A site's own settings on the dashboard (F-SITESCOPE).
 *
 * The onboarding writes the account's sector, departments and priorities into
 * a few localStorage values, and every view reads them. A site set up through
 * "Add a site" has its own: showing that site writes them, so the dashboard,
 * the sidebar and the upload follow it. The account's own settings are kept
 * the first time this happens and put back for a site that has none. */

import { activeDepartment } from "@/lib/active-site"
import { normalizeOpsType, writeOpsTypes, type SingleOpsType } from "@/lib/activities"
import { DEPARTMENTS_KEY } from "@/lib/plans"
import type { StoredSite } from "@/lib/sites"

/** The values a site can override. */
const CONFIG_KEYS = [
  "sentria_sector",
  "sentria_sectors",
  "sentria_business_type",
  DEPARTMENTS_KEY,
  "sentria_equipment",
  "sentria_monitoring",
  "sentria_ops_types",
  "sentria_ops_type",
] as const

/** The account's own values, kept the first time a site's replace them. */
export const BASE_CONFIG_KEY = "sentria_base_config"

type Snapshot = Record<string, string | null>

function snapshot(): Snapshot {
  const out: Snapshot = {}

  for (const key of CONFIG_KEYS) out[key] = localStorage.getItem(key)

  return out
}

function put(values: Snapshot) {
  for (const key of CONFIG_KEYS) {
    const value = values[key]

    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  }
}

/** Shows `site`'s settings: its own when it was set up through "Add a site",
 *  else the account's. Returns true when a value changed. */
export function applySiteConfig(site: StoredSite | null): boolean {
  if (typeof window === "undefined") return false

  try {
    const before = JSON.stringify(snapshot())
    const saved = localStorage.getItem(BASE_CONFIG_KEY)

    if (site && site.configured) {
      if (!saved) localStorage.setItem(BASE_CONFIG_KEY, before)

      // The department shown: the one picked in the top-bar menu, else the first.
      const picked = activeDepartment()
      const department = picked && site.departments.includes(picked) ? picked : (site.departments[0] ?? null)

      const next: Snapshot = {
        sentria_sector: site.sector,
        sentria_sectors: JSON.stringify([site.sector]),
        sentria_business_type: department,
        [DEPARTMENTS_KEY]: site.departments.length > 0 ? JSON.stringify({ [site.sector]: site.departments }) : null,
        sentria_equipment: JSON.stringify(site.priorities),
        sentria_monitoring: JSON.stringify(site.priorities),
        sentria_ops_types: null,
        sentria_ops_type: null,
      }

      put(next)

      if (site.sector === "logistics") {
        const ops = site.departments
          .map((id) => normalizeOpsType(id))
          .filter((t): t is SingleOpsType => !!t && t !== "multi")

        if (ops.length > 0) writeOpsTypes(ops)
      }
    } else if (saved) {
      put(JSON.parse(saved) as Snapshot)
    }

    return JSON.stringify(snapshot()) !== before
  } catch {
    return false
  }
}

export type AccountSetup = { sector: string; departments: string[]; priorities: string[] }

/** The sector, departments and priorities the account chose in its onboarding:
 *  the kept copy when a site's settings are showing, else the live values. */
export function readAccountSetup(): AccountSetup | null {
  if (typeof window === "undefined") return null

  try {
    const base = localStorage.getItem(BASE_CONFIG_KEY)
    const values: Snapshot = base ? (JSON.parse(base) as Snapshot) : snapshot()
    const sector = values.sentria_sector

    if (!sector || sector === "all") return null

    let departments: string[] = []

    try {
      const map = JSON.parse(values[DEPARTMENTS_KEY] ?? "null")
      if (map && Array.isArray(map[sector])) departments = map[sector].filter((d: unknown): d is string => typeof d === "string")
    } catch {
      /* no departments map */
    }

    if (departments.length === 0 && values.sentria_business_type) departments = [values.sentria_business_type]

    let priorities: string[] = []

    try {
      const list = JSON.parse(values.sentria_equipment ?? "null")
      if (Array.isArray(list)) priorities = list.filter((p: unknown): p is string => typeof p === "string")
    } catch {
      /* none */
    }

    return { sector, departments, priorities }
  } catch {
    return null
  }
}
