/* What the dashboard charts plot, as plain data: one series per sector, one
   point per day, and the donut's slices. No React here, so it can be tested
   on its own (tests/e2e/charts.js). The colours themselves are theme tokens
   in app/globals.css (--series-N, --slice-N), validated by
   scripts/validate-palette.mjs. */

import { asRecord, valueAtRisk, type AlertParams } from "@/lib/value-at-risk"

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
  equipment?: string
  severity?: string
  alert_key?: string | null
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

/* ------------------------------ a smooth line ----------------------------- */

/** An SVG path through the points as a smooth curve that never overshoots:
 *  monotone cubic (Fritsch-Carlson). Between two points the curve stays
 *  between their heights, so a dip to zero never swings below zero and a
 *  flat stretch stays flat. */
export function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  const n = points.length
  const f = (v: number) => Number(v.toFixed(2))
  if (n === 0) return ""
  if (n === 1) return `M ${f(points[0][0])} ${f(points[0][1])}`

  const dx = points.slice(1).map((p, i) => p[0] - points[i][0])
  const slope = points.slice(1).map((p, i) => (dx[i] === 0 ? 0 : (p[1] - points[i][1]) / dx[i]))

  const m = Array<number>(n)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / slope[i]
    const b = m[i + 1] / slope[i]
    const sum = a * a + b * b
    if (sum > 9) {
      const t = 3 / Math.sqrt(sum)
      m[i] = t * a * slope[i]
      m[i + 1] = t * b * slope[i]
    }
  }

  let d = `M ${f(points[0][0])} ${f(points[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const third = dx[i] / 3
    d += ` C ${f(x0 + third)} ${f(y0 + m[i] * third)}, ${f(x1 - third)} ${f(y1 - m[i + 1] * third)}, ${f(x1)} ${f(y1)}`
  }
  return d
}

/* --------------------- readings against their limit ---------------------- */

const asNumber = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

const familyOf = (alertKey?: string | null) => {
  const parts = (alertKey ?? "").split(".")
  return parts[1] || parts[0] || ""
}

const time = (date: string) => {
  const at = new Date(date).getTime()
  return Number.isNaN(at) ? -Infinity : at
}

/** The newest alert for each key. */
function newestBy<T extends { date: string }>(items: T[], keyOf: (item: T) => string): T[] {
  const best = new Map<string, T>()
  for (const item of items) {
    const key = keyOf(item)
    const held = best.get(key)
    if (!held || time(item.date) > time(held.date)) best.set(key, item)
  }
  return [...best.values()]
}

export type LimitSide = "max" | "min"

export type Reading = {
  equipment: string
  /** The alert's family ("temperature", "fuel"): the frontend names it. */
  family: string
  reading: number
  limit: number
  side: LimitSide
  /** "" when the alert states none. */
  unit: string
  severity: string
  date: string
}

/** The alerts that carry a reading and the limit it crossed (the backend's
 *  `limit`, `limit_side`, `limit_unit` params), one per piece of equipment
 *  and family: the newest. The most severe first, then the furthest past its
 *  limit. `total` counts them all, `shown` the first `max`. */
export function gaugeReadings(
  alerts: ChartAlert[],
  max = 4
): { shown: Reading[]; total: number } {
  const readings: (Reading & { overshoot: number })[] = []

  for (const alert of alerts) {
    const params = asRecord(alert.params)
    if (!params || "currency" in params) continue

    const limit = asNumber(params.limit)
    const side = params.limit_side
    const reading = asNumber(params.value) ?? asNumber(params.level) ?? asNumber(params.temp)
    if (limit === null || reading === null || (side !== "max" && side !== "min")) continue

    const past = side === "max" ? reading / (limit || 1) : (limit || 1) / (reading || Number.MIN_VALUE)
    readings.push({
      equipment: alert.equipment ?? "",
      family: familyOf(alert.alert_key),
      reading,
      limit,
      side,
      unit: typeof params.limit_unit === "string" ? params.limit_unit : "",
      severity: alert.severity ?? "",
      date: alert.date,
      overshoot: Number.isFinite(past) ? past : 0,
    })
  }

  const latest = newestBy(readings, (r) => `${r.equipment}|${r.family}`).sort(
    (a, b) =>
      Number(b.severity === "CRITICAL") - Number(a.severity === "CRITICAL") ||
      b.overshoot - a.overshoot ||
      time(b.date) - time(a.date)
  )

  const plain = (r: Reading & { overshoot: number }): Reading => ({
    equipment: r.equipment,
    family: r.family,
    reading: r.reading,
    limit: r.limit,
    side: r.side,
    unit: r.unit,
    severity: r.severity,
    date: r.date,
  })

  return { shown: latest.slice(0, max).map(plain), total: latest.length }
}

/** How a reading sits on its gauge: the top of the scale, how far the arc
 *  is filled and where the limit mark goes (the last two from 0 to 1).
 *  A percentage always runs 0-100; otherwise the scale leaves room past the
 *  limit (a quarter more for a "max", twice for a "min"). */
export function gaugeScale(g: { reading: number; limit: number; side: LimitSide; unit: string }) {
  const room = g.side === "max" ? g.limit * 1.25 : g.limit * 2
  const top = g.unit === "%" ? 100 : Math.max(room, g.reading * 1.05)
  const max = top > 0 ? top : 1
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return { max, fill: clamp(g.reading / max), mark: clamp(g.limit / max) }
}

export type StockRow = {
  equipment: string
  stock: number
  min: number
  /** stock / min: under 1 is below the minimum. */
  ratio: number
  date: string
}

/** The alerts that carry a stock and its minimum (`stock`, `min_stock`), the
 *  newest per item, the furthest below its minimum first. */
export function stockRows(alerts: ChartAlert[], max = 6): { shown: StockRow[]; total: number } {
  const rows: StockRow[] = []

  for (const alert of alerts) {
    const params = asRecord(alert.params)
    if (!params) continue
    const stock = asNumber(params.stock)
    const min = asNumber(params.min_stock)
    if (stock === null || min === null || min <= 0 || stock < 0) continue
    rows.push({ equipment: alert.equipment ?? "", stock, min, ratio: stock / min, date: alert.date })
  }

  const latest = newestBy(rows, (r) => r.equipment).sort((a, b) => a.ratio - b.ratio || time(b.date) - time(a.date))
  return { shown: latest.slice(0, max), total: latest.length }
}
