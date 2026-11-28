import { describe, expect, it } from "vitest"

import { bucketAlerts, type ChartAlert } from "@/lib/chart-series"

const now = new Date(2026, 9, 22, 12, 0)
const at = (dayOffset: number, hour: number) => new Date(2026, 9, 22 + dayOffset, hour, 0).toISOString()
const alert = (date: string, alertKey = "health.stock.critical_low"): ChartAlert => ({
  date,
  sector: "health",
  equipment: "Doliprane",
  alert_key: alertKey,
  severity: "CRITICAL",
})

const trend = (alerts: ChartAlert[]) =>
  bucketAlerts(alerts, { keys: ["health"], days: 7, metric: "count", now }).series[0]

describe("bucketAlerts: one alert per asset and check, per day", () => {
  it("the same alert twice on one day counts once", () => {
    const series = trend([alert(at(0, 9)), alert(at(0, 11))])

    expect(series.values[6]).toBe(1)
    expect(series.total).toBe(1)
  })

  it("the same alert on two days shows on both days", () => {
    const series = trend([alert(at(-1, 11)), alert(at(0, 11))])

    expect(series.values[5]).toBe(1)
    expect(series.values[6]).toBe(1)
    expect(series.total).toBe(2)
  })

  it("two different checks on one day count twice", () => {
    const series = trend([alert(at(0, 9)), alert(at(0, 11), "health.stock.low")])

    expect(series.values[6]).toBe(2)
  })
})
