/**
 * Language and country.
 *
 * Two separate axes, kept separate on purpose. Deriving one from the
 * other is the classic mistake: an operator in Cotonou may want French,
 * one in Lagos English, one in Dakar may prefer Wolof and accept
 * French. Country tells us what money looks like; language tells us what
 * words to use.
 *
 *
 * What each language actually gets you
 * ------------------------------------
 *
 * Six languages are offered and they do NOT all mean the same thing,
 * which is why every entry carries `uiReady`.
 *
 *   "full"     the interface exists in this language, end to end
 *   "partial"  the chrome does, the view bodies do not yet
 *   "none"     Ask SentrIA answers in it, the interface does not
 *
 * "partial" exists because English is genuinely halfway: navigation,
 * view titles, search and account labels come from lib/i18n (53 keys),
 * while about 1079 strings inside the views are still French. Calling
 * that "full" would be the decorative-picker bug again, and calling it
 * "none" would hide working English navigation from the market that
 * needs it. The picker states which of the three it is.
 *
 * Ask SentrIA works in all six because the model generates the answer:
 * there is nothing to translate and nothing to mistranslate. The
 * interface is ~1100 strings of operational instruction, and a machine
 * pass over "chaîne du froid rompue, vérifiez l'intégrité des produits"
 * produces confident, wrong advice about someone's cold chain. So the
 * interface ships in the languages a human has actually written, and the
 * picker says which is which rather than implying six.
 *
 * Before this existed, the Settings picker offered all six and stored
 * nothing: `useState("fr")`, never read by any other screen. It was
 * decorative, exactly like the timezone select before it.
 *
 *
 * Why country means currency
 * --------------------------
 *
 * The euro was hardcoded in the cost views while the backend has always
 * read a currency per row. The figures in those views are rates the
 * OPERATOR TYPES THEMSELVES in logistics-cost-view, so the currency is a
 * label on their own numbers: no conversion happens and none is implied.
 * A Lagos operator entering 45000 for immobilisation means naira, and
 * stamping a euro sign on it was simply false.
 */

import { useEffect, useState } from "react"

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

export const LANGUAGE_KEY = "sentria_language"
export const COUNTRY_KEY = "sentria_country"

/** Announced on every write, so chrome that stays mounted for the whole
 *  session picks up a change made in Settings without a reload. */
export const LOCALE_UPDATED_EVENT = "sentria_locale_updated"

function announce() {
  try {
    window.dispatchEvent(new Event(LOCALE_UPDATED_EVENT))
  } catch {
    /* Not a browser, or events are blocked. */
  }
}

/* ------------------------------------------------------------------ */
/*  Languages                                                          */
/* ------------------------------------------------------------------ */

export type LanguageCode = "fr" | "en" | "es" | "pt" | "ar" | "sw"

/** How much of the interface exists in a language. See the file header:
 *  "partial" is a real state, not a placeholder. */
export type UiCoverage = "full" | "partial" | "none"

export type Language = {
  code: LanguageCode
  label: string
  region: string
  uiReady: UiCoverage
  /** Right to left. Arabic needs a layout pass, not a string pass, so
   *  this is recorded rather than acted on globally. */
  rtl?: boolean
}

export const LANGUAGES: Language[] = [
  { code: "fr", label: "Français", region: "France · Afrique", uiReady: "full" },
  { code: "en", label: "English", region: "Global", uiReady: "partial" },
  { code: "es", label: "Español", region: "Amériques", uiReady: "none" },
  { code: "pt", label: "Português", region: "Brésil · Angola", uiReady: "none" },
  {
    code: "ar",
    label: "العربية",
    region: "Maghreb",
    uiReady: "none",
    rtl: true,
  },
  {
    code: "sw",
    label: "Kiswahili",
    region: "Afrique de l'Est",
    uiReady: "none",
  },
]

export const DEFAULT_LANGUAGE: LanguageCode = "fr"

export function languageFor(code: string | null | undefined): Language {
  return (
    LANGUAGES.find((language) => language.code === code) ??
    LANGUAGES.find((language) => language.code === DEFAULT_LANGUAGE)!
  )
}

/** Which language the interface is drawn in.
 *
 *  Never the language the operator picked when the interface does not
 *  exist in it: an Arabic selection means Arabic answers from SentrIA
 *  and a French interface, and pretending otherwise would render a
 *  half-translated screen. */
export function uiLanguage(code: string | null | undefined): LanguageCode {
  const language = languageFor(code)

  /* "partial" still renders: English navigation beats French
     navigation for an English speaker, and the picker says the view
     bodies are not translated yet. Only "none" falls back. */
  return language.uiReady === "none" ? DEFAULT_LANGUAGE : language.code
}

/** What the picker should say each option actually gives you. */
export function languagePromise(language: Language): string {
  if (language.uiReady === "full") {
    return "Interface et réponses SentrIA"
  }

  if (language.uiReady === "partial") {
    return `Navigation en ${language.label} · contenu encore en français`
  }

  return `SentrIA répond en ${language.label} · interface en français`
}

export function readLanguage(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE

  try {
    const stored = localStorage.getItem(LANGUAGE_KEY)

    if (stored && LANGUAGES.some((language) => language.code === stored)) {
      return stored as LanguageCode
    }
  } catch {
    /* fall through to detection */
  }

  return detectLanguage()
}

/** The browser's language, when it is one we offer. Better than
 *  defaulting an English speaker to French on their first visit. */
export function detectLanguage(): LanguageCode {
  try {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const base = String(tag).slice(0, 2).toLowerCase()

      const match = LANGUAGES.find((language) => language.code === base)

      if (match) return match.code
    }
  } catch {
    /* ignore */
  }

  return DEFAULT_LANGUAGE
}

