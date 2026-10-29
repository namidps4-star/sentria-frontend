import { describe, expect, it } from "vitest"

import { TERM_HELP } from "@/lib/term-help"

const everyText = () => {
  const out: { fr: string; en: string }[] = []
  for (const term of Object.values(TERM_HELP)) {
    out.push(term.label, term.short, ...term.examples)
    if (term.rule) out.push(term.rule)
  }
  return out
}

describe("term help", () => {
  it("explains confidence and risk, with examples, in French and English", () => {
    for (const term of Object.values(TERM_HELP)) {
      expect(term.label.fr && term.label.en).toBeTruthy()
      expect(term.short.fr && term.short.en).toBeTruthy()
      expect(term.examples.length).toBeGreaterThanOrEqual(2)
    }
  })

  it("keeps every text free of em dashes, as the copy rules ask", () => {
    for (const text of everyText()) {
      expect(text.fr).not.toMatch(/—/)
      expect(text.en).not.toMatch(/—/)
    }
  })

  it("gives the 0 to 100 scale for risk, and the three confidence bands", () => {
    expect(TERM_HELP.risk.short.en).toMatch(/out of 100/)
    expect(TERM_HELP.confidence.short.en).toMatch(/85%/)
    expect(TERM_HELP.confidence.short.en).toMatch(/65 to 84%/)
  })
})
