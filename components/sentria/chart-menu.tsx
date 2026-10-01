"use client"

/* The "…" menu on the dashboard's trend chart: which sectors to overlay,
   what to measure, and over how long. The panel is the transitions.dev
   dropdown (app/transitions.css), driven by usePresence. */

import { useEffect, useId, useRef, useState } from "react"
import { MoreHorizontal } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { usePresence } from "@/lib/use-presence"
import {
  CHART_RANGES,
  seriesColor,
  type ChartMetric,
  type ChartRange,
  type ValueMetric,
} from "@/lib/chart-series"
import { cn } from "@/lib/utils"

export function ChartMenu({
  available,
  labelOf,
  selected,
  onSelect,
  metric,
  onMetric,
  valueState,
  range,
  onRange,
  onReset,
  isDefault,
}: {
  /** The sectors that have alerts, in the fixed colour order. */
  available: string[]
  labelOf: (key: string) => string
  selected: string[]
  onSelect: (keys: string[]) => void
  metric: ChartMetric
  onMetric: (metric: ChartMetric) => void
  valueState: ValueMetric
  range: ChartRange
  onRange: (range: ChartRange) => void
  onReset: () => void
  isDefault: boolean
}) {
  const tx = useTx()
  const [open, setOpen] = useState(false)
  const presence = usePresence(open, "--dropdown-close-dur")
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const group = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointer)
    }
  }, [open])

  const toggle = (key: string) => {
    if (selected.includes(key)) {
      if (selected.length > 1) onSelect(available.filter((k) => k !== key && selected.includes(k)))
    } else {
      onSelect(available.filter((k) => k === key || selected.includes(k)))
    }
  }

  const valueHint = valueState.available
    ? null
    : valueState.reason === "mixed"
    ? tx("Devises différentes : pas comparables sur un axe.", "Mixed currencies: not comparable on one axis.")
    : tx("Aucune alerte ne porte de valeur.", "No alert carries a value.")

  const heading = "text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground"
  const choice =
    "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={tx("Options du graphique", "Chart options")}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>

      <div
        id={panelId}
        role="dialog"
        aria-label={tx("Options du graphique", "Chart options")}
        hidden={!presence.present}
        data-origin="top-right"
        className={cn(
          "absolute right-0 top-full z-30 mt-1 w-[min(18rem,calc(100vw-2.5rem))] rounded-2xl border border-border bg-card p-3 shadow-xl t-dropdown",
          presence.className
        )}
      >
        {available.length > 1 && (
          <fieldset className="mb-3">
            <legend className={cn(heading, "mb-1 px-2")}>{tx("Secteurs superposés", "Overlay sectors")}</legend>
            {available.map((key) => {
              const checked = selected.includes(key)
              return (
                <label key={key} className={choice}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={checked && selected.length === 1}
                    onChange={() => toggle(key)}
                    className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                    data-sector={key}
                  />
                  <span className="h-[3px] w-4 shrink-0 rounded-full" style={{ background: seriesColor(key) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{labelOf(key)}</span>
                </label>
              )
            })}
          </fieldset>
        )}

        <fieldset className="mb-3">
          <legend className={cn(heading, "mb-1 px-2")}>{tx("Mesure", "Measure")}</legend>
          <label className={choice}>
            <input
              type="radio"
              name={`${group}-metric`}
              checked={metric === "count"}
              onChange={() => onMetric("count")}
              className="h-4 w-4 shrink-0 accent-[var(--brand)]"
              data-metric="count"
            />
            <span>{tx("Nombre d'alertes", "Alert count")}</span>
          </label>
          <label className={choice}>
            <input
              type="radio"
              name={`${group}-metric`}
              checked={metric === "value"}
              disabled={!valueState.available}
              onChange={() => onMetric("value")}
              className="h-4 w-4 shrink-0 accent-[var(--brand)]"
              data-metric="value"
            />
            <span>
              {tx("Valeur à risque", "Value at risk")}
              {valueState.available && valueState.symbol ? ` (${valueState.symbol})` : ""}
            </span>
          </label>
          {valueHint && <p className="px-2 pb-1 text-xs text-muted-foreground">{valueHint}</p>}
        </fieldset>

        <fieldset>
          <legend className={cn(heading, "mb-1 px-2")}>{tx("Période", "Period")}</legend>
          <div className="flex gap-1 px-1">
            {CHART_RANGES.map((days) => (
              <label
                key={days}
                className="flex-1 cursor-pointer rounded-lg border border-border px-2 py-1.5 text-center text-sm font-medium hover:bg-muted has-[:checked]:border-transparent has-[:checked]:bg-[var(--ink)] has-[:checked]:text-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              >
                <input
                  type="radio"
                  name={`${group}-range`}
                  checked={range === days}
                  onChange={() => onRange(days)}
                  className="sr-only"
                  data-range={days}
                />
                {tx(`${days} j`, `${days} d`)}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={onReset}
          disabled={isDefault}
          className="mt-3 w-full rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {tx("Réinitialiser", "Reset")}
        </button>
      </div>
    </div>
  )
}
