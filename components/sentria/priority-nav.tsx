"use client"

import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  prioritiesFor,
  priorityDescription,
  priorityGoal,
  priorityLabel,
  priorityMeta,
  type Sector,
} from "@/lib/priorities"

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
  if (ids.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ids.map((id) => {
        const Icon = priorityMeta(sector, id)?.icon

        return (
          <button
            key={id}
            type="button"
            onClick={() => onOpen(id)}
            className="group rounded-3xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                  {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
                  Priorité
                </span>

                <h4 className="mt-3 font-heading text-lg font-bold">
                  {priorityGoal(sector, id)}
                </h4>
              </div>

              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>

            <p className="mt-3 text-sm leading-5 text-muted-foreground">
              {priorityDescription(sector, id)}
            </p>

            <div className="mt-5 text-xs font-semibold text-foreground">
              Ouvrir la priorité →
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
  label = "Priorités",
  className,
}: PriorityNavProps & {
  activeId?: string | null
  onOpen?: (id: string) => void
  label?: string
  className?: string
}) {
  if (ids.length === 0) return null

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card px-4 py-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-muted-foreground">
          {label}
        </span>

        {ids.map((id) => {
          const Icon = priorityMeta(sector, id)?.icon
          const text = priorityLabel(sector, id)

          if (!onOpen) {
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground"
              >
                {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
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
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
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
  return (
    <div className="mb-4">
      <h3 className="font-heading text-lg font-bold">Vos priorités</h3>

      <p className="mt-1 text-sm text-muted-foreground">
        {count > 0
          ? `Sélectionnées lors de votre onboarding${
              total && total > count ? ` (${count} sur ${total})` : ""
            }.`
          : "Sélectionnées lors de votre onboarding."}
      </p>
    </div>
  )
}

/** Total priorities a sector offers, for the "x sur y" line. */
export function priorityCount(sector: Sector | string | null | undefined) {
  return prioritiesFor(sector).length
}
