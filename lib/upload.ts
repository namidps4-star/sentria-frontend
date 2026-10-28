import { track } from "./analytics"
import { announceAlertsUpdated } from "./alerts-event"
import { withActiveSite } from "./api"
import { supabase } from "./supabase"
import { uploadTeach, type UploadTeach } from "./upload-problem"

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
  /** On a refusal for missing columns: what each is for, with examples. */
  teach?: UploadTeach
  /** On a refusal for missing columns: each missing name's accepted spellings
   *  (the first one is the name the file's column is matched to). */
  missing?: string[][]
  /** The file's own column names, to pick from when matching by hand. */
  fileColumns?: string[]
  /** Runs the import again with the columns the user matched by hand. */
  retry?: (mapping: Record<string, string>) => Promise<UploadState>
}

/** What a missing-columns refusal carries over into the retry. */
type MissingColumns = { missing: string[][]; fileColumns: string[] }

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
    xhr.open("POST", withActiveSite(url))
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

function errorCode(body: unknown): string | undefined {
  const b = (body ?? {}) as { error_code?: unknown; detail?: { error_code?: unknown } }
  const code = b.error_code ?? b.detail?.error_code
  return typeof code === "string" ? code : undefined
}

/** The missing names and the file's columns, from a 422 for missing columns. */
function columnsMissing(body: unknown): MissingColumns | undefined {
  const b = (body ?? {}) as { missing?: unknown; file_columns?: unknown }
  const isNames = (v: unknown): v is string[] => Array.isArray(v) && v.every((n) => typeof n === "string")
  if (!Array.isArray(b.missing) || !b.missing.every(isNames) || b.missing.length === 0) return undefined
  if (!isNames(b.file_columns)) return undefined
  return { missing: b.missing as string[][], fileColumns: b.file_columns }
}

/** Rows and alerts from a successful /upload answer. */
export function uploadSummary(body: unknown): { rows: number; alerts: number; failedSaves: number } {
  const b = (body ?? {}) as Record<string, unknown>
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
  return { rows: n(b.rows_processed), alerts: n(b.alerts_fired), failedSaves: n(b.saves_failed) }
}

/** Runs one import and reports each stage through `set`. Resolves with
 *  the final state; never throws. `refusal` turns a 422/403 body into
 *  the message to show (uploadProblemMessage). `mapping` matches the
 *  file's columns to the missing names by hand (a retry after a
 *  missing-columns refusal). */
export async function runUpload(
  url: string,
  file: File,
  set: (state: UploadState) => void,
  refusal: (body: unknown) => string,
  networkError: string,
  mapping?: Record<string, string>,
  context?: MissingColumns
): Promise<UploadState> {
  const form = new FormData()
  form.append("file", file)
  if (mapping) form.append("mapping", JSON.stringify(mapping))

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

    if (status === 422 || status === 403 || (status === 400 && errorCode(body) === "mapping_invalid")) {
      const missing = errorCode(body) === "upload_columns_missing" ? columnsMissing(body) : context
      final = {
        phase: "refused",
        fileName,
        message: refusal(body),
        teach: uploadTeach(body) ?? undefined,
        ...(missing ? { missing: missing.missing, fileColumns: missing.fileColumns, retry: (choice) => runUpload(url, file, set, refusal, networkError, choice, missing) } : {}),
      }
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

  // Every view that shows the data's age or the alerts reads them again: the
  // sidebar's status, the account card and the dashboard (lib/freshness.ts).
  if (final.phase === "done") announceAlertsUpdated()

  // Only the outcome is counted: never the file, its name or what was in it.
  if (final.phase === "done" || final.phase === "refused" || final.phase === "failed") {
    track({ name: "upload_result", result: final.phase })
  }

  set(final)
  return final
}
