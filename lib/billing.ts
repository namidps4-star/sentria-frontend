import { API_BASE, apiFetch } from "./api"
import type { PlanId } from "./plans"

/* Online payment (BILL-STRIPE). The API is the Sentria repo's
   pipeline/billing.py: it opens Stripe Checkout or the customer portal and
   answers its URL, or, for the in-app card form, starts a subscription and
   answers the client secret Stripe.js confirms the card with. The plan changes only when Stripe tells the API that money
   moved, never from this page. Amounts are not read here: the Plans page shows
   lib/plans.ts, and the same amounts are set on the prices in Stripe. */

export type BillingStatus = {
  /** Online payment is switched on (every Stripe key is set on the API). */
  enabled: boolean
  /** This person may buy: the boss, not an employee. */
  canBuy: boolean
  /** The plans that have a yearly price. */
  yearly: Partial<Record<PlanId, boolean>>
  /** The company has a Stripe customer, so the portal opens. */
  portal: boolean
  /** Stripe's publishable key: set, the boss pays in the app's card form;
   *  empty, the Choose button opens Stripe Checkout. */
  cardKey: string
  /** BILL-MPESA: the boss of a company that pays in shillings may pay by M-PESA. */
  mpesa: boolean
  /** The end of the time paid for by M-PESA, or null. */
  mpesaUntil: string | null
}

export const BILLING_OFF: BillingStatus = { enabled: false, canBuy: false, yearly: {}, portal: false, cardKey: "", mpesa: false, mpesaUntil: null }

export type BillingInterval = "month" | "year"

export type BillingFailure =
  | "not_configured"
  | "on_request"
  | "no_yearly"
  | "no_customer"
  | "owner_only"
  | "unavailable"
  | "unreachable"
  | "email_invalid"
  | "already_subscribed"
  | "phone_invalid"
  | "wrong_market"
  | "mpesa_pending"
  | "mpesa_unavailable"
  | "other"

export type BillingResult = { ok: true; url: string } | { ok: false; reason: BillingFailure }

export type SubscribeResult = { ok: true; clientSecret: string } | { ok: false; reason: BillingFailure }

const BY_CODE: Record<string, BillingFailure> = {
  billing_not_configured: "not_configured",
  plan_on_request: "on_request",
  interval_unavailable: "no_yearly",
  billing_no_customer: "no_customer",
  owner_only: "owner_only",
  billing_unavailable: "unavailable",
  email_invalid: "email_invalid",
  billing_already_subscribed: "already_subscribed",
  mpesa_not_configured: "not_configured",
  phone_invalid: "phone_invalid",
  mpesa_wrong_market: "wrong_market",
  mpesa_pending: "mpesa_pending",
  mpesa_unavailable: "mpesa_unavailable",
}

export async function fetchBillingStatus(): Promise<BillingStatus> {
  try {
    const res = await apiFetch(`${API_BASE}/billing/status`)

    if (!res.ok) return BILLING_OFF

    const body = await res.json()

    return {
      enabled: body?.enabled === true,
      canBuy: body?.can_buy === true,
      yearly: body?.yearly && typeof body.yearly === "object" ? body.yearly : {},
      portal: body?.portal === true,
      cardKey: isPublishableKey(body?.card_key) ? body.card_key : "",
      mpesa: body?.mpesa === true,
      mpesaUntil: typeof body?.mpesa_until === "string" ? body.mpesa_until : null,
    }
  } catch {
    return BILLING_OFF
  }
}

/** Only a Stripe page is followed: anything else the API answers is refused. */
export function isStripeUrl(value: unknown): value is string {
  if (typeof value !== "string") return false

  try {
    const url = new URL(value)

    return url.protocol === "https:" && (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))
  } catch {
    return false
  }
}

/** Only a publishable key (pk_...) loads Stripe.js; anything else keeps Checkout. */
export function isPublishableKey(value: unknown): value is string {
  return typeof value === "string" && /^pk_(test|live)_[A-Za-z0-9]+$/.test(value)
}

/** A PaymentIntent's client secret, the only thing the card form confirms. */
export function isClientSecret(value: unknown): value is string {
  return typeof value === "string" && /^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/.test(value)
}

