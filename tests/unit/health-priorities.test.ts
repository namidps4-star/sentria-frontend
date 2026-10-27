import { describe, expect, it } from "vitest"

import { healthCategoryOf, medicineOf } from "@/lib/health-priorities"

const alert = (alert_key: string | null, severity = "WARNING", equipment = "Doliprane", message = "MSG") => ({ equipment, message, severity, date: "2026-10-27", alert_key })

describe("healthCategoryOf", () => {
  it("puts stock, reorder and critical supply in the stock family", () => {
    expect(healthCategoryOf(alert("health.stock.low"))).toBe("stock")
    expect(healthCategoryOf(alert("health.stock.critical_low", "CRITICAL"))).toBe("stock")
    expect(healthCategoryOf(alert("health.reorder.risk"))).toBe("stock")
  })

  it("keeps expiry, cold chain and branch swaps apart from stock", () => {
    expect(healthCategoryOf(alert("health.expiry.warning"))).toBe("expiry")
    expect(healthCategoryOf(alert("health.cold_chain.broken", "CRITICAL"))).toBe("cold")
    expect(healthCategoryOf(alert("health.branch.swap"))).toBeNull()
  })

  it("reads an old alert with no key from its words", () => {
    expect(healthCategoryOf(alert(null, "CRITICAL", "Fridge", "Cold chain broken: 12°C"))).toBe("cold")
    expect(healthCategoryOf(alert(null, "WARNING", "Fridge", "Something else"))).toBeNull()
  })
})

describe("medicineOf", () => {
  it("names the medicine, and for a branch swap only the product", () => {
    expect(medicineOf({ equipment: "Doliprane", alert_key: "health.stock.low" })).toBe("Doliprane")
    expect(medicineOf({ equipment: "Amoxicillin 250mg · Nairobi -> Mombasa", alert_key: "health.branch.swap" })).toBe("Amoxicillin 250mg")
  })

  it("counts two swaps of one medicine as one medicine", () => {
    const swaps = [
      { equipment: "Amox · A -> B", alert_key: "health.branch.swap" },
      { equipment: "Amox · A -> C", alert_key: "health.branch.swap" },
    ]

    expect(new Set(swaps.map(medicineOf)).size).toBe(1)
  })
})
