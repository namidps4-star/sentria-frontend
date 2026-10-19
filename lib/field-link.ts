import { API_BASE, apiFetch } from "@/lib/api"

/* The field link (F-CONTRACTOR): one task, one person, a page opened from a
 * text. The boss makes it here (signed in); the page it opens is public and
 * carries no account, only the signed token in its address. */

export type FieldView = {
  title: string
  problem: string
  action: string
  severity: string | null
  priority: string | null
  deadline: string | null
  status: string | null
  name: string
  lang: "fr" | "en"
  expires: number
}

export type FieldAnswer = "ack" | "done" | "cannot"

export type FieldFailure = "invalid" | "expired" | "limited" | "unavailable" | "network"

/** The address a field person opens. */
export function fieldUrl(token: string): string {
  return `${window.location.origin}/t/${token}`
}

export async function makeFieldLink(
  taskKey: string,
  contractorId: string,
  lang: "fr" | "en"
): Promise<{ ok: true; token: string; expires_at: number } | { ok: false; code: string }> {
  try {
    const res = await apiFetch(`${API_BASE}/assignments/field-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_key: taskKey, contractor_id: contractorId, lang }),
    })
    const body = await res.json().catch(() => null)

    if (res.ok && typeof body?.token === "string") return { ok: true, token: body.token, expires_at: Number(body.expires_at) }

    return { ok: false, code: String(body?.error_code ?? body?.detail?.error_code ?? "failed") }
  } catch {
    return { ok: false, code: "failed" }
  }
}

function failureOf(status: number): FieldFailure {
  if (status === 410) return "expired"
  if (status === 429) return "limited"
  if (status === 503) return "unavailable"

  return "invalid"
}

/* The two calls below are the field person's. They send no session and no
 * account header on purpose: the token is the whole credential. */

export async function fetchField(token: string): Promise<{ ok: true; view: FieldView } | { ok: false; failure: FieldFailure }> {
  try {
    const res = await fetch(`${API_BASE}/field/${encodeURIComponent(token)}`)

    if (!res.ok) return { ok: false, failure: failureOf(res.status) }

    return { ok: true, view: (await res.json()) as FieldView }
  } catch {
    return { ok: false, failure: "network" }
  }
}

export async function answerField(token: string, action: FieldAnswer): Promise<{ ok: true; status: string } | { ok: false; failure: FieldFailure }> {
  try {
    const res = await fetch(`${API_BASE}/field/${encodeURIComponent(token)}/act`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })

    if (!res.ok) return { ok: false, failure: failureOf(res.status) }

    return { ok: true, status: String((await res.json())?.status ?? "") }
  } catch {
    return { ok: false, failure: "network" }
  }
}
