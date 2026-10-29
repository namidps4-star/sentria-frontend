"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, CheckCircle2, Loader2, Lock, X } from "@/lib/icons"

import { startCheckout, startSubscription, type BillingFailure, type BillingInterval } from "@/lib/billing"
import { resolve, useTx } from "@/lib/i18n"
import { pickableCountries, useLocale } from "@/lib/locale"
import { PLAN_LIMITS, PLAN_NAMES, type PlanId } from "@/lib/plans"
import { loadStripeJs, type StripeCardElement, type StripeClient } from "@/lib/stripe-js"
import { supabase } from "@/lib/supabase"
import { useEnter } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

import { StatusTag } from "./status-tag"

/* The in-app card form (BILL-STRIPE), after the founder's mockup A: the plan
   on a dark panel (name, perks filling its height, the total at the bottom in
   lime), the form beside it. The card fields are Stripe's own (iframes), so
   the number never reaches this app or the API. The plan changes only when
   Stripe's signed webhook reaches the API, never from here. */

type Field = "number" | "expiry" | "cvc"

const FIELDS: Field[] = ["number", "expiry", "cvc"]

/** The mobile money brands on the payment slider, with their official logos
 *  from /public/payment. The logo sits on white so its colours hold in dark mode. */
const MOBILE_MONEY = [
  { id: "mpesa", name: "M-Pesa", testId: "pay-mm-mpesa", logo: "/payment/mpesa.png" },
  { id: "momo", name: "MTN MoMo", testId: "pay-mm-momo", logo: "/payment/mtn-momo.png" },
  { id: "orange", name: "Orange Money", testId: "pay-mm-orange", logo: "/payment/orange-money.webp" },
] as const

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// The app's body font, for the text inside Stripe's fields.
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500&display=swap"

/** A colour as rgb(), read through a canvas: the theme writes oklch(), which
 *  Stripe's fields are not sure to take. */
function toRgb(color: string): string {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const context = canvas.getContext("2d")
  if (!context) return color
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return `rgb(${r}, ${g}, ${b})`
}

/* i18n-ignore-start: a CSS selector and a font family, not text */
/** Stripe's field style, from the colours the theme gives three hidden probes. */
function fieldStyle(probes: HTMLElement | null) {
  const color = (name: string, fallback: string) => {
    const node = probes?.querySelector<HTMLElement>(`[data-probe="${name}"]`)
    return node ? toRgb(getComputedStyle(node).color) : fallback
  }

  return {
    base: {
      color: color("text", "#141414"),
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      fontSize: "15px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: color("muted", "#8a8a8a") },
    },
    invalid: { color: color("bad", "#d4183d") },
  }
}
/* i18n-ignore-end */

