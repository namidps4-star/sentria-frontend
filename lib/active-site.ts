/* The site the app is showing (F-SITESCOPE).
 *
 * Kept apart from lib/sites.ts so lib/api.ts can read it without importing the
 * sites store, which itself calls the API. It lives only in this browser: a
 * second device keeps its own. */

export const ACTIVE_SITE_KEY = "sentria_active_site"

/** Sent when the active site, or the list of sites, changes. A view that
 *  shows a site's data fetches again on it. */
export const SITES_CHANGED_EVENT = "sentria-sites-changed"

/** Sent when the account is cleared (sign out): the sites held in memory
 *  belong to the person who left. */
export const SITES_RESET_EVENT = "sentria-sites-reset"

export function activeSiteId(): string | null {
  if (typeof window === "undefined") return null

  try {
    return localStorage.getItem(ACTIVE_SITE_KEY) || null
  } catch {
    return null
  }
}

/** Remembers the active site. Returns true when it changed. */
export function rememberActiveSite(id: string | null): boolean {
  if (activeSiteId() === id) return false

  try {
    if (id) localStorage.setItem(ACTIVE_SITE_KEY, id)
    else localStorage.removeItem(ACTIVE_SITE_KEY)
  } catch {
    /* storage blocked: the app goes on with the company's first site */
  }

  return true
}

const ADD_SITE_HINT = "sentria_add_site_hint"

/** Asks the Sites page to open "Add a site" as it opens (the top-bar menu's
 *  "Add a site"). Read once. */
export function requestAddSiteOnOpen() {
  try {
    sessionStorage.setItem(ADD_SITE_HINT, "1")
  } catch {
    /* no storage: the page opens on its list */
  }
}

export function takeAddSiteHint(): boolean {
  try {
    const asked = sessionStorage.getItem(ADD_SITE_HINT) === "1"

    if (asked) sessionStorage.removeItem(ADD_SITE_HINT)

    return asked
  } catch {
    return false
  }
}
