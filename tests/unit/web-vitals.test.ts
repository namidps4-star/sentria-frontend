import { describe, expect, it } from "vitest"

import { vitalEvent } from "@/lib/web-vitals"

describe("vitalEvent", () => {
  it("sends the metric, a whole-millisecond value and the rating", () => {
    expect(vitalEvent({ name: "LCP", value: 2123.6, rating: "good" })).toEqual({
      name: "web_vital",
      metric: "LCP",
      value: 2124,
      rating: "good",
    })
  })

  it("keeps CLS, a unitless score, to three decimals", () => {
    expect(vitalEvent({ name: "CLS", value: 0.04612, rating: "good" })?.value).toBe(0.046)
  })

  it("leaves out FID and any other name", () => {
    expect(vitalEvent({ name: "FID", value: 12, rating: "good" })).toBeNull()
    expect(vitalEvent({ name: "custom", value: 1 })).toBeNull()
  })

  it("refuses a value that is not a usable number", () => {
    expect(vitalEvent({ name: "INP", value: Number.NaN })).toBeNull()
    expect(vitalEvent({ name: "INP", value: -3 })).toBeNull()
  })

  it("treats an unknown rating as needs-improvement", () => {
    expect(vitalEvent({ name: "TTFB", value: 800 })?.rating).toBe("needs-improvement")
    expect(vitalEvent({ name: "TTFB", value: 800, rating: "wat" })?.rating).toBe("needs-improvement")
  })
})
