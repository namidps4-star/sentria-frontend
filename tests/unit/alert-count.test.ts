import { describe, expect, it } from "vitest"

import {
  alertKey,
  countAlerts,
  countAlertDays,
  latestAlerts,
  recurrenceDays,
} from "@/lib/alert-count"

const row = (
  equipment: string,
  key: string | null,
  date: string
) => ({ equipment, alert_key: key, date, severity: "WARNING" as const, message: "m" })

describe("alertKey", () => {
  it("joins equipment and alert_key", () => {
    expect(alertKey({ equipment: "Truck A", alert_key: "transport.temp" })).toBe(
      "Truck A\u0000transport.temp"
    )
  })

  it("falls back to empty string for null alert_key", () => {
    expect(alertKey({ equipment: "Truck A", alert_key: null })).toBe("Truck A\u0000")
    expect(alertKey({ equipment: "Truck A" })).toBe("Truck A\u0000")
  })
})

describe("countAlerts", () => {
  it("counts distinct alerts, not rows", () => {
    const rows = [
      row("A", "temp", "2026-10-20"),
      row("A", "temp", "2026-10-21"),
      row("B", "temp", "2026-10-20"),
      row("A", "fuel", "2026-10-20"),
    ]
    expect(countAlerts(rows)).toBe(3)
  })

  it("returns 0 for empty", () => {
    expect(countAlerts([])).toBe(0)
  })
})

describe("latestAlerts", () => {
  it("keeps the newest row per key", () => {
    const rows = [
      row("A", "temp", "2026-10-20T10:00:00Z"),
      row("A", "temp", "2026-10-21T10:00:00Z"),
      row("A", "temp", "2026-10-19T10:00:00Z"),
      row("B", "temp", "2026-10-20T10:00:00Z"),
    ]
    const result = latestAlerts(rows)
    expect(result).toHaveLength(2)
    expect(result[0].equipment).toBe("A")
    expect(result[0].date).toBe("2026-10-21T10:00:00Z")
    expect(result[1].equipment).toBe("B")
  })

  it("preserves input order by first occurrence", () => {
    const rows = [
      row("B", "temp", "2026-10-20T10:00:00Z"),
      row("A", "temp", "2026-10-20T10:00:00Z"),
    ]
    const result = latestAlerts(rows)
    expect(result[0].equipment).toBe("B")
    expect(result[1].equipment).toBe("A")
  })

  it("returns empty for empty input", () => {
    expect(latestAlerts([])).toEqual([])
  })
})

describe("countAlertDays", () => {
  it("counts distinct keys per day, not rows", () => {
    const now = new Date("2026-10-22T14:00:00")
    const rows = [
      row("A", "temp", "2026-10-22T08:00:00"),
      row("A", "temp", "2026-10-22T09:00:00"),
      row("B", "temp", "2026-10-22T10:00:00"),
      row("A", "fuel", "2026-10-21T10:00:00"),
    ]
    const result = countAlertDays(rows, 3, now)
    expect(result).toEqual([0, 1, 2])
  })

  it("same file twice on the same day: no change", () => {
    const now = new Date("2026-10-22T14:00:00")
    const batch = [
      row("A", "temp", "2026-10-22T08:00:00"),
      row("B", "temp", "2026-10-22T08:00:00"),
    ]
    const once = countAlertDays(batch, 1, now)
    const twice = countAlertDays([...batch, ...batch], 1, now)
    expect(once).toEqual(twice)
  })

  it("returns zeros for empty", () => {
    expect(countAlertDays([], 7)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe("recurrenceDays", () => {
  it("counts distinct calendar days", () => {
    const rows = [
      row("A", "temp", "2026-10-20T08:00:00"),
      row("A", "temp", "2026-10-20T16:00:00"),
      row("A", "temp", "2026-10-21T08:00:00"),
    ]
    expect(recurrenceDays("A", "temp", rows)).toBe(2)
  })

  it("ignores other equipment", () => {
    const rows = [
      row("A", "temp", "2026-10-20T08:00:00"),
      row("B", "temp", "2026-10-21T08:00:00"),
    ]
    expect(recurrenceDays("A", "temp", rows)).toBe(1)
  })

  it("handles null alert_key", () => {
    const rows = [
      row("A", null, "2026-10-20T08:00:00"),
      row("A", null, "2026-10-21T08:00:00"),
    ]
    expect(recurrenceDays("A", null, rows)).toBe(2)
  })
})
