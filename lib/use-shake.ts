"use client"

import { useCallback, useRef } from "react"

/** Returns `[ref, shake]`. Shakes the element in `ref` once: the .t-shake animation in
 *  app/transitions.css. Call `shake()` when a field refuses its input.
 *
 *  Put `ref` on an element whose className never depends on state. React
 *  rewrites a className that changed, which would drop the class in the middle
 *  of the shake. A plain wrapper around the input does the job. */
export function useShake<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)

  const shake = useCallback(() => {
    const element = ref.current
    if (!element) return

    element.classList.remove("t-shake")
    void element.offsetWidth // reflow, so the same animation can start again
    element.classList.add("t-shake")
    element.addEventListener("animationend", () => element.classList.remove("t-shake"), { once: true })
  }, [])

  return [ref, shake] as const
}
