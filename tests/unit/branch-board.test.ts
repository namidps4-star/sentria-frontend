import { describe, expect, it } from "vitest"

import { BRANCH_HUES, branchCode, buildBoard, hueOf, shortAmount, stakeOf } from "@/lib/branch-board"
import type { Swap } from "@/lib/branch-swaps"
import type { Contractor } from "@/lib/crm"

const person = (id: string, site_id: string | null) => ({ id, name: id, site_id }) as Contractor
const swap = (from: string, to: string, value: number | null = 3800, currency = "KES"): Swap => ({ taskKey: from + to, product: "P", fromSite: from, toSite: to, units: 10, days: 5, expiry: null, value, currency, date: "" })
const SITES = [{ id: "s1", name: "Nairobi" }, { id: "s2", name: "Mombasa" }, { id: "s3", name: "Kisumu" }]

describe("hueOf and branchCode", () => {
  it("cycles the hues, and keeps a branch's colour while it keeps its place", () => {
    expect(hueOf(0)).toBe(BRANCH_HUES[0])
    expect(hueOf(5)).toBe(BRANCH_HUES[0])
    expect(hueOf(7)).toBe(BRANCH_HUES[2])
    expect(hueOf(-1)).toBe(BRANCH_HUES[4])
  })

  it("makes three letters from a name, whatever its accents or spaces", () => {
    expect(branchCode("Nairobi CBD")).toBe("NAI")
    expect(branchCode("Élysée")).toBe("ELY")
    expect(branchCode("42")).toBe("BR")
  })
})

describe("buildBoard", () => {
  it("lists the branches nobody runs, and who is not filed anywhere", () => {
    const board = buildBoard(SITES, [person("a", "s1"), person("b", "s2"), person("c", null), person("d", "gone")], null)

    expect(board.covered).toBe(2)
    expect(board.missing.map((l) => l.name)).toEqual(["Kisumu"])
    expect(board.unfiled.map((p) => p.id)).toEqual(["c", "d"])
    expect(board.lines.map((l) => l.hue)).toEqual(["lime", "lilac", "sky"])
  })

  it("gives each branch the swaps it sends and the ones sent to it", () => {
    const board = buildBoard(SITES, [], { s1: [swap("Nairobi", "Mombasa"), swap("Nairobi", "Kisumu")], s2: [swap("Mombasa", "Nairobi")], s3: [] })
    const [nairobi, mombasa, kisumu] = board.lines

    expect([nairobi.send.length, nairobi.receive.length]).toEqual([2, 1])
    expect([mombasa.send.length, mombasa.receive.length]).toEqual([1, 1])
    expect([kisumu.send.length, kisumu.receive.length]).toEqual([0, 1])
  })

  it("reads a branch name without caring about case or spaces, and never counts a swap to itself", () => {
    const board = buildBoard(SITES, [], { s1: [swap("Nairobi", " mombasa "), swap("Nairobi", "Nairobi")], s2: [], s3: [] })

    expect(board.lines[1].receive).toHaveLength(1)
    expect(board.lines[0].receive).toHaveLength(0)
  })

  it("has no swaps at all when they could not be read", () => {
    expect(buildBoard(SITES, [], null).lines.every((l) => l.send.length === 0 && l.receive.length === 0)).toBe(true)
  })
})

describe("stakeOf and shortAmount", () => {
  it("adds the money only when every swap has a value in one currency", () => {
    expect(stakeOf({ send: [swap("A", "B")], receive: [swap("C", "A", 3800)] })).toEqual({ count: 2, value: 7600, currency: "KES" })
    expect(stakeOf({ send: [swap("A", "B")], receive: [swap("C", "A", null)] }).value).toBeNull()
    expect(stakeOf({ send: [swap("A", "B")], receive: [swap("C", "A", 100, "USD")] }).value).toBeNull()
    expect(stakeOf({ send: [], receive: [] })).toEqual({ count: 0, value: null, currency: "" })
  })

  it("shortens thousands", () => {
    expect(shortAmount(950)).toBe("950")
    expect(shortAmount(7600)).toBe("7.6k")
    expect(shortAmount(12000)).toBe("12k")
    expect(shortAmount(123456)).toBe("123k")
  })
})
