"use client"

import type { ReactNode } from "react"
import { useEnter } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

/** One step of the onboarding wizard, entering from the side it is on
 *  (transitions.dev's page side-by-side, enter half: app/transitions.css).
 *  Render it with `key={step}` so each step mounts fresh and plays. */
export function StepSlide({
  direction,
  className,
  children,
}: {
  direction: "forward" | "back"
  className?: string
  children: ReactNode
}) {
  const shown = useEnter("is-shown")

  return (
    <div data-step-slide="" data-direction={direction} className={cn("t-step", shown, className)}>
      {children}
    </div>
  )
}
