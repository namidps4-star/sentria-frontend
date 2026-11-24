"use client"

import type { ReactNode } from "react"

import { useTx } from "@/lib/i18n"
import { barFor, type ReorderNumbers } from "@/lib/reorder-card"

const COLOR = { red: "var(--tag-critical-bg)", amber: "var(--tag-watch-bg)", lime: "var(--accent)" } as const

const NBSP = " "

/** The order card on a Tracking board card (F-JIT): what to order and from whom, then
 *  how many days of stock are left against the reorder point. It takes the place of the
 *  action sentence, which stays in the tooltip and in the priority detail. */
export function ReorderCard({
  reorder,
  supplier,
  icon,
  title,
}: {
  reorder: ReorderNumbers
  supplier?: string | null
  icon: ReactNode
  title?: string
}) {
  const tx = useTx()
  const locale = tx("fr-FR", "en-GB")
  const num = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 })
  const bar = barFor(reorder)
  const { order_qty: qty, lead_days: lead, days_of_stock: days } = reorder

  const units = tx(qty < 2 ? "unité" : "unités", qty === 1 ? "unit" : "units")
  const leadWord = tx(lead < 2 ? "jour" : "jours", lead === 1 ? "day" : "days")
  const left = tx(days < 2 ? "jour restant" : "jours restants", days === 1 ? "day left" : "days left")

  const label =
    bar.label.kind === "today"
      ? tx("commander aujourd'hui", "order today")
      : bar.label.kind === "byDay"
        ? tx(`commander avant le jour ${bar.label.day}`, `order by day ${bar.label.day}`)
        : tx("point de commande", "reorder point")

  const labelEdge = bar.align === "start" ? "left-0" : bar.align === "end" ? "right-0" : "-translate-x-1/2"

  return (
    <>
      <p className="mt-1 flex items-start gap-1.5 text-sm leading-snug text-muted-foreground" title={title}>
        {icon}
        <span className="min-w-0" data-reorder-line="">
          <b className="font-semibold text-foreground">
            {tx("Commander", "Order")} {num(qty)}
            {NBSP}
            {units}
          </b>
          {" · "}
          {supplier ? `${supplier}, ` : `${tx("fournisseur", "supplier")} `}
          {lead}
          {NBSP}
          {leadWord}
        </span>
      </p>

      <div
        data-reorder-bar=""
        data-tone={bar.tone}
        role="img"
        aria-label={tx(
          `${num(days)} jours de stock restants. Point de commande à ${num(bar.markerDays)} jours.`,
          `${num(days)} days of stock left. Reorder point at ${num(bar.markerDays)} days.`
        )}
        className="mb-2 mt-2.5"
      >
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">{tx("Jours de stock", "Days of stock")}</span>
          <span className="font-semibold tabular-nums">
            {num(days)}
            {NBSP}
            {left}
          </span>
        </div>
        <div className="relative mt-1.5 h-2 rounded-full bg-muted">
          <span
            data-reorder-fill=""
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${bar.fillPct}%`, background: COLOR[bar.tone] }}
          />
          <span
            data-reorder-marker=""
            className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground"
            style={{ left: `calc(${bar.markerPct}% - 1px)` }}
          />
        </div>
        <div className="relative mt-1.5 h-4 text-[11px] leading-4 text-muted-foreground">
          <span
            data-reorder-label=""
            className={`absolute whitespace-nowrap ${labelEdge}`}
            style={bar.align === "center" ? { left: `${bar.markerPct}%` } : undefined}
          >
            {label}
          </span>
        </div>
      </div>
    </>
  )
}
