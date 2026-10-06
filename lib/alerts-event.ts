/** Fired once new alerts have been saved (a CSV upload finished), so the
 *  chrome outside the dashboard, the bell in the top bar, reads them now
 *  instead of at the next page change. */
export const ALERTS_UPDATED_EVENT = "sentria_alerts_updated"

export function announceAlertsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ALERTS_UPDATED_EVENT))
  }
}
