import { describe, expect, it } from "vitest"

import { isStripeUrl } from "@/lib/billing"

describe("billing", () => {
  it("follows only a Stripe page over https", () => {
    expect(isStripeUrl("https://checkout.stripe.com/c/pay/cs_test_1")).toBe(true)
    expect(isStripeUrl("https://billing.stripe.com/p/session/x")).toBe(true)
    expect(isStripeUrl("http://checkout.stripe.com/c/pay/x")).toBe(false)
    expect(isStripeUrl("https://checkout.stripe.com.evil.test/x")).toBe(false)
    expect(isStripeUrl("https://evilstripe.com/x")).toBe(false)
    expect(isStripeUrl("javascript:alert(1)")).toBe(false)
    expect(isStripeUrl(undefined)).toBe(false)
  })
})
