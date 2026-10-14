/* A site's own settings on the dashboard (F-SITESCOPE).
 *
 * The onboarding writes the account's sector, departments and priorities into
 * a few localStorage values, and every view reads them. A site set up through
 * "Add a site" has its own: showing that site writes them, so the dashboard,
 * the sidebar and the upload follow it. The account's own settings are kept
 * the first time this happens and put back for a site that has none. */

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

      const next: Snapshot = {
        sentria_sector: site.sector,
        sentria_sectors: JSON.stringify([site.sector]),
        sentria_business_type: site.departments[0] ?? null,
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
