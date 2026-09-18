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
import { useTx } from "@/lib/i18n"
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

  const tx = useTx()

  /** The stage status word, or "blocking" for the stage holding the flow
   *  up. Used by both the visible label and the screen-reader one. */
  const statusWord = (status: StageStatus, blocking: boolean) =>
    blocking
      ? tx("Bloquante", "Blocking")
      : tx(STATUS_WORDS[status].fr, STATUS_WORDS[status].en)

  return (
    <div className={cn("w-full", className)}>
      <div className="overflow-x-auto pb-1">
        <div className="w-full min-w-max">
          {/* The capsule holds nothing but the circles and the bars that
              join them, so it reads as one continuous shape. The bars
              carry a negative margin so they run under the circles with
              no seam, and the labels live outside the capsule rather
              than crowding it. */}
          <ol
            className="flex w-full items-center rounded-full bg-track px-3 py-3 sm:px-4 sm:py-4"
            aria-label={tx(
              "Chaîne logistique, étape par étape",
              "Logistics chain, stage by stage"
            )}
          >
            {nodes.map((node, index) => {
              const Icon = STAGE_ICONS[node.id]
              const reached = index <= fillUpTo
              const blocking = index === blockingIndex
              const selected = selectedId === node.id
              const nextReached = index + 1 <= fillUpTo

              const circle = (
                <span
                  className={cn(
                    "relative z-10 flex h-14 w-14 items-center justify-center rounded-full transition-colors sm:h-16 sm:w-16",
                    reached
                      ? "bg-brand text-track"
                      : "bg-track-muted text-track-muted-foreground",
                    blocking && "ring-[3px] ring-track ring-offset-[3px] ring-offset-brand",
                    selected &&
                      !blocking &&
                      "ring-2 ring-white/70 ring-offset-2 ring-offset-track"
                  )}
                >
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
                </span>
              )

              const alertCount =
                node.alertCount > 0
                  ? `, ${node.alertCount} ${
                      node.alertCount > 1
                        ? tx("alertes", "alerts")
                        : tx("alerte", "alert")
                    }`
                  : ""

              const label = `${node.name}, ${
                blocking
                  ? tx("étape bloquante", "blocking stage")
                  : statusWord(node.status, false)
              }${alertCount}`

              return (
                <li
                  key={node.id}
                  className={cn(
                    "flex items-center",
                    index < nodes.length - 1 && "flex-1"
                  )}
                >
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(node.id)}
                      aria-current={selected ? "true" : undefined}
                      aria-label={label}
                      className="flex w-[3.5rem] shrink-0 justify-center rounded-full sm:w-16"
                    >
                      {circle}
                    </button>
                  ) : (
                    <div
                      className="flex w-[3.5rem] shrink-0 justify-center sm:w-16"
                      title={label}
                    >
                      {circle}
                    </div>
                  )}

                  {index < nodes.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "-mx-2 h-8 min-w-12 flex-1 sm:h-9",
                        nextReached ? "bg-brand" : "bg-track-muted"
                      )}
                    />
                  )}
                </li>
              )
            })}
          </ol>

          {/* Same flex structure as the capsule above, so each label sits
              under its own circle. Status is stated in words here, which
              is why the capsule can stay purely visual. */}
          <ul
            className="mt-2 flex w-full items-start px-3 sm:px-4"
            aria-hidden="true"
          >
            {nodes.map((node, index) => {
              const blocking = index === blockingIndex

              return (
                <li
                  key={node.id}
                  className={cn(
                    "flex items-start",
                    index < nodes.length - 1 && "flex-1"
                  )}
                >
                  <div className="w-[3.5rem] shrink-0 px-0.5 text-center sm:w-16">
                    <p className="text-[11px] font-semibold leading-tight">
                      {node.name}
                    </p>

                    <p
                      className={cn(
                        "mt-0.5 text-[10px] leading-tight",
                        node.status === "risk"
                          ? "text-destructive"
                          : node.status === "watch"
                            ? "text-foreground"
                            : "text-muted-foreground"
                      )}
                    >
                      {statusWord(node.status, blocking)}
                    </p>

                    {node.alertCount > 0 && (
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {node.alertCount}{" "}
                        {node.alertCount > 1
                          ? tx("alertes", "alerts")
                          : tx("alerte", "alert")}
                      </p>
                    )}
                  </div>

                  {index < nodes.length - 1 && (
                    <span className="-mx-2 min-w-12 flex-1" />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
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
