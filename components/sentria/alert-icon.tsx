"use client"

import { useEffect, useState } from "react"

import { alertIconName } from "@/lib/alert-icons"
import { cn } from "@/lib/utils"

/* The icon at the start of an alert row: a small 3D icon on a chip tinted by
 * severity (the pastel tag tokens, so light and dark follow the theme).
 *
 * The icons are about 375 KB as source, so they load in their own chunk the
 * first time a table is drawn. Until then the chip is drawn empty at the same
 * size, so the row does not move. */

type IconData = Record<string, { viewBox: string; body: string }>

/** After the dashboard's entrance (about 1.5 s) has finished. */
const ICON_DELAY_MS = 2000
/** Icons already in memory: shown as soon as the entrance is over. */
const ICON_REVISIT_DELAY_MS = 1200

let loaded: IconData | null = null
let loading: Promise<IconData> | null = null

function loadIcons(): Promise<IconData> {
  loading ??= import("@/lib/alert-icon-data").then((m) => (loaded = m.ALERT_ICON_DATA))
  return loading
}

export function AlertIcon({
  alert,
  className,
}: {
  alert: {
    alert_key?: string | null
    sector?: string | null
    message?: string | null
    equipment?: string | null
    severity: string
  }
  className?: string
}) {
  const [data, setData] = useState<IconData | null>(null)

  /* Not on mount: the icons arrive after the dashboard's entrance has played.
     Drawing a dozen 3D icons while the blocks are still rising costs frames
     (dashmotion times the entrance); the empty chip holds the row's size, so
     nothing moves when they appear. */
  useEffect(() => {
    if (data) return

    const timer = window.setTimeout(() => {
      void loadIcons().then(setData)
    }, loaded ? ICON_REVISIT_DELAY_MS : ICON_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [data])

  const icon = data?.[alertIconName(alert)]
  const critical = alert.severity === "CRITICAL"

  return (
    <span
      aria-hidden="true"
      data-alert-icon={alertIconName(alert)}
      className={cn(
        "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-inset",
        critical
          ? "bg-[var(--tag-danger-bg)] ring-[var(--tag-danger-bd)]"
          : "bg-[var(--tag-warning-bg)] ring-[var(--tag-warning-bd)]",
        className
      )}
    >
      {icon && (
        <svg
          viewBox={icon.viewBox}
          width={18}
          height={18}
          focusable="false"
          dangerouslySetInnerHTML={{ __html: icon.body }}
        />
      )}
    </span>
  )
}
