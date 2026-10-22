import { describe, expect, it } from "vitest"

import { lossPerHour, valueAtRisk } from "@/lib/value-at-risk"

describe("valueAtRisk", () => {
  it("reads money from the [name, value] pairs", () => {
    expect(valueAtRisk([["value", 1200], ["currency", "€"]])).toEqual({ value: 1200, currency: "€", estimate: false })
  })

  it("does not read a bare value as money (retail shrinkage is a percentage)", () => {
    expect(valueAtRisk([["value", 12]])).toBeNull()
  })

  it("marks a sales estimate", () => {
    expect(valueAtRisk({ value: 300, currency: "$", basis: "sales" })?.estimate).toBe(true)
  })

  it("rejects zero, negative and non-numbers", () => {
    for (const value of [0, -5, "abc", null]) {
      expect(valueAtRisk({ value, currency: "€" })).toBeNull()
    }
  })

  it("keeps a missing currency as an empty symbol, not a guess", () => {
    expect(valueAtRisk({ value: 10, currency: 3 })?.currency).toBe("")
  })

  it("handles no params at all", () => {
    expect(valueAtRisk(undefined)).toBeNull()
    expect(valueAtRisk(null)).toBeNull()
  })
})

describe("lossPerHour", () => {
  it("needs all three figures", () => {
    expect(lossPerHour({ loss_per_hour: 50, units_per_hour: 10, unit_value: 5, currency: "$" })).toEqual({
      perHour: 50,
      units: 10,
      each: 5,
      currency: "$",
    })
    expect(lossPerHour({ loss_per_hour: 50, units_per_hour: 10 })).toBeNull()
  })
})
