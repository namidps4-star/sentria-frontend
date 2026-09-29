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
  process.env.NEXT_PUBLIC_API_URL ?? "https://retail-nqu5.onrender.com"
  
  //"https://sentria-8btn.onrender.com"

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

  return fetch(input, { ...init, headers })
}
