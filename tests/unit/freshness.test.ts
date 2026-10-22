import { describe, expect, it } from "vitest"

import { assessFreshness, type FreshnessData, type FreshnessEntry } from "@/lib/freshness"

const DAY = 86_400_000
const now = Date.parse("2026-10-22T12:00:00Z")
const ago = (days: number) => new Date(now - days * DAY).toISOString()

const stamp = (sector: string, scope: string, last_upload_at: string): FreshnessEntry => ({
  sector,
  scope,
  last_upload_at,
  age_days: 0,
  stale: false,
  rows_processed: 0,
  alerts_fired: 0,
})

const data = (entries: FreshnessData["entries"], persisted = true): FreshnessData => ({ persisted, staleAfterDays: 7, entries })

describe("assessFreshness", () => {
  it("says nothing when the stamps cannot answer", () => {
    expect(assessFreshness(data([], false), ["health"], [], now).kind).toBe("unknown")
    expect(assessFreshness(data([]), ["health"], [], now).kind).toBe("unknown")
  })

  it("is fresh inside the limit and stale past it", () => {
    expect(assessFreshness(data([stamp("health", "pharmacie", ago(2))]), ["health"], [], now).kind).toBe("fresh")

    const stale = assessFreshness(data([stamp("health", "pharmacie", ago(10))]), ["health"], [], now)

    expect(stale.kind).toBe("stale")
    expect(stale.stale[0]).toMatchObject({ sector: "health", ageDays: 10 })
  })

  it("lets a fresh sibling hide a silent department only when no scope is asked", () => {
    const entries = [
      stamp("health", "pharmacie", ago(1)),
      stamp("health", "labo", ago(20)),
    ]

    expect(assessFreshness(data(entries), ["health"], [], now).kind).toBe("fresh")
    expect(assessFreshness(data(entries), ["health"], ["labo"], now).kind).toBe("stale")
  })

  it("lists the oldest stale sector first", () => {
    const entries = [
      stamp("health", "pharmacie", ago(9)),
      stamp("industry", "usine", ago(30)),
    ]

    expect(assessFreshness(data(entries), ["health", "industry"], [], now).stale.map((s) => s.sector)).toEqual(["industry", "health"])
  })
})
