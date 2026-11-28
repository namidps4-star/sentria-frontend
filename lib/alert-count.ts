/* One alert = one asset + one check (equipment + alert_key).
 *
 * The upload saves one row per fire, so the same alert can appear many
 * times. Every screen must count and show alerts, not rows. These
 * helpers enforce that in one place.
 *
 * Key rule: dedupe (newest wins) for totals, lists and severity splits.
 * For anything per-day (trend, week-over-week), count distinct keys
 * inside each day bucket, never dedupe globally first.
 */

type Keyed = { equipment: string; alert_key?: string | null }
type Dated = Keyed & { date: string }

const SEP = "\u0000"

/** The identity of an alert: equipment + alert_key. */
export function alertKey(row: Keyed): string {
  return `${row.equipment}${SEP}${row.alert_key ?? ""}`
}

/** How many distinct alerts a list holds. */
export function countAlerts(rows: ReadonlyArray<Keyed>): number {
  return new Set(rows.map(alertKey)).size
}

/** One row per alert, the newest date wins. Order follows the input
 *  (first occurrence of each key keeps its place). */
export function latestAlerts<T extends Dated>(rows: ReadonlyArray<T>): T[] {
  const best = new Map<string, T>()
  const order: string[] = []

  for (const row of rows) {
    const key = alertKey(row)
    const held = best.get(key)
    const at = new Date(row.date).getTime()

    if (!held) {
      best.set(key, row)
      order.push(key)
    } else if (at > new Date(held.date).getTime()) {
      best.set(key, row)
    }
  }

  return order.map((key) => best.get(key)!)
}

/** Distinct alerts per local calendar day: for a 7-day trend, each day
 *  counts each key at most once, so a second upload on the same day
 *  does not double the number. Returns an array oldest-first. */
export function countAlertDays(
  rows: ReadonlyArray<Dated>,
  days: number,
  now: Date = new Date()
): number[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const buckets: Set<string>[] = Array.from({ length: days }, () => new Set())

  for (const row of rows) {
    const at = new Date(row.date)
    if (Number.isNaN(at.getTime())) continue

    const start = new Date(at.getFullYear(), at.getMonth(), at.getDate())
    const diff = Math.round((today.getTime() - start.getTime()) / 86_400_000)

    if (diff >= 0 && diff < days) {
      buckets[days - 1 - diff].add(alertKey(row))
    }
  }

  return buckets.map((s) => s.size)
}

/** How many distinct calendar days an asset+check has fired on. For
 *  recurrence: "keeps coming back" means 2+ different days. */
export function recurrenceDays(
  equipment: string,
  alertKeyValue: string | null | undefined,
  rows: ReadonlyArray<Dated>
): number {
  const target = `${equipment}${SEP}${alertKeyValue ?? ""}`
  const days = new Set<string>()

  for (const row of rows) {
    if (alertKey(row) !== target) continue
    const at = new Date(row.date)
    if (Number.isNaN(at.getTime())) continue
    days.add(`${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`)
  }

  return days.size
}
