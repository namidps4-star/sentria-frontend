import { describe, expect, it } from "vitest"

import { peopleOn, stageOf, swapsFrom, totalsOf, SWAP_KEY, type SwapAlert } from "@/lib/branch-swaps"
import type { Assignment, Contractor } from "@/lib/crm"

const alert = (equipment: string, params: Array<[string, unknown]>, date = "2026-10-27T10:00:00+00:00", key = SWAP_KEY): SwapAlert => ({
  equipment,
  alert_key: key,
  date,
  params,
})

const AMOX = (qty = 20, days = 20): Array<[string, unknown]> => [
  ["product", "Amoxicillin 250mg"],
  ["qty", qty],
  ["from_site", "Nairobi"],
  ["to_site", "Mombasa"],
  ["days", days],
  ["expiry", "2026-11-16"],
  ["value", 7600],
  ["currency", "KES"],
]

const assignment = (status: Assignment["status"], ids: string[]): Assignment => ({
  task_key: "k",
  status,
  priority: "high",
  deadline: null,
  contractor_ids: ids,
})

describe("swapsFrom", () => {
  it("reads what moves where, how many, by when, and the money", () => {
    const [swap] = swapsFrom([alert("Amoxicillin 250mg · Nairobi -> Mombasa", AMOX())])

    expect(swap).toMatchObject({
      taskKey: `Amoxicillin 250mg · Nairobi -> Mombasa-${SWAP_KEY}`,
      product: "Amoxicillin 250mg",
      fromSite: "Nairobi",
      toSite: "Mombasa",
      units: 20,
      days: 20,
      expiry: "2026-11-16",
      value: 7600,
      currency: "KES",
    })
  })

  it("ignores other alerts and swaps that lack what a swap needs", () => {
    const rows = swapsFrom([
      alert("PUMP-1", [["product", "x"]], undefined, "industry.torque.warning"),
      alert("a", [["product", "X"], ["qty", 5], ["from_site", "N"]]),
      alert("b", [["product", "X"], ["qty", 0], ["from_site", "N"], ["to_site", "M"]]),
      { equipment: "c", alert_key: SWAP_KEY, params: null },
    ])

    expect(rows).toEqual([])
  })

  it("keeps the newest alert of a repeated swap, one row per task", () => {
    const rows = swapsFrom([
      alert("A · N -> M", AMOX(20), "2026-10-20T10:00:00+00:00"),
      alert("A · N -> M", AMOX(25), "2026-10-27T10:00:00+00:00"),
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].units).toBe(25)
  })

  it("puts the swap that expires first on top", () => {
    const rows = swapsFrom([alert("late", AMOX(10, 45)), alert("soon", AMOX(10, 5))])

    expect(rows.map((r) => r.days)).toEqual([5, 45])
  })

  it("a bare value without a currency is not money", () => {
    const params = AMOX().filter(([k]) => k !== "currency")
    const [swap] = swapsFrom([alert("x", params)])

    expect(swap.value).toBeNull()
  })

  it("takes params in object form too, and a bad date as no date", () => {
    const [swap] = swapsFrom([{ equipment: "x", alert_key: SWAP_KEY, params: { product: "P", qty: 3, from_site: "A", to_site: "B", expiry: "soon" } }])

    expect(swap.units).toBe(3)
    expect(swap.expiry).toBeNull()
    expect(swap.days).toBeNull()
  })
})

describe("stageOf", () => {
  it("waits when there is no task, no person, or the task was dismissed", () => {
    expect(stageOf(undefined)).toBe("waiting")
    expect(stageOf(assignment("todo", []))).toBe("waiting")
    expect(stageOf(assignment("dismissed", ["c1"]))).toBe("waiting")
  })

  it("is with a person until they answer", () => {
    expect(stageOf(assignment("todo", ["c1"]))).toBe("with")
  })

  it("is taken once they tap I'll take it, and done when it is done", () => {
    expect(stageOf(assignment("in_progress", ["c1"]))).toBe("taken")
    expect(stageOf(assignment("done", ["c1"]))).toBe("done")
    expect(stageOf(assignment("done", []))).toBe("done")
  })

  it("an in-progress task with nobody on it is waiting, not taken", () => {
    expect(stageOf(assignment("in_progress", []))).toBe("waiting")
  })
})

describe("peopleOn", () => {
  const people = [{ id: "c1", name: "Mary" }, { id: "c2", name: "Joe" }] as Contractor[]

  it("gives names, never ids, and skips someone who was removed", () => {
    expect(peopleOn(assignment("todo", ["c1", "gone", "c2"]), people)).toEqual(["Mary", "Joe"])
    expect(peopleOn(undefined, people)).toEqual([])
  })
})

describe("totalsOf", () => {
  const rows = swapsFrom([alert("a", AMOX(20)), alert("b", [...AMOX(52, 45).filter(([k]) => k !== "value"), ["value", 3120]])])

  it("adds the money and the share already taken", () => {
    const stages = { [rows[0].taskKey]: "taken" as const, [rows[1].taskKey]: "waiting" as const }
    const totals = totalsOf(rows, stages)

    expect(totals).toMatchObject({ count: 2, value: 10720, currency: "KES" })
    expect(totals.takenShare).toBe(Math.round((7600 / 10720) * 100))
  })

  it("shows no total when one swap has no value or the currencies differ", () => {
    const noValue = swapsFrom([alert("a", AMOX()), alert("b", AMOX().filter(([k]) => k !== "currency"))])
    const mixed = swapsFrom([alert("a", AMOX()), alert("b", AMOX().map(([k, v]) => (k === "currency" ? [k, "USD"] : [k, v])) as Array<[string, unknown]>)])

    expect(totalsOf(noValue, {}).value).toBeNull()
    expect(totalsOf(mixed, {}).value).toBeNull()
    expect(totalsOf(mixed, {}).count).toBe(2)
  })

  it("with no money, the share counts swaps", () => {
    const plain = swapsFrom([alert("a", AMOX().filter(([k]) => k !== "currency")), alert("b", AMOX().filter(([k]) => k !== "currency"))])
    const stages = { [plain[0].taskKey]: "done" as const }

    expect(totalsOf(plain, stages).takenShare).toBe(50)
  })
})
