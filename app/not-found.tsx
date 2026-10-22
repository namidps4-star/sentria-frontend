import type { Metadata } from "next"

import { NotFoundPage } from "@/components/sentria/status-page"

export const metadata: Metadata = {
  title: "SentrIA",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return <NotFoundPage />
}
