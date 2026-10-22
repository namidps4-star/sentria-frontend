"use client"

import { useEffect } from "react"

import { ErrorPage } from "@/components/sentria/status-page"
import { reportError } from "@/lib/error-tracking"

/* A render error inside the app. The reference is Next's own digest: it
   matches the line in the server log and holds no user data. */
export default function Error({
  error,
  retry,
}: {
  error: globalThis.Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
    reportError(error, error.digest)
  }, [error])

  return <ErrorPage digest={error.digest} retry={retry} />
}
