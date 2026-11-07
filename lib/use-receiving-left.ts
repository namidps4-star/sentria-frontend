"use client"

import { useEffect, useState } from "react"

import { RECEIVING_CHANGED, checkedCount, readSaved } from "@/lib/receiving"

/** How many rows of the kept Receiving check are still to look at, for the sidebar's count.
 *  Read after mount (it lives in localStorage), and again when the list changes here or in another tab. */
export function useReceivingLeft(): number {
  const [left, setLeft] = useState(0)

  useEffect(() => {
    const read = () => {
      const saved = readSaved()
      setLeft(saved ? Math.max(0, saved.list.flagged - checkedCount(saved.list.items, saved.ticks)) : 0)
    }

    read()
    window.addEventListener(RECEIVING_CHANGED, read)
    window.addEventListener("storage", read)

    return () => {
      window.removeEventListener(RECEIVING_CHANGED, read)
      window.removeEventListener("storage", read)
    }
  }, [])

  return left
}
