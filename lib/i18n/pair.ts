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

/** Resolve a pair that might not be there.
 *
 *  Every catalogue in this app is indexed by a key that came from
 *  somewhere else: a server row, a localStorage value written by an older
 *  build, an alert_key the frontend has not been taught yet. TypeScript
 *  types `Record<K, V>[k]` as V, not V | undefined, so it cannot warn
 *  about the miss.
 *
 *  Before the catalogues held pairs, a miss rendered as nothing, which
 *  was survivable. Reading `.fr` off the miss throws and takes the whole
 *  view down with it, so every resolver goes through here: a missing
 *  label degrades to the fallback, or to blank, and the screen stays up.
 */
export function resolve(
  text: Localized | undefined | null,
  tx: Tx,
  fallback = ""
): string {
  if (!text) return fallback

  return tx(text.fr, text.en)
}
