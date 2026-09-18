"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  Fuel,
  MoreHorizontal,
  Package,
  Radar,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatEuros } from "@/lib/logistics-signals"

type Recommendation = {
  id: string
  equipment: string
  sector?: string | null
  severity: "WARNING" | "CRITICAL" | string
  date: string
  message: string
  risk_score?: number | null
  alert_key?: string | null
  recommended_action: string
  action_category: string
  /* Set only by deriveRecommendations, which knows the chain. The
     backend endpoint cannot produce these, so every one is optional and
     the card renders what it has. */
  stageName?: string
  downstream?: number
  alertCount?: number
  exposureEUR?: number
  score?: number
  reasoning?: string | null
}

type Status = "todo" | "in_progress" | "done"

type Priority = "low" | "medium" | "high" | "critical"

type TaskMeta = {
  status: Status
  assignee: string | null
  deadline: string | null
  priority: Priority
}

type RecommendationsBoardProps = {
  recommendations: Recommendation[]
  opsType?: string | null
  assignees?: {
    id: string
    name: string
  }[]
}

/** Which cards the pill row is showing. Every one of these is counted
 *  from the cards themselves, so a pill can never claim a number the
 *  board does not hold. */
type Filter = "all" | "critical" | "unassigned"

const COLUMNS: {
  id: Status
  label: string
  hint: string
}[] = [
  {
    id: "todo",
    label: "À traiter",
    hint: "Détecté, pas encore pris en charge",
  },
  {
    id: "in_progress",
    label: "En cours",
    hint: "Quelqu'un s'en occupe",
  },
  {
    id: "done",
    label: "Résolu",
    hint: "Situation traitée",
  },
]

const OPS_TYPE_LABEL: Record<string, string> = {
  port: "Port & conteneurs",
  entrepot: "Entrepôt & manutention",
  transport: "Transport & distribution",
  expedition: "Expédition",
  froid: "Chaîne du froid",
  multi: "Opérations logistiques",
}

const CATEGORY_ICON: Record<string, typeof Wrench> = {
  maintenance: Wrench,
  fuel: Fuel,
  delay: Clock3,
  stock: Package,
  cold_chain: Package,
  expiry: Package,
  capacity: Cpu,
  predictive: Radar,
  other: Sparkles,
}

const CATEGORY_LABEL: Record<string, string> = {
  maintenance: "Maintenance",
  fuel: "Carburant",
  delay: "Retard",
  stock: "Stock",
  cold_chain: "Chaîne du froid",
  expiry: "Expiration",
  capacity: "Capacité",
  predictive: "Prédictif",
  other: "Autre",
}

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
}

const STORAGE_KEY = "sentria_recommendation_tasks_v2"

function getRecommendationId(rec: Recommendation): string {
  return rec.id
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function loadTaskMap(): Record<string, TaskMeta> {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    return parsed as Record<string, TaskMeta>
  } catch {
    return {}
  }
}

function saveTaskMap(map: Record<string, TaskMeta>) {
  if (typeof window === "undefined") {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore localStorage errors.
  }
}

function formatDeadline(deadline: string | null) {
  if (!deadline) {
    return null
  }

  const date = new Date(`${deadline}T23:59:59`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  })
}

function isDeadlineOverdue(deadline: string | null) {
  if (!deadline) {
    return false
  }

  const deadlineDate = new Date(`${deadline}T23:59:59`)

  return deadlineDate.getTime() < Date.now()
}

function getDefaultPriority(rec: Recommendation): Priority {
  if (rec.severity === "CRITICAL") {
    return "critical"
  }

  if (
    rec.risk_score !== null &&
    rec.risk_score !== undefined &&
    rec.risk_score >= 70
  ) {
    return "high"
  }

  return "medium"
}

/* --------------------------------------------------------------------------
 * The severity palette.
 *
 * The reference board tints each card by the group it belongs to. Here the
 * group is the severity the backend assigned, and the tint never carries
 * the meaning on its own: the card also states the severity in words, so
 * the board reads correctly in greyscale and to a screen reader.
 * -------------------------------------------------------------------------- */

const TONE = {
  critical: {
    card: "border-destructive/25 bg-destructive/[0.06]",
    fill: "bg-destructive",
    pill: "bg-destructive/10 text-destructive",
    word: "Critique",
  },
  warning: {
    card: "border-amber-500/25 bg-amber-500/[0.07]",
    fill: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-600",
    word: "Attention",
  },
} as const