export function writeLanguage(code: string) {
  try {
    if (LANGUAGES.some((language) => language.code === code)) {
      localStorage.setItem(LANGUAGE_KEY, code)
    }
  } catch {
    /* A blocked localStorage must not break the form. */
  }

  announce()
}

/* ------------------------------------------------------------------ */
/*  Countries and money                                                */
/* ------------------------------------------------------------------ */

export type Currency = {
  code: string
  /** What goes next to the number on screen. */
  symbol: string
}

export type Country = {
  code: string
  name: string
  currency: Currency
  /** The zone id from lib/company.ts to default the timezone to, so a
   *  country choice fills the clock in rather than leaving it on
   *  whatever the browser happened to report. */
  timezoneId: string
}

const XOF: Currency = { code: "XOF", symbol: "F CFA" }
const XAF: Currency = { code: "XAF", symbol: "FCFA" }
const EUR: Currency = { code: "EUR", symbol: "€" }

/** The markets the product's own timezone list already implies, plus an
 *  explicit fallback. Not a world list: an option nobody can serve is
 *  the same defect as a language nobody translated. */
export const COUNTRIES: Country[] = [
  { code: "BJ", name: "Bénin", currency: XOF, timezoneId: "gmt" },
  { code: "CI", name: "Côte d'Ivoire", currency: XOF, timezoneId: "gmt" },
  { code: "SN", name: "Sénégal", currency: XOF, timezoneId: "gmt" },
  { code: "TG", name: "Togo", currency: XOF, timezoneId: "gmt" },
  {
    code: "GH",
    name: "Ghana",
    currency: { code: "GHS", symbol: "₵" },
    timezoneId: "gmt",
  },
  {
    code: "NG",
    name: "Nigeria",
    currency: { code: "NGN", symbol: "₦" },
    timezoneId: "wat",
  },
  { code: "CM", name: "Cameroun", currency: XAF, timezoneId: "wat" },
  {
    code: "CD",
    name: "RD Congo",
    currency: { code: "CDF", symbol: "FC" },
    timezoneId: "wat",
  },
  {
    code: "KE",
    name: "Kenya",
    currency: { code: "KES", symbol: "KSh" },
    timezoneId: "eat",
  },
  {
    code: "TZ",
    name: "Tanzanie",
    currency: { code: "TZS", symbol: "TSh" },
    timezoneId: "eat",
  },
  {
    code: "MA",
    name: "Maroc",
    currency: { code: "MAD", symbol: "DH" },
    timezoneId: "cet",
  },
  { code: "FR", name: "France", currency: EUR, timezoneId: "cet" },
  {
    code: "BR",
    name: "Brésil",
    currency: { code: "BRL", symbol: "R$" },
    timezoneId: "brt",
  },
  /* Named rather than silent. Somebody outside this list still gets a
     working product, and the euro is stated as the assumption it is
     instead of appearing as a fact. */
  { code: "XX", name: "Autre pays (euro)", currency: EUR, timezoneId: "gmt" },
]

export function countryFor(code: string | null | undefined): Country | undefined {
  return COUNTRIES.find((country) => country.code === code)
}

export function readCountryCode(): string {
  if (typeof window === "undefined") return ""

  try {
    return localStorage.getItem(COUNTRY_KEY) ?? ""
  } catch {
    return ""
  }
}

export function writeCountryCode(code: string) {
  try {
    if (COUNTRIES.some((country) => country.code === code)) {
      localStorage.setItem(COUNTRY_KEY, code)
    } else if (!code) {
      localStorage.removeItem(COUNTRY_KEY)
    }
  } catch {
    /* ignore */
  }

  announce()
}

/** The currency to label figures with.
 *
 *  Falls back to the euro when no country has been chosen, which is
 *  what the code did unconditionally before. The difference is that it
 *  is now a stated default rather than a hardcoded truth. */
export function currencyFor(code: string | null | undefined): Currency {
  return countryFor(code)?.currency ?? EUR
}

/** A figure with its symbol.
 *
 *  Grouped, never with decimals: these are exposures in the hundreds or
 *  thousands and a cent of precision on an estimate is noise dressed as
 *  accuracy. The symbol trails the number, which reads correctly for
 *  "1 240 F CFA" and acceptably for "1 240 €".
 */
export function formatMoney(value: number, currency: Currency): string {
  const rounded = Math.round(value)

  return `${rounded.toLocaleString("fr-FR")} ${currency.symbol}`
}

/* ------------------------------------------------------------------ */
/*  The hook every view uses                                           */
/* ------------------------------------------------------------------ */

export type LocaleState = {
  /** What the operator picked. Sent to SentrIA. */
  language: LanguageCode
  /** What the interface is actually drawn in. */
  ui: LanguageCode
  countryCode: string
  currency: Currency
}

/** Read after mount, like every other stored value in this app.
 *
 *  Reading localStorage during the first render is what produced the
 *  hydration mismatches earlier in this branch, so the initial state is
 *  the same on the server and the client and the real values arrive on
 *  the next tick. */
export function useLocale(): LocaleState {
  const [state, setState] = useState<LocaleState>({
    language: DEFAULT_LANGUAGE,
    ui: DEFAULT_LANGUAGE,
    countryCode: "",
    currency: EUR,
  })

  useEffect(() => {
    const sync = () => {
      const language = readLanguage()
      const countryCode = readCountryCode()

      setState({
        language,
        ui: uiLanguage(language),
        countryCode,
        currency: currencyFor(countryCode),
      })
    }

    sync()

    window.addEventListener(LOCALE_UPDATED_EVENT, sync)
    window.addEventListener("storage", sync)

    return () => {
      window.removeEventListener(LOCALE_UPDATED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return state
}
