"use client"

import { useEffect, useRef, useState } from "react"

/** How long a number takes to settle. A number is read, not waited for, so
 *  it stays short; the rest of the motion layer is 150-200 ms. */
const DURATION_MS = 450

/** Whole numbers only. Money, percentages and anything with a unit is shown
 *  as it comes, so a count-up can never garble a formatted figure. */
const WHOLE_NUMBER = /^\d+$/

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
}

/** A KPI number that counts up to its value on first load and, when the
 *  value changes later (a refresh), from the number on screen to the new
 *  one. Not on every re-render: the effect depends on the target alone.
 *  With "reduce motion" on, the number is simply shown. */
export function CountUp({ value }: { value: string | number }) {
  const text = String(value)
  const target = WHOLE_NUMBER.test(text) ? Number(text) : null
  const [shown, setShown] = useState<number | null>(() =>
    target === null || prefersReducedMotion() ? target : 0
  )
  const current = useRef<number | null>(shown)

  useEffect(() => {
    if (target === null || prefersReducedMotion()) {
      current.current = target
      setShown(target)
      return
    }

    const from = current.current ?? 0
    if (from === target) return

    const startedAt = performance.now()
    let frame = 0

    const tick = (now: number) => {
      // requestAnimationFrame can hand over a timestamp a hair earlier than
      // the performance.now() taken just before it: never let progress go negative.
      const progress = Math.min(1, Math.max(0, (now - startedAt) / DURATION_MS))
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = progress === 1 ? target : Math.round(from + (target - from) * eased)
      current.current = next
      setShown(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return <>{shown === null ? text : shown}</>
}
