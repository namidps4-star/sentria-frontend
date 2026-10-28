import { describe, expect, it } from "vitest"

import { isClientSecret, isPublishableKey, isStripeUrl } from "@/lib/billing"

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

  it("loads the card form only with a publishable key", () => {
    expect(isPublishableKey("pk_test_51Abc")).toBe(true)
    expect(isPublishableKey("pk_live_51Abc")).toBe(true)
    expect(isPublishableKey("sk_test_51Abc")).toBe(false) // secret-scan: allow
    expect(isPublishableKey("pk_test_")).toBe(false)
    expect(isPublishableKey("")).toBe(false)
    expect(isPublishableKey(undefined)).toBe(false)
  })

  it("confirms only a PaymentIntent client secret", () => {
    expect(isClientSecret("pi_3Abc_secret_Xyz")).toBe(true)
    expect(isClientSecret("pi_3Abc")).toBe(false)
    expect(isClientSecret("seti_1_secret_2")).toBe(false)
    expect(isClientSecret("<script>")).toBe(false)
    expect(isClientSecret(null)).toBe(false)
  })
})
