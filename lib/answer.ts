/* L4 trust layer: did the source answer, or only look like it did?

   The API answers a failed list read with HTTP 200, an empty list and the
   error beside it:

     /alerts            {"alerts": [], "error_code": "alerts_query_failed", ...}
     /recommendations   {"count": 0, "recommendations": [], "error": "..."}
     /contractors       {"contractors": [], "error_code": "crm_query_failed", ...}

   Read as "an empty list" that is "no alerts", a calm screen over a broken
   source. `listFrom` and `readList` keep the two apart: the rows when the
   source answered, a reason when it did not. A caller shows "not measured"
   for the reason, never an empty list. */

export type ListAnswer<T> =
  | { ok: true; rows: T[] }
  /** `reason` is a short code for a log line or a corner of the screen
   *  ("HTTP 500", "alerts_query_failed"), not a sentence for the reader. */
  | { ok: false; reason: string }

const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)

/** A parsed answer body as a list. `key` names the list when the body is an
 *  object (`/alerts` sends a bare array when it worked). An error beside the
 *  list wins over the list: the rows of a failed read are not a measurement. */
export function listFrom<T>(body: unknown, key: string): ListAnswer<T> {
  if (Array.isArray(body)) return { ok: true, rows: body as T[] }

  if (body && typeof body === "object") {
    const answer = body as Record<string, unknown>
    const code = text(answer.error_code)

    if (code) return { ok: false, reason: code }
    if (text(answer.error)) return { ok: false, reason: "error" }

    const rows = answer[key]

    if (Array.isArray(rows)) return { ok: true, rows: rows as T[] }
  }

  return { ok: false, reason: "unexpected_answer" }
}

/** A fetch response as a list: an HTTP error, a body that is not JSON and an
 *  answer that carries an error are all "did not answer". */
export async function readList<T>(res: Response, key: string): Promise<ListAnswer<T>> {
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }

  let body: unknown

  try {
    body = await res.json()
  } catch {
    return { ok: false, reason: "unreadable_answer" }
  }

  return listFrom<T>(body, key)
}
