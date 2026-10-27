import type { Assignment, Contractor } from "@/lib/crm"
import { taskKeyFor } from "@/lib/crm"
import { asRecord, type AlertParams } from "@/lib/value-at-risk"

/* Branch swaps (F-BRANCHSWAP): stock that will expire at one pharmacy branch
 * and sells at another. The backend raises `health.branch.swap` on the branch
 * that holds the stock, so the alerts the Dashboard reads for a site are the
 * swaps that site should send. Everything here is read from those alerts and
 * from the task they are tracked under; nothing is guessed. */

export const SWAP_KEY = "health.branch.swap"

/** An alert as /alerts sends it: the fields a swap needs, params included. */
export type SwapAlert = {
  id?: string | number
  equipment: string
  alert_key?: string | null
  date?: string
  params?: AlertParams
  task_key?: string | null
}

export type Swap = {
  /** The task key the swap is tracked under (the board's, the calendar's). */
  taskKey: string
  product: string
  fromSite: string
  toSite: string
  units: number
  /** Days until the stock expires, as the alert counted them. */
  days: number | null
  /** ISO date the stock must leave by. */
  expiry: string | null
  value: number | null
  /** The symbol the backend printed, "" when unknown. */
  currency: string
  /** ISO date of the alert, to keep the newest of a repeat. */
  date: string
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function count(value: unknown): number | null {
  const n = Number(value)

  return Number.isFinite(n) && n > 0 ? n : null
}

/** One swap per task, the newest alert winning, most urgent first. An alert
 *  that is not a swap, or that lacks what a swap needs, is left out: a row
 *  that cannot say what moves where would only mislead. */
export function swapsFrom(alerts: SwapAlert[]): Swap[] {
  const byTask = new Map<string, Swap>()

  for (const alert of alerts) {
    if (alert.alert_key !== SWAP_KEY) continue

    const params = asRecord(alert.params)

    if (!params) continue

    const product = text(params.product)
    const fromSite = text(params.from_site)
    const toSite = text(params.to_site)
    const units = count(params.qty)

    if (!product || !fromSite || !toSite || units === null) continue

    const taskKey = taskKeyFor({
      equipment: alert.equipment,
      alert_key: alert.alert_key,
      id: String(alert.id ?? alert.equipment),
      task_key: alert.task_key,
    })

    const currency = "currency" in params ? text(params.currency) : ""
    const value = "currency" in params ? count(params.value) : null
    const days = Number(params.days)
    const swap: Swap = {
      taskKey,
      product,
      fromSite,
      toSite,
      units,
      days: Number.isFinite(days) ? days : null,
      expiry: /^\d{4}-\d{2}-\d{2}$/.test(text(params.expiry)) ? text(params.expiry) : null,
      value,
      currency,
      date: alert.date ?? "",
    }
    const held = byTask.get(taskKey)

    if (!held || swap.date > held.date) byTask.set(taskKey, swap)
  }

  return [...byTask.values()].sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity))
}

/** Where a swap stands, from the task it is tracked under.
 *
 *  waiting  no task, or nobody on it
 *  with     a person is on it and has not answered
 *  taken    the person tapped "I'll take it"
 *  done     the swap was done
 *
 *  A person who taps "I can't" is taken off the task and the task goes back
 *  to todo (the API does this), so it reads "waiting" again: the app cannot
 *  tell it from a swap nobody has been asked about. */
export type SwapStage = "waiting" | "with" | "taken" | "done"

export function stageOf(assignment: Assignment | undefined): SwapStage {
  if (!assignment || assignment.status === "dismissed") return "waiting"
  if (assignment.status === "done") return "done"
  if (assignment.contractor_ids.length === 0) return "waiting"
  if (assignment.status === "in_progress") return "taken"

  return "with"
}

/** The names of the people on a task, active ones first, never an id. */
export function peopleOn(assignment: Assignment | undefined, contractors: Contractor[]): string[] {
  if (!assignment) return []

  return assignment.contractor_ids
    .map((id) => contractors.find((c) => c.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}

export type SwapTotals = {
  count: number
  /** The sum, or null when no swap has a value or the currencies differ. */
  value: number | null
  currency: string
  /** Share of the money (or of the swaps, with no money) that is taken or done, 0 to 100. */
  takenShare: number
}

export function totalsOf(swaps: Swap[], stages: Record<string, SwapStage>): SwapTotals {
  const priced = swaps.filter((s) => s.value !== null)
  const currencies = new Set(priced.map((s) => s.currency))
  const sameCurrency = priced.length > 0 && currencies.size === 1
  const answered = (s: Swap) => stages[s.taskKey] === "taken" || stages[s.taskKey] === "done"

  if (sameCurrency && priced.length === swaps.length) {
    const total = priced.reduce((sum, s) => sum + (s.value ?? 0), 0)
    const taken = priced.filter(answered).reduce((sum, s) => sum + (s.value ?? 0), 0)

    return { count: swaps.length, value: total, currency: priced[0].currency, takenShare: total > 0 ? Math.round((taken / total) * 100) : 0 }
  }

  const taken = swaps.filter(answered).length

  return { count: swaps.length, value: null, currency: "", takenShare: swaps.length ? Math.round((taken / swaps.length) * 100) : 0 }
}
