"use client"

import { useEffect, useState, type ReactNode } from "react"

/** The landing text meant for search engines. It is in the server HTML, and
 *  it goes away once the page runs in a browser: the screen then shows the
 *  same words itself, and a screen reader must not read them twice, in two
 *  languages, or on top of the signed-in app. */
export function CrawlerIntro({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true)

  useEffect(() => {
    setShown(false)
  }, [])

  return shown ? <div className="sr-only">{children}</div> : null
}
