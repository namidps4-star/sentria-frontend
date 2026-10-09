/* The wholesalers a pharmacy orders from, and when an order reaches it.
 *
 * Everything here is the pharmacy's own typing: a cutoff time, how many days
 * a delivery takes before and after it, and the days the wholesaler delivers.
 * SentrIA cannot see a wholesaler's stock, so it never says who has a
 * product. It lists the wholesalers in the order the pharmacy prefers them
 * and shows, for each, when an order placed now would arrive. */

import { TIMEZONES, readTimezoneId } from "@/lib/company"
import { asRecord, type AlertParams } from "@/lib/value-at-risk"

export const WHOLESALERS_KEY = "sentria_wholesalers"

/** Days of the week, Monday first (index 0). */
export type DayFlags = [boolean, boolean, boolean, boolean, boolean, boolean, boolean]

export type Wholesaler = {
  id: string
  name: string
  /** Minutes after midnight, or null: no cutoff, an order always takes `before`. */
  cutoff: number | null
  /** Days until it arrives when ordered at or before the cutoff (0 = same day). */
  before: number
  /** Days until it arrives when ordered after the cutoff. */
  after: number
  /** Days it delivers, Monday first. */
  days: DayFlags
}

export const MAX_WHOLESALERS = 10
/** The longest delivery time the pickers offer. */
export const MAX_LEAD_DAYS = 7
/** Days the test panel looks ahead, today included. */
export const LADDER_DAYS = 7

export const DEFAULT_DAYS: DayFlags = [true, true, true, true, true, true, false]

export function newWholesaler(): Wholesaler {
  return {
    id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    cutoff: 16 * 60,
    before: 0,
    after: 1,
    days: [...DEFAULT_DAYS] as DayFlags,
  }
}

function clampDays(n: unknown, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback

  return Math.min(Math.max(v, 0), MAX_LEAD_DAYS)
}

/** Reads one stored row, or null when it is not usable. A row written by a
 *  later build with extra fields is kept as far as it makes sense. */
function parseOne(raw: unknown): Wholesaler | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== "string" || !r.id) return null

  const cutoff =
    typeof r.cutoff === "number" && Number.isFinite(r.cutoff) && r.cutoff >= 0 && r.cutoff < 24 * 60
      ? Math.round(r.cutoff)
      : null
  const before = clampDays(r.before, 0)
  const days = Array.isArray(r.days) && r.days.length === 7 ? (r.days.map(Boolean) as DayFlags) : ([...DEFAULT_DAYS] as DayFlags)

  return {
    id: r.id,
    name: typeof r.name === "string" ? r.name.slice(0, 80) : "",
    cutoff,
    before,
    after: cutoff === null ? before : Math.max(clampDays(r.after, before + 1), before),
    days,
  }
}

export function parseWholesalers(text: string | null): Wholesaler[] {
  if (!text) return []

  try {
    const data = JSON.parse(text)
    if (!Array.isArray(data)) return []

    return data
      .map(parseOne)
      .filter((w): w is Wholesaler => w !== null)
      .slice(0, MAX_WHOLESALERS)
  } catch {
    return []
  }
}

export function readWholesalers(): Wholesaler[] {
  if (typeof window === "undefined") return []

  try {
    return parseWholesalers(localStorage.getItem(WHOLESALERS_KEY))
  } catch {
    return []
  }
}

export function writeWholesalers(list: Wholesaler[]) {
  try {
    localStorage.setItem(WHOLESALERS_KEY, JSON.stringify(list.slice(0, MAX_WHOLESALERS)))
  } catch {
    /* storage full or blocked: the page keeps what it shows */
  }
}

/* ------------------------------ the clock ------------------------------- */

export type Moment = {
  /** 0 = Monday ... 6 = Sunday. */
  weekday: number
  /** Minutes after midnight. */
  minutes: number
}

/** The current moment on the account's clock (Settings, "Timezone"), not the
 *  browser's: the cutoffs are the wholesaler's local time, which is the
 *  pharmacy's. */
