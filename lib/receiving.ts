/* PH-RECEIVE, the app's side: the goods-receiving check.
 *
 * A pharmacy sends the file from its own stock system and gets back only the
 * rows to look at against the box: a missing lot or date, a date that reads
 * two ways, a lot with two dates, a lot already expired. The API answers the
 * list (POST /receiving/check) and saves nothing. What staff have looked at
 * is kept here, in the browser, with the last list, so a refresh does not
 * lose it. */

import { activeDepartment } from "@/lib/active-site"
import { announceAlertsUpdated } from "@/lib/alerts-event"
import { API_BASE, apiFetch } from "@/lib/api"
import { accountCurrencyParam } from "@/lib/locale"

export type Flag = "nodate" | "unclear" | "conflict" | "expired"

/** The order staff should work in, and the order of the board's columns. */
export const FLAGS: Flag[] = ["nodate", "unclear", "conflict", "expired"]

export const FLAG_LABEL: Record<Flag, { fr: string; en: string }> = {
  nodate: { fr: "Manquant", en: "Missing" },
  unclear: { fr: "Date ambiguë", en: "Unclear" },
  conflict: { fr: "Deux dates", en: "Two dates" },
  expired: { fr: "Périmé", en: "Expired" },
}

export const FLAG_HINT: Record<Flag, { fr: string; en: string }> = {
  nodate: { fr: "Lire le lot et la date sur la boîte", en: "Read the lot and date on the box" },
  unclear: { fr: "Quel nombre est le jour ?", en: "Which number is the day?" },
  conflict: { fr: "Garder la bonne date", en: "Keep the right date" },
  expired: { fr: "Mettre de côté, demander un avoir", en: "Set aside, ask for a credit note" },
}

export type Item = {
  id: string
  row: number
  flag: Flag
  product: string
  batch: string
  expiry: string
  dates: string[] | null
  daysExpired: number | null
  value: number | null
  currency: string | null
  message: string
  action: string
}

/** One line of the file, as the grid shows it. `bad` names the cells to colour. */
export type TableRow = {
  row: number
  product: string
  batch: string
  expiry: string
  quantity: string
  unitCost: string
  flag: Flag | null
  item: string | null
  bad: ("batch" | "expiry")[]
}

export type Worklist = {
  rows: number
  flagged: number
  clean: number
  items: Item[]
  /** The whole file, flagged rows first-class and clean ones up to the API's cap. Empty for a list kept before the grid existed. */
  table: TableRow[]
  tableTruncated: boolean
}

/** One tick: when, and the date typed from the box if there was one. */
export type Tick = { at: number; date?: string }
export type Ticks = Record<string, Tick>

/** `raised` is how many alerts the list was turned into, once it has been. */
export type Saved = { name: string; at: number; list: Worklist; ticks: Ticks; raised?: number }

/** Fired when the kept list or its ticks change, so the sidebar's count follows. */
export const RECEIVING_CHANGED = "sentria_receiving_changed"

const KEY = "sentria_receiving"

const isFlag = (v: unknown): v is Flag => typeof v === "string" && (FLAGS as string[]).includes(v)
const text = (v: unknown) => (typeof v === "string" ? v : "")
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** The API's answer as a Worklist, or null when it is not one. All or nothing. */
export function parseWorklist(body: unknown): Worklist | null {
  const b = body as { success?: unknown; rows?: unknown; flagged?: unknown; clean?: unknown; items?: unknown } | null

  if (!b || b.success !== true || !Array.isArray(b.items)) return null

  const items: Item[] = []

  for (const raw of b.items as Record<string, unknown>[]) {
    if (!raw || !isFlag(raw.flag) || typeof raw.id !== "string" || typeof raw.product !== "string") return null

    items.push({
      id: raw.id,
      row: num(raw.row) ?? 0,
      flag: raw.flag,
      product: raw.product,
      batch: text(raw.batch),
      expiry: text(raw.expiry),
      dates: Array.isArray(raw.dates) ? raw.dates.map(String) : null,
      daysExpired: num(raw.days_expired),
      value: num(raw.value),
      currency: typeof raw.currency === "string" ? raw.currency : null,
      message: text(raw.message),
      action: text(raw.action),
    })
  }

  return { rows: num(b.rows) ?? items.length, flagged: items.length, clean: num(b.clean) ?? 0, items, table: parseTable((b as { table?: unknown }).table), tableTruncated: (b as { table_truncated?: unknown }).table_truncated === true }
}

/** The API's table, or nothing when it is missing or malformed: the grid then falls back to the flagged rows. */
function parseTable(raw: unknown): TableRow[] {
  if (!Array.isArray(raw)) return []

  const out: TableRow[] = []

  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r.row !== "number") return []

    out.push({
      row: r.row,
      product: text(r.product),
      batch: text(r.batch),
      expiry: text(r.expiry),
      quantity: text(r.quantity),
      unitCost: text(r.unit_cost),
      flag: isFlag(r.flag) ? r.flag : null,
      item: typeof r.item === "string" ? r.item : null,
      bad: Array.isArray(r.bad) ? (r.bad.filter((c) => c === "batch" || c === "expiry") as ("batch" | "expiry")[]) : [],
    })
  }

  return out
}

/** The grid's lines: the API's table, or, for an older kept list, the flagged rows rebuilt from the items. */
export function tableOf(list: Worklist): { rows: TableRow[]; whole: boolean } {
  if (list.table.length > 0) return { rows: list.table, whole: true }

  const rows = list.items
    .map<TableRow>((i) => ({
      row: i.row,
      product: i.product,
      batch: i.batch === "?" ? "" : i.batch,
      expiry: i.expiry,
      quantity: "",
      unitCost: "",
      flag: i.flag,
      item: i.id,
      bad: i.flag === "nodate" ? [...(i.batch && i.batch !== "?" ? [] : (["batch"] as const)), ...(i.expiry ? [] : (["expiry"] as const))] : ["expiry"],
    }))
    .sort((a, b) => a.row - b.row)

  return { rows, whole: false }
}

