/* Stripe.js for the in-app card form (BILL-STRIPE). Loaded from Stripe's own
   address, and only when the form opens. The card number, date and code are
   typed into Stripe's fields (iframes), so they never reach this app or the
   API. Only the calls the form makes are typed here. */

export type StripeElementChange = { complete: boolean; empty: boolean; error?: { message?: string } }

export type StripeCardElement = {
  mount(target: HTMLElement): void
  on(event: "change", handler: (change: StripeElementChange) => void): void
  update(options: object): void
  destroy(): void
}

export type StripeElements = {
  create(kind: "cardNumber" | "cardExpiry" | "cardCvc", options?: object): StripeCardElement
}

export type StripeConfirmResult = {
  error?: { type?: string; message?: string }
  paymentIntent?: { status?: string }
}

export type StripeClient = {
  elements(options?: object): StripeElements
  confirmCardPayment(clientSecret: string, data: object): Promise<StripeConfirmResult>
}

export type StripeFactory = (publishableKey: string, options?: object) => StripeClient

export const STRIPE_JS_URL = "https://js.stripe.com/v3/"

let loading: Promise<StripeFactory | null> | null = null

function loaded(): StripeFactory | null {
  return (window as unknown as { Stripe?: StripeFactory }).Stripe ?? null
}

/** Stripe's factory, or null when the script could not load (blocked, offline). */
export function loadStripeJs(): Promise<StripeFactory | null> {
  if (typeof window === "undefined") return Promise.resolve(null)

  const ready = loaded()

  if (ready) return Promise.resolve(ready)
  if (loading) return loading

  loading = new Promise((resolve) => {
    const script = document.createElement("script")

    script.src = STRIPE_JS_URL
    script.async = true
    script.onload = () => resolve(loaded())
    script.onerror = () => {
      // A later opening tries again.
      loading = null
      script.remove()
      resolve(null)
    }
    document.head.appendChild(script)
  })

  return loading
}
