"use client"

/* Robo's face in three moods, for the status bubble: smiling (the data is
   fresh), worried (it went quiet), flat (nobody can tell). The shape is the
   tour's robot (guide-buddy.tsx): a lime shell around a black screen. */

export type Mood = "fresh" | "stale" | "unknown"

const SCREEN = "#161614"

const COLORS: Record<Mood, { shell: string; dark: string }> = {
  fresh: { shell: "var(--brand)", dark: "oklch(0.78 0.19 124)" },
  stale: { shell: "var(--tag-watch-bg)", dark: "#d97a14" },
  unknown: { shell: "#8a8a85", dark: "#6f6f6a" },
}

function Face({ mood }: { mood: Mood }) {
  const ink = COLORS[mood].shell

  if (mood === "fresh") {
    return (
      <g fill="none" stroke={ink} strokeWidth="6" strokeLinecap="round">
        <path d="M68 58 Q80 42 92 58" />
        <path d="M108 58 Q120 42 132 58" />
        <path d="M88 78 Q100 90 112 78" />
      </g>
    )
  }

  if (mood === "stale") {
    return (
      <>
        <g fill="none" stroke={ink} strokeWidth="6" strokeLinecap="round">
          <circle cx="80" cy="62" r="9" />
          <circle cx="120" cy="62" r="9" />
          <path d="M64 44 L88 38" />
          <path d="M136 44 L112 38" />
          <path d="M90 86 Q100 76 110 86" />
        </g>
        <path d="M146 40 q5 8 0 12 q-5 -4 0 -12z" fill="#7fb8ff" />
      </>
    )
  }

  return (
    <g fill="none" stroke="#b8b8b3" strokeWidth="6" strokeLinecap="round">
      <path d="M70 62 H90" />
      <path d="M110 62 H130" />
      <path d="M92 82 H108" />
    </g>
  )
}

/** Just the head, small enough for the bubble. */
export function RoboHead({ mood, className }: { mood: Mood; className?: string }) {
  const { shell } = COLORS[mood]

  return (
    <svg viewBox="30 8 140 124" className={className} aria-hidden="true" focusable="false">
      <rect x="36" y="14" width="128" height="108" rx="54" fill={shell} />
      <rect x="50" y="26" width="100" height="70" rx="35" fill={SCREEN} />
      <Face mood={mood} />
    </svg>
  )
}

/** The whole robot, for the pop-out. Arms up when it is glad, down otherwise. */
export function RoboBody({ mood, className }: { mood: Mood; className?: string }) {
  const { shell, dark } = COLORS[mood]
  const arms =
    mood === "fresh"
      ? [
          { d: "M124 142 C160 146 176 132 176 98", hand: [176, 93] },
          { d: "M76 144 C58 150 40 162 36 182", hand: [35, 187] },
        ]
      : [
          { d: "M124 142 C140 150 142 168 134 182", hand: [133, 187] },
          { d: "M76 144 C60 152 58 170 66 184", hand: [67, 189] },
        ]

  return (
    <svg viewBox="0 0 200 240" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="222" rx="46" ry="6" fill="#000" opacity="0.18" />

      {arms.map((arm, i) => (
        <g key={i}>
          <path d={arm.d} fill="none" stroke={shell} strokeWidth="12" strokeLinecap="round" />
          <circle cx={arm.hand[0]} cy={arm.hand[1]} r="8" fill={shell} />
        </g>
      ))}

      <path d="M78 112 h44 c4 24 8 52 8 76 a6 6 0 0 1 -6 6 h-48 a6 6 0 0 1 -6 -6 c0 -24 4 -52 8 -76 z" fill={shell} />
      <rect x="94" y="150" width="12" height="3" rx="1.5" fill="#fff" opacity="0.9" />
      <rect x="72" y="188" width="56" height="16" rx="8" fill={dark} />
      <rect x="36" y="14" width="128" height="108" rx="54" fill={shell} />
      <rect x="50" y="26" width="100" height="70" rx="35" fill={SCREEN} />
      <Face mood={mood} />
    </svg>
  )
}
