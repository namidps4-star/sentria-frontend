/* How many alerts a list holds. One alert is one asset and one check
 * (equipment + alert_key), the same unit the upload reports (pipeline/alerts.py).
 * A file that repeats an asset in several rows still counts that asset once
 * per check, so every number on every screen agrees. */

export function countAlerts(
  rows: ReadonlyArray<{ equipment: string; alert_key?: string | null }>
): number {
  return new Set(rows.map((row) => `${row.equipment}\u0000${row.alert_key ?? ""}`)).size
}
