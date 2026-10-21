import { useCallback, useLayoutEffect, useRef } from "react"

/** For a read of text the server writes in a language (alerts, recommendations).
 *
 *  `start()` marks a new read and returns a check to call when the answer
 *  arrives. The check says no when a newer read has started since, or when the
 *  `key` (the language, the site) is no longer the one the read was asked
 *  under. So a French answer that lands after the person switched to English is
 *  dropped, and so is a slow answer from an earlier site.
 *
 *  Pass everything the read depends on in `key`, for example `${lang}|${site}`. */
export function useLatestRead(key: string) {
  const sequence = useRef(0)
  const current = useRef(key)

  // Before the effects of the same render, so a read started there sees the new key.
  useLayoutEffect(() => {
    current.current = key
  }, [key])

  return useCallback((): (() => boolean) => {
    const mine = ++sequence.current
    const askedUnder = current.current

    return () => mine === sequence.current && askedUnder === current.current
  }, [])
}