export function nowOnAccountClock(date = new Date()): Moment {
  const zone = TIMEZONES.find((t) => t.id === readTimezoneId())?.zone

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
    const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"))

    return { weekday: Math.max(weekday, 0), minutes: Number(get("hour")) * 60 + Number(get("minute")) }
  } catch {
    return { weekday: (date.getDay() + 6) % 7, minutes: date.getHours() * 60 + date.getMinutes() }
  }
}

/* ----------------------------- the arithmetic --------------------------- */

/** Days from the moment of the order until the delivery, or null when the
 *  wholesaler delivers on no day. Ordered at or before the cutoff the base is
 *  `before`, after it `after`; a delivery that falls on a day the wholesaler
 *  does not deliver waits for the next day it does. */
export function arrivalDays(w: Wholesaler, at: Moment): number | null {
  if (!w.days.some(Boolean)) return null

  const base = w.cutoff === null || at.minutes <= w.cutoff ? w.before : w.after

  for (let d = base; d < base + 7; d++) {
    if (w.days[(at.weekday + d) % 7]) return d
  }

  return null
}

export type Reading = {
  wholesaler: Wholesaler
  /** Days until it arrives, null when it never does. */
  arrives: number | null
  /** The order is early enough: it arrives on or before the day the stock runs out. */
  inTime: boolean
  /** Days without stock before it arrives (0 when in time). */
  gap: number
  /** The order is placed before the cutoff, so "before 4 pm" is still open. */
  beforeCutoff: boolean
}

/** How each wholesaler does for a product that lasts `stockDays` more days.
 *  Same order as the list. */
export function readLadder(list: Wholesaler[], at: Moment, stockDays: number): Reading[] {
  return list.map((wholesaler) => {
    const arrives = arrivalDays(wholesaler, at)
    const inTime = arrives !== null && arrives <= stockDays

    return {
      wholesaler,
      arrives,
      inTime,
      gap: arrives === null ? Infinity : Math.max(arrives - stockDays, 0),
      beforeCutoff: wholesaler.cutoff !== null && at.minutes <= wholesaler.cutoff,
    }
  })
}

export type Advice =
  | { kind: "none" }
  /** `pick` is the first wholesaler in the list that is in time. */
  | { kind: "order"; pick: Reading; fallback: Reading | null }
  /** No wholesaler is in time: the one that comes soonest, and for how long the stock is out. */
  | { kind: "late"; fastest: Reading | null }

export function advise(readings: Reading[]): Advice {
  if (readings.length === 0) return { kind: "none" }

  const pickIndex = readings.findIndex((r) => r.inTime)

  if (pickIndex >= 0) {
    return { kind: "order", pick: readings[pickIndex], fallback: readings[pickIndex + 1] ?? null }
  }

  const reachable = readings.filter((r) => r.arrives !== null)
  const fastest = reachable.sort((a, b) => (a.arrives as number) - (b.arrives as number))[0] ?? null

  return { kind: "late", fastest }
}

/** The "Nearby / Farther / Farthest" tag: the list is in order of preference,
 *  and the pharmacy lists the nearest first. */
export function rankTag(index: number, count: number): "nearby" | "farther" | "farthest" | null {
  if (count < 2) return null
  if (index === 0) return "nearby"
  if (index === count - 1 && count > 2) return "farthest"

  return "farther"
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)

  return next
}

/* ------------------------- the alert's side of it ------------------------ */

/** The stock alerts a pharmacy's wholesalers can answer. */
const STOCK_ALERT = /^health\.(stock|reorder)\./

/** Whole days of stock left, from the number the API puts on a pharmacy stock
 *  alert (`stock_days_left`: stock over daily sales, rounded down). Null for
 *  any other alert and for an alert saved before the API sent it: the app then
 *  says nothing about delivery, never a guess. Not `days_left`: on an expiry
 *  alert that is the days until the expiry date. */
export function stockDaysFromAlert(alertKey: string | null | undefined, params: AlertParams): number | null {
  if (!alertKey || !STOCK_ALERT.test(alertKey)) return null
  const value = asRecord(params)?.stock_days_left
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null

  return Math.floor(value)
}
