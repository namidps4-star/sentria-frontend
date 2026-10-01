/* What the dashboard charts plot, as plain data: one series per sector, one
   point per day, and the donut's slices. No React here, so it can be tested
   on its own (tests/e2e/charts.js). The colours themselves are theme tokens
   in app/globals.css (--series-N, --slice-N), validated by
   scripts/validate-palette.mjs. */

import { valueAtRisk, type AlertParams } from "@/lib/value-at-risk"

/** Each sector keeps its colour everywhere in the app: its place in this
 *  list is its `--series-N`. Append, never reorder or insert, or every
 *  sector's colour moves. A sector not listed here goes into "other". */
export const SERIES_ORDER = [
  "industry",
  "health",
  "agriculture",
  "transportation",
  "logistics",
  "energy",
  "commerce",
  "eac",
] as const

export const OTHER_KEY = "other"

export type ChartAlert = {
  date: string
  sector?: string | null
  params?: AlertParams
}

export type ChartMetric = "count" | "value"
export type ChartRange = 7 | 30 | 90
export const CHART_RANGES: ChartRange[] = [7, 30, 90]

/** The series an alert belongs to: its sector, or "other". */
export function seriesKeyOf(alert: { sector?: string | null }): string {
  const sector = alert.sector ?? ""
  return (SERIES_ORDER as readonly string[]).includes(sector) ? sector : OTHER_KEY
}

/** The CSS colour for a series: a theme token, never a literal. */
export function seriesColor(key: string): string {
  const at = (SERIES_ORDER as readonly string[]).indexOf(key)
  return at >= 0 ? `var(--series-${at + 1})` : "var(--series-other)"
}

/** The series present in these alerts, in the fixed order ("other" last). */
export function availableSeries(alerts: ChartAlert[]): string[] {
  const seen = new Set(alerts.map(seriesKeyOf))
  return [...SERIES_ORDER, OTHER_KEY].filter((key) => seen.has(key))
}

/* ------------------------------- the days -------------------------------- */

const MS_PER_DAY = 86_400_000

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** Local midnights, oldest first, ending today. */
export function dayStarts(days: number, now: Date = new Date()): Date[] {
  const today = startOfDay(now)
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(today)
    day.setDate(day.getDate() - (days - 1 - i))
    return day
  })
}

/** Which of the `days` buckets a date falls in (0 = oldest), or -1. A
 *  rounded difference, so a daylight-saving day of 23 or 25 hours still
 *  lands on the right day. */
function bucketOf(date: Date, first: Date, days: number): number {
  const at = Math.round((startOfDay(date).getTime() - first.getTime()) / MS_PER_DAY)
  return at >= 0 && at < days ? at : -1
}

/* ------------------------------ the series ------------------------------- */

export type SeriesData = {
  key: string
  values: number[]
  total: number
  /** Some of what is summed is an estimate (value metric only). */
  approx: boolean
}

export type Bucketed = { days: Date[]; series: SeriesData[] }

/** One series per requested key, one value per day. "count" is alerts per
 *  day; "value" is the value at risk per day, which means nothing across
 *  currencies: see `valueMetric`. */
export function bucketAlerts(
  alerts: ChartAlert[],
  opts: { keys: string[]; days: number; metric: ChartMetric; now?: Date }
): Bucketed {
  const days = dayStarts(opts.days, opts.now)
  const wanted = new Set(opts.keys)
  const rows = new Map<string, SeriesData>(
    opts.keys.map((key) => [key, { key, values: Array(opts.days).fill(0), total: 0, approx: false }])
  )

  for (const alert of alerts) {
    const key = seriesKeyOf(alert)
    if (!wanted.has(key)) continue

    const date = new Date(alert.date)
    if (Number.isNaN(date.getTime())) continue

    const at = bucketOf(date, days[0], opts.days)
    if (at < 0) continue

    let amount = 1
    if (opts.metric === "value") {
      const risk = valueAtRisk(alert.params)
      if (!risk) continue
      amount = risk.value
      if (risk.estimate) rows.get(key)!.approx = true
    }

    const row = rows.get(key)!
    row.values[at] += amount
    row.total += amount
  }

  return { days, series: opts.keys.map((key) => rows.get(key)!) }
}

export type ValueMetric =
  | { available: true; symbol: string }
  | { available: false; reason: "none" | "mixed" }

/** Whether the value-at-risk metric can be drawn on one axis: some alerts
 *  carry a money value, and they all name the same currency. */
export function valueMetric(alerts: ChartAlert[]): ValueMetric {
  const symbols = new Set<string>()
  for (const alert of alerts) {
    const risk = valueAtRisk(alert.params)
    if (risk) symbols.add(risk.currency)
  }
  if (symbols.size === 0) return { available: false, reason: "none" }
  if (symbols.size > 1) return { available: false, reason: "mixed" }
  return { available: true, symbol: [...symbols][0] }
}

/* -------------------------------- the axis -------------------------------- */

/** A top of axis and ticks that land on round numbers: 0 … max, at most
 *  `maxTicks` of them, whole numbers when the data are counts. */
export function niceScale(
  highest: number,
  opts: { maxTicks?: number; integer?: boolean } = {}
): { max: number; ticks: number[] } {
  const maxTicks = opts.maxTicks ?? 4
  if (!(highest > 0) || !Number.isFinite(highest)) return { max: 1, ticks: [0, 1] }
  const top = opts.integer ? Math.max(highest, 1) : highest

  const rough = top / (maxTicks - 1)
  const power = 10 ** Math.floor(Math.log10(rough))
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough && (!opts.integer || Number.isInteger(s))) ??
    Math.ceil(rough)

  const intervals = Math.ceil(top / step - 1e-9)
  const ticks = Array.from({ length: intervals + 1 }, (_, i) => Number((i * step).toFixed(10)))
  return { max: ticks[ticks.length - 1], ticks }
}

/* -------------------------------- the donut ------------------------------- */

export type SliceInput = { label: string; value: number }
export type Slice = SliceInput & { key: string; share: number }

/** At most `limit` slices of a whole. More than that and the smallest are
 *  folded into one "Other", so a part-of-a-whole never has a dozen slivers
 *  and never silently drops what it can't show. Biggest first. */
export function foldSlices(input: SliceInput[], otherLabel: string, limit = 6): Slice[] {
  const sorted = input.filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
  const total = sorted.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return []

  const folded = sorted.length > limit
  const kept = folded
    ? [
        ...sorted.slice(0, limit - 1),
        { label: otherLabel, value: sorted.slice(limit - 1).reduce((sum, s) => sum + s.value, 0) },
      ]
    : sorted

  return kept.map((s, i) => ({
    ...s,
    key: folded && i === kept.length - 1 ? OTHER_KEY : `slice-${i + 1}`,
    share: s.value / total,
  }))
}

/** The slice's colour: its rank in the ramp, "other" in the neutral. */
export function sliceColor(key: string): string {
  return key === OTHER_KEY ? "var(--slice-other)" : `var(--${key})`
}
