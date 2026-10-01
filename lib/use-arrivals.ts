import { useEffect, useRef, useState } from "react"

/** The ids that showed up after the list was first on screen, so a new card
 *  can pop in instead of teleporting into place.
 *
 *  The first non-empty list is the baseline: nothing in it "arrives", so
 *  opening the page doesn't animate every card at once. An id stays in the
 *  returned set once it has arrived (a CSS animation only plays when the
 *  element first mounts, so keeping the class costs nothing). */
export function useArrivals(ids: string[]): Set<string> {
  const known = useRef<Set<string> | null>(null)
  const [arrivals, setArrivals] = useState<Set<string>>(() => new Set())
  const signature = ids.join("\u0000")

  useEffect(() => {
    const list = signature ? signature.split("\u0000") : []

    if (known.current === null) {
      if (list.length > 0) known.current = new Set(list)
      return
    }

    const seen = known.current
    const added = list.filter((id) => !seen.has(id))
    if (added.length === 0) return

    added.forEach((id) => seen.add(id))
    setArrivals((current) => new Set([...current, ...added]))
  }, [signature])

  return arrivals
}
