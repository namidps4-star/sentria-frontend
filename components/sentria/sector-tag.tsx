"use client"

import { useEffect, useState } from "react"

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

  if (sectors.length === 0) return null

  const text = sectors.map((id) => sectorLabel(id, tx)).join(" + ")

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
      <span className="truncate">{text}</span>
    </span>
  )
}
