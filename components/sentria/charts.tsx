"use client"

/* Lightweight, dependency-free SVG charts tuned for the SentrIA aesthetic.
   Colours are theme tokens (--series-N, --slice-N in app/globals.css), never
   literals; the data comes from lib/chart-series.ts. */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { useTx } from "@/lib/i18n"
import { gaugeScale, niceScale, smoothPath, type LimitSide, type Slice } from "@/lib/chart-series"
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

  // A smooth line through every day's value (monotone: it never dips below
  // zero or swings past a peak it does not have).
  const curve = (values: number[]) => smoothPath(values.map((v, i) => [x(i), y(v)] as const))

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
                d={`${curve(series[0].values)} L ${x(count - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
                fill={`url(#${gradientId})`}
              />
            )}

            {!empty &&
              series.map((s) => (
                <path
                  key={s.key}
                  d={curve(s.values)}
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

/* The donut sits on a black card in every theme (its colours are validated on
   it: --slice-N, --slice-critical, --slice-warning). A thick ring cut into
   rounded segments with a small gap between them, the total in the hole. */
const SIZE = 212
const CENTER = SIZE / 2
const R_OUT = 100
const R_IN = 54
const THICK = R_OUT - R_IN
/** How round a segment's corners are, at most; a thin slice gets less. */
const CORNER = 13
/** The gap between two segments, in pixels at the middle of the ring. */
const GAP_PX = 7

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (radians: number) => (radians * 180) / Math.PI

function polar(radius: number, degrees: number): readonly [number, number] {
  const angle = rad(degrees - 90)
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)] as const
}

/** The whole ring, for a donut with one slice. */
const RING_PATH =
  `M ${CENTER - R_OUT} ${CENTER} a ${R_OUT} ${R_OUT} 0 1 0 ${2 * R_OUT} 0 a ${R_OUT} ${R_OUT} 0 1 0 ${-2 * R_OUT} 0 Z ` +
  `M ${CENTER - R_IN} ${CENTER} a ${R_IN} ${R_IN} 0 1 0 ${2 * R_IN} 0 a ${R_IN} ${R_IN} 0 1 0 ${-2 * R_IN} 0 Z`

/** One segment of the ring from angle `a0` to `a1` (degrees clockwise from
 *  the top), with rounded corners. Each corner is a circle of radius `rc`
 *  tangent to the arc and to the straight edge, so it takes `asin(rc / r)`
 *  off the arc at the radius it sits on (more on the inner arc). A slice too
 *  thin for the full corner gets smaller ones, then square ones. */
export function segmentPath(a0: number, a1: number): string {
  const span = a1 - a0
  let rc = Math.min(CORNER, THICK / 2 - 0.5)
  const offsetOut = (c: number) => deg(Math.asin(c / (R_OUT - c)))
  const offsetIn = (c: number) => deg(Math.asin(c / (R_IN + c)))

  while (rc > 0.5 && 2 * offsetIn(rc) >= span - 0.4) rc *= 0.85
  if (rc <= 0.5) rc = 0

  const dOut = rc ? offsetOut(rc) : 0
  const dIn = rc ? offsetIn(rc) : 0
  const edgeOut = rc ? (R_OUT - rc) * Math.cos(rad(dOut)) : R_OUT
  const edgeIn = rc ? (R_IN + rc) * Math.cos(rad(dIn)) : R_IN

  const [x1, y1] = polar(R_OUT, a0 + dOut)
  const [x2, y2] = polar(R_OUT, a1 - dOut)
  const [x3, y3] = polar(edgeOut, a1)
  const [x4, y4] = polar(edgeIn, a1)
  const [x5, y5] = polar(R_IN, a1 - dIn)
  const [x6, y6] = polar(R_IN, a0 + dIn)
  const [x7, y7] = polar(edgeIn, a0)
  const [x8, y8] = polar(edgeOut, a0)
  const bigOut = a1 - dOut - (a0 + dOut) > 180 ? 1 : 0
  const bigIn = a1 - dIn - (a0 + dIn) > 180 ? 1 : 0

  if (!rc) {
    return `M ${x1} ${y1} A ${R_OUT} ${R_OUT} 0 ${bigOut} 1 ${x2} ${y2} L ${x5} ${y5} A ${R_IN} ${R_IN} 0 ${bigIn} 0 ${x6} ${y6} Z`
  }

  return (
    `M ${x1} ${y1} A ${R_OUT} ${R_OUT} 0 ${bigOut} 1 ${x2} ${y2} ` +
    `A ${rc} ${rc} 0 0 1 ${x3} ${y3} L ${x4} ${y4} ` +
    `A ${rc} ${rc} 0 0 1 ${x5} ${y5} ` +
    `A ${R_IN} ${R_IN} 0 ${bigIn} 0 ${x6} ${y6} ` +
    `A ${rc} ${rc} 0 0 1 ${x7} ${y7} L ${x8} ${y8} ` +
    `A ${rc} ${rc} 0 0 1 ${x1} ${y1} Z`
  )
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

  const gapDeg = deg(GAP_PX / ((R_OUT + R_IN) / 2))
  const arcs = slices.map((slice, i) => {
    const sweep = slice.share * 360
    const from = slices.slice(0, i).reduce((sum, s) => sum + s.share * 360, 0)
    // A sliver keeps most of its width: the gap never takes more than 40%.
    const gap = slices.length > 1 ? Math.min(gapDeg, sweep * 0.4) : 0
    return { slice, from: from + gap / 2, to: from + sweep - gap / 2, sweep }
  })

  return (
    <div className={cn("flex flex-col items-center gap-5 text-sidebar-foreground", className)} data-chart="donut">
      <div
        className="relative shrink-0"
        style={{ width: SIZE, height: SIZE }}
        role="img"
        aria-label={tx("Répartition des alertes", "Alert breakdown") + ": " + slices.map((s) => `${s.label} ${s.value}`).join(", ")}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="block overflow-visible">
          {arcs.map(({ slice, from, to, sweep }) => (
            <path
              key={slice.key}
              d={sweep >= 359.9 ? RING_PATH : segmentPath(from, to)}
              fillRule="evenodd"
              fill={slice.color}
              opacity={active && active !== slice.key ? 0.4 : 1}
              data-slice={slice.key}
              style={{
                transformOrigin: `${CENTER}px ${CENTER}px`,
                transform: active === slice.key ? "scale(1.045)" : "none",
                transition: "transform 120ms ease-out, opacity 120ms ease-out",
              }}
              onPointerEnter={() => setActive(slice.key)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" data-donut-center="">
          <div className="flex w-24 flex-col items-center text-center">
            <span className="font-heading text-[2rem] font-bold leading-none tabular-nums">{current ? current.value : total}</span>
            <span className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-sidebar-foreground/65">
              {current ? `${current.label} · ${percent(current.share)}` : centerLabel}
            </span>
          </div>
        </div>
      </div>

      <ul data-legend="" aria-label={tx("Légende", "Legend")} className="flex w-full flex-wrap justify-center gap-x-2 gap-y-1.5 text-sm">
        {slices.map((slice) => (
          <li
            key={slice.key}
            tabIndex={0}
            className={cn(
              "flex max-w-full items-center gap-2 rounded-full px-2.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active === slice.key && "bg-white/10"
            )}
            onPointerEnter={() => setActive(slice.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(slice.key)}
            onBlur={() => setActive(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} aria-hidden="true" />
            <span className="min-w-0 truncate">{slice.label}</span>
            <span className="font-semibold tabular-nums">{slice.value}</span>
            <span className="text-xs tabular-nums text-sidebar-foreground/60">{percent(slice.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Gauge: a reading against the limit it crossed                      */
/* ------------------------------------------------------------------ */

const GAUGE = { cx: 60, cy: 60, r: 46, stroke: 11 }

function gaugePoint(fraction: number, radius = GAUGE.r) {
  const angle = Math.PI * (1 - fraction)
  return [GAUGE.cx + radius * Math.cos(angle), GAUGE.cy - radius * Math.sin(angle)] as const
}

export function GaugeChart({
  reading,
  limit,
  side,
  unit,
  tone,
  name,
  detail,
  locale,
  className,
}: {
  reading: number
  limit: number
  side: LimitSide
  unit: string
  /** Critical or warning: the status colours, which only status uses. */
  tone: "danger" | "warning"
  /** The equipment. */
  name: string
  /** What is measured, and when. */
  detail: string
  locale: string
  className?: string
}) {
  const tx = useTx()
  const { max, fill, mark } = gaugeScale({ reading, limit, side, unit })
  const color = tone === "danger" ? "var(--tag-danger-fg)" : "var(--tag-warning-fg)"

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const withUnit = (v: number) => (unit === "%" ? `${number.format(v)}%` : unit ? `${number.format(v)} ${unit}` : number.format(v))
  const past = side === "max" ? reading > limit : reading < limit
  const spoken = `${withUnit(reading)}, ${tx("limite", "limit")} ${withUnit(limit)}${
    past ? `, ${side === "max" ? tx("au-dessus", "above") : tx("en dessous", "below")}` : ""
  }`

  const [x0, y0] = gaugePoint(0)
  const [x1, y1] = gaugePoint(fill)
  const [t0x, t0y] = gaugePoint(mark, GAUGE.r - GAUGE.stroke / 2 - 3)
  const [t1x, t1y] = gaugePoint(mark, GAUGE.r + GAUGE.stroke / 2 + 3)

  return (
    <div className={cn("flex min-w-0 flex-col items-center text-center", className)} data-gauge="">
      <div
        role="meter"
        aria-label={`${name}: ${detail}`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={reading}
        aria-valuetext={spoken}
        className="relative w-full max-w-[176px]"
      >
        <svg viewBox="0 0 120 70" className="block w-full" aria-hidden="true">
          <path d={`M ${x0} ${y0} A ${GAUGE.r} ${GAUGE.r} 0 0 1 ${gaugePoint(1)[0]} ${gaugePoint(1)[1]}`} fill="none" stroke="var(--border)" strokeWidth={GAUGE.stroke} strokeLinecap="round" data-gauge-track="" />
          {fill > 0.004 && (
            <path d={`M ${x0} ${y0} A ${GAUGE.r} ${GAUGE.r} 0 0 1 ${x1} ${y1}`} fill="none" stroke={color} strokeWidth={GAUGE.stroke} strokeLinecap="round" data-gauge-fill="" />
          )}
          <line x1={t0x} y1={t0y} x2={t1x} y2={t1y} stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round" data-gauge-limit="" />
        </svg>
        <p className="pointer-events-none absolute inset-x-0 bottom-0 font-heading text-lg font-bold leading-none tabular-nums">
          {withUnit(reading)}
        </p>
      </div>

      <p className="mt-1.5 w-full truncate text-sm font-semibold" title={name}>
        {name}
      </p>
      <p className="w-full truncate text-xs text-muted-foreground">{detail}</p>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
        {tx("limite", "limit")} <span className="font-semibold text-foreground">{withUnit(limit)}</span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stock bars: each item against its own minimum                      */
/* ------------------------------------------------------------------ */

export type StockBar = {
  name: string
  stock: number
  min: number
  /** When the reading was taken, already formatted. */
  date: string
}

/** Every bar is scaled to its own minimum, so one line (the minimum) sits at
 *  the same place on all of them: a bar that stops short of it is below. The
 *  track runs to twice the minimum. */
export function StockBars({ rows, locale, className }: { rows: StockBar[]; locale: string; className?: string }) {
  const tx = useTx()
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })

  return (
    <div className={className} data-chart="stock">
      <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
        {tx("Minimum de chaque article", "Each item's minimum")}
      </p>

      <ul aria-label={tx("Stock face au minimum", "Stock against its minimum")} className="space-y-2.5">
        {rows.map((row) => {
          const below = row.stock < row.min
          const width = Math.min(1, row.stock / (row.min * 2)) * 100
          return (
            <li key={row.name} data-stock-row="" data-below={below} className="rounded-lg">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium" title={row.name}>
                  {row.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{number.format(row.stock)}</span>
                  <span className="text-muted-foreground">
                    {" / "}
                    {number.format(row.min)}
                  </span>
                  <span className="sr-only">
                    {" "}
                    {below ? tx("sous le minimum", "below the minimum") : tx("au-dessus du minimum", "above the minimum")}
                  </span>
                </span>
              </div>
              <div className="relative mt-1 h-2.5 rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${width}%`, background: below ? "var(--tag-danger-fg)" : "var(--tag-warning-fg)" }}
                  data-stock-bar=""
                />
                <span className="absolute -bottom-1 -top-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-foreground" data-stock-min="" />
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{row.date}</p>
            </li>
          )
        })}
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
  const pad = 2 // room for the stroke at the top and bottom
  const max = Math.max(...data)
  const min = Math.min(...data)
  const stepX = w / (data.length - 1)
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
  const line = smoothPath(data.map((v, i) => [i * stepX, y(v)] as const))
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" data-sparkline="">
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
