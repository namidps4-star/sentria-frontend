import { describe, expect, it } from "vitest"

import { atLeast, canSeeAmounts, effectivePlan, trialDaysLeft } from "@/lib/plans"

const DAY = 86_400_000
const now = Date.parse("2026-10-22T12:00:00Z")

describe("plans", () => {
  it("orders the plans", () => {
    expect(atLeast("pro", "decouverte")).toBe(true)
    expect(atLeast("decouverte", "pro")).toBe(false)
    expect(atLeast("business", "business")).toBe(true)
  })

  it("shows money amounts from Pro up", () => {
    expect(canSeeAmounts("decouverte")).toBe(false)
    expect(canSeeAmounts("pro")).toBe(true)
  })

  it("gives Business during a running trial, and never lowers a paid plan", () => {
    const running = new Date(now + 3 * DAY).toISOString()
    const ended = new Date(now - DAY).toISOString()

    expect(effectivePlan("decouverte", running, now)).toBe("business")
    expect(effectivePlan("decouverte", ended, now)).toBe("decouverte")
    expect(effectivePlan("entreprise", running, now)).toBe("entreprise")
    expect(effectivePlan("pro", null, now)).toBe("pro")
  })

  it("counts trial days left, rounding up, and stops at zero", () => {
    expect(trialDaysLeft(new Date(now + 2.2 * DAY).toISOString(), now)).toBe(3)
    expect(trialDaysLeft(new Date(now - DAY).toISOString(), now)).toBe(0)
    expect(trialDaysLeft(null, now)).toBe(0)
  })
})
