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

import { useEffect, useState } from "react"

import type { Tx } from "@/lib/i18n/pair"

export const COMPANY_NAME_KEY = "sentria_company_name"
export const TIMEZONE_KEY = "sentria_timezone"

/** Announced whenever the name or the zone changes. The top bar is
 *  mounted for the whole session, so without this it would keep showing
 *  the name the page was loaded with after Settings saved a new one. */
export const COMPANY_UPDATED_EVENT = "sentria_company_updated"

function announce() {
  try {
    window.dispatchEvent(new Event(COMPANY_UPDATED_EVENT))
  } catch {
    /* Not a browser, or events are blocked. Nothing to announce to. */
  }
}

/** A company's initials, so an avatar is not stamped with the initials
 *  of a person who does not exist. Two words at most: "Groupe Sahel
 *  Logistique" reads better as GS than GSL. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("")
}

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
/* Zone abbreviations, city names and IANA identifiers. The same
   characters in every language: "GMT (Cotonou, Dakar, Abidjan)" does not
   translate, and "Africa/Abidjan" must not.
 *
 * i18n-ignore-start: zone abbreviations, city names and IANA ids */
export const TIMEZONES: TimezoneOption[] = [
  { id: "gmt", label: "GMT (Cotonou, Dakar, Abidjan)", zone: "Africa/Abidjan" },
  { id: "wat", label: "WAT (Lagos, Kinshasa)", zone: "Africa/Lagos" },
  { id: "cet", label: "CET (Paris, Lyon)", zone: "Europe/Paris" },
  { id: "eat", label: "EAT (Nairobi)", zone: "Africa/Nairobi" },
  { id: "brt", label: "BRT (São Paulo)", zone: "America/Sao_Paulo" },
]
/* i18n-ignore-end */

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

  announce()
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

  announce()
}

export function timezoneFor(id: string): TimezoneOption {
  return TIMEZONES.find((t) => t.id === id) ?? TIMEZONES[0]
}

/** Format a timestamp in the company's zone, so "bloqué depuis 14 h"
 *  and the date next to it agree with the operator's own clock. */
export function formatInCompanyZone(
  iso: string,
  tx: Tx,
  id: string = readTimezoneId()
): string {
  const date = new Date(iso)

  if (!Number.isFinite(date.getTime())) return ""

  const locale = tx("fr-FR", "en-GB")

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezoneFor(id).zone,
    }).format(date)
  } catch {
    return date.toLocaleString(locale)
  }
}

/** The company identity for a client view.
 *
 *  Reading localStorage during the first render desynchronises the
 *  server and client markup, which is how the hydration mismatches
 *  earlier in this branch happened, so both values are read after mount
 *  and every view that shows them goes through here rather than keeping
 *  its own copy of the pattern.
 */
export function useCompanyIdentity(): { name: string; timezoneId: string } {
  const [identity, setIdentity] = useState({ name: "", timezoneId: "" })

  useEffect(() => {
    const sync = () =>
      setIdentity({ name: readCompanyName(), timezoneId: readTimezoneId() })

    sync()

    /* The custom event covers a save in this tab, "storage" covers a
       save in another one. */
    window.addEventListener(COMPANY_UPDATED_EVENT, sync)
    window.addEventListener("storage", sync)

    return () => {
      window.removeEventListener(COMPANY_UPDATED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return identity
}
