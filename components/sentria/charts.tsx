"use client"

/* Lightweight, dependency-free SVG charts tuned for the SentrIA aesthetic.
   Colours are theme tokens (--series-N, --slice-N in app/globals.css), never
   literals; the data comes from lib/chart-series.ts. */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { useTx } from "@/lib/i18n"
import { niceScale, type Slice } from "@/lib/chart-series"
import { cn } from "@/lib/utils"

/** The size of an element, kept up to date. The charts draw in real pixels
 *  rather than stretching a viewBox, so their text and strokes stay crisp. */
function useSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const box = el.getBoundingClientRect()
      setSize({ width: Math.round(box.width), height: Math.round(box.height) })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

/* ------------------------------------------------------------------ */
/*  Line chart: one line per series, one axis, hover and keyboard      */
/* ------------------------------------------------------------------ */

export type LineSeries = {
  key: string
  label: string
  /** A theme token, e.g. "var(--series-2)". */
  color: string
  values: number[]
  /** The values include estimates: the tooltip says so. */
  approx?: boolean
}

const PAD = { top: 10, right: 12, bottom: 26 }

export function LineChart({
  days,
  series,
  locale,
  formatValue,
  summary,
  emptyLabel,
  minHeight = 208,
  className,
}: {
  days: Date[]
  series: LineSeries[]
  locale: string
  /** A value as the tooltip prints it (money, a plain count). */
  formatValue: (value: number, approx: boolean) => string
  /** What the chart shows, for a screen reader. */
  summary: string
  emptyLabel: string
  /** The plot grows to fill its card, never below this. */
  minHeight?: number
  className?: string
}) {
  const tx = useTx()
  const gradientId = useId()
  const [boxRef, { width, height }] = useSize()
  const [active, setActive] = useState<number | null>(null)
  const [hot, setHot] = useState<string | null>(null)

  const count = days.length
  const highest = Math.max(0, ...series.flatMap((s) => s.values))
  const integer = series.every((s) => s.values.every(Number.isInteger))
  const { max, ticks } = niceScale(highest, { integer })
  const empty = highest === 0

  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 })
  const tickLabels = ticks.map((t) => compact.format(t))
  const padLeft = Math.max(26, Math.max(...tickLabels.map((l) => l.length)) * 6.6 + 12)

  const plotW = Math.max(0, width - padLeft - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const x = (i: number) => padLeft + (count > 1 ? (i / (count - 1)) * plotW : plotW / 2)
  const y = (v: number) => PAD.top + (1 - v / max) * plotH

  const dayShort = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" })
  const dayLong = (d: Date) => d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })

  // Evenly spaced date labels counted back from today, so the last day is
  // always named and the gaps between labels are all the same.
  const labelCount = width < 420 ? 3 : 5
  const labelStep = Math.max(1, Math.ceil((count - 1) / (labelCount - 1)))
  const labelAt = Array.from({ length: Math.floor((count - 1) / labelStep) + 1 }, (_, j) => count - 1 - j * labelStep).reverse()

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!width || count < 2) return
    const box = event.currentTarget.getBoundingClientRect()
    const at = Math.round(((event.clientX - box.left - padLeft) / plotW) * (count - 1))
    setActive(Math.min(count - 1, Math.max(0, at)))
  }

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = count - 1
    const step = (by: number) => setActive((cur) => Math.min(last, Math.max(0, (cur ?? last) + by)))
    if (event.key === "ArrowLeft") step(-1)
    else if (event.key === "ArrowRight") step(1)
    else if (event.key === "Home") setActive(0)
    else if (event.key === "End") setActive(last)
    else if (event.key === "Escape") setActive(null)
    else return
    event.preventDefault()
  }

  const single = series.length === 1
  const ax = active === null ? 0 : x(active)
  const flip = ax > width / 2

  const spoken =
    active === null
      ? ""
      : `${dayLong(days[active])}: ${series.map((s) => `${s.label} ${formatValue(s.values[active], !!s.approx)}`).join(", ")}`

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        ref={boxRef}
        role="group"
        aria-label={summary}
        tabIndex={0}
        data-chart="line"
        className="relative flex-1 touch-pan-y select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ minHeight }}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={(event) => event.pointerType !== "touch" && setActive(null)}
        onKeyDown={keys}
        onFocus={(event) => event.currentTarget.matches(":focus-visible") && setActive((cur) => cur ?? count - 1)}
        onBlur={() => setActive(null)}
      >
        {width > 0 && height > 0 && (
          <svg width={width} height={height} aria-hidden="true" className="absolute inset-0">
            {single && (
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series[0].color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={series[0].color} stopOpacity="0" />
                </linearGradient>
              </defs>
            )}

            {ticks.map((t, i) => (
              <g key={t}>
                <line
                  x1={padLeft}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray={t === 0 ? undefined : "3 4"}
                />
                <text x={padLeft - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px]">
                  {tickLabels[i]}
                </text>
              </g>
            ))}

            {labelAt.map((i, j) => (
              <text
                key={i}
                x={x(i)}
                y={height - 6}
                textAnchor={j === labelAt.length - 1 ? "end" : "middle"}
                className="fill-muted-foreground text-[11px]"
              >
                {dayShort(days[i])}
              </text>
            ))}

            {single && !empty && (
              <path
                d={`${series[0].values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ")} L ${x(count - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
                fill={`url(#${gradientId})`}
              />
            )}

            {!empty &&
              series.map((s) => (
                <path
                  key={s.key}
                  d={s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hot === s.key ? 3.5 : 2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hot && hot !== s.key ? 0.2 : 1}
                  data-series={s.key}
                />
              ))}

            {!empty &&
              series.map((s) => (
                <circle
                  key={s.key}
                  cx={x(count - 1)}
                  cy={y(s.values[count - 1])}
                  r={4}
                  fill={s.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                  opacity={hot && hot !== s.key ? 0.2 : 1}
                />
              ))}

            {active !== null && (
              <g data-crosshair="">
                <line x1={ax} x2={ax} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.6} />
                {series.map((s) => (
                  <circle key={s.key} cx={ax} cy={y(s.values[active])} r={4.5} fill={s.color} stroke="var(--card)" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}

        {empty && width > 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        )}

        {active !== null && width > 0 && (
          <div
            data-tooltip=""
            role="presentation"
            className="pointer-events-none absolute z-10 min-w-[150px] max-w-[220px] rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg"
            style={{ top: PAD.top, ...(flip ? { right: width - ax + 12 } : { left: ax + 12 }) }}
          >
            <p className="mb-1 font-semibold text-foreground">{dayLong(days[active])}</p>
            <ul className="space-y-0.5">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-[3px] w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{formatValue(s.values[active], !!s.approx)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {spoken}
        </p>
      </div>

      {series.length > 1 && (
        <ul
          data-legend=""
          aria-label={tx("Légende", "Legend")}
          className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs"
          onPointerLeave={() => setHot(null)}
        >
          {series.map((s) => (
            <li
              key={s.key}
              className="flex items-center gap-1.5"
              onPointerEnter={() => setHot(s.key)}
            >
              <span className="h-[3px] w-4 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              <span className="text-foreground">{s.label}</span>
              <span className="tabular-nums text-muted-foreground">{formatValue(s.values.reduce((a, b) => a + b, 0), !!s.approx)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Donut: a whole in at most six parts                                */
/* ------------------------------------------------------------------ */

export type DonutSlice = Slice & { color: string }

const SIZE = 156
const RADIUS = 60
const STROKE = 22
const GAP_DEG = 2

function arcPath(from: number, to: number) {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return [SIZE / 2 + RADIUS * Math.cos(rad), SIZE / 2 + RADIUS * Math.sin(rad)]
  }
  const [x0, y0] = point(from)
  const [x1, y1] = point(to)
  return `M ${x0} ${y0} A ${RADIUS} ${RADIUS} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

const percent = (share: number) => (share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`)

export function DonutChart({
  slices,
  centerLabel,
  className,
}: {
  slices: DonutSlice[]
  /** What the total counts, under the figure ("alerts"). */
  centerLabel: string
  className?: string
}) {
  const tx = useTx()
  const [active, setActive] = useState<string | null>(null)
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const current = slices.find((s) => s.key === active) ?? null

  const arcs = slices.map((slice, i) => {
    const sweep = slice.share * 360
    const from = slices.slice(0, i).reduce((sum, s) => sum + s.share * 360, 0)
    const gap = slices.length > 1 ? Math.min(GAP_DEG, sweep / 3) : 0
    return { slice, from: from + gap / 2, to: from + sweep - gap / 2, sweep }
  })

  return (
    <div className={cn("flex flex-col items-center gap-4", className)} data-chart="donut">
      <div
        className="relative shrink-0"
        style={{ width: SIZE, height: SIZE }}
        role="img"
        aria-label={tx("Répartition des alertes", "Alert breakdown") + ": " + slices.map((s) => `${s.label} ${s.value}`).join(", ")}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="block">
          {arcs.map(({ slice, from, to, sweep }) =>
            sweep >= 359.9 ? (
              <circle
                key={slice.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={active === slice.key ? STROKE + 4 : STROKE}
                data-slice={slice.key}
                onPointerEnter={() => setActive(slice.key)}
                onPointerLeave={() => setActive(null)}
              />
            ) : (
              <path
                key={slice.key}
                d={arcPath(from, to)}
                fill="none"
                stroke={slice.color}
                strokeWidth={active === slice.key ? STROKE + 4 : STROKE}
                opacity={active && active !== slice.key ? 0.4 : 1}
                data-slice={slice.key}
                style={{ transition: "stroke-width 120ms ease-out, opacity 120ms ease-out" }}
                onPointerEnter={() => setActive(slice.key)}
                onPointerLeave={() => setActive(null)}
              />
            )
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-9 text-center" data-donut-center="">
          <span className="font-heading text-2xl font-bold leading-none tabular-nums">{current ? current.value : total}</span>
          <span className="mt-1 line-clamp-2 text-[11px] leading-tight text-muted-foreground">
            {current ? `${current.label} · ${percent(current.share)}` : centerLabel}
          </span>
        </div>
      </div>

      <ul data-legend="" aria-label={tx("Légende", "Legend")} className="w-full space-y-1 text-sm">
        {slices.map((slice) => (
          <li
            key={slice.key}
            tabIndex={0}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === slice.key && "bg-muted"
            )}
            onPointerEnter={() => setActive(slice.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(slice.key)}
            onBlur={() => setActive(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: slice.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{slice.label}</span>
            <span className="font-semibold tabular-nums">{slice.value}</span>
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{percent(slice.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sparkline: the small trend inside a KPI tile                       */
/* ------------------------------------------------------------------ */

export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const w = 120
  const h = 36
  const max = Math.max(...data)
  const min = Math.min(...data)
  const stepX = w / (data.length - 1)
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * h
  const line = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${y(v)}`)
    .join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}
