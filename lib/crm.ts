/**
 * The contractor CRM client.
 *
 * Six routes on the backend, behind one module so the board and the
 * contractors view cannot drift into two different ideas of the same
 * resource.
 *
 *
 * Why every call returns a result instead of throwing
 * ---------------------------------------------------
 *
 * These endpoints answer HTTP 200 even when they failed, and say which
 * failure it was in `error_code`. That is the contract /alerts and /ask
 * already use, and it is the reason Ask AI once rendered a fallback
 * string as if it were an answer: `res.ok` was true.
 *
 * So nothing here reads `res.ok` alone, and nothing returns a bare value
 * that a caller could mistake for success. Every function returns
 * `{ ok: true, data }` or `{ ok: false, code, detail }`, which forces the
 * caller to decide what to show when a save did not land. A board that
 * silently keeps a change the server rejected is lying about its own
 * state.
 *
 *
 * What company_name is for
 * ------------------------
 *
 * It partitions the data so two operators cannot collide on the same
 * task key. It is NOT access control: the API has no authentication, so
 * any caller can pass any company name. Do not present it as privacy.
 */

import { API_BASE, apiFetch } from "@/lib/api"
import { localized, type Localized, type Tx } from "@/lib/i18n"

export type Availability = "available" | "busy" | "off"

export const AVAILABILITY_LABEL: Record<Availability, Localized> = {
  available: localized("Disponible", "Available"),
  busy: localized("Occupé", "Busy"),
  off: localized("Indisponible", "Unavailable"),
}

/** "dismissed" (F-SUPPRESS): a card the user set aside as not useful. The
 *  board hides it and offers to restore it. */
export type AssignmentStatus = "todo" | "in_progress" | "done" | "dismissed"

export type AssignmentPriority = "low" | "medium" | "high" | "critical"

export type Contractor = {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  availability: Availability
  note: string | null
  active: boolean
  /** Counted from the assignments table, not stored on the contractor,
   *  so it cannot drift away from what the board shows. */
  open_assignments: number
  /** Can this person be texted? false when the stored number is not a real
   *  E.164 one (it was saved before F-PHONE); null when there is no number.
   *  Absent from an API that has not been redeployed yet: read as "unknown". */
  sms_ready?: boolean | null
}

/** The task a recommendation or alert is tracked under. One key for the
 *  whole app: the dashboard's "Mark handled", the tracking board and the
 *  calendar each keyed tasks their own way, so a task done in one place
 *  stayed open in the others (P-TRACK). Repeat alerts on the same
 *  equipment for the same issue are one task. */
export function taskKeyFor(rec: {
  equipment: string
  alert_key?: string | null
  id: string
}): string {
  return `${rec.equipment}-${rec.alert_key ?? rec.id}`
}

export type Assignment = {
  id?: string
  task_key: string
  status: AssignmentStatus
  priority: AssignmentPriority
  deadline: string | null
  /** Everyone on this task. A crane driver and a customs agent are on
   *  the same container, so a task holds a set rather than one person.
   *
   *  The API also still returns the old single `contractor_id`, as a
   *  mirror of the first of this set, so an older build keeps working
   *  through a deploy. Nothing here reads it: a mirror that two places
   *  disagree about is worse than no mirror at all. */
  contractor_ids: string[]
}

/** The ids on an assignment, whichever shape the API answered in.
 *
 *  An API that has not been redeployed yet answers with `contractor_id`
 *  and no `contractor_ids`, and a board that read the new field alone
 *  would show every task as unassigned against it. Normalising on the
 *  way in means exactly one place has to know that. */
export function contractorIdsOf(row: unknown): string[] {
  if (!row || typeof row !== "object") return []

  const record = row as Record<string, unknown>
  const many = record.contractor_ids

  if (Array.isArray(many)) {
    return many
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .filter((id, index, all) => all.indexOf(id) === index)
  }

  const one = record.contractor_id

  return typeof one === "string" && one.length > 0 ? [one] : []
}

