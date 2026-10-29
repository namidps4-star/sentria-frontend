"use client"

import { useReportWebVitals } from "next/web-vitals"

import { track } from "@/lib/analytics"
import { vitalEvent } from "@/lib/web-vitals"

/* Renders nothing. Reports how fast each page loaded and responded (see lib/web-vitals.ts). */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const event = vitalEvent(metric)
    if (event) track(event)
  })

  return null
}
