/** F-SUPPRESS: tell the backend what people do with an alert.
 *
 *  "dismissed" = set aside as not useful. "acted" = put in progress or
 *  marked done. The backend keeps the log per company and, when the same
 *  alert on the same asset is dismissed again and again, lowers it from
 *  Critical to Warning on the next upload (pipeline/suppression.py).
 *
 *  Fire and forget: a failed log must never get in the way of the action
 *  the person just took. */

import { API_BASE, apiFetch } from "@/lib/api"

export type AlertFeedback = "dismissed" | "acted"

export function sendAlertFeedback(
  alertKey: string | null | undefined,
  equipment: string | null | undefined,
  action: AlertFeedback
): void {
  if (!alertKey || !equipment) return

  apiFetch(`${API_BASE}/alerts/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alert_key: alertKey, equipment, action }),
  }).catch((error) => {
    console.warn("[SentrIA] Alert feedback was not recorded.", error)
  })
}