function toneOf(rec: Recommendation) {
  return rec.severity === "CRITICAL" ? TONE.critical : TONE.warning
}

/** The segmented risk rule from the reference, driven by the backend's
 *  own 0-100 score.
 *
 *  It renders nothing at all when the row carries no score. A bar with no
 *  number behind it is exactly the kind of invented progress this product
 *  keeps removing, and an empty rule would still read as "low risk". */
function RiskRule({ rec }: { rec: Recommendation }) {
  const score = rec.risk_score

  if (score === null || score === undefined || !Number.isFinite(score)) {
    return null
  }

  const filled = Math.max(0, Math.min(10, Math.round(score / 10)))
  const tone = toneOf(rec)

  return (
    <div className="mt-3">
      <div className="flex items-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              index < filled ? tone.fill : "bg-foreground/10"
            )}
          />
        ))}
      </div>

      <span className="sr-only">Risque {Math.round(score)} sur 100</span>
    </div>
  )
}

export function RecommendationsBoard({
  recommendations,
  opsType,
  assignees = [],
}: RecommendationsBoardProps) {
  /* This used to read localStorage inside the useState initialiser, which
     makes the first client render disagree with the server markup. It is
     read after mount instead, like every other stored value in the app. */
  const [taskMap, setTaskMap] = useState<Record<string, TaskMeta>>({})

  useEffect(() => {
    setTaskMap(loadTaskMap())
  }, [])

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")

  const cards = useMemo(() => {
    return recommendations.map((rec) => {
      const id = getRecommendationId(rec)
      const stored = taskMap[id]

      return {
        id,
        rec,
        task: {
          status: stored?.status ?? "todo",
          assignee: stored?.assignee ?? null,
          deadline: stored?.deadline ?? null,
          priority: stored?.priority ?? getDefaultPriority(rec),
        },
      }
    })
  }, [recommendations, taskMap])

  const criticalCount = cards.filter(
    (card) => card.rec.severity === "CRITICAL"
  ).length

  const unassignedCount = cards.filter((card) => !card.task.assignee).length

  const totalExposure = cards.reduce(
    (sum, card) => sum + (card.rec.exposureEUR ?? 0),
    0
  )

  const visible = useMemo(() => {
    if (filter === "critical") {
      return cards.filter((card) => card.rec.severity === "CRITICAL")
    }

    if (filter === "unassigned") {
      return cards.filter((card) => !card.task.assignee)
    }

    return cards
  }, [cards, filter])

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Toutes", count: cards.length },
    { id: "critical", label: "Critiques", count: criticalCount },
    { id: "unassigned", label: "Non assignées", count: unassignedCount },
  ]

  function updateTask(id: string, patch: Partial<TaskMeta>) {
    setTaskMap((current) => {
      const existing = current[id] ?? {
        status: "todo" as Status,
        assignee: null,
        deadline: null,
        priority: "medium" as Priority,
      }

      const next = {
        ...current,
        [id]: {
          ...existing,
          ...patch,
        },
      }

      saveTaskMap(next)

      return next
    })
  }

  function moveTo(id: string, status: Status) {
    if (!id) {
      return
    }

    updateTask(id, { status })
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    e.stopPropagation()

    e.dataTransfer.setData("text/plain", id)
    e.dataTransfer.effectAllowed = "move"

    setDraggingId(id)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, status: Status) {
    e.preventDefault()
    e.stopPropagation()

    const id = e.dataTransfer.getData("text/plain")

    if (!id) {
      setDraggingId(null)
      setDragOverColumn(null)
      return
    }

    if (cards.some((card) => card.id === id)) {
      moveTo(id, status)
    }

    setDraggingId(null)
    setDragOverColumn(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  const opsLabel = opsType ? OPS_TYPE_LABEL[opsType] : undefined

  if (recommendations.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-accent-foreground" />
        Aucune priorité urgente pour ce secteur pour le moment. Tout est sous
        contrôle ici.
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6">
      {/* ------------------------------------------------------------------
          Header strip: eyebrow, title, filter pills, and the three counts.
          ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {opsLabel ?? "Opérations"}
          </p>

          <h3 className="mt-1 font-heading text-2xl font-bold tracking-tight">
            Priorités du moment
          </h3>

          {/* The pill row from the reference. Dark active pill, brand count
              badge, every number counted from the cards on screen. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {FILTERS.map((item) => {
              const active = filter === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "bg-foreground text-background"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {item.label}

                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <dl className="flex shrink-0 items-start gap-6 lg:gap-8">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Priorités
            </dt>
            <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">
              {cards.length}
            </dd>
          </div>

          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Critiques
            </dt>
            <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">
              {criticalCount}
            </dd>
          </div>

          {totalExposure > 0 && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Exposition
              </dt>
              <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">
                {formatEuros(totalExposure)}
                <span className="ml-1 text-sm font-semibold">€</span>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* ------------------------------------------------------------------
          The columns.
          ------------------------------------------------------------------ */}
      <div className="mt-7 grid grid-cols-1 gap-x-5 gap-y-6 md:grid-cols-3">
        {COLUMNS.map((column, columnIndex) => {
          const columnCards = visible.filter(
            (card) => card.task.status === column.id
          )

          const isDropTarget = dragOverColumn === column.id

          return (
            <div
              key={column.id}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                setDragOverColumn(column.id)
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                setDragOverColumn(column.id)
              }}
              onDrop={(e) => handleDrop(e, column.id)}
              className="flex min-h-[260px] flex-col"
            >
              {/* The segmented rule from the reference: one segment per
                  card in this column, coloured by that card's severity, so
                  the shape of the column is readable before the cards are. */}
              <div
                className="flex items-center gap-1 pb-3"
                aria-hidden="true"
              >
                {columnCards.length === 0 ? (
                  <span className="h-[3px] flex-1 rounded-full bg-foreground/10" />
                ) : (
                  columnCards.map((card) => (
                    <span
                      key={card.id}
                      className={cn(
                        "h-[3px] flex-1 rounded-full",
                        toneOf(card.rec).fill
                      )}
                    />
                  ))
                )}
              </div>

              <div className="mb-3 flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{column.label}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {column.hint}
                  </p>
                </div>

                <span className="shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                  {columnCards.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3">
                {columnCards.length === 0 && (
                  <div
                    style={{
                      /* The hatched drop slot from the reference. Written
                         as a style rather than an arbitrary class because
                         the tokens are oklch() values: hsl(var(--token))
                         is invalid and the browser drops the whole rule. */
                      backgroundImage:
                        "repeating-linear-gradient(135deg, transparent, transparent 6px, color-mix(in oklab, var(--foreground) 4%, transparent) 6px, color-mix(in oklab, var(--foreground) 4%, transparent) 12px)",
                    }}
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-2xl border border-dashed py-10 text-[11px] transition-colors",
                      isDropTarget
                        ? "border-accent text-accent-foreground"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {filter === "all"
                      ? "Déposez une priorité ici"
                      : "Rien dans ce filtre"}
                  </div>
                )}

                {columnCards.map(({ id, rec, task }) => {
                  const Icon = CATEGORY_ICON[rec.action_category] ?? Sparkles
                  const tone = toneOf(rec)
                  const isDragging = draggingId === id
                  const overdue = isDeadlineOverdue(task.deadline)

                  const assignee = assignees.find(
                    (person) => person.id === task.assignee
                  )

                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group relative rounded-2xl border px-4 pb-3.5 pt-4",
                        "cursor-grab transition-all duration-200",
                        "hover:-translate-y-0.5 hover:shadow-md",
                        "active:cursor-grabbing",
                        tone.card,
                        isDragging &&
                          "z-50 scale-[1.03] opacity-90 shadow-xl ring-2 ring-accent"
                      )}
                    >
                      {/* Title block, two lines like the reference. */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-bold leading-snug">
                          {rec.equipment}

                          {rec.stageName && (
                            <span className="block font-medium text-muted-foreground">
                              {rec.stageName}
                            </span>
                          )}
                        </p>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingId(id)
                          }}
                          aria-label={`Détails de la priorité ${rec.equipment}`}
                          className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      <RiskRule rec={rec} />

                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {rec.recommended_action}
                      </p>

                      {(rec.exposureEUR ?? 0) > 0 && (
                        <p className="mt-2 text-xs font-bold tabular-nums">
                          {formatEuros(rec.exposureEUR!)} € exposés
                        </p>
                      )}

                      {/* Severity in words, so the tint is never the only
                          thing carrying it. */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider",
                            tone.pill
                          )}
                        >
                          {tone.word}
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[9px] font-medium text-muted-foreground">
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {CATEGORY_LABEL[rec.action_category] ?? "Autre"}
                        </span>

                        {(rec.downstream ?? 0) > 0 && (
                          <span className="rounded-md border border-brand/40 bg-brand/10 px-2 py-1 text-[9px] font-semibold">
                            {rec.downstream} en aval
                          </span>
                        )}

                        {(rec.alertCount ?? 0) > 1 && (
                          <span className="rounded-md border border-border bg-background/60 px-2 py-1 text-[9px] font-medium text-muted-foreground">
                            {rec.alertCount} signaux
                          </span>
                        )}

                        <span className="rounded-md border border-border bg-background/60 px-2 py-1 text-[9px] font-medium text-muted-foreground">
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                      </div>

                      {/* Footer: who is on it, and by when. In the reference
                          this row carries a photo and a name; here it carries
                          the assigned contractor, and says plainly that there
                          is nobody rather than showing a placeholder face. */}
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-foreground/10 pt-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingId(id)
                          }}
                          className="flex min-w-0 items-center gap-2 rounded-lg py-1 pr-1 text-left transition-colors hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {assignee ? (
                            <>
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background">
                                {getInitials(assignee.name)}
                              </span>

                              <span className="max-w-[110px] truncate text-[11px] font-semibold">
                                {assignee.name}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/25 text-muted-foreground">
                                <UserRound
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </span>

                              <span className="text-[11px] text-muted-foreground">
                                Assigner
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingId(id)
                          }}
                          className={cn(
                            "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition-colors hover:bg-foreground/5",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            overdue
                              ? "font-bold text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          <CalendarDays
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />

                          {task.deadline
                            ? formatDeadline(task.deadline)
                            : "Échéance"}
                        </button>
                      </div>

                      <div className="pointer-events-none absolute bottom-1.5 right-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label="Déplacer vers la colonne précédente"
                          disabled={columnIndex === 0}
                          onClick={(e) => {
                            e.stopPropagation()

                            if (columnIndex > 0) {
                              moveTo(id, COLUMNS[columnIndex - 1].id)
                            }
                          }}
                          className="rounded-md bg-background/80 p-1 text-muted-foreground shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-20"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          aria-label="Déplacer vers la colonne suivante"
                          disabled={columnIndex === COLUMNS.length - 1}
                          onClick={(e) => {
                            e.stopPropagation()

                            if (columnIndex < COLUMNS.length - 1) {
                              moveTo(id, COLUMNS[columnIndex + 1].id)
                            }
                          }}
                          className="rounded-md bg-background/80 p-1 text-muted-foreground shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-20"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {editingId === id && (
                        <div
                          className="absolute inset-x-2 bottom-2 z-20 rounded-xl border border-border bg-card p-3 shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold">
                              Détails de la priorité
                            </p>

                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Fermer"
                              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                            Responsable
                          </label>

                          <select
                            value={task.assignee ?? ""}
                            onChange={(e) =>
                              updateTask(id, {
                                assignee: e.target.value || null,
                              })
                            }
                            className="mb-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-accent"
                          >
                            <option value="">Non assigné</option>

                            {assignees.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name}
                              </option>
                            ))}
                          </select>

                          {assignees.length === 0 && (
                            <p className="mb-3 text-[10px] leading-4 text-muted-foreground">
                              Aucun intervenant enregistré pour l&apos;instant.
                            </p>
                          )}

                          <label className="mb-1 mt-2 block text-[10px] font-medium text-muted-foreground">
                            Échéance
                          </label>

                          <div className="relative mb-3">
                            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

                            <input
                              type="date"
                              value={task.deadline ?? ""}
                              onChange={(e) =>
                                updateTask(id, {
                                  deadline: e.target.value || null,
                                })
                              }
                              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-xs outline-none focus:border-accent"
                            />
                          </div>

                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                            Priorité
                          </label>

                          <select
                            value={task.priority}
                            onChange={(e) =>
                              updateTask(id, {
                                priority: e.target.value as Priority,
                              })
                            }
                            className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-accent"
                          >
                            <option value="low">Faible</option>
                            <option value="medium">Moyenne</option>
                            <option value="high">Haute</option>
                            <option value="critical">Critique</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Enregistrer
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
