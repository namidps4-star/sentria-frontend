/* SentrIA staff looking at one company, read only (S-3).
 *
 * The choice lives in sessionStorage, so it ends with the tab. apiFetch sends it
 * as X-View-As; the API checks that the caller is staff and that the company
 * exists, and refuses every write while it is set. */

const KEY = "sentria_view_as"

export type ViewAs = { company_id: string; name: string }

export function readViewAs(): ViewAs | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null

    if (parsed && typeof parsed.company_id === "string" && parsed.company_id) {
      return { company_id: parsed.company_id, name: typeof parsed.name === "string" ? parsed.name : "" }
    }
  } catch {
    /* no storage: not viewing */
  }

  return null
}

export function setViewAs(target: ViewAs | null) {
  try {
    // Starting or ending a view: the next load reads the account's own saved
    // settings again, not whatever the other company's sites left in this
    // browser (lib/site-config.ts writes a site's sector over the account's).
    window.localStorage.removeItem("sentria_account_owner")
    window.localStorage.removeItem("sentria_base_config")

    if (target) window.sessionStorage.setItem(KEY, JSON.stringify(target))
    else window.sessionStorage.removeItem(KEY)
  } catch {
    /* no storage: nothing to remember */
  }
}

/* How SentrIA staff preview the app (the founder's switch): as the company's
 * boss, or as one of its employees on the sites named. Read only, like View
 * as, and ended with the tab. The server answers as that role (X-View-As-Owner
 * or X-View-As-Employee) and no staff powers come with it; this only keeps the
 * screens in step with it. Founder is no preview at all. */

const ROLE_KEY = "sentria_role_view"

export type RoleView = { role: "boss" } | { role: "employee"; sites: string[] }

export function readRoleView(): RoleView | null {
  try {
    const raw = window.sessionStorage.getItem(ROLE_KEY)
    const parsed = raw ? JSON.parse(raw) : null

    if (parsed?.role === "boss") return { role: "boss" }

    if (parsed?.role === "employee" && Array.isArray(parsed.sites)) {
      return { role: "employee", sites: parsed.sites.filter((s: unknown): s is string => typeof s === "string" && s.length > 0) }
    }
  } catch {
    /* no storage: no preview */
  }

  return null
}

export function setRoleView(view: RoleView | null) {
  try {
    // The same as View as: the saved settings are read again, never written from
    // what a preview shows (lib/account.ts keeps the sync off while it is set).
    window.localStorage.removeItem("sentria_account_owner")
    window.localStorage.removeItem("sentria_base_config")

    if (view) window.sessionStorage.setItem(ROLE_KEY, JSON.stringify(view))
    else window.sessionStorage.removeItem(ROLE_KEY)
  } catch {
    /* no storage: nothing to remember */
  }
}
