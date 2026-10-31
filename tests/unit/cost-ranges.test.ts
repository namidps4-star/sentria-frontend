import { describe, expect, it } from "vitest"

import { bucketRange } from "@/lib/cost-ranges"

const en = (_fr: string, en: string) => en
const fr = (fr: string) => fr

describe("bucketRange", () => {
  it("writes each range in English with the account's symbol", () => {
    expect(bucketRange("lt100", "€", en)).toBe("under 100 €")
    expect(bucketRange("100_1k", "€", en)).toBe("100–1,000 €")
    expect(bucketRange("1k_10k", "€", en)).toBe("1,000–10,000 €")
    expect(bucketRange("gt10k", "€", en)).toBe("over 10,000 €")
  })

  it("lets the figures stand alone when the account has no currency", () => {
    expect(bucketRange("lt100", "", en)).toBe("under 100")
    expect(bucketRange("gt10k", "", en)).toBe("over 10,000")
  })

  it("writes the French wording", () => {
    expect(bucketRange("lt100", "€", fr)).toMatch(/^moins de 100 €$/)
    expect(bucketRange("gt10k", "€", fr)).toMatch(/^plus de 10.000 €$/)
  })
})
