"use client"

/* Lightweight, dependency-free SVG charts tuned for the SentrIA aesthetic. */

export function AreaChart({
  data,
  height = 200,
  className,
}: {
  data: number[]
  height?: number
  className?: string
}) {
  const w = 600
  const h = height
  const pad = 8
  const max = Math.max(...data) * 1.15
  const min = Math.min(...data) * 0.85
  const stepX = (w - pad * 2) / (data.length - 1)
  const y = (v: number) =>
    h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
  const points = data.map((v, i) => [pad + i * stepX, y(v)] as const)
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ")
  const area = `${line} L ${points[points.length - 1][0]} ${h} L ${points[0][0]} ${h} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label="Graphique d'évolution"
    >
      <defs>
        <linearGradient id="sentria-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sentria-area)" />
      <path
        d={line}
        fill="none"
        stroke="var(--color-foreground)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={i === points.length - 1 ? 4 : 0}
          fill="var(--color-accent)"
          stroke="var(--color-foreground)"
          strokeWidth={2}
        />
      ))}
    </svg>
  )
}

export function BarChart({
  data,
  labels,
  height = 200,
  className,
}: {
  data: number[]
  labels?: string[]
  height?: number
  className?: string
}) {
  const w = 600
  const h = height
  const pad = 8
  const max = Math.max(...data) * 1.1
  const gap = 14
  const barW = (w - pad * 2 - gap * (data.length - 1)) / data.length

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Histogramme">
        {data.map((v, i) => {
          const bh = (v / max) * (h - pad * 2)
          const x = pad + i * (barW + gap)
          const last = i === data.length - 1
          return (
            <rect
              key={i}
              x={x}
              y={h - pad - bh}
              width={barW}
              height={bh}
              rx={6}
              fill={last ? "var(--color-accent)" : "var(--color-foreground)"}
              opacity={last ? 1 : 0.85}
            />
          )
        })}
      </svg>
      {labels && (
        <div className="mt-2 flex justify-between px-1 text-[11px] text-muted-foreground">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}

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
