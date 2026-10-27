"use client"

import { useEffect, useState } from "react"

import { readSectors } from "@/lib/activities"
import { readList } from "@/lib/answer"
import { API_BASE, apiFetch } from "@/lib/api"
import { SWAP_KEY, swapsFrom, type Swap, type SwapAlert } from "@/lib/branch-swaps"

/* The swaps each branch has to send (F-BRANCHBOARD). `/alerts` is cut to one
 * site, and a swap is raised on the branch that holds the stock, so reading
 * every branch is the only way to know what each one sends and receives. The
 * read is all or nothing: one branch that fails to answer would make the
 * others' "to receive" look smaller than it is, so then nothing is shown. */

const MAX_BRANCHES = 40

export function useBranchSwaps({ lang, siteIds, enabled, refresh }: { lang: string; siteIds: string[]; enabled: boolean; refresh: number }): Record<string, Swap[]> | null {
  const [swaps, setSwaps] = useState<Record<string, Swap[]> | null>(null)
  const key = siteIds.join("|")

  useEffect(() => {
    let cancelled = false

    if (!enabled || !readSectors().includes("health") || siteIds.length === 0 || siteIds.length > MAX_BRANCHES) {
      setSwaps(null)

      return
    }

    async function load() {
      const answers = await Promise.all(
        siteIds.map((id) =>
          apiFetch(`${API_BASE}/alerts?lang=${lang}&site_id=${encodeURIComponent(id)}`)
            .then((r) => readList<SwapAlert>(r, "alerts"))
            .catch(() => ({ ok: false as const, reason: "network" }))
        )
      )

      if (cancelled || answers.some((a) => !a.ok)) return

      const next: Record<string, Swap[]> = {}

      siteIds.forEach((id, i) => {
        const answer = answers[i]

        next[id] = answer.ok ? swapsFrom(answer.rows.filter((a) => a.alert_key === SWAP_KEY)) : []
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
