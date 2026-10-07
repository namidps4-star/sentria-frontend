/* The Health priorities, counted from the user's alerts.
 *
 * Four of the saved priorities are alert families (stock, cold chain,
 * temperature, expiry). "medications" is not a family: it is the number of
 * distinct medicines that have an alert. Any other saved priority (storage,
 * for instance) has no figure yet, and says so rather than showing a 0. */

export type HealthCategory = "stock" | "cold" | "temperature" | "expiry"

export const HEALTH_PRIORITY_CATEGORY: Record<string, HealthCategory | undefined> = {
  stocks: "stock",
  "cold-chain": "cold",
  temperature: "temperature",
  expiry: "expiry",
}

const FAMILIES: Record<HealthCategory, string[]> = {
  stock: ["stock", "reorder", "critical_supply"],
  cold: ["cold_chain"],
  temperature: ["temperature", "temp", "food_temp"],
  expiry: ["expiry"],
}

export type HealthAlert = {
  equipment: string
  message: string
  severity: string
  date: string
  alert_key?: string | null
}

/** The family is the second part of the key ("health.stock.low"). A key with
 *  no known family falls back to the words the old cold chain tile used. */
export function healthCategoryOf(a: HealthAlert): HealthCategory | null {
  const family = (a.alert_key ?? "").split(".")[1] ?? ""

  for (const key of Object.keys(FAMILIES) as HealthCategory[]) {
    if (FAMILIES[key].includes(family)) return key
  }

  const text = a.message.toLowerCase()
  if (text.includes("froid") || text.includes("cold")) return "cold"

  return null
}

export type PriorityRow = {
  id: string
  /** null: this priority has no figure (nothing counts it yet). */
  count: number | null
  critical: number
  top: HealthAlert | undefined
  items: HealthAlert[]
}

/** One row per saved priority. With `rank`, the most urgent comes first:
 *  critical alerts, then how many. Without it the saved order stays, which is
 *  what to show while the numbers are not known. */
export function healthRows(ids: string[], alerts: HealthAlert[], rank: boolean): PriorityRow[] {
  const rows = ids.map((id): PriorityRow => {
    const category = HEALTH_PRIORITY_CATEGORY[id]

    if (id !== "medications" && !category) {
      return { id, count: null, critical: 0, top: undefined, items: [] }
    }

    const items =
      id === "medications"
        ? Array.from(new Map(alerts.map((a) => [a.equipment, a])).values())
        : alerts.filter((a) => healthCategoryOf(a) === category)
    const critical = items.filter((a) => a.severity === "CRITICAL").length

    return {
      id,
      count: items.length,
      critical,
      top: items.find((a) => a.severity === "CRITICAL") ?? items[0],
      items,
    }
  })

  if (!rank) return rows

  const score = (r: PriorityRow) => (r.count === null ? -1 : r.critical * 100 + r.count)

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => score(b.row) - score(a.row) || a.index - b.index)
    .map(({ row }) => row)
}
