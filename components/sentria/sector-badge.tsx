"use client"

import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { SECTORS } from "./onboarding-modal"

/** One pastel tone per industry, from the theme's tag tokens so light and dark
 *  both read. Retail has no tag tone left, so it takes a chart colour. */
const TONE: Record<string, CSSProperties> = {
  industry: { background: "var(--tag-neutral-bg)", color: "var(--tag-neutral-fg)" },
  health: { background: "var(--tag-danger-bg)", color: "var(--tag-danger-fg)" },
  agriculture: { background: "var(--tag-success-bg)", color: "var(--tag-success-fg)" },
  transportation: { background: "var(--tag-warning-bg)", color: "var(--tag-warning-fg)" },
  logistics: { background: "var(--tag-info-bg)", color: "var(--tag-info-fg)" },
  energy: { background: "var(--tag-brand-bg)", color: "var(--tag-brand-fg)" },
  commerce: { background: "color-mix(in oklab, var(--series-6) 18%, transparent)", color: "var(--series-6)" },
}

export const sectorTone = (sector: string): CSSProperties => TONE[sector] ?? TONE.industry

/** The industry's icon on its own colour: the same mark wherever a site's
 *  industry is shown, so a person learns it once. */
export function SectorBadge({ sector, size = "md", className }: { sector: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = SECTORS.find((s) => s.id === sector)?.icon

  if (!Icon) return null

  const box = size === "sm" ? "h-6 w-6 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-9 w-9 rounded-xl"
  const glyph = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-[18px] w-[18px]"

  return (
    <span className={cn("flex shrink-0 items-center justify-center", box, className)} style={sectorTone(sector)} aria-hidden="true">
      <Icon className={glyph} />
    </span>
  )
}
