/**
 * The company SentrIA is watching.
 *
 * The name and the timezone already had fields in Settings, but the name
 * was a hardcoded defaultValue and the timezone a select with no state:
 * neither was ever read back or saved. Onboarding never asked for
 * either, so a report or an Ask SentrIA answer had nothing to call the
 * customer but "votre entreprise", and every hour-based threshold was
 * read against whatever clock the browser happened to be in.
 *
 * These two are here because the product consumes them. A free-text
 * "describe your business" field is not: the sector, the activities and
 * the priorities already say that in a form the pipeline can read.
 */

export const COMPANY_NAME_KEY = "sentria_company_name"
export const TIMEZONE_KEY = "sentria_timezone"

export type TimezoneOption = {
  id: string
  label: string
  /** IANA zone, so a date can actually be formatted in it. */
  zone: string
}

/** The zones SentrIA's own operations sit in. Each carries a real IANA
 *  identifier rather than an abbreviation, because "WAT" cannot be
 *  handed to Intl.DateTimeFormat and an abbreviation alone would leave
 *  the setting decorative, which is what it was. */
export const TIMEZONES: TimezoneOption[] = [
  { id: "gmt", label: "GMT (Cotonou, Dakar, Abidjan)", zone: "Africa/Abidjan" },
  { id: "wat", label: "WAT (Lagos, Kinshasa)", zone: "Africa/Lagos" },
  { id: "cet", label: "CET (Paris, Lyon)", zone: "Europe/Paris" },
  { id: "eat", label: "EAT (Nairobi)", zone: "Africa/Nairobi" },
  { id: "brt", label: "BRT (São Paulo)", zone: "America/Sao_Paulo" },
]

export function readCompanyName(): string {
  if (typeof window === "undefined") return ""

  try {
    return localStorage.getItem(COMPANY_NAME_KEY) ?? ""
  } catch {
    return ""
  }
}

export function writeCompanyName(name: string) {
  try {
    const trimmed = name.trim()

    if (trimmed) localStorage.setItem(COMPANY_NAME_KEY, trimmed)
    else localStorage.removeItem(COMPANY_NAME_KEY)
  } catch {
    /* A blocked localStorage must not break the form. */
  }
}

/** The stored zone id, defaulting to whatever the browser reports so a
 *  first-time user is not silently put on the wrong clock. */
export function readTimezoneId(): string {
  if (typeof window === "undefined") return TIMEZONES[0].id

  try {
    const stored = localStorage.getItem(TIMEZONE_KEY)

    if (stored && TIMEZONES.some((t) => t.id === stored)) return stored
  } catch {
    /* fall through to detection */
  }

  return detectTimezoneId()
}

export function detectTimezoneId(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone

    return TIMEZONES.find((t) => t.zone === zone)?.id ?? TIMEZONES[0].id
  } catch {
    return TIMEZONES[0].id
  }
}

export function writeTimezoneId(id: string) {
  try {
    if (TIMEZONES.some((t) => t.id === id)) {
      localStorage.setItem(TIMEZONE_KEY, id)
    }
  } catch {
    /* ignore */
  }
}

export function timezoneFor(id: string): TimezoneOption {
  return TIMEZONES.find((t) => t.id === id) ?? TIMEZONES[0]
}

/** Format a timestamp in the company's zone, so "bloqué depuis 14 h"
 *  and the date next to it agree with the operator's own clock. */
export function formatInCompanyZone(
  iso: string,
  id: string = readTimezoneId()
): string {
  const date = new Date(iso)

  if (!Number.isFinite(date.getTime())) return ""

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezoneFor(id).zone,
    }).format(date)
  } catch {
    return date.toLocaleString("fr-FR")
  }
}
