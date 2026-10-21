"use client"

import { useEffect, useState } from "react"

import { useTx } from "@/lib/i18n"
import { agoLabel } from "@/lib/relative-time"
import { cn } from "@/lib/utils"

/** "12 min ago" that keeps itself current while the page stays open, with the
 *  exact date and time in the tooltip. */
export function RelativeTime({ date, fullDate, className }: { date: string; fullDate: string; className?: string }) {
  const tx = useTx()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)

    return () => window.clearInterval(id)
  }, [])

  return (
    <time dateTime={date} title={fullDate} data-alert-time="" className={cn("tabular-nums", className)}>
      {agoLabel(date, tx, now)}
    </time>
  )
}
