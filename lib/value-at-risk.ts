/** F-MONEY: the value at risk an alert carries.
 *
 *  The backend stores what built each message as ordered [name, value]
 *  pairs (alerts.params). A money figure is the "value" + "currency" pair
 *  A-VALUE introduced and every sector now shares. "currency" is what
 *  marks it as money: some alerts pass a bare "value" that is a rate
 *  (retail shrinkage, in %), and those must not read as an amount.
 */

export type AlertParams =
  | Array<[string, unknown]>
  | Record<string, unknown>
  | null
  | undefined

export type ValueAtRisk = {
  value: number
  /** The symbol the backend printed, or "" when the currency is unknown. */
  currency: string
  /** True when the amount is an estimate of the sales lost while waiting
   *  for a delivery (a stock-out with nothing left to value), not the
   *  value of stock on the shelf. The backend marks it basis "sales". */
  estimate: boolean
}

export function asRecord(params: AlertParams): Record<string, unknown> | null {
  if (Array.isArray(params)) {
    const out: Record<string, unknown> = {}
    for (const pair of params) {
      if (Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string") {
        out[pair[0]] = pair[1]
      }
    }
    return out
  }
  if (params && typeof params === "object") return params
  return null
}

export function valueAtRisk(params: AlertParams): ValueAtRisk | null {
  const record = asRecord(params)
  if (!record || !("currency" in record)) return null

  const value = Number(record.value)
  if (!Number.isFinite(value) || value <= 0) return null

  const currency = typeof record.currency === "string" ? record.currency.trim() : ""
  return { value, currency, estimate: record.basis === "sales" }
}
