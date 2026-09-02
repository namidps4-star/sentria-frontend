"use client"

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

  const safeData = data.map((v) => (Number.isFinite(v) ? v : 0))

  if (safeData.length === 0) {
    return <div className={className} style={{ height }} />
  }

  const max = Math.max(...safeData)
  const min = Math.min(...safeData)
  const range = max - min || 1
  const stepX = safeData.length > 1 ? (w - pad * 2) / (safeData.length - 1) : 0

  const y = (v: number) =>
    h - pad - ((v - min) / range) * (h - pad * 2)

  const points = safeData.map((v, i) => [pad + i * stepX, y(v)] as const)

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
    .join(" ")

  const area =
    points.length > 1
      ? `${line} L ${points[points.length - 1][0]} ${h} L ${points[0][0]} ${h} Z`
      : ""

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
          <stop
            offset="0%"
            stopColor="var(--color-accent)"
            stopOpacity="0.35"
          />
          <stop
            offset="100%"
            stopColor="var(--color-accent)"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>

      {area && <path d={area} fill="url(#sentria-area)" />}

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
  const gap = 14

  const safeData = data.map((v) => (Number.isFinite(v) ? v : 0))

  if (safeData.length === 0) {
    return <div className={className} style={{ height }} />
  }

  const max = Math.max(...safeData.map(Math.abs), 1) * 1.1
  const barW =
    (w - pad * 2 - gap * (safeData.length - 1)) / safeData.length

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        role="img"
        aria-label="Histogramme"
      >
        {safeData.map((v, i) => {
          const bh = (Math.abs(v) / max) * (h - pad * 2)
          const x = pad + i * (barW + gap)
          const y = h - pad - bh
          const last = i === safeData.length - 1

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={bh}
              rx={6}
              fill={
                last
                  ? "var(--color-accent)"
                  : "var(--color-foreground)"
              }
              opacity={last ? 1 : 0.85}
            />
          )
        })}
      </svg>

      {labels && (
        <div className="mt-2 flex justify-between px-1 text-[11px] text-muted-foreground">
          {labels.map((l, i) => (
            <span key={`${l}-${i}`}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sparkline({
  data,
  className,
}: {
  data: number[]
  className?: string
}) {
  const w = 120
  const h = 36

  const safeData = data.map((v) => (Number.isFinite(v) ? v : 0))

  if (safeData.length === 0) {
    return <div className={className} style={{ height: h }} />
  }

  const max = Math.max(...safeData)
  const min = Math.min(...safeData)
  const range = max - min || 1
  const stepX = safeData.length > 1 ? w / (safeData.length - 1) : 0

  const y = (v: number) =>
    h - ((v - min) / range) * h

  const line = safeData
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"} ${i * stepX} ${y(v)}`
    )
    .join(" ")

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </svg>
  )
}