import type { AlertParams } from "@/lib/value-at-risk"

/* The supplier a stock alert says to order from (F-SUPPLIER). It comes from
 * three optional columns of the uploaded file. The API puts it on every
 * recommendation as `supplier`, and on the alert itself as the params
 * order_from, order_phone and order_email. Anything missing stays missing:
 * no name means no supplier at all, and a button appears only for a contact
 * that is really there. */

export type Supplier = {
  name: string
  phone?: string | null
  email?: string | null
}

const PHONE = /^\+[1-9][0-9]{6,14}$/
const EMAIL = /^[^@\s<>,;"']+@[^@\s<>,;"']+\.[^@\s<>,;"']+$/

/** A number safe to put in a tel: or sms: link: E.164 or nothing. */
export function safePhone(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : ""

  return PHONE.test(text) ? text : null
}

/** An address safe to put in a mailto: link, or nothing. */
export function safeEmail(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : ""

  return EMAIL.test(text) ? text : null
}

/** The supplier as the API sent it on a recommendation, cleaned. */
export function cleanSupplier(value: unknown): Supplier | null {
  if (!value || typeof value !== "object") return null

  const raw = value as Record<string, unknown>
  const name = typeof raw.name === "string" ? raw.name.trim() : ""

  if (!name) return null

  return { name, phone: safePhone(raw.phone), email: safeEmail(raw.email) }
}

/** The supplier carried by an alert's own params. */
export function supplierFromParams(params: AlertParams): Supplier | null {
  const pairs: Array<[string, unknown]> = Array.isArray(params)
    ? params
    : params && typeof params === "object"
      ? Object.entries(params)
      : []
  const find = (key: string) => pairs.find(([name]) => name === key)?.[1]

  return cleanSupplier({ name: find("order_from"), phone: find("order_phone"), email: find("order_email") })
}
