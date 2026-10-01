import { useEffect, useState } from "react"

/** The transitions.dev menu dropdown and modal (app/transitions.css) work
 *  through state classes on an element that stays mounted: `.is-open` to
 *  show, then `.is-closing` for the close duration before it resets. Their
 *  JavaScript toggles those by hand; this is that orchestration for React,
 *  where the element is rendered only while it is open.
 *
 *  Render the element while `present` is true and add `className` to it:
 *    - opening: it mounts in its resting (closed) look, and two frames later
 *      gets `.is-open`, so the transition has something to start from;
 *    - closing: it keeps `.is-closing` for the close duration, then
 *      `present` turns false and it unmounts. The duration is read from the
 *      same CSS variable the transition uses, so they cannot drift apart.
 *  With "reduce motion" the transitions are off, so it unmounts at once. */
type Phase = "closed" | "open" | "closing"

type CloseVariable = "--dropdown-close-dur" | "--modal-close-dur"

/** A CSS time as milliseconds. The production build minifies `150ms` to
 *  `.15s`, so both spellings have to be read; anything else is NaN. */
function toMs(value: string): number {
  const text = value.trim()
  const number = parseFloat(text)
  if (text.endsWith("ms")) return number
  if (text.endsWith("s")) return number * 1000
  return Number.NaN
}

function closeMs(variable: CloseVariable): number {
  if (typeof window === "undefined") return 0
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0
  const ms = toMs(getComputedStyle(document.documentElement).getPropertyValue(variable))
  return Number.isFinite(ms) && ms >= 0 ? ms : 150
}

export function usePresence(open: boolean, closeVariable: CloseVariable) {
  const [present, setPresent] = useState(open)
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed")

  useEffect(() => {
    if (open) {
      setPresent(true)
      let second = 0
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setPhase("open"))
      })
      return () => {
        cancelAnimationFrame(first)
        cancelAnimationFrame(second)
      }
    }

    setPhase((current) => (current === "closed" ? "closed" : "closing"))
    const timer = window.setTimeout(() => {
      setPhase("closed")
      setPresent(false)
    }, closeMs(closeVariable))
    return () => window.clearTimeout(timer)
  }, [open, closeVariable])

  return {
    present,
    className: phase === "open" ? "is-open" : phase === "closing" ? "is-closing" : "",
  }
}

/** For something that is only ever rendered while it is open (a popover or a
 *  dialog its parent mounts): the state class to add, "" on the first
 *  render and `shown` two frames later, so the entrance plays on mount. It
 *  has no exit: the parent unmounts it. */
export function useEnter(shown: "is-open" | "is-shown" = "is-open"): string {
  const [on, setOn] = useState(false)

  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setOn(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])

  return on ? shown : ""
}
