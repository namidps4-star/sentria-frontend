"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react"

import { entranceWait } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { PopNumber } from "./pop-number"

/* A whole number that counts up to its value, and follows it when it changes
   ("every number follows": the founder's reference video).

   The page keeps the real text: it is what a screen reader, a copy and a test
   read, and it is always the final value. While the number counts, that text
   is see-through and a CSS counter, driven by a transition on a registered
   integer (`--t-n`, app/transitions.css), is drawn over it. No timer, no
   re-render per frame. A value that is not a whole number, or a browser that
   cannot animate a registered property, gets the digit pop-in as before. */

const WHOLE = /^\d{1,9}$/

function canCount(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.registerProperty === "function"
}

const subscribe = () => () => {}
const server = () => false

export function CountNumber({ value, className }: { value: string | number; className?: string }) {
  const text = String(value)
  const whole = WHOLE.test(text)
  const target = whole ? Number(text) : 0
  const supported = useSyncExternalStore(subscribe, canCount, server)
  const root = useRef<HTMLSpanElement>(null)

  // What the counter is heading for. It starts at 0 and moves on to the value
  // two frames after the first paint, so the transition has a start to leave,
  // and not before the block it sits in has begun to show.
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!whole) return

    let second = 0
    let timer = 0

    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const wait = entranceWait(root.current)
        if (wait > 0) timer = window.setTimeout(() => setShown(target), wait)
        else setShown(target)
      })
    })

    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      window.clearTimeout(timer)
    }
  }, [whole, target])

  if (!whole || !supported) return <PopNumber value={text} className={className} />

  return (
    <span ref={root} className={cn("t-count", className)} data-count="">
      <span className="t-count-final">{text}</span>
      <span aria-hidden="true" className="t-count-live" style={{ "--t-n": shown } as CSSProperties} />
    </span>
  )
}
