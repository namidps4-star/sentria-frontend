import type { Contractor } from "@/lib/crm"
import type { Swap } from "@/lib/branch-swaps"

/* The Field team board for a company with several branches (F-BRANCHBOARD):
 * which branch each person runs, which branches nobody runs, and the swaps
 * each branch has to send and expects to receive. Pure arithmetic; the view
 * and the reads live elsewhere. */

export const BRANCH_HUES = ["lime", "lilac", "sky", "peach", "mint"] as const
export type BranchHue = (typeof BRANCH_HUES)[number]

/** A branch keeps its colour for as long as it keeps its place in the list. */
export function hueOf(index: number): BranchHue {
  return BRANCH_HUES[((index % BRANCH_HUES.length) + BRANCH_HUES.length) % BRANCH_HUES.length]
}

/** Three letters to tell branches apart on a small tile: "Nairobi CBD" is NAI. */
export function branchCode(name: string): string {
  const letters = name.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()

  return letters || "BR"
}

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export type BranchSite = { id: string; name: string }

export type BranchLine = {
  siteId: string
  name: string
  hue: BranchHue
  /** The people filed under this branch. */
  people: Contractor[]
  /** Swaps this branch has to send, and swaps other branches send to it. */
  send: Swap[]
  receive: Swap[]
  /** False when this branch's swaps are not read for this account: shown as "not loaded", never as zero. */
  read: boolean
}

export type BranchBoard = {
  lines: BranchLine[]
  /** Branches nobody runs. */
  missing: BranchLine[]
  /** People who are not filed under any branch (or under one that is gone). */
  unfiled: Contractor[]
  covered: number
}

/* `swapsBySite` holds, for each branch it can read, the swaps its own alerts raised: the ones it sends.
 * `incomingBySite` is the receiver's own read (F-SWAPIN): undefined for the boss, who reads every
 * branch's sends and works out what each receives; null while the receiver's read is not loaded. */
export function buildBoard(
  sites: BranchSite[],
  contractors: Contractor[],
  swapsBySite: Record<string, Swap[]> | null,
  incomingBySite?: Record<string, Swap[]> | null
): BranchBoard {
  const everySwap = swapsBySite ? Object.values(swapsBySite).flat() : []
  const lines: BranchLine[] = sites.map((site, i) => {
    const sent = swapsBySite?.[site.id]
    const received = incomingBySite === undefined ? everySwap.filter((s) => same(s.toSite, site.name) && !same(s.fromSite, site.name)) : incomingBySite?.[site.id]

    return {
      siteId: site.id,
      name: site.name,
      hue: hueOf(i),
      people: contractors.filter((c) => c.site_id === site.id),
      send: sent ?? [],
      receive: received ?? [],
      read: sent !== undefined && received !== undefined,
    }
  })
  const known = new Set(sites.map((s) => s.id))

  return {
    lines,
    missing: lines.filter((l) => l.people.length === 0),
    unfiled: contractors.filter((c) => !c.site_id || !known.has(c.site_id)),
    covered: lines.filter((l) => l.people.length > 0).length,
  }
}

export type Stake = { count: number; value: number | null; currency: string }

/** What a branch has riding on swaps: how many, and the money when every one has a value in one currency. */
export function stakeOf(line: Pick<BranchLine, "send" | "receive">): Stake {
  const all = [...line.send, ...line.receive]
  const priced = all.filter((s) => s.value !== null)
  const currencies = new Set(priced.map((s) => s.currency))

  if (all.length === 0 || priced.length !== all.length || currencies.size !== 1) return { count: all.length, value: null, currency: "" }

  return { count: all.length, value: priced.reduce((sum, s) => sum + (s.value ?? 0), 0), currency: priced[0].currency }
}

/** 7600 reads 7.6k, 950 reads 950, 12000 reads 12k. */
export function shortAmount(value: number): string {
  const rounded = Math.round(value)

  if (Math.abs(rounded) < 1000) return String(rounded)

  const k = rounded / 1000

  return `${Number.isInteger(k) || Math.abs(k) >= 100 ? Math.round(k) : k.toFixed(1)}k`
}
