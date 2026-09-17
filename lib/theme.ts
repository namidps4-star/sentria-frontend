/**
 * Theme resolution.
 *
 * globals.css already had all three layers in place: `:root` for light,
 * `.dark` for an explicit dark choice, and
 * `@media (prefers-color-scheme: dark) { :root:not(.light) }` for
 * following the system. Nothing used them, because layout.tsx hardcoded
 * `class="light"` on <html>, which made `:not(.light)` never match and
 * pinned the app to light regardless of the tokens or the setting. The
 * "Mode sombre" switch in Settings flipped a local boolean that was
 * never read.
 *
 * The class is set by an inline script before first paint (see
 * THEME_INIT_SCRIPT) rather than from React, so there is no flash of
 * the wrong theme and no server/client mismatch to suppress.
 */

export type Theme = "light" | "dark" | "system"

export const THEME_KEY = "sentria_theme"

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

/** Put the right class on <html>. "system" clears both classes so the
 *  media query in globals.css takes over. */
export function applyThemeClass(theme: Theme) {
  const root = document.documentElement

  root.classList.remove("light", "dark")

  if (theme === "dark") root.classList.add("dark")
  else if (theme === "light") root.classList.add("light")
}

export function readTheme(): Theme {
  if (typeof window === "undefined") return "system"

  try {
    const stored = localStorage.getItem(THEME_KEY)

    return isTheme(stored) ? stored : "system"
  } catch {
    return "system"
  }
}

export function writeTheme(theme: Theme) {
  applyThemeClass(theme)

  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* A blocked localStorage still leaves the class applied for this
       page, so the switch works even if the choice cannot be kept. */
  }

  window.dispatchEvent(new Event("sentria_theme_updated"))
}

/** What the user actually sees right now, with "system" resolved. */
export function resolvedTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme

  if (typeof window === "undefined") return "light"

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

/** Runs in <head> before the first paint. Kept dependency-free and
 *  wrapped in try/catch so a blocked localStorage cannot stop the page
 *  from rendering. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var r=document.documentElement;r.classList.remove("light","dark");if(t==="dark"){r.classList.add("dark")}else if(t==="light"){r.classList.add("light")}}catch(e){}})();`