export function PayDialog({
  plan,
  interval,
  cardKey,
  amount,
  tagline,
  describe,
  onClose,
  onPaid,
}: {
  plan: PlanId
  interval: BillingInterval
  /** Stripe's publishable key, from GET /billing/status. */
  cardKey: string
  /** The price as the Plans page shows it, e.g. "29 €". */
  amount: string
  tagline: string
  /** What a failed step says (the Plans page's own texts). */
  describe: (reason: BillingFailure) => string
  onClose: () => void
  /** Stripe took the money; the dialog shows its done state. */
  onPaid: () => void
}) {
  const tx = useTx()
  const { ui, countryCode } = useLocale()
  const enter = useEnter()

  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [country, setCountry] = useState("")
  const [load, setLoad] = useState<"loading" | "ready" | "failed">("loading")
  const [complete, setComplete] = useState<Record<Field, boolean>>({ number: false, expiry: false, cvc: false })
  const [fieldError, setFieldError] = useState<Record<Field, string>>({ number: "", expiry: "", cvc: "" })
  const [paying, setPaying] = useState(false)
  const [problem, setProblem] = useState("")
  const [paid, setPaid] = useState(false)

  const payingRef = useRef(false)
  const stripeRef = useRef<StripeClient | null>(null)
  const cardRef = useRef<StripeCardElement | null>(null)
  // One subscription per plan and period while the dialog lives: a declined
  // card is retried on the same one, not a new one each time.
  const secrets = useRef(new Map<string, string>())
  const probes = useRef<HTMLDivElement>(null)
  const mounts = useRef<Record<Field, HTMLDivElement | null>>({ number: null, expiry: null, cvc: null })
  const firstInput = useRef<HTMLInputElement>(null)

  const yearly = interval === "year"
  const limits = PLAN_LIMITS[plan]
  const perks = [limits.sitesUsers, limits.alerts, limits.ask, limits.history]
  const countries = pickableCountries(countryCode || country)

  // The signed-in person's address, as a starting point for the receipt.
  useEffect(() => {
    let alive = true
    supabase?.auth.getSession().then(({ data }) => {
      const mail = data.session?.user?.email
      if (alive && mail) setEmail((current) => current || mail)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setCountry((current) => current || countryCode || "BJ")
  }, [countryCode])

  useEffect(() => {
    firstInput.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !payingRef.current) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Stripe's three card fields, restyled when the theme changes.
  useEffect(() => {
    let alive = true
    const made: StripeCardElement[] = []
    let watcher: MutationObserver | null = null
    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)")
    const restyle = () => made.forEach((element) => element.update({ style: fieldStyle(probes.current) }))

    setLoad("loading")

    loadStripeJs().then((factory) => {
      if (!alive) return

      if (!factory || FIELDS.some((field) => !mounts.current[field])) {
        setLoad("failed")
        return
      }

      try {
        const client = factory(cardKey, { locale: ui === "en" ? "en" : "fr" })
        const elements = client.elements({ fonts: [{ cssSrc: FONT_CSS }] })
        const kinds = { number: "cardNumber", expiry: "cardExpiry", cvc: "cardCvc" } as const

        for (const field of FIELDS) {
          const element = elements.create(kinds[field], {
            style: fieldStyle(probes.current),
            ...(field === "number" ? { showIcon: true, placeholder: "1234 1234 1234 1234" } : {}),
          })
          element.mount(mounts.current[field]!)
          element.on("change", (change) => {
            setComplete((current) => ({ ...current, [field]: change.complete }))
            setFieldError((current) => ({ ...current, [field]: change.error?.message ?? "" }))
          })
          made.push(element)
          if (field === "number") cardRef.current = element
        }

        stripeRef.current = client
        setLoad("ready")

        watcher = new MutationObserver(restyle)
        watcher.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
        scheme?.addEventListener?.("change", restyle)
      } catch {
        setLoad("failed")
      }
    })

    return () => {
      alive = false
      watcher?.disconnect()
      scheme?.removeEventListener?.("change", restyle)
      made.forEach((element) => element.destroy())
      cardRef.current = null
      stripeRef.current = null
    }
  }, [cardKey, ui])

  function stop(message: string) {
    payingRef.current = false
    setPaying(false)
    setProblem(message)
  }

  async function pay() {
    if (payingRef.current) return

    const mail = email.trim()
    const holder = name.trim()

    setProblem("")

    if (!EMAIL.test(mail)) return setProblem(describe("email_invalid"))
    if (!holder) return setProblem(tx("Indiquez le nom sur la carte.", "Enter the name on the card."))
    if (FIELDS.some((field) => !complete[field])) {
      return setProblem(tx("Complétez le numéro, la date et le code de la carte.", "Complete the card number, date and code."))
    }

    const stripe = stripeRef.current
    const card = cardRef.current
    if (!stripe || !card) return

    payingRef.current = true
    setPaying(true)

    const key = `${plan}:${interval}`
    let secret = secrets.current.get(key)

    if (!secret) {
      const answer = await startSubscription(plan, interval, mail)
      if (!answer.ok) return stop(describe(answer.reason))
      secret = answer.clientSecret
      secrets.current.set(key, secret)
    }

    let result
    try {
      result = await stripe.confirmCardPayment(secret, {
        payment_method: { card, billing_details: { name: holder, email: mail, address: { country } } },
      })
    } catch {
      return stop(describe("unavailable"))
    }

    if (result.error) return stop(result.error.message || describe("other"))

    if (result.paymentIntent?.status === "succeeded") {
      payingRef.current = false
      setPaying(false)
      setPaid(true)
      onPaid()
      return
    }

    stop(describe("other"))
  }

  // Stripe.js did not load (blocked, offline): Stripe's own page still works.
  async function payOnStripe() {
    if (payingRef.current) return
    payingRef.current = true
    setPaying(true)
    const answer = await startCheckout(plan, interval)
    if (answer.ok) {
      window.location.assign(answer.url)
      return
    }
    stop(describe(answer.reason))
  }

  const per = yearly ? tx("par an", "per year") : tx("par mois", "per month")
  const cardMessage = FIELDS.map((field) => fieldError[field]).find(Boolean) ?? ""
  const fieldShell = "min-h-[50px] px-4 py-[15px] transition-shadow [&.StripeElement--focus]:shadow-[inset_0_0_0_1.5px_var(--brand)] [&.StripeElement--invalid]:shadow-[inset_0_0_0_1.5px_var(--destructive)]"
  const input = "h-[50px] w-full rounded-2xl border border-border bg-background px-4 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:border-brand focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60"
  const label = "text-xs font-semibold text-foreground"

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-4 t-modal-backdrop", enter)}
      onClick={(event) => {
        if (event.target === event.currentTarget && !payingRef.current) onClose()
      }}
    >
      {/* Hidden probes: the theme's colours, read for Stripe's fields. */}
      <div ref={probes} aria-hidden="true" className="hidden">
        <span data-probe="text" className="text-foreground" />
        <span data-probe="muted" className="text-muted-foreground" />
        <span data-probe="bad" className="text-destructive" />
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-plan"
        data-testid="pay-dialog"
        style={{ borderRadius: 32 }}
        className={cn(
          "squircle grid max-h-[calc(100dvh-1.5rem)] w-full max-w-[960px] overflow-y-auto overflow-x-hidden rounded-[32px] border border-border bg-card shadow-2xl md:grid-cols-[340px_1fr] t-modal",
          enter
        )}
      >
        {/* The plan */}
        <aside className="flex flex-col gap-[18px] bg-sidebar-shell p-6 text-white md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/60">
            {tx("Abonnement", "Subscription")}
          </p>
          <h2 id="pay-plan" className="mt-1 font-heading text-[64px] font-semibold leading-[0.86] tracking-[-0.05em] md:text-[96px]">
            {PLAN_NAMES[plan]}
          </h2>
          <p className="text-sm text-white/75">{tagline}</p>

          <ul data-testid="pay-perks" className="mt-1 flex flex-col border-b border-white/12 md:flex-1">
            {perks.map((perk) => (
              <li key={perk.en} className="flex items-center gap-2.5 border-t border-white/12 py-3 text-[15px] md:flex-1 md:py-0">
                <Check className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />
                {resolve(perk, tx)}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onClose}
            disabled={paying}
            className="self-start rounded text-[13px] font-semibold text-brand underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
          >
            {tx("Changer de formule", "Change plan")}
          </button>

          <div data-testid="pay-total" className="flex items-baseline justify-between gap-3 border-t border-white/12 pt-[18px]">
            <span className="text-sm text-white/70">{yearly ? tx("Total, chaque année", "Total, every year") : tx("Total, chaque mois", "Total, every month")}</span>
            <b className="font-heading text-[44px] font-semibold leading-none tabular-nums text-brand">{amount}</b>
          </div>
        </aside>

        {/* The form */}
        {paid ? (
          <div data-testid="pay-done" role="status" className="flex flex-col justify-center gap-4 p-6 md:p-8">
            <CheckCircle2 className="h-10 w-10 text-[var(--tag-success-fg)]" aria-hidden="true" />
            <h3 className="font-heading text-2xl font-semibold">{tx("Paiement reçu", "Payment received")}</h3>
            <p className="text-sm text-muted-foreground">
              {tx(
                `Votre offre passe à ${PLAN_NAMES[plan]} dès que Stripe le confirme, en général dans la minute. Rechargez la page pour la voir.`,
                `Your plan moves to ${PLAN_NAMES[plan]} once Stripe confirms it, usually within a minute. Reload the page to see it.`
              )}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="h-12 self-start rounded-full bg-foreground px-6 text-sm font-bold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Fermer", "Close")}
            </button>
          </div>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4 p-6 md:p-8"
            onSubmit={(event) => {
              event.preventDefault()
              void pay()
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">{tx("Paiement", "Payment")}</h3>
              <button
                type="button"
                data-testid="pay-close"
                onClick={onClose}
                disabled={paying}
                aria-label={tx("Fermer", "Close")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <label className="flex flex-col gap-2">
              <span className={label}>{tx("Adresse e-mail", "Email address")}</span>
              <input
                ref={firstInput}
                data-testid="pay-email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={paying}
                placeholder={tx("vous@entreprise.com", "you@company.com")}
                className={input}
              />
            </label>

            <div className="flex flex-col gap-2">
              <span id="pay-method" className={label}>{tx("Mode de paiement", "Payment method")}</span>
              <div role="radiogroup" aria-labelledby="pay-method" className="grid grid-cols-2 gap-1 rounded-[24px] bg-muted p-1 sm:grid-cols-4">
                <button
                  type="button"
                  role="radio"
                  aria-checked="true"
                  className="flex h-12 items-center justify-center rounded-[18px] bg-card text-sm font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {tx("Carte bancaire", "Card")}
                </button>
                {MOBILE_MONEY.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    role="radio"
                    aria-checked="false"
                    disabled
                    data-testid={brand.testId}
                    className="flex min-h-12 cursor-not-allowed flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-1.5 text-muted-foreground"
                  >
                    <span className="flex h-8 w-full max-w-[92px] items-center justify-center rounded-md bg-white px-1.5">
                      <img src={brand.logo} alt={brand.name} className="max-h-6 w-auto max-w-full object-contain" />
                    </span>
                    <StatusTag tone="neutral" size="xs" icon={false}>{tx("Bientôt", "Soon")}</StatusTag>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className={label}>{tx("Carte bancaire", "Card")}</span>
              <div data-testid="pay-card" className={cn("overflow-hidden rounded-[18px] border border-border bg-background", load === "loading" && "animate-pulse")}>
                <div ref={(node) => { mounts.current.number = node }} data-field="number" className={cn(fieldShell, "border-b border-border")} />
                <div className="grid grid-cols-2">
                  <div ref={(node) => { mounts.current.expiry = node }} data-field="expiry" className={cn(fieldShell, "border-r border-border")} />
                  <div ref={(node) => { mounts.current.cvc = node }} data-field="cvc" className={fieldShell} />
                </div>
              </div>
              {cardMessage && <p className="text-xs text-destructive">{cardMessage}</p>}
            </div>

            <label className="flex flex-col gap-2">
              <span className={label}>{tx("Nom sur la carte", "Name on the card")}</span>
              <input
                data-testid="pay-name"
                autoComplete="cc-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={paying}
                className={input}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={label}>{tx("Pays de facturation", "Billing country")}</span>
              <select
                data-testid="pay-country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                disabled={paying}
                className={cn(input, "appearance-none")}
              >
                {countries.map((option) => (
                  <option key={option.code} value={option.code}>
                    {resolve(option.name, tx)}
                  </option>
                ))}
              </select>
            </label>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {tx(
                "Paiement sécurisé par Stripe. SentrIA ne voit pas votre numéro de carte.",
                "Payment secured by Stripe. SentrIA never sees your card number."
              )}
            </p>

            {problem && (
              <p role="alert" data-testid="pay-problem" className="text-sm font-semibold text-destructive">
                {problem}
              </p>
            )}

            {load === "failed" ? (
              <div data-testid="pay-fallback" className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {tx(
                    "Le formulaire de carte n'a pas pu se charger. Vous pouvez payer sur la page de Stripe.",
                    "The card form could not load. You can pay on Stripe's page."
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void payOnStripe()}
                  disabled={paying}
                  className="h-[52px] rounded-full bg-brand text-[15px] font-bold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {paying ? tx("Ouverture…", "Opening…") : tx("Payer sur la page Stripe", "Pay on Stripe's page")}
                </button>
              </div>
            ) : (
              <button
                type="submit"
                data-testid="pay-submit"
                disabled={paying || load !== "ready"}
                className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-bold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {paying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {paying ? tx("Paiement…", "Paying…") : tx(`Payer ${amount} ${per}`, `Pay ${amount} ${per}`)}
              </button>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              {yearly
                ? tx(
                    `En vous abonnant, vous autorisez SentrIA à prélever ${amount} chaque année jusqu'à résiliation. Vous pouvez résilier à tout moment avec « Gérer mon abonnement ».`,
                    `By subscribing, you allow SentrIA to charge ${amount} every year until you cancel. You can cancel at any time with "Manage my subscription".`
                  )
                : tx(
                    `En vous abonnant, vous autorisez SentrIA à prélever ${amount} chaque mois jusqu'à résiliation. Vous pouvez résilier à tout moment avec « Gérer mon abonnement ».`,
                    `By subscribing, you allow SentrIA to charge ${amount} every month until you cancel. You can cancel at any time with "Manage my subscription".`
                  )}
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
