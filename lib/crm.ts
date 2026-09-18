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

import { API_BASE } from "@/lib/api"

export type Availability = "available" | "busy" | "off"

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "Disponible",
  busy: "Occupé",
  off: "Indisponible",
}

export type AssignmentStatus = "todo" | "in_progress" | "done"

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
}

export type Assignment = {
  id?: string
  task_key: string
  status: AssignmentStatus
  priority: AssignmentPriority
  deadline: string | null
  contractor_id: string | null
}

export type CrmResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; detail: string }

/** A request that never reached the API at all: CORS, DNS, the server
 *  being down. Distinct from a rejection the API sent back, because the
 *  two need different words in front of a user. */
const UNREACHABLE = "unreachable"

function failed(code: string, detail: string): CrmResult<never> {
  return { ok: false, code, detail }
}

async function call<T>(
  path: string,
  init: RequestInit,
  pick: (body: Record<string, unknown>) => T
): Promise<CrmResult<T>> {
  let res: Response

  try {
    res = await fetch(`${API_BASE}${path}`, {
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
      "L'API SentrIA n'a pas répondu. Origine bloquée par CORS, ou API hors service."
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")

    console.error(
      `[SentrIA] ${init.method ?? "GET"} ${path} -> HTTP ${res.status}`,
      text
    )

    return failed("http_error", `L'API a répondu ${res.status}.`)
  }

  let body: Record<string, unknown>

  try {
    body = await res.json()
  } catch (error) {
    console.error(`[SentrIA] ${path} returned a body that is not JSON.`, error)

    return failed("bad_json", "Réponse illisible de l'API.")
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

    return failed(body.error_code, detail)
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
        "Renseignez le nom de l'entreprise dans les Paramètres."
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
/*  Assignments                                                        */
/* ------------------------------------------------------------------ */

export function fetchAssignments(
  companyName: string
): Promise<CrmResult<Assignment[]>> {
  if (!companyName) {
    return Promise.resolve(
      failed(
        "company_name_required",
        "Renseignez le nom de l'entreprise dans les Paramètres."
      )
    )
  }

  return call(
    `/assignments?company_name=${encodeURIComponent(companyName)}`,
    { method: "GET" },
    (body) => asArray<Assignment>(body.assignments)
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
    (body) => body.assignment as Assignment
  )
}
