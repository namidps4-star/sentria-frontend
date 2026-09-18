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
