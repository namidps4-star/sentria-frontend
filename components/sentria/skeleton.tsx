import { cn } from "@/lib/utils"

/* --------------------------------------------------------------------------
 * Placeholders for what has not arrived yet (F-VIZPREMIUM).
 *
 * The dashboard used to draw its figures from empty arrays until the first
 * fetch resolved, so for a beat every KPI read 0 and the chart said "No
 * alerts in this period", which looks like good news. These hold the place
 * instead, at the real tile's size so nothing jumps when the numbers land.
 * They pulse softly; with "reduce motion" they sit still. A KPI tile keeps its
 * label and its card and puts a placeholder only where the figure goes.
 * -------------------------------------------------------------------------- */

export function Skeleton({
  className,
  ...rest
}: {
  className?: string
  "data-chart-skeleton"?: string
}) {
  return (
    <div
      aria-hidden="true"
      data-skeleton=""
      {...rest}
      className={cn("animate-pulse rounded-lg bg-muted motion-reduce:animate-none", className)}
    />
  )
}
