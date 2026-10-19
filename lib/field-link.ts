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
  /** What this person has already sent on the task, and the limits. */
  reports?: { notes: number; photos: number; available: boolean; max_notes: number; max_photos: number }
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

/* Notes and photos from the field page. Public like the rest: the token is
 * the credential and no session is sent. */

export type ReportFailure = "limit" | "invalid" | "too_big" | "unavailable" | "link" | "network"

function reportFailure(status: number, code: string): ReportFailure {
  if (code === "report_limit") return "limit"
  if (code === "photo_too_big") return "too_big"
  if (code === "reports_unavailable") return "unavailable"
  if (status === 404 || status === 410 || status === 429) return "link"
  if (status === 413) return "too_big"

  return "invalid"
}

export async function sendFieldNote(token: string, note: string): Promise<{ ok: true } | { ok: false; failure: ReportFailure }> {
  try {
    const res = await fetch(`${API_BASE}/field/${encodeURIComponent(token)}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    })

    if (res.ok) return { ok: true }

    const body = await res.json().catch(() => null)

    return { ok: false, failure: reportFailure(res.status, String(body?.error_code ?? "")) }
  } catch {
    return { ok: false, failure: "network" }
  }
}

export async function sendFieldPhoto(token: string, photo: Blob): Promise<{ ok: true } | { ok: false; failure: ReportFailure }> {
  try {
    const form = new FormData()

    form.append("file", photo, "photo.jpg")

    const res = await fetch(`${API_BASE}/field/${encodeURIComponent(token)}/photo`, { method: "POST", body: form })

    if (res.ok) return { ok: true }

    const body = await res.json().catch(() => null)

    return { ok: false, failure: reportFailure(res.status, String(body?.error_code ?? "")) }
  } catch {
    return { ok: false, failure: "network" }
  }
}

/** A phone photo is several megabytes. The page shrinks it to a JPEG of at most
 *  1600 px first, which is also what the API keeps. */
export async function shrinkPhoto(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")

    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8))
  } catch {
    return null
  }
}

/* What the boss reads (signed in). */

export type FieldReport = { id: string; kind: "note" | "photo"; note: string; created_at: string; name: string }

export async function fetchFieldReports(taskKey: string): Promise<{ reports: FieldReport[]; available: boolean } | null> {
  try {
    const res = await apiFetch(`${API_BASE}/assignments/field-reports?task_key=${encodeURIComponent(taskKey)}`)
    const body = await res.json().catch(() => null)

    if (!res.ok || !Array.isArray(body?.reports)) return null

    return { reports: body.reports, available: body.available !== false }
  } catch {
    return null
  }
}

/** One photo as a local address the page can show (the request needs the sign-in, so an <img src> cannot fetch it). */
export async function fetchFieldPhoto(id: string): Promise<string | null> {
  try {
    const res = await apiFetch(`${API_BASE}/assignments/field-reports/${encodeURIComponent(id)}/photo`)

    return res.ok ? URL.createObjectURL(await res.blob()) : null
  } catch {
    return null
  }
}
