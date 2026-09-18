/**
 * The translator.
 *
 * Forty lines instead of a library, on purpose.
 *
 * next-intl and next-i18next are built around locale-segmented routing
 * (/en/..., /fr/...) and server components. This app builds two routes,
 * "/" and "/_not-found": it is a client-rendered shell whose locale
 * lives in localStorage and is read after mount. Those libraries would
 * be fighting the shape of the app rather than helping it.
 *
 * What a library would give and this does too: interpolation, a fallback
 * chain, one place to add a language.
 *
 * What this gives and a runtime library cannot: `en.ts` is typed against
 * `fr.ts`, so a missing English string is a BUILD ERROR rather than a
 * French word appearing in an English screen at 2am.
 */

import { en } from "./en"
import { fr } from "./fr"
import { useLocale, type LanguageCode } from "@/lib/locale"

export type MessageKey = keyof typeof fr

/** Only the languages the interface actually exists in.
 *
 *  Deliberately not every language in LANGUAGES: the other four are
 *  answered by the model, not rendered by us, and listing them here
 *  with French values would be the decorative-picker bug again in a new
 *  shape. lib/locale.ts's uiLanguage() is what narrows a choice down to
 *  this set. */
const CATALOGUES: Partial<Record<LanguageCode, Record<MessageKey, string>>> = {
  fr,
  en,
}

/** Substitute {name}-style placeholders.
 *
 *  Anything the catalogue does not carry a value for is left as-is
 *  rather than blanked, so a missing parameter shows up as "{count}" in
 *  testing instead of disappearing silently. The backend shipped
 *  "(score {risk_score}/100)" to real users precisely because a
 *  swallowed interpolation looked like nothing was wrong. */
function interpolate(
  template: string,
  values?: Record<string, string | number>
): string {
  if (!values) return template

  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  )
}

export type Translate = (
  key: MessageKey,
  values?: Record<string, string | number>
) => string

/** Build a translator for a given UI language, outside React.
 *
 *  Used by the hook below, and available on its own for anything that
 *  needs a label without being a component. */
export function translator(ui: LanguageCode): Translate {
  const catalogue = CATALOGUES[ui] ?? fr

  return (key, values) => interpolate(catalogue[key] ?? fr[key], values)
}

/** The hook every component uses.
 *
 *  `ui` comes from useLocale(), which already narrows the operator's
 *  chosen language to one the interface exists in. So selecting Kiswahili
 *  gives Kiswahili answers from SentrIA and a French interface, and this
 *  hook is where that narrowing takes effect.
 */
export function useT(): Translate {
  const { ui } = useLocale()

  return translator(ui)
}

/* --------------------------------------------------------------------------
 * Bulk translation: tx()
 *
 * The catalogue above is right for strings used in more than one place:
 * the nav, the view titles, the repeated buttons. It is the wrong tool for
 * the other thousand, which are prose that appears exactly once.
 *
 * Per string, the catalogue costs four edits: invent a key, add it to
 * fr.ts, add it to en.ts, replace the usage. Across ~1050 strings that is
 * 4200 edits and 1050 key names nobody will ever look up.
 *
 * tx("Coûts", "Costs") costs one edit, and it keeps the guarantee that
 * matters in a stronger form than the catalogue does: the SIGNATURE
 * requires both languages. You cannot add a French string without its
 * English, because the function does not compile without it. The
 * catalogue catches a missing key at build time; this makes a missing
 * translation unwriteable.
 *
 * It also reviews better. A reviewer sees both languages on one line
 * instead of holding a key in their head across two files.
 * -------------------------------------------------------------------------- */

/** A string that exists in both languages. For module-level catalogues
 *  (priorities, activities, the metric definitions) that are built
 *  outside a React render and so cannot call a hook. */
export type Localized = { fr: string; en: string }

export function localized(fr: string, en: string): Localized {
  return { fr, en }
}

/** Resolve a Localized outside React. */
export function pick(text: Localized, ui: LanguageCode): string {
  return ui === "en" ? text.en : text.fr
}

export type Tx = (fr: string, en: string) => string

/** Resolve a pair outside React, when the language is already known. */
export function txFor(ui: LanguageCode): Tx {
  return (frText, enText) => (ui === "en" ? enText : frText)
}

/** The hook for view bodies.
 *
 *  Reads the same narrowed ui language as useT(), so a language whose
 *  interface does not exist still renders French.
 */
export function useTx(): Tx {
  const { ui } = useLocale()

  return txFor(ui)
}
