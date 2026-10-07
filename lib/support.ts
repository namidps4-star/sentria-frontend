import { API_BASE, apiFetch } from "./api"

/* The "Help and feedback" form (F-SUPPORT). The API is the Sentria repo's
   pipeline/support.py: it emails the message to the founder with the company
   and the plan, read from the sign-in, never from this request. */

export type SupportKind = "bug" | "idea" | "question"

export const SUPPORT_KINDS: SupportKind[] = ["bug", "idea", "question"]

/** The API's own limits (pipeline/support.py). The form stops at them, so the
 *  API never has to refuse a message for its size. */
export const SUPPORT_MIN_CHARS = 5
export const SUPPORT_MAX_CHARS = 2000

export type SupportFailure =
  /** Too many messages from this person; `waitSeconds` says when to come back. */
  | "rate_limited"
  /** Too many from everyone. */
  | "busy"
  /** The API has no inbox or no mail key yet. */
  | "not_configured"
  /** The mail provider refused or could not be reached. */
  | "send_failed"
  /** The sign-in has expired. */
  | "signed_out"
  /** The API refused the message itself (too short, unknown kind). */
  | "invalid"
  /** The request never reached the API (CORS, DNS, the server being down). */
  | "unreachable"
  | "other"

export type SupportResult =
  | { ok: true }
  | { ok: false; reason: SupportFailure; waitSeconds?: number }

const BY_CODE: Record<string, SupportFailure> = {
  support_rate_limited: "rate_limited",
  support_busy: "busy",
  support_not_configured: "not_configured",
  support_send_failed: "send_failed",
  auth_required: "signed_out",
  auth_invalid: "signed_out",
  kind_invalid: "invalid",
  message_invalid: "invalid",
  message_too_short: "invalid",
  message_too_long: "invalid",
  unknown_fields: "invalid",
}

export async function sendSupportMessage(input: {
  kind: SupportKind
  message: string
  /** The view the person is on, as the app names it ("dashboard"). */
  page: string
  language: "fr" | "en"
}): Promise<SupportResult> {
  let res: Response

  try {
    res = await apiFetch(`${API_BASE}/support/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: input.kind,
        message: input.message,
        page: input.page,
        language: input.language,
        agent: typeof navigator === "undefined" ? "" : navigator.userAgent.slice(0, 200),
      }),
    })
  } catch (error) {
    console.error("[SentrIA] POST /support/messages never completed.", error)

    return { ok: false, reason: "unreachable" }
  }

  if (res.ok) return { ok: true }

  // The message is the person's: only the status and the code are logged.
  let code = ""

  try {
    const body = (await res.json()) as {
      detail?: { error_code?: unknown }
      error_code?: unknown
    }
    const found = body?.detail?.error_code ?? body?.error_code

    code = typeof found === "string" ? found : ""
  } catch {
    code = ""
  }

  console.error(`[SentrIA] POST /support/messages -> HTTP ${res.status} ${code}`)

  const wait = Number(res.headers.get("Retry-After"))

  return {
    ok: false,
    reason: BY_CODE[code] ?? "other",
    waitSeconds: Number.isFinite(wait) && wait > 0 ? wait : undefined,
  }
}
