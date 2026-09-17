"use client"

import type { LucideIcon } from "lucide-react"
import {
  Anchor,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Factory,
  FileWarning,
  MapPin,
  PackageOpen,
  Send,
  Snowflake,
  Thermometer,
  Truck,
  UsersRound,
  Warehouse,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  STATUS_WORDS,
  type PrimitiveId,
  type StageStatus,
} from "@/lib/logistics-signals"

/* --------------------------------------------------------------------------
 * The flow track.
 *
 * A dark capsule carrying one circular node per stage, filled in brand
 * lime up to the stage where the flow actually stops and muted after it.
 * Every view with a process chain uses this one component, so a flow is
 * drawn the same way whether it is a port, a warehouse or a cold chain.
 *
 * Status is never carried by color alone: each node states its stage name
 * and its status in words underneath, and the blocking node is also
 * marked with a ring and an explicit "étape bloquante" label.
 * -------------------------------------------------------------------------- */

export const STAGE_ICONS: Record<PrimitiveId, LucideIcon> = {
  fournisseurs: Factory,
  stock: Boxes,
  entrepot: Warehouse,
  transport: Truck,
  douane: FileWarning,
  client: UsersRound,
  arrivee: Anchor,
  quai: MapPin,
  cour: PackageOpen,
  enlevement: Send,
  reception: ClipboardCheck,
  stockage: Boxes,
  preparation: ClipboardList,
  expedition: Send,
  commande: ClipboardCheck,
  emballage: PackageOpen,
  depart: Send,
  stockageFroid: Snowflake,
  transportRefrigere: Thermometer,
  livraison: DoorOpen,
}

export type FlowNode = {
  id: PrimitiveId
  name: string
  status: StageStatus
  /** How many alerts the backend attributed to this stage. */
  alertCount: number
}

type FlowTrackProps = {
  nodes: FlowNode[]
  /** Index of the stage where the flow stops. -1 when nothing blocks. */
  blockingIndex: number
  /** Called when a node is activated, for views that drill into a stage. */
  onSelect?: (id: PrimitiveId) => void
  selectedId?: PrimitiveId | null
  className?: string
}

export function FlowTrack({
  nodes,
  blockingIndex,
  onSelect,
  selectedId,
  className,
}: FlowTrackProps) {
  if (nodes.length === 0) return null

  /* Nothing blocking means the whole chain is flowing, so every
     connector is filled. */
  const fillUpTo = blockingIndex < 0 ? nodes.length - 1 : blockingIndex

  return (
    <div className={cn("w-full", className)}>
      <div className="overflow-x-auto pb-1">
        <ol
          className="flex w-full min-w-max items-stretch justify-between gap-0 rounded-[2.5rem] bg-sidebar px-4 py-5 sm:px-6 sm:py-6"
          aria-label="Chaîne logistique, étape par étape"
        >
          {nodes.map((node, index) => {
            const Icon = STAGE_ICONS[node.id]
            const reached = index <= fillUpTo
            const blocking = index === blockingIndex
            const selected = selectedId === node.id
            const nextReached = index + 1 <= fillUpTo

            const content = (
              <>
                <span
                  className={cn(
                    "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors sm:h-16 sm:w-16",
                    reached
                      ? "bg-brand text-brand-foreground"
                      : "bg-sidebar-accent text-sidebar-foreground/45",
                    blocking &&
                      "ring-4 ring-sidebar ring-offset-2 ring-offset-brand",
                    selected && !blocking &&
                      "ring-2 ring-sidebar-foreground/60 ring-offset-2 ring-offset-sidebar"
                  )}
                >
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />

                  {node.alertCount > 0 && (
                    <span
                      className={cn(
                        "absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                        node.status === "risk"
                          ? "bg-destructive text-white"
                          : "bg-sidebar text-sidebar-foreground"
                      )}
                    >
                      {node.alertCount}
                    </span>
                  )}
                </span>

                <span className="mt-2 block max-w-[5.5rem] text-center text-[11px] font-semibold leading-tight text-sidebar-foreground">
                  {node.name}
                </span>

                <span
                  className={cn(
                    "mt-0.5 block text-center text-[10px] leading-tight",
                    node.status === "risk"
                      ? "text-destructive"
                      : node.status === "watch"
                        ? "text-brand"
                        : "text-sidebar-foreground/45"
                  )}
                >
                  {blocking ? "Étape bloquante" : STATUS_WORDS[node.status]}
                </span>
              </>
            )

            return (
              <li
                key={node.id}
                className={cn(
                  "flex items-start",
                  index < nodes.length - 1 && "flex-1"
                )}
              >
                <div className="flex w-[5.75rem] shrink-0 flex-col items-center sm:w-24">
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(node.id)}
                      aria-current={selected ? "true" : undefined}
                      className="flex flex-col items-center rounded-2xl px-1 py-1 transition-transform hover:-translate-y-0.5"
                      aria-label={`${node.name}, ${
                        blocking ? "étape bloquante" : STATUS_WORDS[node.status]
                      }${
                        node.alertCount > 0
                          ? `, ${node.alertCount} alerte${
                              node.alertCount > 1 ? "s" : ""
                            }`
                          : ""
                      }`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center px-1 py-1">
                      {content}
                    </div>
                  )}
                </div>

                {index < nodes.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-[1.4rem] h-4 min-w-4 flex-1 sm:mt-[1.65rem] sm:h-5",
                      nextReached ? "bg-brand" : "bg-sidebar-accent"
                    )}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * The headline block above the track, and the figure below it, laid out
 * the way the reference card is: statement, one line of context, the
 * track, then a labelled figure in large tabular numerals.
 * -------------------------------------------------------------------------- */

export function FlowCard({
  title,
  subtitle,
  figureLabel,
  figure,
  figureNote,
  tone = "neutral",
  children,
  aside,
}: {
  title: string
  subtitle: string
  figureLabel?: string
  figure?: string
  figureNote?: string
  tone?: "neutral" | "risk"
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-balance font-heading text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl">
            {title}
          </h2>

          <p className="mt-2 text-pretty text-base leading-6 text-muted-foreground">
            {subtitle}
          </p>
        </div>

        {aside}
      </div>

      <div className="mt-6">{children}</div>

      {figure && (
        <div className="mt-6">
          {figureLabel && (
            <p className="text-sm text-muted-foreground">{figureLabel}</p>
          )}

          <p
            className={cn(
              "mt-1 font-heading text-5xl font-bold tabular-nums tracking-tight sm:text-6xl",
              tone === "risk" ? "text-destructive" : "text-foreground"
            )}
          >
            {figure}
          </p>

          {figureNote && (
            <p className="mt-1 text-sm text-muted-foreground">{figureNote}</p>
          )}
        </div>
      )}
    </section>
  )
}
