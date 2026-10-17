"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import { ChevronDown, Truck } from "@/lib/icons"
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
  const [open, setOpen] = useState(false)

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
    "rounded-2xl",
    dark ? "bg-white/[0.06] text-sidebar-foreground ring-1 ring-white/10" : "border border-border bg-muted/30 text-foreground",
    className
  )
  const quiet = dark ? "text-sidebar-foreground/60" : "text-muted-foreground"

  let preview: string
  let body: ReactNode
  let late = false
  let testId = "alert-advice"

  if (list.length === 0) {
    testId = "alert-advice-setup"
    preview = tx("Ajoutez vos grossistes", "Add your wholesalers")
    body = (
      <>
        <p className="text-sm leading-5">
          {tx("Ajoutez vos grossistes pour savoir quand commander.", "Add your wholesalers to know when to order.")}
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
      </>
    )
  } else {
    const lines = adviceLines(
      list,
      readings,
      advise(readings),
      now,
      lang,
      tx,
      dark ? "text-sidebar-foreground" : "text-foreground"
    )
    late = lines.late
    preview = lines.short
    body = (
      <>
        <p className="text-sm font-semibold leading-5" data-testid="alert-advice-message">
          {lines.message}
        </p>
        {lines.fallback && (
          <p className={cn("mt-1.5 text-xs leading-5", dark ? "text-sidebar-foreground/70" : "text-muted-foreground")} data-testid="alert-advice-fallback">
            {lines.fallback}
          </p>
        )}
      </>
    )
  }

  /* Folded, it is one row: the answer in a few words. Opened, it says it all.
     A native button, so the keyboard and a screen reader get it for free. */
  return (
    <div data-testid={testId} data-late={late ? "" : undefined} className={frame}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="alert-advice-toggle"
        title={tx("Quand commander", "When to order")}
        className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Truck className={cn("h-3.5 w-3.5 shrink-0", late ? (dark ? "text-[#ff8a8a]" : "text-destructive") : quiet)} aria-hidden="true" />
        <span
          data-testid="alert-advice-preview"
          className={cn("line-clamp-2 min-w-0 flex-1 break-words text-xs font-semibold leading-4", late && (dark ? "text-[#ff8a8a]" : "text-destructive"))}
        >
          {preview}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", quiet, open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-0.5">
          <p className={cn("mb-1 text-[10px] font-semibold uppercase tracking-widest", quiet)}>
            {tx("Quand commander", "When to order")}
          </p>
          {body}
        </div>
      )}
    </div>
  )
}
