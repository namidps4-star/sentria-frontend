"use client"

import { useEffect } from "react"

import { useTx } from "@/lib/i18n"
import { useLocale } from "@/lib/locale"

/**
 * The three things about the document itself that carry a language: the
 * tab title, the meta description, and the lang attribute a screen reader
 * picks its voice from.
 *
 * All three were hardcoded French, and none can be fixed in
 * app/layout.tsx: `metadata` and `<html lang>` there are evaluated when
 * the page is built, while the operator's choice lives in localStorage and
 * is read after mount. The static ones stay as the first-paint default,
 * and this corrects them once the choice is known.
 *
 *
 * Why an observer rather than one assignment
 * ------------------------------------------
 *
 * Two simpler versions of this were wrong, and both LOOKED right:
 *
 *  - `document.title = ...` in an effect. The framework writes <head>
 *    after hydration, so the assignment was overwritten inside the first
 *    second and the tab kept its French title.
 *
 *  - rendering a <title> element and letting React hoist it into <head>.
 *    React hoisted it, but did not dedupe it against the one the
 *    framework had already put there, leaving three <title> tags. The
 *    browser uses the first, which was still the French one.
 *
 * So the correction is re-applied whenever something changes it. The
 * observer fires only on an actual head mutation, which is a handful of
 * times per page load, and it cannot be raced by whatever writes last.
 */
export function DocumentLanguage() {
  const { ui } = useLocale()
  const tx = useTx()

  useEffect(() => {
    const title = tx(
      "SentrIA | Intelligence opérationnelle",
      "SentrIA | Operational intelligence"
    )

    const description = tx(
      "SentrIA : surveillance et intelligence prédictive des systèmes, équipements et opérations critiques.",
      "SentrIA: monitoring and predictive intelligence for critical systems, equipment and operations."
    )

    function apply() {
      document.documentElement.lang = ui

      /* Assigning document.title writes the FIRST <title> in the head,
         which is the one the browser shows. */
      if (document.title !== title) document.title = title

      const meta = document.querySelector('meta[name="description"]')

      if (meta && meta.getAttribute("content") !== description) {
        meta.setAttribute("content", description)
      }
    }

    apply()

    const observer = new MutationObserver(apply)

    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => observer.disconnect()
  }, [ui, tx])

  return null
}
