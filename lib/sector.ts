// lib/sector.ts

/**
 * Sector keys are not the same on both sides of the wire.
 *
 * The UI calls the retail sector "commerce". The backend, in
 * pipeline/alerts.py's SECTORS dict and check_retail(), calls it
 * "retail". Every sector that uses different words on the two sides
 * has to be listed here TWICE: once in the UI→API direction
 * (toApiSector) and once in the API→UI direction (withOurSector).
 *
 * Missing one direction is exactly the bug this file exists to prevent.
 * An upload tagged "commerce" whose sector is not translated before it
 * reaches run_pipeline() falls through check_equipment()'s default
 * branch, gets processed by check_industry(), finds no "Torque [Nm]"
 * column, and returns ["OK"] for every row. Zero alerts saved, no error
 * logged, dashboard shows an empty sector.
 */

const UI_TO_API: Record<string, string> = {
  commerce: "retail",
  // Add every other pair as you find it. Check by curling /alerts and
  // comparing the distinct `sector` values against the SECTORS array in
  // dashboard-view.tsx.
}

const API_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(UI_TO_API).map(([ui, api]) => [api, ui])
)

/** UI sector key -> backend sector key. Identity when no pair is known,
 *  so a new sector added on both sides just works. */
export function toApiSector(sector: string): string {
  return UI_TO_API[sector] ?? sector
}

/** Backend row -> row whose `sector` field speaks the UI's vocabulary.
 *  Identity when no pair is known. Rows without a sector are passed
 *  through untouched. */
export function withOurSector<T extends { sector?: string | null }>(row: T): T {
  if (!row.sector) return row

  const mapped = API_TO_UI[row.sector]

  return mapped ? { ...row, sector: mapped } : row
}