export type CrmResult<T> =
  | { ok: true; data: T }
  /** `detail` is a pair so a caller can show it in the reader's own
   *  language. Text the API itself chose is wrapped as the same string in
   *  both, because that is the truth: the server picked those words and
   *  this module is not going to re-derive them. */
  | { ok: false; code: string; detail: Localized }

/** A request that never reached the API at all: CORS, DNS, the server
 *  being down. Distinct from a rejection the API sent back, because the
 *  two need different words in front of a user. */
const UNREACHABLE = "unreachable"

function failed(code: string, detail: Localized): CrmResult<never> {
  return { ok: false, code, detail }
}

/** A message the API wrote, carried through unchanged. */
function fromApi(detail: string): Localized {
  return localized(detail, detail)
}

/** Resolve a failed result's wording. */
export function crmErrorText(detail: Localized, tx: Tx): string {
  return tx(detail.fr, detail.en)
}

async function call<T>(
  path: string,
  init: RequestInit,
  pick: (body: Record<string, unknown>) => T
): Promise<CrmResult<T>> {
  let res: Response

  try {
    res = await apiFetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    })
  } catch (error) {
    console.error(`[SentrIA] ${init.method ?? "GET"} ${path} never completed.`, error)

    return failed(
      UNREACHABLE,
      localized(
        "L'API SentrIA n'a pas répondu. Origine bloquée par CORS, ou API hors service.",
        "The SentrIA API did not answer. Either CORS blocked the origin, or the API is down."
      )
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")

    console.error(
      `[SentrIA] ${init.method ?? "GET"} ${path} -> HTTP ${res.status}`,
      text
    )

    // The API's own reason when it gave one (sign-in expired, no
    // account yet...), not just the status.
    let reason = ""
    try {
      const parsed = JSON.parse(text) as { detail?: { message?: unknown; error_code?: unknown } }
      reason = typeof parsed?.detail?.message === "string" ? parsed.detail.message : ""
    } catch {
      reason = ""
    }

    return failed(
      "http_error",
      localized(
        `L'API a répondu ${res.status}.${reason ? ` ${reason}` : ""}`,
        `The API answered ${res.status}.${reason ? ` ${reason}` : ""}`
      )
    )
  }

  let body: Record<string, unknown>

  try {
    body = await res.json()
  } catch (error) {
    console.error(`[SentrIA] ${path} returned a body that is not JSON.`, error)

    return failed(
      "bad_json",
      localized(
        "Réponse illisible de l'API.",
        "The API's response could not be read."
      )
    )
  }

  /* The 200-with-an-error-code case. Checked before the payload is read,
     because on failure the payload is an empty placeholder and treating
     it as data is exactly how an empty board comes to look healthy. */
  if (typeof body.error_code === "string") {
    const detail =
      typeof body.error_detail === "string" && body.error_detail
        ? body.error_detail
        : body.error_code

    console.error(`[SentrIA] ${path} -> ${body.error_code}`, detail)

    return failed(body.error_code, fromApi(detail))
  }

  return { ok: true, data: pick(body) }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/* ------------------------------------------------------------------ */
/*  Contractors                                                        */
/* ------------------------------------------------------------------ */

export function fetchContractors(
  companyName: string
): Promise<CrmResult<Contractor[]>> {
  if (!companyName) {
    return Promise.resolve(
      failed(
        "company_name_required",
        localized(
          "Renseignez le nom de l'entreprise dans les Paramètres.",
          "Set the company name in Settings."
        )
      )
    )
  }

  return call(
    `/contractors?company_name=${encodeURIComponent(companyName)}`,
    { method: "GET" },
    (body) => asArray<Contractor>(body.contractors)
  )
}

export function createContractor(
  companyName: string,
  input: {
    name: string
    role?: string
    phone?: string
    email?: string
    availability?: Availability
    note?: string
  }
): Promise<CrmResult<Contractor>> {
  return call(
    "/contractors",
    {
      method: "POST",
      body: JSON.stringify({ company_name: companyName, ...input }),
    },
    (body) => body.contractor as Contractor
  )
}

export function updateContractor(
  contractorId: string,
  patch: Partial<{
    name: string
    role: string
    phone: string
    email: string
    note: string
    availability: Availability
  }>
): Promise<CrmResult<Contractor>> {
  return call(
    `/contractors/${encodeURIComponent(contractorId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    (body) => body.contractor as Contractor
  )
}

/** A soft delete on the backend: the row stays so the assignments that
 *  name this person keep a name, and the list stops returning them. */
export function deactivateContractor(
  contractorId: string
): Promise<CrmResult<Contractor>> {
  return call(
    `/contractors/${encodeURIComponent(contractorId)}`,
    { method: "DELETE" },
    (body) => body.contractor as Contractor
  )
}

/* ------------------------------------------------------------------ */
/*  Removing a contractor: hand their open tasks over first (F-CDELETE) */
/* ------------------------------------------------------------------ */

/** One person who could take a task, with the facts behind the ranking. */
export type HandoverCandidate = {
  id: string
  name: string
  role: string | null
  availability: Availability
  /** Same role as the person leaving. */
  role_match: boolean
  /** Open tasks they already hold. */
  open: number
  /** Open tasks of theirs due within a day of this one. */
  conflicts: number
  score: number
}

export type HandoverTask = {
  task_key: string
  status: AssignmentStatus
  priority: AssignmentPriority
  deadline: string | null
  /** The asset, and what the alert says (may be empty). */
  equipment: string
  message: string
  /** Others already on the task: they keep it. */
  co_holders: string[]
  /** The API's first pick, and the ranked runners-up. */
  suggested: string | null
  candidates: HandoverCandidate[]
}

export type Handover = {
  contractor: { id: string; name: string; role: string | null }
  open_count: number
  tasks: HandoverTask[]
}

/** A text for one person who gained a task. Nothing is sent: per-contractor
 *  SMS is not live yet, so the app keeps these (lib/sms-drafts.ts). */
export type HandoverDraft = {
  contractor_id: string
  name: string
  phone: string | null
  sms_ready: boolean | null
  task_keys: string[]
  body: string
}

export type HandoverResult = {
  contractor: Contractor
  handed_over: number
  unassigned: string[]
  drafts: HandoverDraft[]
}

/** What leaving would orphan, and who could take each task. Read only. */
export function fetchHandover(
  contractorId: string,
  lang: "fr" | "en"
): Promise<CrmResult<Handover>> {
  return call(
    `/contractors/${encodeURIComponent(contractorId)}/handover?lang=${lang}`,
    { method: "GET" },
    (body) => {
      const plan = (body.handover ?? {}) as Partial<Handover>

      return {
        contractor: plan.contractor ?? { id: contractorId, name: "", role: null },
        open_count: typeof plan.open_count === "number" ? plan.open_count : 0,
        tasks: asArray<HandoverTask>(plan.tasks).map((task) => ({
          ...task,
          equipment: task.equipment || task.task_key,
          message: task.message ?? "",
          co_holders: asArray<string>(task.co_holders),
          candidates: asArray<HandoverCandidate>(task.candidates),
        })),
      }
    }
  )
}

/** Move the open tasks to the people chosen, then remove the person. A
 *  task left out of `moves` (or sent with no one) is left without them. */
export function applyHandover(
  contractorId: string,
  moves: { task_key: string; contractor_ids: string[] }[],
  lang: "fr" | "en"
): Promise<CrmResult<HandoverResult>> {
  return call(
    `/contractors/${encodeURIComponent(contractorId)}/handover`,
    { method: "POST", body: JSON.stringify({ moves, lang }) },
    (body) => {
      const result = (body.result ?? {}) as Partial<HandoverResult>

      return {
        contractor: result.contractor as Contractor,
        handed_over: typeof result.handed_over === "number" ? result.handed_over : 0,
        unassigned: asArray<string>(result.unassigned),
        drafts: asArray<HandoverDraft>(result.drafts),
      }
    }
  )
}

/* ------------------------------------------------------------------ */
/*  Assignments                                                        */
/* ------------------------------------------------------------------ */

export function fetchAssignments(
  companyName: string
): Promise<CrmResult<Assignment[]>> {
  if (!companyName) {
    return Promise.resolve(
      failed(
        "company_name_required",
        localized(
          "Renseignez le nom de l'entreprise dans les Paramètres.",
          "Set the company name in Settings."
        )
      )
    )
  }

  return call(
    `/assignments?company_name=${encodeURIComponent(companyName)}`,
    { method: "GET" },
    (body) =>
      asArray<Assignment>(body.assignments).map((row) => ({
        ...row,
        contractor_ids: contractorIdsOf(row),
      }))
  )
}

/** Upsert one card's state.
 *
 *  Keyed on (company_name, task_key) server side, so saving the same
 *  card repeatedly replaces its state rather than adding rows. The task
 *  key is the recommendation id the board already computes,
 *  "stage:equipment".
 */
export function saveAssignment(
  companyName: string,
  assignment: Assignment
): Promise<CrmResult<Assignment>> {
  return call(
    "/assignments",
    {
      method: "PUT",
      body: JSON.stringify({ company_name: companyName, ...assignment }),
    },
    (body) => {
      const row = body.assignment as Assignment

      return { ...row, contractor_ids: contractorIdsOf(row) }
    }
  )
}

/* ------------------------------------------------------------------ */
/*  Two-way SMS (F-SMS2)                                               */
/* ------------------------------------------------------------------ */

/** What the API did with a text about a task. `live` is false until the SMS
 *  provider is switched on: the text is then logged, and not sent. */
export type TaskText = {
  status: "placeholder" | "sent" | "failed"
  live: boolean
}

/** Text one person on a task. Only the task and the person are sent: the
 *  words are the API's, so this cannot be used to send arbitrary text. The
 *  task must already be saved with that person on it. */
export function textContractor(
  taskKey: string,
  contractorId: string,
  language: "fr" | "en"
): Promise<CrmResult<TaskText>> {
  return call(
    "/assignments/sms",
    {
      method: "POST",
      body: JSON.stringify({ task_key: taskKey, contractor_id: contractorId, lang: language }),
    },
    (body) => {
      const sms = (body.sms ?? {}) as Record<string, unknown>
      const status = sms.status === "sent" || sms.status === "failed" ? sms.status : "placeholder"

      return { status, live: sms.live === true }
    }
  )
}

const SMS_ERRORS: Record<string, Localized> = {
  sms_capped: localized(
    "La limite quotidienne de SMS de votre entreprise est atteinte.",
    "Your company's daily text limit is reached."
  ),
  phone_invalid: localized(
    "Ce numéro n'est pas valide. Corrigez-le dans Intervenants.",
    "This number is not valid. Fix it in Field team."
  ),
  contractor_not_on_task: localized(
    "La tâche n'est pas encore enregistrée avec cette personne. Réessayez dans un instant.",
    "The task is not saved with this person yet. Try again in a moment."
  ),
  task_closed: localized(
    "Cette tâche est déjà fermée.",
    "This task is already closed."
  ),
  sms_log_unavailable: localized(
    "L'envoi de SMS n'est pas encore prêt côté serveur (migration 014).",
    "Texting is not ready on the server yet (migration 014)."
  ),
  sms_send_failed: localized(
    "Le SMS n'a pas pu partir.",
    "The text could not be sent."
  ),
}

/** The wording for a failed text: ours when we know the reason, else what
 *  the API said. */
export function smsErrorText(code: string, fallback: Localized): Localized {
  return SMS_ERRORS[code] ?? fallback
}
