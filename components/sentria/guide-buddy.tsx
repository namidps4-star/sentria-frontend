"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { Check } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { activeDepartment } from "@/lib/active-site"
import { activityLabel } from "@/lib/activities"
import { columnsForUpload } from "@/lib/csv-columns"
import {
  GUIDE_DONE_KEY,
  GUIDE_NAME,
  markPartsSeen,
  partCards,
  partSteps,
  previewStep,
  readSeenParts,
  type DeepContext,
  type GuidePose,
  type GuideStep,
  type PartId,
} from "@/lib/guide-steps"
import type { ViewKey } from "./types"
import { cn } from "@/lib/utils"

/* --------------------------------------------------------------------------
 * The first-use tour (ONB-GUIDE): a small lime robot with a black screen face
 * walks down the sidebar, points at each item, and says in plain words what it
 * is for, with one example. Scripted, so no AI and no cost per use.
 *
 * Someone who has been through it once opens a list of parts instead, and
 * jumps to the one they need ("Play all parts" runs them in order).
 *
 * "Go deeper" at the end opens a second chapter on the dashboard and on what
 * to import: it points at the dashboard's own blocks (data-tour), and shows
 * the columns the account's department asks for in its file.
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
/** What the tour is showing: the list of parts, or one part. */
type Part = PartId | "list"

/** The card the list of parts sits on: it has no step of its own to read. */
const LIST_STEP: GuideStep = { id: "parts", pose: "wave", title: "", body: "" }

const CARD_W = 320
const PARTS_W = 380
const ROBO_W = 142
const GAP = 12

/** Where a step points: a menu item or a dashboard block. */
function selectorFor(step: GuideStep): string | null {
  if (step.nav) return `aside [data-nav="${step.nav}"]`
  if (step.anchor) return `[data-tour="${step.anchor}"]${step.anchorSector ? `[data-sector="${step.anchorSector}"]` : ""}`

  return null
}

/** What the deeper chapter says about this account's file. */
function deepContext(tx: ReturnType<typeof useTx>): DeepContext {
  try {
    const sector = localStorage.getItem("sentria_sector")
    const department = activeDepartment() ?? localStorage.getItem("sentria_business_type")
    let sectors: string[] = []

    try {
      const saved = JSON.parse(localStorage.getItem("sentria_sectors") || "null")
      if (Array.isArray(saved)) sectors = saved.filter((s): s is string => typeof s === "string")
    } catch {
      /* the single sector below stands in */
    }

    if (sector && !sectors.includes(sector)) sectors.push(sector)

    return {
      columns: columnsForUpload(department, sector),
      department: activityLabel(sector, department, tx),
      sectors,
      departmentId: department,
    }
  } catch {
    return { columns: [] }
  }
}

