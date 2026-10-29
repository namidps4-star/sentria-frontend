import { describe, expect, it } from "vitest"

import { DESCRIPTION_LIMIT, SEO, TITLE_LIMIT } from "@/lib/seo"

describe("search metadata", () => {
  const pairs = Object.entries(SEO)

  it("has a title and a description in both languages", () => {
    expect(pairs.map(([lang]) => lang).sort()).toEqual(["en", "fr"])
    for (const [, pair] of pairs) {
      expect(pair.title.trim()).not.toBe("")
      expect(pair.description.trim()).not.toBe("")
    }
  })

  it("keeps titles and descriptions inside the length limits", () => {
    for (const [lang, pair] of pairs) {
      expect(pair.title.length, `${lang} title`).toBeLessThanOrEqual(TITLE_LIMIT)
      expect(pair.description.length, `${lang} description`).toBeLessThanOrEqual(DESCRIPTION_LIMIT)
    }
  })

  it("does not repeat a title or a description between languages", () => {
    expect(SEO.fr.title).not.toBe(SEO.en.title)
    expect(SEO.fr.description).not.toBe(SEO.en.description)
  })

  it("carries each language's target phrase in the title", () => {
    expect(SEO.fr.title.toLowerCase()).toContain("alertes de stock en temps réel")
    expect(SEO.en.title.toLowerCase()).toContain("real-time stock alerts")
  })

  it("uses no em dash", () => {
    for (const [, pair] of pairs) expect(pair.title + pair.description).not.toMatch(/—/)
  })
})
