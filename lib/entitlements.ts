import { API_BASE, apiFetch } from "@/lib/api"
import { applyEntitlements } from "@/lib/plans"

/** P-TIER: the app follows the plan table the API serves (GET /plans).
 *
 *  The last answer is kept in this browser (it isn't personal: the same
 *  for everyone), so a reload shows the right numbers before the network
 *  answers; and if the API is down, the last known table still applies.
 *  With neither, the defaults bundled in lib/plans.ts stay. */
const CACHE_KEY = "sentria_plan_table"

export async function refreshEntitlements(): Promise<void> {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) applyEntitlements(JSON.parse(cached))
  } catch {
    /* no storage, or an unreadable copy: carry on */
  }

  try {
    const res = await apiFetch(`${API_BASE}/plans`)
    if (!res.ok) return
    const body = await res.json()
    if (applyEntitlements(body)) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(body))
      } catch {
        /* no storage */
      }
    }
  } catch (error) {
    console.warn("[SentrIA] Plan table unavailable, using the last known one:", error)
  }
}
