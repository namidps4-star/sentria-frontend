/**
 * The frontend and the backend spell one sector differently.
 *
 * Onboarding calls it "commerce". The pipeline's dispatcher branches on
 * `sector == "retail"`, and `SECTORS.get(sector, check_industry)` sends
 * anything it does not recognise to the industry checks, which have
 * nothing to say about a shop. So a retail CSV uploaded from the app
 * landed, succeeded, and produced zero alerts.
 *
 * It cuts the other way too: all thirteen retail checks call
 * `fire(..., "retail", ...)`, so every alert comes back stamped
 * "retail" while the dashboard filters on "commerce". Even with the
 * upload fixed, picking Commerce on the dashboard would have shown an
 * empty list.
 *
 * Renaming one side to match the other would be cleaner and is the
 * right end state. It is not this change: "commerce" is written into
 * every user's localStorage, into PRIORITIES_BY_SECTOR, into
 * ACTIVITIES_BY_SECTOR and into the calendar, and a rename that misses
 * one of them silently empties a view. This translates at the two
 * points where the two vocabularies actually meet, and nowhere else.
 */

/** Sector ids this app uses, mapped to what the API calls them. */
const TO_API: Record<string, string> = {
  commerce: "retail",
}

/** The inverse, built from the same table so the two cannot drift. */
const FROM_API: Record<string, string> = Object.fromEntries(
  Object.entries(TO_API).map(([ours, theirs]) => [theirs, ours])
)

/** Our sector id, in the spelling the API expects. Pass-through for
 *  every sector whose name already agrees. */
export function toApiSector(sector: string): string {
  return TO_API[sector] ?? sector
}

/** The API's sector id, in our spelling. */
export function fromApiSector(sector: string | null | undefined): string {
  if (!sector) return ""

  return FROM_API[sector] ?? sector
}

/** An alert as the API returned it, with its sector translated.
 *
 *  Applied on the way in, so nothing downstream has to know the API
 *  spells this differently. */
export function withOurSector<T extends { sector?: string | null }>(
  alert: T
): T {
  return { ...alert, sector: fromApiSector(alert.sector) }
}
