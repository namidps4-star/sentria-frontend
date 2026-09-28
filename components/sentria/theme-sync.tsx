"use client"

import { useLayoutEffect } from "react"

// Re-applies the saved theme after hydration, which resets <html> classes.
export function ThemeSync() {
  useLayoutEffect(() => {
    let theme = "light"
    try {
      if (localStorage.getItem("sentria-theme") === "dark") theme = "dark"
    } catch {}
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.classList.toggle("light", theme === "light")
  }, [])

  return null
}
