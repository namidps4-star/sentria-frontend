"use client"

/* How recent the account's data is, for the views that are not the
   dashboard (L4): Tracking, the Calendar, the Report and the Profile.
   The same stamps (GET /freshness) and the same rule (assessFreshness) as
   the dashboard, over the sectors the account holds. An empty board there
   reads as "nothing to do", which is only true if the data is recent. */

import { useEffect, useState } from "react"

import { readSectors } from "@/lib/activities"
import { assessFreshness, useFreshness, type Assessment } from "@/lib/freshness"
import { useTx } from "@/lib/i18n"
import { sectorLabel } from "@/lib/priorities"

import { FreshnessNote } from "./freshness-note"

/** What the stamps say about the account's sectors. Unknown until they
 *  answer, and when they cannot: it then claims nothing. */
export function useAccountFreshness(): Assessment {
  const { data } = useFreshness()
  const [sectors, setSectors] = useState<string[]>([])

  useEffect(() => {
    setSectors(readSectors())
  }, [])

  return assessFreshness(data, sectors)
}

/** The warning for that assessment, when a department went silent. These
 *  views keep their layout otherwise: no quiet "updated N days ago" line,
 *  and nothing when the stamps cannot tell. */
export function AccountFreshnessNote({ assessment }: { assessment: Assessment }) {
  const tx = useTx()

  if (assessment.kind !== "stale") return null

  return (
    <FreshnessNote
      assessment={assessment}
      sectorName={(key) => sectorLabel(key, tx) || key}
      locale={tx("fr-FR", "en-GB")}
    />
  )
}
