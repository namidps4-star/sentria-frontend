/* Crash reports (LAUNCH-READY C): when the app breaks for a real person, Sentry
 * gets where and what, so the founder can fix it before anyone writes in.
 *
 * Switched off until NEXT_PUBLIC_SENTRY_DSN is set on Vercel. Even then nothing
 * is loaded or sent until the person has said yes to the same banner as the
 * usage statistics (lib/analytics.ts); Settings takes it back.
 *
 * Rules that are not optional, the same as analytics:
 *  - No names, emails, company names, file contents or typed text. The event
 *    keeps the error type, a cleaned message and the stack. The address is cut
 *    to its path, the user, request, breadcrumbs and contexts are dropped.
 *  - No breadcrumbs: they record clicked text and request URLs with filters.
 *  - No replay, no performance traces. The SDK sends no personal data by default,
 *    and the scrub below removes what could carry it.
 *  - Only the integrations that catch a crash. */

import { CONSENT_EVENT, readConsent } from "@/lib/analytics"

const DSN = (process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim()

type Sentry = typeof import("@sentry/browser")

let client: Sentry | null = null
let starting: Promise<void> | null = null

export function errorTrackingConfigured(): boolean {
  return DSN.length > 0
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g
const LONG_NUMBER = /\+?\d[\d\s().-]{6,}\d/g
const LONG_TOKEN = /[A-Za-z0-9_\-.~]{24,}/g
const MAX_MESSAGE = 200

/** A message with anything that looks like an email, a phone number or a token
 *  hidden, and cut short. Our own errors are generic; a library's may quote a value. */
export function scrubText(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(LONG_TOKEN, "[token]")
    .replace(LONG_NUMBER, "[number]")
    .slice(0, MAX_MESSAGE)
}

type SentryLikeEvent = {
  message?: string
  exception?: { values?: { value?: string }[] }
  request?: unknown
  user?: unknown
  breadcrumbs?: unknown
  contexts?: unknown
  extra?: unknown
}

/** Sentry's beforeSend: keep what broke, drop who it broke for. */
export function scrubEvent<T extends object>(input: T, pathname = "/"): T {
  const event = input as unknown as SentryLikeEvent

  if (typeof event.message === "string") event.message = scrubText(event.message)

  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === "string") value.value = scrubText(value.value)
  }

  delete event.user
  delete event.breadcrumbs
  delete event.extra
  delete event.contexts
  event.request = { url: pathname.split("?")[0] }

  return input
}

/** Load Sentry and start reporting, when a DSN is set and the person said yes. */
export function startErrorTracking(): Promise<void> {
  if (!errorTrackingConfigured() || readConsent() !== "granted") return Promise.resolve()
  if (client) return Promise.resolve()
  if (starting) return starting

  starting = import("@sentry/browser").then((sentry) => {
    sentry.init({
      dsn: DSN,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
      tracesSampleRate: 0,
      maxBreadcrumbs: 0,
      defaultIntegrations: false,
      integrations: [sentry.globalHandlersIntegration(), sentry.linkedErrorsIntegration(), sentry.dedupeIntegration()],
      beforeSend: (event) => scrubEvent(event, window.location.pathname),
    })
    client = sentry
  })

  return starting
}

/** Stop reporting at once (the person took their yes back). */
export function stopErrorTracking(): void {
  if (!client) return

  void client.close()
  client = null
  starting = null
}

/** Report a crash the error pages caught. `reference` is the code the person
 *  saw on the screen, so the report and the person's message match. */
export function reportError(error: unknown, reference?: string): void {
  if (!client) return

  client.withScope((scope) => {
    if (reference) scope.setTag("reference", reference)

    client?.captureException(error)
  })
}

/** Follow the consent answer: start on yes, stop on no. */
export function followConsent(): () => void {
  const sync = () => {
    if (readConsent() === "granted") void startErrorTracking()
    else stopErrorTracking()
  }

  sync()
  window.addEventListener(CONSENT_EVENT, sync)

  return () => window.removeEventListener(CONSENT_EVENT, sync)
}
