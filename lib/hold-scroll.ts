/** Keeps `anchor` at the same place on screen while the page around it
 *  changes (B-13: the dashboard slid while an upload's results came in).
 *
 *  Every size change of the scrolling content moves the scroll by as much
 *  as the anchor moved, before the frame is painted, so nothing jumps.
 *  The user scrolling ends the hold, and so does the returned release(). */
export function holdInPlace(anchor: HTMLElement | null): () => void {
  if (!anchor || typeof ResizeObserver === "undefined") return () => {}

  // The app shell's <main> scrolls, not the document.
  let scroller: HTMLElement | null = anchor.parentElement

  while (scroller) {
    const { overflowY } = getComputedStyle(scroller)
    if (overflowY === "auto" || overflowY === "scroll") break
    scroller = scroller.parentElement
  }

  const target =
    scroller ?? (document.scrollingElement as HTMLElement | null)

  if (!target) return () => {}

  const top = anchor.getBoundingClientRect().top

  const correct = () => {
    if (!anchor.isConnected) return
    const delta = anchor.getBoundingClientRect().top - top
    if (Math.abs(delta) >= 1) target.scrollTop += delta
  }

  const observer = new ResizeObserver(correct)
  for (const child of Array.from(target.children)) observer.observe(child)

  const userEvents = ["wheel", "touchmove", "keydown", "pointerdown"] as const

  const release = () => {
    observer.disconnect()
    for (const type of userEvents) {
      window.removeEventListener(type, release, true)
    }
  }

  for (const type of userEvents) {
    window.addEventListener(type, release, { capture: true, passive: true })
  }

  return release
}
