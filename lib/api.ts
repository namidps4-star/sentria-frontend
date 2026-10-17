import { activeSiteId } from "./active-site"
import { supabase } from "./supabase"

/**
 * Single source of truth for the backend base URL.
 *
 * This constant used to be declared twice — once in dashboard-view.tsx and
 * once in ask-view.tsx. When the backend moved from Railway to Render only
 * the dashboard copy was updated, so Ask AI went on calling the dead
 * Railway host. The dashboard kept loading alerts and recommendations
 * normally, which is exactly why the failure looked like "the AI is
 * broken" rather than "the chat is pointed at the wrong server".
 *
 * Every view imports this now, so the URL can only ever be wrong in one
 * place. Override per environment with NEXT_PUBLIC_API_URL (useful for
 * pointing the UI at a local backend while debugging).
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://sentria-8btn.onrender.com"

/** The routes that answer for one site (F-SITESCOPE): alerts, recommendations,
 *  uploads and Ask. The active site rides along on them, so no view has to
 *  remember to ask for it. */
/** `url` with the active site on it, when it is a route that answers for one
 *  site. Unchanged for any other, and when there is no active site. */
export function withActiveSite(input: string): string {
  const site = activeSiteId()

  if (!site) return input

  try {
    const url = new URL(input)

    if (/\/(alerts|recommendations|upload)$/.test(url.pathname) && !url.searchParams.has("site_id")) {
      url.searchParams.set("site_id", site)

      return url.toString()
    }
  } catch {
    /* not a URL: sent as it is */
  }

  return input
}

function forActiveSite(input: string, init: RequestInit): [string, RequestInit] {
  const site = activeSiteId()

  if (!site) return [input, init]

  try {
    const url = new URL(input)

    if (/\/(alerts|recommendations|upload)$/.test(url.pathname)) {
      return [withActiveSite(input), init]
    }

    if (/\/ask$/.test(url.pathname) && typeof init.body === "string") {
      const body = JSON.parse(init.body)

      if (body && typeof body === "object" && !Array.isArray(body) && !("site_id" in body)) {
        return [input, { ...init, body: JSON.stringify({ ...body, site_id: site }) }]
      }
    }
  } catch {
    /* not a URL or not JSON: sent as it is */
  }

  return [input, init]
}

/** fetch() for the SentrIA API, signed in (S-3).
 *
 *  Adds the user's Supabase session token: the API answers only to a
 *  signed-in user, and only with their own company's data. getSession()
 *  hands back a refreshed token when the old one has expired. */
export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers)

  try {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token

    if (token) headers.set("Authorization", `Bearer ${token}`)
  } catch (error) {
    console.error("[SentrIA] No session token for the API call:", error)
  }

  const [url, options] = forActiveSite(input, init)

  return fetch(url, { ...options, headers })
}
