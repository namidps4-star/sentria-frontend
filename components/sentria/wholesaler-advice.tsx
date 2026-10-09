"use client"

import { useEffect, useMemo, useState } from "react"

import { Truck } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import type { AlertParams } from "@/lib/value-at-risk"
import {
  advise,
  nowOnAccountClock,
  readLadder,
  readWholesalers,
  stockDaysFromAlert,
  type Moment,
  type Wholesaler,
} from "@/lib/wholesalers"
import { cn } from "@/lib/utils"
import { adviceLines } from "./wholesaler-text"

/* On a pharmacy stock alert: when to order, and from whom, set against the
 * wholesalers the pharmacy listed. It needs two things the pharmacy gave or
 * the file gave: the wholesalers, and the days of stock left (the API's
 * `stock_days_left`). With either missing it says nothing about delivery, and
 * with no wholesaler at all it offers to set them up, once. It never says a
 * wholesaler has the product. */

export function WholesalerAdvice({
  alertKey,
  params,
  onSetup,
  tone = "dark",
  className,
}: {
  alertKey?: string | null
  params: AlertParams
  /** Opens the Wholesalers page. */
  onSetup?: () => void
  /** The card it sits in: "dark" is the black detail card, "light" a white one. */
  tone?: "dark" | "light"
  className?: string
}) {
  const tx = useTx()
  const lang = tx("fr", "en")
  const stockDays = stockDaysFromAlert(alertKey, params)
  const [list, setList] = useState<Wholesaler[] | null>(null)
  const [now, setNow] = useState<Moment | null>(null)

  useEffect(() => {
    setList(readWholesalers())
    setNow(nowOnAccountClock())
  }, [alertKey])

  const readings = useMemo(
    () => (list && now && stockDays !== null ? readLadder(list, now, stockDays) : []),
    [list, now, stockDays]
  )

  if (stockDays === null || list === null || now === null) return null

  const dark = tone === "dark"

  const frame = cn(
    "rounded-2xl px-4 py-3",
    dark ? "bg-white/[0.06] text-sidebar-foreground ring-1 ring-white/10" : "border border-border bg-muted/30 text-foreground",
    className
  )
  const label = cn(
    "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest",
    dark ? "text-sidebar-foreground/40" : "text-muted-foreground"
  )

  if (list.length === 0) {
    return (
      <div data-testid="alert-advice-setup" className={frame}>
        <p className={label}>
          <Truck className="h-3 w-3" aria-hidden="true" />
          {tx("Grossistes", "Wholesalers")}
        </p>
        <p className="mt-1 text-sm leading-5">
          {tx(
            "Ajoutez vos grossistes pour savoir quand commander.",
            "Add your wholesalers to know when to order."
          )}
        </p>
        {onSetup && (
          <button
            type="button"
            onClick={onSetup}
            className="mt-2 rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tx("Ajouter mes grossistes", "Add my wholesalers")}
          </button>
        )}
      </div>
    )
  }

  const { message, fallback, late } = adviceLines(
    list,
    readings,
    advise(readings),
    now,
    lang,
    tx,
    dark ? "text-sidebar-foreground" : "text-foreground"
  )

  return (
    <div data-testid="alert-advice" data-late={late ? "" : undefined} className={frame}>
      <p className={label}>
        <Truck className="h-3 w-3" aria-hidden="true" />
        {tx("Quand commander", "When to order")}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5" data-testid="alert-advice-message">
        {message}
      </p>
      {fallback && (
        <p className={cn("mt-1.5 text-xs leading-5", dark ? "text-sidebar-foreground/70" : "text-muted-foreground")} data-testid="alert-advice-fallback">
          {fallback}
        </p>
      )}
    </div>
  )
}
