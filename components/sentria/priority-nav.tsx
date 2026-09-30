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

/** A live number for one priority tile, counted from the user's alerts.
 *  `label` says what was counted, so the number never overclaims. */
export type PriorityStat = {
  value: string
  label: string
  tone?: "risk" | "watch" | "good"
}

const STAT_TONE: Record<NonNullable<PriorityStat["tone"]>, string> = {
  risk: "text-[var(--tag-danger-fg)]",
  watch: "text-[var(--tag-warning-fg)]",
  good: "text-[var(--tag-success-fg)]",
}

/** Bento of entry tiles for a sector overview.
 *
 *  The first priority leads as a large lime tile with its explanation;
 *  the rest are compact tiles that lead with their live number. With five
 *  priorities the lead takes a 2×2 block and the four others fill the
 *  2×2 beside it, so the grid closes with no hole. */
export function PriorityCards({
  sector,
  ids,
  onOpen,
  emptyLabel,
  stats,
}: PriorityNavProps & {
  onOpen: (id: string) => void
  emptyLabel: string
  stats?: Record<string, PriorityStat | undefined>
}) {
  const tx = useTx()

  if (ids.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  // A 2×2 lead only when there are enough tiles to sit beside it.
  const bento = ids.length >= 3

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        bento ? "lg:auto-rows-[minmax(9.5rem,auto)] lg:grid-cols-4" : "md:grid-cols-2"
      )}
      data-testid="priority-bento"
    >
      {ids.map((id, index) => {
        const Icon = priorityMeta(sector, id)?.icon
        const lead = index === 0
        const stat = stats?.[id]
        const number = String(index + 1).padStart(2, "0")

        if (lead) {
          const edge = priorityEdge(sector, id, tx)

          return (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              className={cn(
                "group relative col-span-2 flex flex-col overflow-hidden rounded-[28px] bg-brand p-5 text-left text-[#141414] shadow-sm transition-all sm:p-6",
                "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
                bento && "lg:row-span-2"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#141414] text-brand">
                    {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#141414]/60">
                    {tx("En tête", "First up")}
                  </span>
                </span>
                <span className="font-mono text-[11px] font-semibold tracking-widest text-[#141414]/50" aria-hidden="true">
                  {number}
                </span>
              </div>

              <h4 className="mt-5 max-w-md text-balance font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                {priorityGoal(sector, id, tx)}
              </h4>

              <p className="mt-2 max-w-md text-sm leading-5 text-[#141414]/70">
                {priorityDescription(sector, id, tx)}
              </p>

              <div className="min-h-6 flex-1" aria-hidden="true" />

              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  {stat ? (
                    <>
                      <p className="font-heading text-5xl font-bold leading-none tabular-nums tracking-tight sm:text-6xl">
                        {stat.value}
                      </p>
                      <p className="mt-1.5 text-xs font-semibold text-[#141414]/70">{stat.label}</p>
                    </>
                  ) : (
                    edge && (
                      <p className="flex items-start gap-1.5 text-xs font-medium leading-snug">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>{edge}</span>
                      </p>
                    )
                  )}
                </div>

                <span className="flex shrink-0 items-center gap-2 rounded-full bg-[#141414] py-1.5 pl-4 pr-1.5 text-xs font-semibold text-white">
                  {tx("Ouvrir", "Open")}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[#141414] transition-transform group-hover:rotate-45" aria-hidden="true">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </span>
              </div>
            </button>
          )
        }

        return (
          <button
            key={id}
            type="button"
            onClick={() => onOpen(id)}
            title={priorityDescription(sector, id, tx)}
            className={cn(
              "group relative flex min-h-[9.5rem] flex-col rounded-[24px] bg-card p-4 text-left shadow-sm ring-1 ring-transparent transition-all",
              "hover:-translate-y-0.5 hover:shadow-md hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
              // An odd tile left over on a phone takes the full row.
              index === ids.length - 1 && (ids.length - 1) % 2 === 1 && "col-span-2 lg:col-span-1"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
                {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-brand group-hover:text-[#141414]"
                aria-hidden="true"
              >
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:rotate-45" />
              </span>
            </div>

            <h4 className="mt-3 text-pretty text-sm font-bold leading-snug">
              {priorityGoal(sector, id, tx)}
            </h4>

            <div className="min-h-2 flex-1" aria-hidden="true" />

            {stat ? (
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-heading text-2xl font-bold leading-none tabular-nums tracking-tight",
                    stat.tone ? STAT_TONE[stat.tone] : "text-foreground"
                  )}
                >
                  {stat.value}
                </span>
                <span className="min-w-0 truncate text-[11px] text-muted-foreground">{stat.label}</span>
              </div>
            ) : (
              <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">
                {priorityDescription(sector, id, tx)}
              </p>
            )}
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
