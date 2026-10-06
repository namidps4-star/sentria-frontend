import type { CSSProperties } from "react"

/** The last place in the dashboard's entrance. Blocks further down than this
 *  all come in with it, so the page never takes more than a second to settle. */
export const MAX_ENTER = 9

/** Where a block sits in the entrance (`.t-enter` in app/transitions.css): 0
 *  rises first, and each step is a beat later. Fractions are fine: tiles in a
 *  row take 0.4 apart, rows take 1. */
export function enterAt(index: number): CSSProperties {
  return { "--i": Math.min(Math.max(index, 0), MAX_ENTER) } as CSSProperties
}

/* The data motion inside a block (a number counting, a line growing, the ring
   sweeping, a bar filling) should begin when the block does. Most of the time
   it does: the data arrives after the page has come in. When the data is
   already there (coming back to the dashboard) it is drawn in the same frame
   as its block, and would play behind a block that has not started to rise,
   so it waits for the block. */

function isEntrance(animation: Animation): boolean {
  return "animationName" in animation && (animation as CSSAnimation).animationName === "t-enter"
}

/** Milliseconds until every block of the entrance around `el` has started to
 *  rise: 0 when none of them is waiting. */
export function entranceWait(el: Element | null): number {
  let wait = 0

  for (let node = el; node; node = node.parentElement) {
    for (const animation of node.getAnimations?.() ?? []) {
      if (!isEntrance(animation)) continue
      const delay = Number(animation.effect?.getTiming().delay ?? 0)
      const time = Number(animation.currentTime ?? 0)
      if (time < delay) wait = Math.max(wait, delay - time)
    }
  }

  return wait
}

const pushedBack = new WeakSet<Animation>()

/** A ref callback for an element that plays one of our `t-` animations (or
 *  holds some below it): they start when the blocks around them do. */
export function waitForEntrance(el: Element | null): void {
  if (!el) return

  const wait = entranceWait(el)
  if (wait <= 0) return

  for (const animation of el.getAnimations({ subtree: true })) {
    const name = "animationName" in animation ? String((animation as CSSAnimation).animationName) : ""
    if (!name.startsWith("t-") || name === "t-enter" || pushedBack.has(animation) || !animation.effect) continue

    pushedBack.add(animation)
    animation.effect.updateTiming({ delay: Number(animation.effect.getTiming().delay ?? 0) + wait })
  }
}
