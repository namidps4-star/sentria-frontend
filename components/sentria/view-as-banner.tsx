"use client"

import { useEffect, useState } from "react"

import { Eye } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { readViewAs, setViewAs, type ViewAs } from "@/lib/view-as"

/* Shown the whole time SentrIA staff are looking at a company (S-3). It says
 * whose data this is and that nothing can be changed, and ends the view. */
export function ViewAsBanner() {
  const tx = useTx()
  const [target, setTarget] = useState<ViewAs | null>(null)

  useEffect(() => setTarget(readViewAs()), [])

  if (!target) return null

  return (
    <div
      role="status"
      data-testid="view-as-banner"
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <Eye className="h-4 w-4" aria-hidden="true" />
        {tx(`Vous regardez ${target.name || "une entreprise"} (lecture seule)`, `You are viewing ${target.name || "a company"} (read only)`)}
      </span>
      <button
        type="button"
        data-testid="view-as-exit"
        onClick={() => {
          setViewAs(null)
          window.location.assign("/")
        }}
        className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tx("Quitter", "Exit")}
      </button>
    </div>
  )
}
