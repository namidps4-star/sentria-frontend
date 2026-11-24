/* The order card on a Tracking board card (F-JIT): the numbers behind a reorder
 * alert as the backend sends them (`reorder` on the recommendation), and how the
 * days-of-stock bar draws them. */

export type ReorderNumbers = {
  order_qty: number
  reorder_point: number
  days_of_stock: number
  buffer_days: number
  lead_days: number
}

const FIELDS = ["order_qty", "reorder_point", "days_of_stock", "buffer_days", "lead_days"] as const

/** The numbers, or null unless all five are plain numbers of zero or more. A card
 *  without them keeps its action line. */
export function readReorder(value: unknown): ReorderNumbers | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const found = value as Record<string, unknown>
  const out: Partial<ReorderNumbers> = {}

  for (const name of FIELDS) {
    const number = found[name]

    if (typeof number !== "number" || !Number.isFinite(number) || number < 0) return null

    out[name] = number
  }

  return out as ReorderNumbers
}

/** The bar is three weeks wide, so one day means the same on every card. */
export const BAR_DAYS = 21

export type BarTone = "red" | "amber" | "lime"

/** Red under a week of stock, amber under three, lime beyond. */
export function toneFor(days: number): BarTone {
  return days < 7 ? "red" : days < BAR_DAYS ? "amber" : "lime"
}

export type BarLabel = { kind: "today" } | { kind: "byDay"; day: number } | { kind: "point" }

export type BarModel = {
  tone: BarTone
  /** How much of the bar is filled, 0 to 100. */
  fillPct: number
  /** Where the reorder point sits on the bar, 0 to 100. */
  markerPct: number
  /** The reorder point in days of sales: the delivery time plus the safety buffer. */
  markerDays: number
  /** Red: "order today" at or under the reorder point, else "order by day N".
   *  Amber and lime: "reorder point". */
  label: BarLabel
  /** Near an edge the label lines up with the edge instead of centring on the marker. */
  align: "start" | "center" | "end"
}

const pct = (days: number) => Math.round((Math.min(days, BAR_DAYS) / BAR_DAYS) * 1000) / 10

export function barFor(reorder: ReorderNumbers): BarModel {
  const tone = toneFor(reorder.days_of_stock)
  const markerDays = reorder.lead_days + reorder.buffer_days
  const markerPct = pct(markerDays)
  // Whole days until the stock reaches the reorder point.
  const early = Math.floor(reorder.days_of_stock - markerDays)

  const label: BarLabel =
    tone !== "red" ? { kind: "point" } : early <= 0 ? { kind: "today" } : { kind: "byDay", day: early }

  return {
    tone,
    fillPct: pct(reorder.days_of_stock),
    markerPct,
    markerDays,
    label,
    align: markerPct < 16 ? "start" : markerPct > 84 ? "end" : "center",
  }
}
