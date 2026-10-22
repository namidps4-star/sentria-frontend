import { describe, expect, it } from "vitest"

import { errorTrackingConfigured, scrubEvent, scrubText } from "@/lib/error-tracking"

describe("scrubText", () => {
  it("hides emails, phone numbers and long tokens", () => {
    const text = scrubText("Could not send to ama@port-a.test or +229 01 97 12 34 56, token AbCdEf0123456789AbCdEf0123456789")

    expect(text).not.toMatch(/ama@|port-a|229|0197|AbCdEf/)
    expect(text).toContain("[email]")
    expect(text).toContain("[number]")
    expect(text).toContain("[token]")
  })

  it("keeps a plain message readable", () => {
    expect(scrubText("Cannot read properties of undefined")).toBe("Cannot read properties of undefined")
  })

  it("cuts a long message", () => {
    expect(scrubText("x ".repeat(500)).length).toBeLessThanOrEqual(200)
  })
})

describe("scrubEvent", () => {
  const event = () => ({
    message: "boom for ama@port-a.test",
    exception: { values: [{ value: "bad value +229 01 97 12 34 56" }] },
    request: { url: "https://app.example/?company_name=Smoke%20Pharmacy", headers: { Authorization: "Bearer x" }, cookies: { s: "1" } },
    user: { email: "ama@port-a.test", ip_address: "1.2.3.4" },
    breadcrumbs: [{ message: "clicked Smoke Pharmacy" }],
    contexts: { device: { name: "x" } },
    extra: { file: "stock.csv" },
  })

  it("keeps what broke", () => {
    const clean = scrubEvent(event(), "/")

    expect(clean.message).toBe("boom for [email]")
    expect(clean.exception.values[0].value).toBe("bad value [number]")
  })

  it("drops the request detail, the user, the breadcrumbs, the contexts and the extras", () => {
    const text = JSON.stringify(scrubEvent(event(), "/tracking?company_name=Smoke"))

    for (const leak of ["Smoke", "ama@", "1.2.3.4", "Bearer", "clicked", "stock.csv", "device", "cookies"]) {
      expect(text).not.toContain(leak)
    }

    expect(JSON.parse(text).request).toEqual({ url: "/tracking" })
  })
})

describe("errorTrackingConfigured", () => {
  it("is off when no DSN is set for the build", () => {
    expect(errorTrackingConfigured()).toBe(false)
  })
})
