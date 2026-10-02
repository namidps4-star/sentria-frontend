"use client"

import { useEffect, useRef, useState } from "react"

import { readSectors } from "@/lib/activities"
import { useTx } from "@/lib/i18n"
import { PLAN_UPDATED_EVENT } from "@/lib/plans"
import { sectorLabel } from "@/lib/priorities"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3 py-1 text-xs",
} as const

/** The account's sector, as a lime tag. It sits where a "Live" badge used to:
 *  on the dark cards, so the lime accent is the one colour that works in every
 *  theme. Nothing while the account has no sector yet. */
export function SectorTag({ size = "sm", className }: { size?: keyof typeof SIZES; className?: string }) {
  const tx = useTx()
  const [sectors, setSectors] = useState<string[]>([])

  useEffect(() => {
    const refresh = () => setSectors(readSectors())
    refresh()
    const events = ["sentria_sectors_updated", "sentria_onboarding_completed", PLAN_UPDATED_EVENT, "storage"]
    events.forEach((name) => window.addEventListener(name, refresh))
    return () => events.forEach((name) => window.removeEventListener(name, refresh))
  }, [])

  const text = sectors.map((id) => sectorLabel(id, tx)).join(" + ")

  // A change of sector rises in (t-rise-in, 250 ms budget). Showing the tag
  // for the first time on a page does not: only a swap after it was there.
  const shown = useRef("")
  const [swapped, setSwapped] = useState(0)
  useEffect(() => {
    if (shown.current && text && shown.current !== text) setSwapped((n) => n + 1)
    shown.current = text
  }, [text])

  if (sectors.length === 0) return null

  return (
    <span
      data-testid="sector-tag"
      title={text}
      className={cn(
        "inline-flex max-w-[11rem] shrink-0 items-center truncate rounded-full bg-accent font-semibold text-accent-foreground",
        SIZES[size],
        className
      )}
    >
      <span key={swapped} className={cn("truncate", swapped > 0 && "t-rise-in")}>
        {text}
      </span>
    </span>
  )
}
