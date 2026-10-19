import type { Metadata } from "next"

import { FieldTaskPage } from "@/components/sentria/field-task-page"

/* The field page (F-CONTRACTOR): public, opened from a text. It must not be
   indexed, and its address, which holds the credential, must not leak to any
   site through a referrer. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return <FieldTaskPage token={token} />
}
