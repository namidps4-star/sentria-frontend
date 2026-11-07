import { describe, expect, it } from "vitest"

import { buildCsv, checkedCount, parseWorklist, tableOf, valueLeft, type Item } from "@/lib/receiving"

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

describe("the whole file as a table", () => {
  const api = {
    success: true, rows: 3, clean: 1,
    items: [{ id: "1:x", row: 3, flag: "expired", product: "Metformin", batch: "M771", expiry: "2026-09-30", dates: null, days_expired: 40, value: 35, currency: "KES", message: "m", action: "a" }],
    table: [
      { row: 2, product: "Aspirin", batch: "A1", expiry: "2027-10-31", quantity: "10", unit_cost: "2", flag: null, item: null, bad: [] },
      { row: 3, product: "Metformin", batch: "M771", expiry: "2026-09-30", quantity: "10", unit_cost: "3.5", flag: "expired", item: "1:x", bad: ["expiry", "weird"] },
    ],
    table_truncated: true,
  }

  it("reads the table, keeping only the cells it knows", () => {
    const list = parseWorklist(api)
    expect(list?.table).toHaveLength(2)
    expect(list?.table[1]).toMatchObject({ flag: "expired", item: "1:x", bad: ["expiry"], unitCost: "3.5" })
    expect(list?.tableTruncated).toBe(true)
  })
  it("gives the whole file when the API sent a table", () => {
    const t = tableOf(parseWorklist(api)!)
    expect(t.whole).toBe(true)
    expect(t.rows).toHaveLength(2)
  })
  it("falls back to the flagged rows for a list kept before the table existed", () => {
    const { table, table_truncated, ...old } = api
    void table; void table_truncated
    const t = tableOf(parseWorklist(old)!)
    expect(t.whole).toBe(false)
    expect(t.rows).toHaveLength(1)
    expect(t.rows[0]).toMatchObject({ row: 3, flag: "expired", item: "1:x", bad: ["expiry"] })
  })
  it("rebuilds a blank-lot row with the lot cell marked", () => {
    const { table, table_truncated, ...old } = api
    void table; void table_truncated
    const list = parseWorklist({ ...old, items: [{ ...old.items[0], flag: "nodate", batch: "?", expiry: "2027-03" }] })!
    expect(tableOf(list).rows[0].bad).toEqual(["batch"])
  })
  it("drops a malformed table instead of showing half of it", () => {
    expect(parseWorklist({ ...api, table: [api.table[0], { product: "no row number" }] })?.table).toEqual([])
  })
})

describe("a list kept before the grid existed", () => {
  it("is read back, not dropped", async () => {
    const store: Record<string, string> = {}
    const win = { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] } }
    ;(globalThis as unknown as { window: unknown }).window = win
    const { readSaved } = await import("@/lib/receiving")

    store.sentria_receiving = JSON.stringify({
      name: "old.csv", at: 1, ticks: { "1:x": { at: 2 } },
      list: { rows: 3, flagged: 1, clean: 2, items: [{ id: "1:x", row: 3, flag: "expired", product: "Metformin", batch: "M771", expiry: "2026-09-30", dates: null, daysExpired: 40, value: 35, currency: "KES", message: "m", action: "a" }] },
    })

    const saved = readSaved()
    expect(saved?.name).toBe("old.csv")
    expect(saved?.list.items).toHaveLength(1)
    expect(saved?.list.table).toEqual([])
    expect(saved?.ticks["1:x"]).toEqual({ at: 2 })
  })
})
