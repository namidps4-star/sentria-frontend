"use client"

import { ArrowUpRight, Sparkles } from "@/lib/icons"
import { cn } from "@/lib/utils"
import {
  prioritiesFor,
  priorityDescription,
  priorityEdge,
  priorityGoal,
  priorityLabel,
  priorityMeta,
  type Sector,
} from "@/lib/priorities"
import { useTx } from "@/lib/i18n"

/* --------------------------------------------------------------------------
 * One rule, so the same selection never looks like two different features:
 *
 *   cards  = you have not picked a priority yet. This is the entry point,
 *            so each one gets room to say what it is for.
 *   pills  = you are already inside a priority. This is a switcher, so it
 *            stays out of the way and reuses the sector filter's chip
 *            language (active = solid foreground, like "Tous"/"Santé").
 *
 * Before this, the dashboard had five hand-rolled versions of those two
 * ideas: cards duplicated verbatim between industry and logistics, pills
 * duplicated between their drill-downs, plus a third bespoke capsule on
 * the main dashboard that only ever showed logistics. Sectors without a
 * drill-down showed nothing at all, so a pharmacist picked six priorities
 * during onboarding and never saw them again.
 * -------------------------------------------------------------------------- */

type PriorityNavProps = {
  sector: Sector | string | null | undefined
  /** Priority ids the user picked during onboarding, catalog-ordered. */
  ids: string[]
}

/** Grid of entry cards for a sector overview. */
export function PriorityCards({
  sector,
  ids,
  onOpen,
  emptyLabel,
}: PriorityNavProps & {
  onOpen: (id: string) => void
  emptyLabel: string
}) {
  const tx = useTx()

  if (ids.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ids.map((id, index) => {
        const Icon = priorityMeta(sector, id)?.icon
        const edge = priorityEdge(sector, id, tx)
        // The first one leads, in lime; the others are white.
        const lead = index === 0

        return (
          <button
            key={id}
            type="button"
            onClick={() => onOpen(id)}
            className={cn(
              "group flex flex-col rounded-[28px] p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              lead ? "bg-brand text-[#141414]" : "bg-card"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
                {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
              </span>
              <span
                className={cn(
                  "font-mono text-[11px] font-semibold tracking-widest",
                  lead ? "text-[#141414]/55" : "text-muted-foreground/70"
                )}
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>

            <h4 className="mt-4 font-heading text-lg font-bold leading-snug">
              {priorityGoal(sector, id, tx)}
            </h4>

            <p className={cn("mt-1 text-sm leading-5", lead ? "text-[#141414]/70" : "text-muted-foreground")}>
              {priorityDescription(sector, id, tx)}
            </p>

            {edge && (
              <p className={cn("mt-3 flex items-start gap-1.5 text-xs font-medium leading-snug", lead ? "text-[#141414]" : "text-foreground/80")}>
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{edge}</span>
              </p>
            )}

            <div className="min-h-5 flex-1" aria-hidden="true" />
            <div
              className={cn(
                "flex items-center justify-between rounded-full py-1.5 pl-4 pr-1.5 text-xs font-semibold",
                lead ? "bg-[#141414]/10" : "bg-muted"
              )}
            >
              {tx("Ouvrir", "Open")}
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  lead ? "bg-[#141414] text-brand" : "bg-card shadow-sm group-hover:bg-brand group-hover:text-[#141414]"
                )}
                aria-hidden="true"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** Chip row used as a switcher once a priority is open.
 *
 *  With no `onOpen` it renders as static chips instead, which is what
 *  sectors that have no per-priority screens yet get: the user still sees
 *  what they configured, and nothing pretends to be clickable. */
export function PriorityPills({
  sector,
  ids,
  activeId,
  onOpen,
  label,
  className,
}: PriorityNavProps & {
  activeId?: string | null
  onOpen?: (id: string) => void
  label?: string
  className?: string
}) {
  const tx = useTx()

  /* Resolved here rather than as a default parameter: a default cannot
     call a hook, and hardcoding "Priorités" there is how the pill row
     kept its French heading in an English dashboard. */
  const heading = label ?? tx("Priorités", "Priorities")

  if (ids.length === 0) return null

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {heading}
      </p>

      {/* A dock of tiles: icon in a circle, then the name. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {ids.map((id) => {
          const Icon = priorityMeta(sector, id)?.icon
          const text = priorityLabel(sector, id, tx)

          if (!onOpen) {
            return (
              <span
                key={id}
                className="flex shrink-0 items-center gap-2.5 rounded-2xl bg-card py-1.5 pl-1.5 pr-4 text-sm font-semibold text-muted-foreground shadow-sm"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                </span>
                {text}
              </span>
            )
          }

          const active = id === activeId

          return (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex shrink-0 items-center gap-2.5 rounded-2xl py-1.5 pl-1.5 pr-4 text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-[var(--ink)] text-white" : "bg-card hover:-translate-y-0.5 hover:shadow-md"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  active ? "bg-brand text-[#141414]" : "bg-muted group-hover:bg-brand group-hover:text-[#141414]"
                )}
              >
                {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Heading shared by both overview pages, so "Vos priorités" is written
 *  once rather than once per sector. */
export function PriorityHeading({
  count,
  total,
}: {
  count: number
  total?: number
}) {
  const tx = useTx()

  const scope =
    count > 0 && total && total > count
      ? tx(` (${count} sur ${total})`, ` (${count} of ${total})`)
      : ""

  return (
    <div className="mb-4">
      <h3 className="font-heading text-lg font-bold">
        {tx("Vos priorités", "Your priorities")}
      </h3>

      <p className="mt-1 text-sm text-muted-foreground">
        {tx(
          "Sélectionnées lors de votre onboarding",
          "Selected while you were setting up"
        )}
        {scope}.
      </p>
    </div>
  )
}

/** Total priorities a sector offers, for the "x sur y" line. */
export function priorityCount(
  sector: Sector | string | null | undefined,
  businessType?: string | null
) {
  return prioritiesFor(sector, businessType).length
}
