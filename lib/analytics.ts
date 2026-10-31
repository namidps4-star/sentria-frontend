/* Product analytics (F-ANALYTICS): which screens and steps people use, so the
 * founder can see where they drop off. PostHog, in the EU region by default.
 *
 * Switched off until NEXT_PUBLIC_POSTHOG_KEY is set on Vercel. Even then,
 * nothing is loaded or sent until the person has said yes (the banner in
 * components/sentria/analytics-consent.tsx, and Settings to take it back).
 *
 * Rules that are not optional:
 *  - Events carry only the small typed values below. Never a name, an email,
 *    a company, a file name, an equipment name or any text a person typed.
 *  - No autocapture (it records the text of what was clicked).
 *  - No person profiles and no identify(): the events are anonymous. Per-user
 *    tracking waits for a reason and a legal text that says so.
 *  - Session replay is off. NEXT_PUBLIC_POSTHOG_REPLAY=1 turns it on, always
 *    with every input and all text masked: the screens show business data. */

const KEY = (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").trim()
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com").trim()
const REPLAY = process.env.NEXT_PUBLIC_POSTHOG_REPLAY === "1"

export const CONSENT_KEY = "sentria_analytics_consent"
export const CONSENT_EVENT = "sentria:analytics-consent"

export type Consent = "granted" | "denied" | null

/** The only events there are. Add one here before sending it. */
export type AnalyticsEvent =
  | { name: "view_opened"; view: string }
  | { name: "onboarding_step"; step: number }
  | { name: "onboarding_done" }
  | { name: "upload_result"; result: "done" | "refused" | "failed" }
  // Page timings: a number and a rating, no page or person (lib/web-vitals.ts).
  | { name: "web_vital"; metric: "CLS" | "FCP" | "INP" | "LCP" | "TTFB"; value: number; rating: "good" | "needs-improvement" | "poor" }

type PostHog = typeof import("posthog-js").default

let client: PostHog | null = null
let starting: Promise<void> | null = null

/** Is a PostHog key set for this build? When false, nothing here does anything. */
export function analyticsConfigured(): boolean {
  return KEY.length > 0
}

export function readConsent(): Consent {
  try {
    const value = localStorage.getItem(CONSENT_KEY)

    return value === "granted" || value === "denied" ? value : null
  } catch {
    return null
  }
}

/** Load PostHog and start sending, when a key is set and the person said yes. */
export function startAnalytics(): Promise<void> {
  if (!analyticsConfigured() || readConsent() !== "granted") return Promise.resolve()
  if (client) {
    client.opt_in_capturing()
    return Promise.resolve()
  }
  if (starting) return starting

  starting = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      person_profiles: "identified_only",
      respect_dnt: true,
      persistence: "localStorage",
      disable_session_recording: !REPLAY,
      session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    })
    client = posthog
  })

  return starting
}

/** Record the answer, and start or stop at once. */
export function setConsent(value: "granted" | "denied"): void {
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    /* storage blocked: the answer lasts until the page closes */
  }

  if (value === "granted") {
    void startAnalytics()
  } else if (client) {
    client.opt_out_capturing()
    client.reset()
  }

  window.dispatchEvent(new Event(CONSENT_EVENT))
}

/** Send one event. Does nothing without a key, without a yes, or before the
 *  library has loaded. */
export function track(event: AnalyticsEvent): void {
  if (!client || readConsent() !== "granted") return

  const { name, ...props } = event

  client.capture(name, props)
}
