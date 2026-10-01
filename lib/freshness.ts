"use client"

/* L4 trust layer: is the data behind this screen recent?

   A screen with no alerts looks healthy. It is only healthy if the data is
   recent: a department that stopped uploading three weeks ago shows the same
   quiet screen. The backend stamps every clean upload (GET /freshness); this
   says what that means for the view on screen.

   It makes a claim only when it knows. No stamp for a department (the log
   starts at the backend's migration 012), an API that has not been
   redeployed, a failed request: all "unknown", never "stale". */

import { useCallback, useEffect, useState } from "react"
import { API_BASE, apiFetch } from "@/lib/api"

export type FreshnessEntry = {
  sector: string
  /** The department: a business type, a logistics operation type, or "". */
  scope: string
  last_upload_at: string
  age_days: number
  stale: boolean
  rows_processed: number
  alerts_fired: number
}

export type FreshnessData = {
  /** False before the backend's migration 012 (or when the request failed):
   *  the app then says nothing about staleness. */
  persisted: boolean
  /** From the API, so the number lives in one place. */
  staleAfterDays: number
  entries: FreshnessEntry[]
}

export const UNKNOWN_FRESHNESS: FreshnessData = { persisted: false, staleAfterDays: 7, entries: [] }

const DAY = 86_400_000

export type StaleSector = { sector: string; ageDays: number; lastUploadAt: string }

export type Assessment = {
  kind: "unknown" | "fresh" | "stale"
  /** Sectors whose newest data is older than the limit. */
  stale: StaleSector[]
  /** The newest data among the sectors the view covers, when any is known. */
  newest: { ageDays: number; lastUploadAt: string } | null
}

const timeOf = (iso: string) => {
  const at = new Date(iso).getTime()
  return Number.isNaN(at) ? null : at
}

/** What the data behind a view says about itself.
 *
 *  `sectors` are the sectors the view covers (all the account's on "All", the
 *  one on a sector pill); `scopes` are the departments it is limited to, when
 *  it is (a department tab). With scopes, only that department's stamp
 *  counts: a fresh sibling must not hide it. Without, a sector is stale only
 *  when its newest stamp is. Age is counted from the stamp, now, so a page
 *  left open for days still goes stale. */
export function assessFreshness(
  data: FreshnessData,
  sectors: string[],
  scopes: string[] = [],
  now: number = Date.now()
): Assessment {
  if (!data.persisted) return { kind: "unknown", stale: [], newest: null }

  const stale: StaleSector[] = []
  let newest: Assessment["newest"] = null
  let known = 0

  for (const sector of sectors) {
    const stamps = data.entries
      .filter((entry) => entry.sector === sector && (scopes.length === 0 || scopes.includes(entry.scope)))
      .map((entry) => ({ entry, at: timeOf(entry.last_upload_at) }))
      .filter((s): s is { entry: FreshnessEntry; at: number } => s.at !== null)

    // No stamp: this sector says nothing either way.
    if (stamps.length === 0) continue

    const latest = stamps.reduce((a, b) => (b.at > a.at ? b : a))
    const ageDays = Math.max(0, Math.floor((now - latest.at) / DAY))
    known += 1

    if (ageDays > data.staleAfterDays) {
      stale.push({ sector, ageDays, lastUploadAt: latest.entry.last_upload_at })
    }

    if (!newest || latest.at > (timeOf(newest.lastUploadAt) ?? 0)) {
      newest = { ageDays, lastUploadAt: latest.entry.last_upload_at }
    }
  }

  stale.sort((a, b) => b.ageDays - a.ageDays)

  return { kind: stale.length > 0 ? "stale" : known > 0 ? "fresh" : "unknown", stale, newest }
}

/** A displayed figure that is a zero ("0", "0%", "0 €"). */
export const isZeroFigure = (value: string) => /^\D*0+(?:[.,]0+)?\D*$/.test(value.trim())

async function fetchFreshness(): Promise<FreshnessData> {
  try {
    const res = await apiFetch(`${API_BASE}/freshness`)
    if (!res.ok) return UNKNOWN_FRESHNESS

    const body = (await res.json()) as {
      freshness?: unknown
      persisted?: unknown
      stale_after_days?: unknown
    }

    const entries = Array.isArray(body.freshness)
      ? (body.freshness as FreshnessEntry[]).filter(
          (e) => e && typeof e.sector === "string" && typeof e.last_upload_at === "string"
        )
      : []

    return {
      persisted: body.persisted === true,
      staleAfterDays: typeof body.stale_after_days === "number" ? body.stale_after_days : 7,
      entries,
    }
  } catch {
    return UNKNOWN_FRESHNESS
  }
}

/** The account's stamps, read on mount and again when `refresh` is called
 *  (after an upload). Unknown until the first answer. */
export function useFreshness() {
  const [data, setData] = useState<FreshnessData>(UNKNOWN_FRESHNESS)

  const refresh = useCallback(async () => {
    setData(await fetchFreshness())
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchFreshness().then((next) => {
      if (!cancelled) setData(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, refresh }
}
