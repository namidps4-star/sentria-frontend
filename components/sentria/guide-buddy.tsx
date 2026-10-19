"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { useTx } from "@/lib/i18n"
import { GUIDE_DONE_KEY, GUIDE_NAME, guideSteps, type GuidePose } from "@/lib/guide-steps"
import { cn } from "@/lib/utils"

/* --------------------------------------------------------------------------
 * The first-use tour (ONB-GUIDE): a small lime robot with a black screen face
 * walks down the sidebar, points at each item, and says in plain words what it
 * is for, with one example. Scripted, so no AI and no cost per use.
 *
 * Pointing steps put the robot next to the item and ring the item in lime.
 * Hello and goodbye sit in the middle of the screen. Under 768 px the sidebar
 * is a drawer, so every step sits at the bottom of the screen instead and the
 * robot does not point at a menu that is not there.
 * -------------------------------------------------------------------------- */

const LIME = "var(--brand)"
const LIME_DARK = "oklch(0.78 0.19 124)"
const SCREEN = "#161614"

/** Where each pose puts the arms, in the robot's 200 x 240 box. */
const ARMS: Record<GuidePose, { d: string; hand: [number, number] }[]> = {
  // Raised arms swing out past the head, so the hands stay in view.
  wave: [
    { d: "M124 142 C160 146 176 132 176 98", hand: [176, 93] },
    { d: "M76 144 C58 150 40 162 36 182", hand: [35, 187] },
  ],
  point: [
    { d: "M76 140 C54 138 34 134 18 128", hand: [15, 127] },
    { d: "M124 142 C132 146 134 150 130 160", hand: [130, 165] },
  ],
  cheer: [
    { d: "M76 142 C40 146 24 132 24 98", hand: [24, 93] },
    { d: "M124 142 C160 146 176 132 176 98", hand: [176, 93] },
  ],
}

export function RoboFigure({ pose, className, style }: { pose: GuidePose; className?: string; style?: React.CSSProperties }) {
  const happy = pose !== "point"

  return (
    <svg
      viewBox="0 0 200 240"
      className={className}
      style={style}
      role="img"
      aria-label={GUIDE_NAME}
      data-pose={pose}
    >
      <ellipse cx="100" cy="222" rx="46" ry="6" fill="currentColor" opacity="0.14" />

      {/* Arms first, so the body sits in front of the shoulder. */}
      {ARMS[pose].map((arm, i) => (
        <g
          key={i}
          className={
            pose === "wave" && i === 0
              ? "origin-[124px_142px] animate-[robo-wave_1.1s_ease-in-out_infinite]"
              : pose === "point" && i === 0
                ? "animate-[robo-point_1.2s_ease-in-out_infinite]"
                : undefined
          }
        >
          <path d={arm.d} fill="none" stroke={LIME} strokeWidth="12" strokeLinecap="round" />
          <circle cx={arm.hand[0]} cy={arm.hand[1]} r="8" fill={LIME} />
        </g>
      ))}

      {/* Body, chest dash and foot. */}
      <path
        d="M78 112 h44 c4 24 8 52 8 76 a6 6 0 0 1 -6 6 h-48 a6 6 0 0 1 -6 -6 c0 -24 4 -52 8 -76 z"
        fill={LIME}
      />
      <rect x="94" y="150" width="12" height="3" rx="1.5" fill="#fff" opacity="0.9" />
      <rect x="72" y="188" width="56" height="16" rx="8" fill={LIME_DARK} />

      {/* Head: a lime shell around a black screen. */}
      <rect x="36" y="14" width="128" height="108" rx="54" fill={LIME} />
      <rect x="50" y="26" width="100" height="70" rx="35" fill={SCREEN} />

      {happy ? (
        <g fill="none" stroke={LIME} strokeWidth="6" strokeLinecap="round">
          <path d="M68 66 Q80 50 92 66" />
          <path d="M108 66 Q120 50 132 66" />
        </g>
      ) : (
        <g
          fill="none"
          stroke={LIME}
          strokeWidth="6"
          className="origin-center animate-[robo-blink_4s_ease-in-out_infinite] [transform-box:fill-box]"
        >
          <circle cx="80" cy="61" r="11" />
          <circle cx="120" cy="61" r="11" />
        </g>
      )}
    </svg>
  )
}

type Box = { left: number; top: number; width: number; height: number }

const CARD_W = 320
const ROBO_W = 142
const GAP = 12

