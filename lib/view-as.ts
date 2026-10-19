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
