import { describe, expect, it } from "vitest"

import { buildCsv, checkedCount, parseWorklist, valueLeft, type Item } from "@/lib/receiving"

const item = (over: Partial<Item>): Item => ({
  id: "1:x", row: 3, flag: "expired", product: "Metformin", batch: "M771", expiry: "2026-09-30", dates: null, daysExpired: 37,
  value: 35, currency: "KES", message: "m", action: "a", ...over,
})

describe("parseWorklist", () => {
  const good = { success: true, rows: 6, clean: 1, items: [{ id: "2:health.receiving.expired", row: 4, flag: "expired", product: "Metformin", batch: "M771", expiry: "2026-09-30", dates: null, days_expired: 40, value: 35, currency: "KES", message: "m", action: "a" }] }

  it("reads the API's answer", () => {
    const list = parseWorklist(good)
    expect(list?.items[0]).toMatchObject({ flag: "expired", daysExpired: 40, value: 35, currency: "KES" })
    expect(list?.flagged).toBe(1)
  })
  it("refuses anything that is not a worklist, all or nothing", () => {
    expect(parseWorklist(null)).toBeNull()
    expect(parseWorklist({ success: false })).toBeNull()
    expect(parseWorklist({ ...good, items: [{ ...good.items[0], flag: "weird" }] })).toBeNull()
    expect(parseWorklist({ ...good, items: [good.items[0], { id: 5 }] })).toBeNull()
  })
})

describe("buildCsv", () => {
  it("writes one line per item with the tick and the date typed from the box", () => {
    const csv = buildCsv([item({ id: "a" }), item({ id: "b", row: 9, product: "Zinc" })], { a: { at: 1, date: "2027-07-06" } })
    const lines = csv.trim().split("\r\n")
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain("2027-07-06")
    expect(lines[1]).toContain(",yes,")
    expect(lines[2]).toContain(",no,")
  })
  it("writes a cell that starts like a formula as plain text", () => {
    const csv = buildCsv([item({ product: "=HYPERLINK(\"x\")" }), item({ product: "+1" }), item({ product: "@a" })], {})
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain("'+1")
    expect(csv).toContain("'@a")
  })
  it("quotes commas and quotes", () => {
    expect(buildCsv([item({ product: 'A, "B"' })], {})).toContain('"A, ""B"""')
  })
})

describe("progress", () => {
  it("counts only ticks of items on the list", () => {
    expect(checkedCount([item({ id: "a" }), item({ id: "b" })], { a: { at: 1 }, gone: { at: 1 } })).toBe(1)
  })
  it("adds up the money still to look at, in one currency", () => {
    const items = [item({ id: "a", value: 10 }), item({ id: "b", value: 5 }), item({ id: "c", value: null })]
    expect(valueLeft(items, { a: { at: 1 } })).toEqual({ value: 5, currency: "KES" })
    expect(valueLeft(items, { a: { at: 1 }, b: { at: 1 } })).toBeNull()
    expect(valueLeft([item({ id: "a" }), item({ id: "b", currency: "EUR" })], {})).toBeNull()
  })
})
