import { API_BASE, apiFetch } from "@/lib/api"

/* The disposal log of a veterinary outlet (H-VET step 2): each time stock is
 * thrown away, how it was disposed of and what it cost. The API holds it
 * (GET/POST/DELETE /disposals); an employee sees their own site's entries. */

export const DISPOSAL_METHODS = ["pit", "burn", "return", "donation", "other"] as const
export type DisposalMethod = (typeof DISPOSAL_METHODS)[number]

export type Disposal = {
  id: string
  product: string
  batch: string
  qty: number
  value: number
  currency: string
  method: DisposalMethod
  disposed_on: string
  note: string
}

export type DisposalSummary = {
  count: number
  total_value: number
  last_30_days_value: number
  /** Percent of the loss thrown in pits, by value when any was written down. */
  pit_share: number
  by_method: Record<string, { count: number; value: number; qty: number }>
}

export type DisposalLog = {
  disposals: Disposal[]
  summary: DisposalSummary
  persisted: boolean
}

export type DisposalDraft = {
  product: string
  batch: string
  qty: string
  value: string
  method: DisposalMethod
  disposed_on: string
  currency: string
}

export async function fetchDisposals(): Promise<DisposalLog | null> {
  try {
    const res = await apiFetch(`${API_BASE}/disposals`)
    const body = await res.json().catch(() => null)

    if (!res.ok || !body || !Array.isArray(body.disposals)) return null

    return body as DisposalLog
  } catch {
    return null
  }
}

export async function saveDisposal(draft: DisposalDraft): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    const res = await apiFetch(`${API_BASE}/disposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: draft.product,
        batch: draft.batch,
        qty: draft.qty === "" ? 0 : Number(draft.qty),
        value: draft.value === "" ? 0 : Number(draft.value),
        method: draft.method,
        disposed_on: draft.disposed_on,
        currency: draft.currency,
      }),
    })
    const body = await res.json().catch(() => null)

    return res.ok ? { ok: true } : { ok: false, code: String(body?.error_code ?? body?.detail?.error_code ?? "failed") }
  } catch {
    return { ok: false, code: "failed" }
  }
}

export async function removeDisposal(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/disposals/${encodeURIComponent(id)}`, { method: "DELETE" })

    return res.ok
  } catch {
    return false
  }
}
