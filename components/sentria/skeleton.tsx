import { cn } from "@/lib/utils"

/* --------------------------------------------------------------------------
 * Placeholders for what has not arrived yet (F-VIZPREMIUM).
 *
 * The dashboard used to draw its figures from empty arrays until the first
 * fetch resolved, so for a beat every KPI read 0 and the chart said "No
 * alerts in this period", which looks like good news. These hold the place
 * instead, at the real tile's size so nothing jumps when the numbers land.
 * They pulse softly; with "reduce motion" they sit still.
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

/** The KPI tiles of the dashboard while the alerts load. `card` is the
 *  generic dashboard's tile, `tight` the compact tile of the industry and
 *  logistics overviews. */
export function KpiSkeleton({
  count,
  variant,
}: {
  count: number
  variant: "card" | "tight"
}) {
  return (
    <>
      {Array.from({ length: Math.max(1, count) }, (_, index) =>
        variant === "card" ? (
          <div
            key={index}
            data-kpi-skeleton=""
            className="rounded-3xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>

            <Skeleton className="mt-3 h-9 w-16" />
            <Skeleton className="mt-2 h-9 w-full" />
          </div>
        ) : (
          <div key={index} data-kpi-skeleton="" className="bg-card px-4 py-3">
            {/* A real tile's label can take one line or two, so its top row
                is 24 or 40 px tall: this is in between. */}
            <div className="flex min-h-7 items-center justify-between gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-10 rounded-full" />
            </div>

            <Skeleton className="mt-1.5 h-7 w-14" />
            <Skeleton className="mt-1.5 h-7 w-full" />
          </div>
        )
      )}
    </>
  )
}
