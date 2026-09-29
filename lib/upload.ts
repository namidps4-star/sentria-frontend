import { supabase } from "./supabase"

/** Where an import is. `sending` has a real percentage (the browser
 *  reports bytes sent); `analysing` is the server checking the columns
 *  and running the checks, which it can't report on, so the screen shows
 *  elapsed seconds rather than an invented percentage. */
export type UploadPhase = "idle" | "sending" | "analysing" | "done" | "refused" | "failed"

export type UploadState = {
  phase: UploadPhase
  fileName?: string
  /** 0-100 while sending, when the browser reports it (it may not:
   *  some networks buffer the upload). */
  sentPct?: number
  /** When sending started (ms), for the elapsed counter without a %. */
  sendingSince?: number
  /** When the server started analysing (ms), for the elapsed counter. */
  analysingSince?: number
  rows?: number
  alerts?: number
  /** Alerts the server could not save. */
  failedSaves?: number
  /** The server's refusal (422/403) or the error, in the user's language. */
  message?: string
}

export type UploadResponse = { status: number; body: unknown }

/** POST a file with upload progress (fetch can't report it) and the
 *  user's session token, like apiFetch. */
export async function uploadWithProgress(
  url: string,
  form: FormData,
  onSent: (pct: number) => void
): Promise<UploadResponse> {
  let token: string | undefined
  try {
    token = (await supabase?.auth.getSession())?.data.session?.access_token
  } catch {
    /* sent without; the API answers 401 */
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onSent(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      }
    }
    xhr.upload.onload = () => onSent(100)

    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = xhr.responseText
      }
      resolve({ status: xhr.status, body })
    }
    xhr.onerror = () => reject(new Error("network"))
    xhr.onabort = () => reject(new Error("aborted"))

    xhr.send(form)
  })
}

/** Rows and alerts from a successful /upload answer. */
export function uploadSummary(body: unknown): { rows: number; alerts: number; failedSaves: number } {
  const b = (body ?? {}) as Record<string, unknown>
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
  return { rows: n(b.rows_processed), alerts: n(b.alerts_fired), failedSaves: n(b.saves_failed) }
}

/** Runs one import and reports each stage through `set`. Resolves with
 *  the final state; never throws. `refusal` turns a 422/403 body into
 *  the message to show (uploadProblemMessage). */
export async function runUpload(
  url: string,
  file: File,
  set: (state: UploadState) => void,
  refusal: (body: unknown) => string,
  networkError: string
): Promise<UploadState> {
  const form = new FormData()
  form.append("file", file)

  const fileName = file.name
  const sendingSince = Date.now()
  set({ phase: "sending", fileName, sendingSince })

  let analysing = false
  const startAnalysing = () => {
    if (analysing) return
    analysing = true
    set({ phase: "analysing", fileName, analysingSince: Date.now() })
  }

  let final: UploadState

  try {
    const { status, body } = await uploadWithProgress(url, form, (pct) => {
      if (pct >= 100) startAnalysing()
      else if (!analysing) set({ phase: "sending", fileName, sendingSince, sentPct: pct })
    })

    if (status === 422 || status === 403) {
      final = { phase: "refused", fileName, message: refusal(body) }
    } else if (status < 200 || status >= 300) {
      final = { phase: "failed", fileName, message: `${networkError} (HTTP ${status})` }
    } else {
      const { rows, alerts, failedSaves } = uploadSummary(body)
      final = { phase: "done", fileName, rows, alerts, failedSaves }
    }
  } catch (error) {
    console.error("[SentrIA] upload failed:", error)
    final = { phase: "failed", fileName, message: networkError }
  }

  set(final)
  return final
}
