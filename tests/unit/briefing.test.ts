import { describe, expect, it } from "vitest"

import { buildBriefing } from "@/lib/briefing"
import type { LogisticsAlert } from "@/lib/logistics-signals"

const tx = (_fr: string, en: string) => en
const at = (hours: number) => new Date(Date.parse("2026-10-22T12:00:00Z") - hours * 3_600_000).toISOString()

const alert = (equipment: string, severity: string, key: string, hours: number, message = "m", risk = 50): LogisticsAlert => ({
  equipment,
  severity,
  alert_key: key,
  date: at(hours),
  message,
  risk_score: risk,
})

describe("buildBriefing", () => {
  const alerts = [
    alert("CRANE-02", "CRITICAL", "cycles", 3, "96% : plan service", 90),
    alert("CRANE-02", "CRITICAL", "cycles", 1, "98% : plan service", 95),
    alert("REEFER-7", "CRITICAL", "temp", 5, "9 C : check", 80),
    alert("QUAI-1", "WARNING", "wait", 30, "6 h : call", 40),
  ]

  it("counts things that need a person, not repeats", () => {
    const brief = buildBriefing(alerts, tx)

    expect(brief.headline).toBe("2 critical things need you, starting with CRANE-02.")
    expect(brief.needs).toHaveLength(3)
    expect(brief.needs[0]).toMatchObject({ equipment: "CRANE-02", count: 2, finding: "98%" })
  })

  it("ranks critical first, then by risk", () => {
    expect(buildBriefing(alerts, tx).needs.map((n) => n.equipment)).toEqual(["CRANE-02", "REEFER-7", "QUAI-1"])
  })

  it("does not raise a false alarm when nothing is critical", () => {
    expect(buildBriefing([alerts[3]], tx).headline).toBe("Nothing critical. 1 thing to watch.")
  })

  it("names one critical asset in the singular", () => {
    expect(buildBriefing([alerts[2]], tx).headline).toBe("REEFER-7 needs you now.")
  })

  it("plans today for critical, this week for repeats and a stale file", () => {
    const plan = buildBriefing(alerts, tx, true).plan

    expect(plan).toContain("Today: deal with CRANE-02.")
    expect(plan).toContain("Today: deal with REEFER-7.")
    expect(plan.some((s) => s.startsWith("This week: find out why CRANE-02"))).toBe(true)
    expect(plan).toContain("This week: import a recent file.")
  })

  it("never writes a money figure", () => {
    const text = JSON.stringify(buildBriefing(alerts, tx, true))

    expect(text).not.toMatch(/[€$]/)
  })

  it("speaks French when asked", () => {
    expect(buildBriefing([alerts[2]], (fr) => fr).headline).toBe("REEFER-7 a besoin de vous maintenant.")
  })
})
