/* Counts for the priorities of sectors other than Health.
 *
 * Only Health has a hand-made map from priority to alert family. For the
 * rest, a priority counts the alerts whose key or text contains one of the
 * words of its id ("cold-chain" looks for "cold" and "chain"). It is a
 * match on words, so a priority nothing names reads 0, not a guess. */

import type { HealthAlert, PriorityRow } from "./health-priorities"

const SKIP = new Set(["and", "the", "de", "du", "des", "et"])

export function priorityRows(ids: string[], alerts: HealthAlert[], rank: boolean): PriorityRow[] {
  // No alerts at all: no figures, so an empty account does not read "all clear".
  if (alerts.length === 0) {
    return ids.map((id): PriorityRow => ({ id, count: null, critical: 0, top: undefined, items: [] }))
  }

  const rows = ids.map((id): PriorityRow => {
    const words = id.toLowerCase().split(/[-_]/).filter((w) => w.length > 2 && !SKIP.has(w))
    const items = alerts.filter((a) => {
      const hay = `${a.alert_key ?? ""} ${a.equipment} ${a.message}`.toLowerCase()
      return words.some((w) => hay.includes(w))
    })

    return {
      id,
      count: items.length,
      critical: items.filter((a) => a.severity === "CRITICAL").length,
      top: items.find((a) => a.severity === "CRITICAL") ?? items[0],
      items,
    }
  })

  if (!rank) return rows
  const score = (r: PriorityRow) => r.critical * 100 + (r.count ?? 0)
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => score(b.row) - score(a.row) || a.index - b.index)
    .map(({ row }) => row)
}
