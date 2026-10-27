"use client"

import { useEffect, useState } from "react"

import { inAccountScope, readSectors } from "@/lib/activities"
import { readList } from "@/lib/answer"
import { API_BASE, apiFetch } from "@/lib/api"
import { activeSiteId } from "@/lib/active-site"
import { SWAP_KEY, stageOf, swapsFrom, type SwapAlert } from "@/lib/branch-swaps"
import { fetchAssignments } from "@/lib/crm"
import { withOurSector } from "@/lib/sector"

/* What the sidebar needs to know about branch swaps (F-BRANCHSWAP): the swap
 * alerts of the site on screen, and how many still need someone (nobody on
 * them yet, or a person who has not answered). It reads only for an account
 * with the health sector, keeps what it held when a read fails (a failed read
 * is not "no swap"), and is read again whenever `refresh` changes: a page
 * change, an upload, a link sent. */

/* `incoming` are the swaps other branches send to the site on screen (F-SWAPIN): read only here, the sending branch acts. */
export type SwapFeed = { alerts: SwapAlert[]; open: number; total: number; incoming: SwapAlert[] }

const NONE: SwapFeed = { alerts: [], open: 0, total: 0, incoming: [] }

export function useSwapFeed({ lang, companyName, refresh, site, view }: { lang: string; companyName: string; refresh: number; site: unknown; view: string }): SwapFeed {
  const [feed, setFeed] = useState<SwapFeed>(NONE)

  useEffect(() => {
    let cancelled = false

    if (!readSectors().includes("health")) {
      setFeed(NONE)

      return
    }

    async function load() {
      const siteId = activeSiteId()
      const [answer, assignments, incomingAnswer] = await Promise.all([
        apiFetch(`${API_BASE}/alerts?lang=${lang}`)
          .then((r) => readList<SwapAlert & { sector?: string | null; business_type?: string | null }>(r, "alerts"))
          .catch(() => ({ ok: false as const, reason: "network" })),
        companyName ? fetchAssignments(companyName) : Promise.resolve(null),
        siteId
          ? apiFetch(`${API_BASE}/swaps/incoming?lang=${lang}&site_id=${encodeURIComponent(siteId)}`)
              .then((r) => readList<SwapAlert>(r, "alerts"))
              .catch(() => ({ ok: false as const, reason: "network" }))
          : Promise.resolve(null),
      ])

      if (cancelled || !answer.ok) return

      let businessType: string | null = null

      try {
        businessType = localStorage.getItem("sentria_business_type")
      } catch {
        businessType = null
      }

      const rows = inAccountScope(answer.rows.map(withOurSector), readSectors(), businessType).filter((a) => a.alert_key === SWAP_KEY)
      const swaps = swapsFrom(rows)

      // A failed read keeps the incoming swaps held before: a failed read is not "none".
      const incoming = (current: SwapFeed) => (incomingAnswer === null ? [] : incomingAnswer.ok ? incomingAnswer.rows : current.incoming)

      if (assignments === null || !assignments.ok) {
        // The tasks could not be read: every swap counts as open, never as handled.
        setFeed((current) => ({ alerts: rows, open: swaps.length, total: swaps.length, incoming: incoming(current) }))

        return
      }

      const byKey = new Map(assignments.data.map((a) => [a.task_key, a]))
      const open = swaps.filter((s) => {
        const stage = stageOf(byKey.get(s.taskKey))

        return stage === "waiting" || stage === "with"
      }).length

      setFeed((current) => ({ alerts: rows, open, total: swaps.length, incoming: incoming(current) }))
    }

    load().catch(() => {
      /* keep what we held */
    })

    return () => {
      cancelled = true
    }
  }, [lang, companyName, refresh, site, view])

  return feed
}
