import { API_BASE, apiFetch } from "./api"
import type { PlanId } from "./plans"

/* Online payment (BILL-STRIPE). The API is the Sentria repo's
   pipeline/billing.py: it opens Stripe Checkout or the customer portal and
   answers its URL. The plan changes only when Stripe tells the API that money
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
}

export const BILLING_OFF: BillingStatus = { enabled: false, canBuy: false, yearly: {}, portal: false }

export type BillingInterval = "month" | "year"

export type BillingFailure =
  | "not_configured"
  | "on_request"
  | "no_yearly"
  | "no_customer"
  | "owner_only"
  | "unavailable"
  | "unreachable"
  | "other"

export type BillingResult = { ok: true; url: string } | { ok: false; reason: BillingFailure }

const BY_CODE: Record<string, BillingFailure> = {
  billing_not_configured: "not_configured",
  plan_on_request: "on_request",
  interval_unavailable: "no_yearly",
  billing_no_customer: "no_customer",
  owner_only: "owner_only",
  billing_unavailable: "unavailable",
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

async function post(path: string, body: object = {}): Promise<BillingResult> {
  let res: Response

  try {
    res = await apiFetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, reason: "unreachable" }
  }

  const data = await res.json().catch(() => null)

  if (res.ok && isStripeUrl(data?.url)) return { ok: true, url: data.url }

  const code = data?.detail?.error_code ?? data?.error_code

  return { ok: false, reason: (typeof code === "string" && BY_CODE[code]) || "other" }
}

export function startCheckout(plan: PlanId, interval: BillingInterval): Promise<BillingResult> {
  return post("/billing/checkout", { plan, interval })
}

export function openBillingPortal(): Promise<BillingResult> {
  return post("/billing/portal")
}