export function GuideBuddy({
  open,
  onClose,
  view,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  /** The view on screen, and a way to open another: the deeper chapter starts on the dashboard. */
  view: ViewKey
  onNavigate: (view: ViewKey) => void
}) {
  const tx = useTx()
  const [part, setPart] = useState<Part>("menu")
  // The parts still to come after this one (the full run, or the deeper chapter).
  const [queue, setQueue] = useState<PartId[]>([])
  // Opened from the list: Back on a part's first step returns to it.
  const [fromList, setFromList] = useState(false)
  const [seen, setSeen] = useState<PartId[]>([])
  const [index, setIndex] = useState(0)
  const [targets, setTargets] = useState<Record<string, Box | null>>({})
  const [narrow, setNarrow] = useState(false)
  // The dashboard is on its "no data yet" screen (data-tour="empty").
  const [empty, setEmpty] = useState(false)
  // False while the dashboard is still opening: no step is dropped for a block that is just not there yet.
  const [settled, setSettled] = useState(true)
  const next = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    let finished = false
    try {
      finished = !!localStorage.getItem(GUIDE_DONE_KEY)
    } catch {
      /* No storage: the whole tour is offered. */
    }

    setSeen(readSeenParts())
    setQueue([])
    setFromList(false)
    // Whoever has finished the tour once picks a part; a first visit gets it from the top.
    setPart(finished ? "list" : "menu")
    setIndex(0)
  }, [open])

  const all = useMemo(
    () => (part === "list" ? [LIST_STEP] : partSteps(part, tx, deepContext(tx), queue.length > 0)),
    // The columns are read when the part opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tx, part, open, queue.length],
  )

  const measure = useCallback(() => {
    const isNarrow = window.matchMedia("(max-width: 767px)").matches
    setNarrow(isNarrow)
    setEmpty(!!document.querySelector('[data-tour="empty"]'))

    const found: Record<string, Box | null> = {}
    for (const step of all) {
      const selector = selectorFor(step)
      if (!selector) continue
      const el = document.querySelector<HTMLElement>(selector)
      const r = el?.getBoundingClientRect()
      found[selector] = r && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null
    }
    setTargets(found)
  }, [all])

  // A step whose target is not on screen is dropped: a menu item the person does not have (wide screens
  // only, as the menu is a drawer on a phone), or a dashboard block that is not in this sector's layout.
  // When the data blocks are missing because the account has no data yet, one "what you will see after an
  // import" step takes their place; a layout that simply has other blocks (logistics) gets no such step.
  const steps = useMemo(() => {
    if (!settled) return all

    const out: GuideStep[] = []
    let droppedData = false

    for (const s of all) {
      const selector = selectorFor(s)
      const missing = selector !== null && targets[selector] === null

      if (missing && s.nav && narrow && !s.needsRow) {
        out.push(s)
        continue
      }

      if (missing) {
        if (s.needsData) droppedData = true
        continue
      }

      out.push(s)
    }

    if (droppedData && empty) out.splice(1, 0, previewStep(tx))

    return out
  }, [all, targets, narrow, settled, empty, tx])

  useLayoutEffect(() => {
    if (!open) return
    measure()
  }, [open, measure, index])

  useEffect(() => {
    if (!open) return

    let frame = 0
    const again = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    window.addEventListener("resize", again)
    // The dashboard scrolls inside its own panel: follow it so the ring stays on its block.
    window.addEventListener("scroll", again, true)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", again)
      window.removeEventListener("scroll", again, true)
    }
  }, [open, measure])

  const finish = useCallback(() => {
    try {
      localStorage.setItem(GUIDE_DONE_KEY, "1")
    } catch {
      /* A blocked localStorage just lets the tour offer itself again. */
    }
    setIndex(0)
    setPart("menu")
    setQueue([])
    onClose()
  }, [onClose])

  const step = steps[Math.min(index, steps.length - 1)]
  const last = index >= steps.length - 1

  const isList = part === "list"

  const go = useCallback(
    (delta: number) => {
      if (isList) return

      if (delta > 0 && last) {
        markPartsSeen([part as PartId])

        // Another part follows: carry on into it.
        if (queue.length > 0) {
          setSettled(false)
          setPart(queue[0])
          setQueue(queue.slice(1))
          setIndex(0)
          return
        }

        return finish()
      }

      if (delta < 0 && index === 0 && fromList) {
        setPart("list")
        setQueue([])
        setSeen(readSeenParts())
        return
      }

      setIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)))
    },
    [isList, last, part, queue, index, fromList, finish, steps.length],
  )

  /** The deeper chapter: the dashboard, then what to import. */
  function goDeeper() {
    setSettled(false)
    setQueue(["import"])
    setPart("dashboard")
    setIndex(0)
  }

  function pickPart(id: PartId) {
    setSettled(false)
    setFromList(true)
    setQueue([])
    setPart(id)
    setIndex(0)
  }

  /** Every part, in order, from the menu to sites. */
  function playAll() {
    setSettled(false)
    setFromList(false)
    setQueue(["dashboard", "import", "tracking", "sites"])
    setPart("menu")
    setIndex(0)
  }

  // On entering a step: open its view, bring its block into view, and measure again once the page has settled.
  const stepId = step?.id
  const stepView = step?.view
  const stepSelector = step ? selectorFor(step) : null
  const stepIsNav = !!step?.nav

  useEffect(() => {
    if (!open || !stepId) return

    if (stepView && view !== stepView) {
      setSettled(false)
      onNavigate(stepView)
    }

    const timers = [0, 150, 500, 1000].map((ms) =>
      setTimeout(() => {
        if (ms === 150 && stepSelector && !stepIsNav) {
          document
            .querySelector(stepSelector)
            ?.scrollIntoView({ block: window.matchMedia("(max-width: 767px)").matches ? "start" : "center", behavior: "smooth" })
        }

        measure()
        if (ms === 1000) setSettled(true)
      }, ms),
    )

    return () => timers.forEach(clearTimeout)
    // `view` is read at entry only: leaving the view would otherwise restart the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepId, stepView, stepSelector, stepIsNav, part, measure])

  useEffect(() => {
    if (!open) return
    next.current?.focus()
  }, [open, index, part])

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

  const vw = typeof window === "undefined" ? 1280 : window.innerWidth
  const vh = typeof window === "undefined" ? 800 : window.innerHeight
  const selector = selectorFor(step)
  const target = selector && !(step.nav && narrow) ? targets[selector] ?? null : null

  // Where the robot and its card stand:
  //  side    - to the right of a menu item, arm out to the left
  //  left    - to the left of a small block on the right edge (the import button), arm out to the right
  //  float   - top or bottom of the screen, on the side with more room, for a big block
  //  centre  - hello, goodbye and the explaining steps that point at nothing
  //  sheet   - the bottom of a phone screen
  const small = !!target && target.width < 220 && target.height < 120
  const placement =
    narrow ? "sheet" : !target ? "centre" : step.nav ? "side" : small && target.left > vw * 0.55 ? "left" : "float"
  const centred = placement === "centre"

  let place: React.CSSProperties | undefined

  if (target && placement === "side") {
    place = {
      left: target.left + target.width + GAP,
      top: Math.max(12, Math.min(vh - 250, target.top + target.height / 2 - ROBO_W * 0.6)),
    }
  } else if (target && placement === "left") {
    place = {
      right: vw - (target.left - GAP),
      top: Math.max(12, Math.min(vh - 250, target.top + target.height / 2 - ROBO_W * 0.6)),
    }
  } else if (target && placement === "float") {
    const room = { top: target.top, bottom: vh - (target.top + target.height) }
    place = {
      left: "50%",
      transform: "translateX(-50%)",
      ...(room.top > room.bottom ? { top: 16 } : { bottom: 16 }),
    }
  }

  const cornerGlow = { filter: "drop-shadow(0 0 12px var(--robo-glow))" }
  const roboClass = cn(
    "shrink-0 text-black animate-[robo-pop_0.45s_cubic-bezier(0.2,1.4,0.4,1)]",
    centred ? "-mb-6 h-40 w-[134px]" : narrow ? "-mb-6 h-28 w-[94px]" : "h-[170px] w-[142px]",
  )

  return (
    <div
      className="fixed inset-0 z-[80]"
      data-testid="guide-buddy"
      data-step={step.id}
      data-pose={step.pose}
      data-chapter={part === "menu" ? "quick" : part === "dashboard" || part === "import" ? "deep" : part}
      data-placement={placement}
    >
      {/* Hello and goodbye dim the page behind the card. A pointing step dims it through the ring's
          own shadow, so the block it points at stays lit; on a phone with nothing to ring, the page
          is dimmed here. Neither blocks a click, so the page stays usable. */}
      {centred && <div className="absolute inset-0 bg-black/35" onClick={finish} aria-hidden="true" />}
      {narrow && !target && <div className="pointer-events-none absolute inset-0 bg-black/30" aria-hidden="true" />}

      {target && (
        <div
          className="pointer-events-none absolute rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.38)] ring-2 ring-[color:var(--brand)] ring-offset-2 ring-offset-transparent transition-all duration-300 ease-out"
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
          placement === "left" && "flex-row-reverse",
        )}
        style={place}
      >
        {placement === "left" ? (
          // Mirrored on a wrapper, so the pop animation on the robot itself keeps its own transform.
          <span className="shrink-0" style={{ transform: "scaleX(-1)" }}>
            <RoboFigure pose={step.pose} className={roboClass} style={cornerGlow} />
          </span>
        ) : (
          <RoboFigure pose={step.pose} className={roboClass} style={cornerGlow} />
        )}

        {isList ? (
          <PartsCard
            tx={tx}
            seen={seen}
            width={narrow ? "100%" : PARTS_W}
            onPick={pickPart}
            onPlayAll={playAll}
            onSkip={finish}
          />
        ) : (
        <div
          className="squircle shrink-0 rounded-[22px] border border-border bg-card p-4 text-card-foreground shadow-xl"
          style={{ width: narrow ? "100%" : CARD_W }}
          data-testid="guide-card"
        >
          <div className="text-sm font-semibold">{step.title}</div>
          <p className="mt-1 text-[13px] leading-snug text-card-foreground/85">{step.body}</p>

          {step.chips && (
            <div className="mt-2 flex flex-wrap gap-1" data-testid="guide-chips">
              {step.chips.map((column) => (
                <code key={column} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/85">
                  {column}
                </code>
              ))}
            </div>
          )}

          {step.bullets && (
            <ul className="mt-2 space-y-1" data-testid="guide-bullets">
              {step.bullets.map((line) => {
                const cut = line.indexOf(" : ") > -1 ? line.indexOf(" : ") : line.indexOf(": ")
                const name = cut > 0 ? line.slice(0, cut) : ""

                return (
                  <li key={line} className="text-xs leading-snug text-card-foreground/85">
                    {name && <span className="font-semibold text-foreground">{name}{tx(" : ", ": ")}</span>}
                    {name ? line.slice(cut).replace(/^ ?: ?/, "") : line}
                  </li>
                )
              })}
            </ul>
          )}

          {step.example && <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{step.example}</p>}

          {last && part === "menu" && queue.length === 0 && (
            <button
              type="button"
              onClick={goDeeper}
              data-testid="guide-deeper"
              className="mt-3 w-full rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Aller plus loin : le tableau de bord et les données", "Go deeper: the dashboard and your data")}
            </button>
          )}

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
              {(index > 0 || fromList) && (
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
                {last && queue.length === 0 ? tx("Terminer", "Done") : tx("Suivant", "Next")}
              </button>
            </span>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

/** The list a returning visitor picks a part from. */
function PartsCard({
  tx,
  seen,
  width,
  onPick,
  onPlayAll,
  onSkip,
}: {
  tx: ReturnType<typeof useTx>
  seen: PartId[]
  width: number | string
  onPick: (id: PartId) => void
  onPlayAll: () => void
  onSkip: () => void
}) {
  return (
    <div
      className="squircle shrink-0 rounded-[22px] border border-border bg-card p-4 text-card-foreground shadow-xl"
      style={{ width }}
      data-testid="guide-card"
      data-parts=""
    >
      <div className="text-sm font-semibold">{tx("Content de vous revoir. Choisissez une partie.", "Welcome back. Pick a part.")}</div>
      <p className="mt-1 text-[13px] leading-snug text-card-foreground/85">
        {tx("Chaque partie est courte. Allez à celle qu'il vous faut.", "Every part is short. Jump to the one you need.")}
      </p>

      <ul className="mt-3 space-y-1.5">
        {partCards(tx).map((card, i) => {
          const done = seen.includes(card.id)

          return (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => onPick(card.id)}
                data-testid="guide-part"
                data-part={card.id}
                data-seen={done ? "true" : "false"}
                className="flex w-full items-center gap-2.5 rounded-2xl border border-border bg-muted/40 px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    done ? "bg-brand text-[#141414]" : "bg-foreground text-brand",
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-tight">{card.title}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    {card.hint} · {card.minutes} min
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                    done ? "bg-muted text-muted-foreground" : "bg-brand text-[#141414]",
                  )}
                >
                  {done ? tx("Revoir", "Replay") : tx("Commencer", "Start")}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="whitespace-nowrap text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tx("Passer la visite", "Skip tour")}
        </button>
        <button
          type="button"
          onClick={onPlayAll}
          data-testid="guide-play-all"
          className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tx("Tout lire", "Play all parts")}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {tx("Rouvrez cette liste depuis « Aide et retours », bouton « Visite guidée ».", "Open this list any time from \"Help & feedback\", button \"Take the tour\".")}
      </p>
    </div>
  )
}
