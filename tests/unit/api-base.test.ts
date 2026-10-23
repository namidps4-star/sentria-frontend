import { describe, expect, it } from "vitest"

import { normalizeApiBase } from "@/lib/api-base"

const FALLBACK = "https://fallback.example"

describe("normalizeApiBase", () => {
  it("leaves a clean address alone", () => {
    expect(normalizeApiBase("https://api.sentriahq.dev", FALLBACK)).toBe("https://api.sentriahq.dev")
  })

  it("strips the dot after the host, which the browser reads as another server", () => {
    expect(normalizeApiBase("https://api.sentriahq.dev.", FALLBACK)).toBe("https://api.sentriahq.dev")
  })

  it("strips a trailing slash and spaces", () => {
    expect(normalizeApiBase("  https://api.sentriahq.dev/  ", FALLBACK)).toBe("https://api.sentriahq.dev")
  })

  it("keeps a path and a port", () => {
    expect(normalizeApiBase("http://localhost:8000/", FALLBACK)).toBe("http://localhost:8000")
    expect(normalizeApiBase("https://x.example/v1/", FALLBACK)).toBe("https://x.example/v1")
  })

  it("falls back when nothing is set", () => {
    expect(normalizeApiBase(undefined, FALLBACK)).toBe(FALLBACK)
    expect(normalizeApiBase("   ", FALLBACK)).toBe(FALLBACK)
  })

  it("returns something that is not a web address as it is, minus a trailing slash", () => {
    expect(normalizeApiBase("not a url/", FALLBACK)).toBe("not a url")
  })
})