type Answer = { ok: boolean; data: any } | null // eslint-disable-line @typescript-eslint/no-explicit-any

async function send(path: string, body: object): Promise<Answer> {
  try {
    const res = await apiFetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    return { ok: res.ok, data: await res.json().catch(() => null) }
  } catch {
    return null
  }
}

function failure(data: { detail?: { error_code?: unknown }; error_code?: unknown } | null): BillingFailure {
  const code = data?.detail?.error_code ?? data?.error_code

  return (typeof code === "string" && BY_CODE[code]) || "other"
}

async function post(path: string, body: object = {}): Promise<BillingResult> {
  const answer = await send(path, body)

  if (!answer) return { ok: false, reason: "unreachable" }
  if (answer.ok && isStripeUrl(answer.data?.url)) return { ok: true, url: answer.data.url }

  return { ok: false, reason: failure(answer.data) }
}

export function startCheckout(plan: PlanId, interval: BillingInterval): Promise<BillingResult> {
  return post("/billing/checkout", { plan, interval })
}

export function openBillingPortal(): Promise<BillingResult> {
  return post("/billing/portal")
}

/** The in-app card form: a subscription waiting for its first payment. The
 *  plan changes only when Stripe's signed webhook reaches the API. */
export async function startSubscription(plan: PlanId, interval: BillingInterval, email: string): Promise<SubscribeResult> {
  const answer = await send("/billing/subscribe", { plan, interval, email })

  if (!answer) return { ok: false, reason: "unreachable" }
  if (answer.ok && isClientSecret(answer.data?.client_secret)) return { ok: true, clientSecret: answer.data.client_secret }

  return { ok: false, reason: failure(answer.data) }
}

/* ------------------------------------------------------------------ */
/*  M-PESA (BILL-MPESA): one month of a plan, paid from the phone      */
/* ------------------------------------------------------------------ */

/** A Kenyan mobile number as Safaricom wants it (2547… or 2541…), or null.
 *  Accepts 07…, 01…, +254… and 254…, with spaces or dashes. The API checks
 *  it again and has the last word. */
export function kenyanPhone(value: string): string | null {
  let digits = value.replace(/[\s\-()]/g, "")
  if (digits.startsWith("+")) digits = digits.slice(1)
  if (/^0[17]\d{8}$/.test(digits)) digits = `254${digits.slice(1)}`
  return /^254[17]\d{8}$/.test(digits) ? digits : null
}

export type MpesaStartResult = { ok: true; checkoutId: string } | { ok: false; reason: BillingFailure }

/** Sends the M-PESA prompt to the phone. The amount comes from the plan on the
 *  API, never from here, and the plan changes only once Safaricom confirms. */
export async function startMpesa(plan: PlanId, phone: string): Promise<MpesaStartResult> {
  const answer = await send("/billing/mpesa/pay", { plan, phone })

  if (!answer) return { ok: false, reason: "unreachable" }
  if (answer.ok && typeof answer.data?.checkout_id === "string") return { ok: true, checkoutId: answer.data.checkout_id }

  return { ok: false, reason: failure(answer.data) }
}

export type MpesaReason = "cancelled" | "no_answer" | "insufficient_funds" | "wrong_pin" | "amount_mismatch" | "failed"

export type MpesaState =
  | { status: "pending" }
  | { status: "paid"; paidUntil: string | null }
  | { status: "failed"; reason: MpesaReason }

const REASONS: MpesaReason[] = ["cancelled", "no_answer", "insufficient_funds", "wrong_pin", "amount_mismatch", "failed"]

/** Where one payment stands. Null when the API cannot be reached: try again. */
export async function mpesaState(checkoutId: string): Promise<MpesaState | null> {
  try {
    const res = await apiFetch(`${API_BASE}/billing/mpesa/${encodeURIComponent(checkoutId)}`)
    if (!res.ok) return null
    const body = await res.json()

    if (body?.status === "paid") return { status: "paid", paidUntil: typeof body.paid_until === "string" ? body.paid_until : null }
    if (body?.status === "failed") return { status: "failed", reason: REASONS.includes(body.reason) ? body.reason : "failed" }
    if (body?.status === "pending") return { status: "pending" }
    return null
  } catch {
    return null
  }
}
