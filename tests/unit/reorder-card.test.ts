import { describe, expect, it } from "vitest"

import { BAR_DAYS, barFor, readReorder, toneFor, type ReorderNumbers } from "@/lib/reorder-card"

const card = (days_of_stock: number, lead_days: number, buffer_days: number): ReorderNumbers => ({
  order_qty: 50, reorder_point: 40, days_of_stock, buffer_days, lead_days,
})

describe("readReorder", () => {
  const good = { order_qty: 58, reorder_point: 48, days_of_stock: 4.5, buffer_days: 9, lead_days: 3 }

  it("reads the API's numbers", () => {
    expect(readReorder(good)).toEqual(good)
  })
  it("ignores fields it does not know", () => {
    expect(readReorder({ ...good, extra: 1 })).toEqual(good)
  })
  it("wants all five, as plain numbers of zero or more", () => {
    expect(readReorder(null)).toBeNull()
    expect(readReorder(undefined)).toBeNull()
    expect(readReorder("x")).toBeNull()
    expect(readReorder([good])).toBeNull()
    expect(readReorder({})).toBeNull()
    expect(readReorder({ ...good, lead_days: undefined })).toBeNull()
    expect(readReorder({ ...good, order_qty: "58" })).toBeNull()
    expect(readReorder({ ...good, days_of_stock: Number.NaN })).toBeNull()
    expect(readReorder({ ...good, days_of_stock: Infinity })).toBeNull()
    expect(readReorder({ ...good, buffer_days: -1 })).toBeNull()
    expect(readReorder({ ...good, lead_days: null })).toBeNull()
  })
  it("accepts zero: an empty shelf is a real answer", () => {
    expect(readReorder({ ...good, days_of_stock: 0 })).not.toBeNull()
  })
})

describe("toneFor", () => {
  it("follows the alert: red for Critical, amber for any other", () => {
    expect(toneFor("CRITICAL")).toBe("red")
    expect(toneFor("WARNING")).toBe("amber")
    expect(toneFor("INFO")).toBe("amber")
    expect(toneFor(undefined)).toBe("amber")
    expect(toneFor(null)).toBe("amber")
  })
})

describe("barFor", () => {
  it("is three weeks wide", () => {
    expect(BAR_DAYS).toBe(21)
  })
  it("draws a stock-out risk: 1.5 days left, delivery 3 days, buffer 6", () => {
    expect(barFor(card(1.5, 3, 6), "CRITICAL")).toEqual({ tone: "red", fillPct: 7.1, markerPct: 42.9, markerDays: 9, label: { kind: "today" }, align: "center" })
  })
  it("says order today when the stock is already under the reorder point", () => {
    const bar = barFor(card(4.5, 3, 9), "WARNING")
    expect(bar).toMatchObject({ tone: "amber", fillPct: 21.4, markerPct: 57.1, markerDays: 12, label: { kind: "today" } })
  })
  it("says order by day N when a week of stock or less is still above the reorder point", () => {
    expect(barFor(card(6.3, 2, 3), "WARNING")).toMatchObject({ tone: "amber", fillPct: 30, markerPct: 23.8, label: { kind: "byDay", day: 1 } })
    expect(barFor(card(6.9, 2, 3), "WARNING").label).toEqual({ kind: "byDay", day: 1 })
    expect(barFor(card(5.9, 2, 3), "WARNING").label).toEqual({ kind: "today" })
  })
  it("names the reorder point from a week of stock up", () => {
    expect(barFor(card(6.99, 2, 3), "WARNING").label).toEqual({ kind: "byDay", day: 1 })
    expect(barFor(card(7, 2, 3), "WARNING").label).toEqual({ kind: "point" })
    expect(barFor(card(16, 10, 4.5), "WARNING")).toMatchObject({ tone: "amber", fillPct: 76.2, markerPct: 69, label: { kind: "point" } })
    expect(barFor(card(25, 2, 3), "WARNING")).toMatchObject({ tone: "amber", fillPct: 100, label: { kind: "point" } })
  })
  it("never turns green: an order-now card with a long delivery time stays amber", () => {
    expect(barFor(card(31, 30, 3), "WARNING")).toMatchObject({
      tone: "amber", fillPct: 100, markerPct: 100, markerDays: 33, label: { kind: "point" }, align: "end",
    })
  })
  it("keeps a long delivery time on the bar: the marker stops at the end", () => {
    const bar = barFor(card(10, 30, 5))
    expect(bar.markerPct).toBe(100)
    expect(bar.align).toBe("end")
  })
  it("lines the label up with the edge near the ends, and centres it elsewhere", () => {
    expect(barFor(card(3, 1, 1)).align).toBe("start")
    expect(barFor(card(3, 3, 0)).align).toBe("start")
    expect(barFor(card(3, 5, 0)).align).toBe("center")
    expect(barFor(card(3, 18, 1)).align).toBe("end")
  })
  it("draws an empty shelf as an empty bar", () => {
    expect(barFor(card(0, 3, 3), "CRITICAL")).toMatchObject({ tone: "red", fillPct: 0, label: { kind: "today" } })
  })
})