export type CheckResult = { ok: true; list: Worklist } | { ok: false; code: string; message: string }

/** Sends the file. Every failure comes back as {ok:false, message}: the API's own sentence when it sent one. */
export async function checkReceiving(file: File, lang: "fr" | "en"): Promise<CheckResult> {
  const fail = (code: string, message: string): CheckResult => ({ ok: false, code, message })
  const fallback =
    lang === "fr" ? "Le contrôle n'a pas abouti. Réessayez dans un instant." : "The check did not go through. Try again in a moment."

  try {
    const form = new FormData()
    form.append("file", file)

    const res = await apiFetch(`${API_BASE}/receiving/check?lang=${lang}`, { method: "POST", body: form })
    const body = await res.json().catch(() => null)

    if (res.ok) {
      const list = parseWorklist(body)

      return list ? { ok: true, list } : fail("bad_answer", fallback)
    }

    const detail = (body && (body.detail ?? body)) as { error_code?: unknown; message?: unknown } | null

    return fail(text(detail?.error_code) || "failed", text(detail?.message) || fallback)
  } catch {
    return fail("network", fallback)
  }
}

export function readSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(KEY)

    if (!raw) return null

    const saved = JSON.parse(raw) as Partial<Saved>
    const list = parseWorklist({ success: true, ...(saved.list ? serialise(saved.list) : {}) })

    if (!list || typeof saved.name !== "string") return null

    return { name: saved.name, at: num(saved.at) ?? 0, list, ticks: saved.ticks && typeof saved.ticks === "object" ? saved.ticks : {}, ...(typeof saved.raised === "number" ? { raised: saved.raised } : {}) }
  } catch {
    return null
  }
}

export function writeSaved(saved: Saved | null): void {
  try {
    if (!saved) window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    /* A full or blocked store: the screen still works, it just forgets on refresh. */
  }

  // After the current render: this is called from inside a state update.
  if (typeof window !== "undefined") queueMicrotask(() => window.dispatchEvent(new Event(RECEIVING_CHANGED)))
}

/** A Worklist back into the API's own shape, so one parser reads both. */
function serialise(list: Worklist) {
  return {
    rows: list.rows,
    clean: list.clean,
    items: list.items.map((i) => ({ ...i, days_expired: i.daysExpired })),
    // A list kept before the grid existed has no table.
    table: (list.table ?? []).map((t) => ({ ...t, unit_cost: t.unitCost })),
    table_truncated: list.tableTruncated === true,
  }
}

/** A cell that a spreadsheet would run as a formula is written as text. */
function cell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value)

  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`

  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The list as a CSV, for the pharmacy's own records: no names of people, only the rows. */
export function buildCsv(items: Item[], ticks: Ticks): string {
  const head = ["row", "problem", "product", "lot", "expiry_in_file", "date_on_box", "checked", "value", "currency", "what_is_wrong", "what_to_do"]

  const lines = items.map((i) => {
    const tick = ticks[i.id]

    return [i.row, i.flag, i.product, i.batch, i.expiry, tick?.date ?? "", tick ? "yes" : "no", i.value, i.currency, i.message, i.action].map(cell).join(",")
  })

  return [head.join(","), ...lines].join("\r\n") + "\r\n"
}

/** How many of the items are ticked, ignoring ticks of items no longer on the list. */
export function checkedCount(items: Item[], ticks: Ticks): number {
  return items.filter((i) => ticks[i.id]).length
}

/** The money still to look at: unticked items that carry a value, in one currency or none. */
export function valueLeft(items: Item[], ticks: Ticks): { value: number; currency: string } | null {
  const left = items.filter((i) => !ticks[i.id] && i.value !== null && i.currency)

  if (left.length === 0) return null

  const currency = left[0].currency as string

  if (left.some((i) => i.currency !== currency)) return null

  return { value: left.reduce((sum, i) => sum + (i.value as number), 0), currency }
}

export type RaiseResult = { ok: true; fired: number } | { ok: false; message: string }

/** Turns the same file into alerts (one per flagged row) through /upload, named as a receiving file.
 *  The API raises them through its one alert path, so the phone limits and the demotion of an
 *  alert you keep dismissing apply. Needs the file itself: it is only in memory just after the
 *  check. */
export async function raiseReceivingAlerts(file: File, lang: "fr" | "en"): Promise<RaiseResult> {
  const fallback = lang === "fr" ? "Les alertes n'ont pas pu être créées. Réessayez dans un instant." : "The alerts could not be created. Try again in a moment."

  try {
    const form = new FormData()
    form.append("file", file)

    const department = activeDepartment() ?? "pharmacie"
    const res = await apiFetch(`${API_BASE}/upload?sector=health&business_type=${encodeURIComponent(department)}&lang=${lang}&kind=receiving${accountCurrencyParam()}`, { method: "POST", body: form })
    const body = (await res.json().catch(() => null)) as { success?: unknown; alerts_fired?: unknown; message?: unknown; detail?: { message?: unknown } } | null

    if (res.ok && body?.success === true) {
      announceAlertsUpdated()

      return { ok: true, fired: typeof body.alerts_fired === "number" ? body.alerts_fired : 0 }
    }

    return { ok: false, message: text(body?.message) || text(body?.detail?.message) || fallback }
  } catch {
    return { ok: false, message: fallback }
  }
}
