import type { AnalyticsEvent } from "@/lib/analytics"

/* Page timings (LAUNCH-READY C): how fast a real person's page loads and
 * responds. Sent as a typed analytics event, so the same consent and key rules
 * apply: nothing leaves the browser without a yes to the banner.
 *
 * Only the numbers and the rating go out. No address, no names, no view. */

export type WebVitalEvent = Extract<AnalyticsEvent, { name: "web_vital" }>

type Vital = WebVitalEvent["metric"]

const REPORTED: readonly string[] = ["CLS", "FCP", "INP", "LCP", "TTFB"]

export type MetricLike = { name: string; value: number; rating?: string }

/** The analytics event for one measurement, or null for a metric we do not
 *  report (FID is replaced by INP; it is kept out on purpose). */
export function vitalEvent(metric: MetricLike): WebVitalEvent | null {
  if (!REPORTED.includes(metric.name) || !Number.isFinite(metric.value) || metric.value < 0) return null

  const rating = metric.rating === "good" || metric.rating === "poor" ? metric.rating : "needs-improvement"

  // CLS is a score with no unit: three decimals. The rest are milliseconds.
  const value = metric.name === "CLS" ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value)

  return { name: "web_vital", metric: metric.name as Vital, value, rating }
}
