"use client"

import { useEffect } from "react"

import { ErrorPage } from "@/components/sentria/status-page"

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
  }, [error])

  return <ErrorPage digest={error.digest} retry={retry} />
}
