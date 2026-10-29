import { describe, expect, it } from "vitest"

import {
  advise,
  arrivalDays,
  distanceTags,
  moveItem,
  readLadder,
  stockDaysFromAlert,
  type DayFlags,
  type Wholesaler,
} from "@/lib/wholesalers"

const MON_TO_SAT: DayFlags = [true, true, true, true, true, true, false]

const make = (over: Partial<Wholesaler> = {}): Wholesaler => ({
  id: "w",
  name: "Wholesaler",
  cutoff: 16 * 60,
  before: 0,
  after: 1,
  days: MON_TO_SAT,
  km: null,
  ...over,
})

// Weekday 0 is Monday. Minutes are after midnight on the pharmacy's clock.
const at = (weekday: number, hour: number, minute = 0) => ({ weekday, minutes: hour * 60 + minute })

describe("arrivalDays", () => {
  it("uses `before` up to the cutoff, and `after` past it", () => {
    expect(arrivalDays(make(), at(0, 10))).toBe(0)
    expect(arrivalDays(make(), at(0, 16))).toBe(0)
    expect(arrivalDays(make(), at(0, 17))).toBe(1)
  })

  it("waits for the next day it delivers", () => {
    // Saturday after the cutoff: Sunday is off, so Monday, two days on.
    expect(arrivalDays(make(), at(5, 17))).toBe(2)
  })

  it("with no cutoff, an order always takes `before`", () => {
    expect(arrivalDays(make({ cutoff: null, before: 2 }), at(4, 23))).toBe(3)
  })

  it("is null when it delivers on no day", () => {
    expect(arrivalDays(make({ days: [false, false, false, false, false, false, false] }), at(0, 9))).toBeNull()
  })
})

describe("readLadder and advise", () => {
  const near = make({ id: "near", cutoff: 16 * 60, before: 0, after: 1 })
  const far = make({ id: "far", cutoff: null, before: 3 })

  it("says which wholesalers are in time, and the gap of the others", () => {
    const [a, b] = readLadder([near, far], at(0, 10), 1)
    expect(a).toMatchObject({ arrives: 0, inTime: true, gap: 0, beforeCutoff: true })
    expect(b).toMatchObject({ arrives: 3, inTime: false, gap: 2, beforeCutoff: false })
  })

  it("orders from the first in-time wholesaler, with the next as the fallback", () => {
    const advice = advise(readLadder([near, far], at(0, 10), 5))
    expect(advice.kind).toBe("order")
    if (advice.kind === "order") {
      expect(advice.pick.wholesaler.id).toBe("near")
      expect(advice.fallback?.wholesaler.id).toBe("far")
    }
  })

  it("skips a first choice that is too late and picks the next in time", () => {
    const slow = make({ id: "slow", cutoff: null, before: 4 })
    const advice = advise(readLadder([slow, near], at(0, 10), 1))
    expect(advice.kind === "order" && advice.pick.wholesaler.id).toBe("near")
  })

  it("is late when none arrives in time, naming the soonest", () => {
    const advice = advise(readLadder([far, make({ id: "mid", cutoff: null, before: 2 })], at(0, 10), 0))
    expect(advice.kind).toBe("late")
    if (advice.kind === "late") expect(advice.fastest?.wholesaler.id).toBe("mid")
  })

  it("has no fastest when no wholesaler ever delivers", () => {
    const never = make({ days: [false, false, false, false, false, false, false] })
    expect(advise(readLadder([never], at(0, 10), 3))).toEqual({ kind: "late", fastest: null })
  })

  it("says nothing without a list", () => {
    expect(advise([])).toEqual({ kind: "none" })
  })
})

describe("distanceTags", () => {
  it("tags only from the km the pharmacy typed", () => {
    expect(distanceTags([{ km: 5 }, { km: null }, { km: 12 }, { km: 8 }])).toEqual(["nearby", null, "farthest", "farther"])
  })

  it("compares nothing until two have a distance, or when they are equal", () => {
    expect(distanceTags([{ km: 5 }, { km: null }])).toEqual([null, null])
    expect(distanceTags([{ km: 7 }, { km: 7 }])).toEqual([null, null])
  })

  it("has no farthest with only two", () => {
    expect(distanceTags([{ km: 3 }, { km: 9 }])).toEqual(["nearby", "farther"])
  })
})

describe("moveItem", () => {
  it("moves an item and leaves the original alone", () => {
    const list = ["a", "b", "c"]
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a"])
    expect(list).toEqual(["a", "b", "c"])
  })

  it("returns the same list for a no-op or an out-of-range move", () => {
    const list = ["a", "b"]
    expect(moveItem(list, 1, 1)).toBe(list)
    expect(moveItem(list, 0, 5)).toBe(list)
    expect(moveItem(list, -1, 0)).toBe(list)
  })
})

describe("stockDaysFromAlert", () => {
  it("reads whole days of stock from a pharmacy stock or reorder alert", () => {
    expect(stockDaysFromAlert("health.stock.low", { stock_days_left: 3.8 })).toBe(3)
    expect(stockDaysFromAlert("health.reorder.soon", [["stock_days_left", 2]])).toBe(2)
  })

  it("says nothing for other alerts: days_left on an expiry alert is something else", () => {
    expect(stockDaysFromAlert("health.expiry.warning", { stock_days_left: 4, days_left: 9 })).toBeNull()
    expect(stockDaysFromAlert(null, { stock_days_left: 4 })).toBeNull()
  })

  it("says nothing when the API did not send a usable number", () => {
    expect(stockDaysFromAlert("health.stock.low", {})).toBeNull()
    expect(stockDaysFromAlert("health.stock.low", { stock_days_left: -1 })).toBeNull()
    expect(stockDaysFromAlert("health.stock.low", { stock_days_left: "3" })).toBeNull()
  })
})
