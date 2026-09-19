/**
 * A string that exists in both languages.
 *
 * Its own module, with no imports at all, because lib/locale.ts holds
 * catalogues that need pairs and lib/i18n/index.ts needs locale.ts for
 * LanguageCode. Putting `localized` in index.ts made that a cycle, and a
 * cycle through a module that exports a runtime function is the kind of
 * thing that works until a bundler reorders it.
 *
 * Everything here is either a type or a two-line constructor. Anything
 * that needs to know which language is current lives in index.ts.
 */

/** A string in both languages. For module-level catalogues, which are
 *  built outside React and so cannot call a hook. */
export type Localized = { fr: string; en: string }

export function localized(fr: string, en: string): Localized {
  return { fr, en }
}

/** Resolve a pair. The signature requires both languages, which is what
 *  makes a missing translation unwriteable rather than merely detectable. */
export type Tx = (fr: string, en: string) => string
