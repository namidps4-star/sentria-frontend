"use client"

import { priorityLabel, priorityMeta } from "@/lib/priorities"
import type { PriorityRow } from "@/lib/health-priorities"
import { useTx } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { CountNumber } from "./count-number"
import { NotMeasuredFigure } from "./not-measured"
import { Skeleton } from "./skeleton"

/* The saved priorities as one dark capsule. The open priority is a lime pill
 * that says what it is, how many alerts it has and how bad; the others stay
 * small, an icon with a count. The open one is the pressed one, or the most
 * urgent when none is pressed. Pressing a pill filters the alerts table.
 *
 * A figure is only shown when it is a reading: nothing while the alerts load,
 * a dash when a zero would be a guess (the read failed, or the data is stale),
 * and no figure at all for a priority nothing counts yet. */

type Figure =
  | { kind: "loading" }
  | { kind: "unknown" }
  | { kind: "none" }
  | { kind: "count"; value: number }

function figureOf(row: PriorityRow, loaded: boolean, zeroUnknown: boolean): Figure {
  if (!loaded) return { kind: "loading" }
  if (row.count === null) return { kind: "none" }
  if (row.count === 0 && zeroUnknown) return { kind: "unknown" }
  return { kind: "count", value: row.count }
}

export function PriorityTrack({
  sector,
  rows,
  selected,
  loaded,
  zeroUnknown,
  onPick,
}: {
  sector: string
  rows: PriorityRow[]
  /** The pressed priority, or null for none. */
  selected: string | null
  loaded: boolean
  zeroUnknown: boolean
  onPick: (id: string) => void
}) {
  const tx = useTx()
  const openId = selected ?? rows[0]?.id

  return (
    <div className="flex justify-center" data-testid="priority-track">
      {/* No justify-center in here: centred content in a scroll row cuts off
          its own start on a narrow screen. */}
      <div className="flex w-fit max-w-full items-center gap-2 overflow-x-auto rounded-full bg-[var(--ink)] p-2 [scrollbar-width:none]">
        {rows.map((row) => {
          const Icon = priorityMeta(sector, row.id)?.icon
          const label = priorityLabel(sector, row.id, tx)
          const figure = figureOf(row, loaded, zeroUnknown)
          const open = row.id === openId
          const pressed = row.id === selected

          const status =
            figure.kind === "count"
              ? row.critical > 0
                ? tx(
                    `${row.critical} critique${row.critical > 1 ? "s" : ""}`,
                    `${row.critical} critical`
                  )
                : figure.value > 0
                  ? tx("à surveiller", "to watch")
                  : tx("rien à signaler", "all clear")
              : figure.kind === "unknown"
                ? tx("Non mesuré", "Not measured")
                : figure.kind === "none"
                  ? tx("Pas encore de chiffre", "No figure yet")
                  : ""

          const spoken =
            figure.kind === "count"
              ? `${label}, ${figure.value}, ${status}`
              : status
                ? `${label}, ${status}`
                : label

          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onPick(row.id)}
              aria-pressed={pressed}
              aria-label={spoken}
              title={label}
              data-open={open ? "" : undefined}
              className={cn(
                "flex h-16 shrink-0 items-center gap-3 rounded-full transition-[width,background-color] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                open
                  ? "w-[min(300px,calc(100vw-9rem))] bg-brand pl-2 pr-6 text-[#141414]"
                  : "w-16 justify-center bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <span
                className={cn(
                  "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                  open ? "bg-[#141414] text-brand" : "bg-transparent"
                )}
              >
                {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}

                {!open && figure.kind === "count" && figure.value > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-[#141414]"
                  >
                    {figure.value}
                  </span>
                )}
              </span>

              {open && (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="min-w-0 text-left">
                    <span className="block truncate font-heading text-lg font-medium leading-tight">
                      {label}
                    </span>

                    {figure.kind === "loading" ? (
                      <Skeleton className="mt-1 h-3 w-16 bg-[#141414]/15" />
                    ) : (
                      <span className="block truncate text-xs text-[#141414]/70">{status}</span>
                    )}
                  </span>

                  {figure.kind === "loading" ? (
                    <Skeleton className="h-8 w-8 bg-[#141414]/15" />
                  ) : figure.kind === "unknown" ? (
                    <span className="font-heading text-4xl font-medium">
                      <NotMeasuredFigure className="text-[#141414]/70" />
                    </span>
                  ) : figure.kind === "count" ? (
                    <span className="font-heading text-4xl font-medium tabular-nums">
                      <CountNumber value={figure.value} />
                    </span>
                  ) : null}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