export function GuideBuddy({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tx = useTx()
  const [index, setIndex] = useState(0)
  const [targets, setTargets] = useState<Record<string, Box | null>>({})
  const [narrow, setNarrow] = useState(false)
  const next = useRef<HTMLButtonElement>(null)

  const all = useMemo(() => guideSteps(tx), [tx])

  // Wide screens drop a step whose menu item is not on screen. Narrow ones
  // keep every step: nothing is pointed at, so nothing can be missing.
  const steps = useMemo(
    () => all.filter((s) => !s.nav || narrow || targets[s.nav] !== null),
    [all, narrow, targets],
  )

  const measure = useCallback(() => {
    const isNarrow = window.matchMedia("(max-width: 767px)").matches
    setNarrow(isNarrow)

    const found: Record<string, Box | null> = {}
    for (const step of all) {
      if (!step.nav) continue
      const el = document.querySelector<HTMLElement>(`aside [data-nav="${step.nav}"]`)
      const r = el?.getBoundingClientRect()
      found[step.nav] = r && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null
    }
    setTargets(found)
  }, [all])

  useLayoutEffect(() => {
    if (!open) return
    measure()
  }, [open, measure, index])

  useEffect(() => {
    if (!open) return
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [open, measure])

  const finish = useCallback(() => {
    try {
      localStorage.setItem(GUIDE_DONE_KEY, "1")
    } catch {
      /* A blocked localStorage just lets the tour offer itself again. */
    }
    setIndex(0)
    onClose()
  }, [onClose])

  const step = steps[Math.min(index, steps.length - 1)]
  const last = index >= steps.length - 1

  const go = useCallback(
    (delta: number) => {
      if (delta > 0 && last) return finish()
      setIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)))
    },
    [last, finish, steps.length],
  )

  useEffect(() => {
    if (!open) return
    next.current?.focus()
  }, [open, index])

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish()
      else if (e.key === "ArrowRight") go(1)
      else if (e.key === "ArrowLeft") go(-1)
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, go, finish])

  if (!open || !step) return null

  const target = step.nav && !narrow ? targets[step.nav] : null
  const centred = !target && !narrow

  // The robot stands to the right of the item, arm out to the left. The card
  // follows it, kept inside the screen.
  const vh = typeof window === "undefined" ? 800 : window.innerHeight
  const roboLeft = target ? target.left + target.width + GAP : 0
  const roboTop = target ? Math.max(12, Math.min(vh - 250, target.top + target.height / 2 - ROBO_W * 0.6)) : 0

  return (
    <div className="fixed inset-0 z-[80]" data-testid="guide-buddy" data-step={step.id} data-pose={step.pose}>
      {/* No backdrop on pointing steps, so the ringed item stays clear and the page stays usable. */}
      {centred && <div className="absolute inset-0 bg-black/35" onClick={finish} aria-hidden="true" />}

      {target && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-[color:var(--brand)] ring-offset-2 ring-offset-transparent transition-all duration-300 ease-out"
          style={{ left: target.left - 2, top: target.top - 2, width: target.width + 4, height: target.height + 4 }}
          data-testid="guide-ring"
          aria-hidden="true"
        />
      )}

      <div
        role="dialog"
        aria-label={tx("Visite guidée", "Guided tour")}
        className={cn(
          "absolute flex items-start gap-2 transition-all duration-500 ease-out",
          centred && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex-col items-center",
          narrow && "inset-x-3 bottom-3 flex-col items-center",
        )}
        style={target ? { left: roboLeft, top: roboTop } : undefined}
      >
        <RoboFigure
          pose={step.pose}
          className={cn(
            "shrink-0 text-black animate-[robo-pop_0.45s_cubic-bezier(0.2,1.4,0.4,1)]",
            centred ? "-mb-6 h-40 w-[134px]" : narrow ? "-mb-6 h-28 w-[94px]" : "h-[170px] w-[142px]",
          )}
          style={{ filter: "drop-shadow(0 0 12px var(--robo-glow))" }}
        />

        <div
          className="squircle shrink-0 rounded-[22px] border border-border bg-card p-4 text-card-foreground shadow-xl"
          style={{ width: narrow ? "100%" : CARD_W }}
          data-testid="guide-card"
        >
          <div className="text-sm font-semibold">{step.title}</div>
          <p className="mt-1 text-[13px] leading-snug text-card-foreground/85">{step.body}</p>
          {step.example && <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{step.example}</p>}

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={finish}
              className="whitespace-nowrap text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Passer la visite", "Skip tour")}
            </button>

            <span
              className="flex items-center gap-1"
              role="img"
              aria-label={tx(`Étape ${index + 1} sur ${steps.length}`, `Step ${index + 1} of ${steps.length}`)}
            >
              {steps.map((s, i) => (
                <i
                  key={s.id}
                  className={cn("h-1.5 rounded-full bg-muted-foreground/30 transition-all", i === index ? "w-4 bg-foreground" : "w-1.5")}
                />
              ))}
            </span>

            <span className="flex items-center gap-1.5">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="rounded-full px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {tx("Retour", "Back")}
                </button>
              )}
              <button
                ref={next}
                type="button"
                onClick={() => go(1)}
                className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {last ? tx("Terminer", "Done") : tx("Suivant", "Next")}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
