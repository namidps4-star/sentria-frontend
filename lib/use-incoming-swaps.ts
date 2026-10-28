"use client"

import { useEffect, useState } from "react"

import { readList } from "@/lib/answer"
import { API_BASE, apiFetch } from "@/lib/api"
import { swapsFrom, type Swap, type SwapAlert } from "@/lib/branch-swaps"

/* The swaps other branches send to each site the account can read (F-SWAPIN),
 * for the Field team board. One read per site. All or nothing, like
 * useBranchSwaps: one site that does not answer would make the others'
 * "to receive" look smaller, so then nothing is shown. */

const MAX_BRANCHES = 40

export function useIncomingSwaps({ lang, siteIds, enabled, refresh }: { lang: string; siteIds: string[]; enabled: boolean; refresh: number }): Record<string, Swap[]> | null {
  const [swaps, setSwaps] = useState<Record<string, Swap[]> | null>(null)
  const key = siteIds.join("|")

  useEffect(() => {
    let cancelled = false

    if (!enabled || siteIds.length === 0 || siteIds.length > MAX_BRANCHES) {
      setSwaps(null)

      return
    }

    async function load() {
      const answers = await Promise.all(
        siteIds.map((id) =>
          apiFetch(`${API_BASE}/swaps/incoming?lang=${lang}&site_id=${encodeURIComponent(id)}`)
            .then((r) => readList<SwapAlert>(r, "alerts"))
            .catch(() => ({ ok: false as const, reason: "network" }))
        )
      )

      if (cancelled || answers.some((a) => !a.ok)) return

      const next: Record<string, Swap[]> = {}

      siteIds.forEach((id, i) => {
        const answer = answers[i]

        next[id] = answer.ok ? swapsFrom(answer.rows) : []
      })
      setSwaps(next)
    }

    load().catch(() => {
      /* keep what we held */
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, key, enabled, refresh])

  return swaps
}
