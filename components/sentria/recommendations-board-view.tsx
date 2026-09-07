"use client"

import { useMemo, useState } from "react"
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  Fuel,
  GripVertical,
  Package,
  Radar,
  Shield,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Recommendation = {
  equipment: string
  sector?: string | null
  severity: "WARNING" | "CRITICAL" | string
  date: string
  message: string
  risk_score?: number | null
  alert_key?: string | null
  recommended_action: string
  action_category: string
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

  /**
   * Liste des personnes auxquelles une priorité peut être assignée.
   *
   * Exemple :
   * [
   *   { id: "marie", name: "Marie Dupont" },
   *   { id: "thomas", name: "Thomas Martin" }
   * ]
   */
  assignees?: {
    id: string
    name: string
  }[]
}

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

const STORAGE_KEY = "sentria_recommendation_tasks"

function getRecommendationId(
  rec: Recommendation,
  index: number
): string {
  return rec.alert_key ?? `${rec.equipment}-${rec.date}-${index}`
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function loadTaskMap(): Record<string, TaskMeta> {
  if (typeof window === "undefined") return {}

  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    )

    return stored && typeof stored === "object" ? stored : {}
  } catch {
    return {}
  }
}

function saveTaskMap(map: Record<string, TaskMeta>) {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Le board continue de fonctionner pendant la session.
  }
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return null

  const date = new Date(`${deadline}T23:59:59`)

  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  })
}

function isDeadlineOverdue(deadline: string | null) {
  if (!deadline) return false

  const deadlineDate = new Date(`${deadline}T23:59:59`)
  const now = new Date()

  return deadlineDate.getTime() < now.getTime()
}

function getDefaultPriority(rec: Recommendation): Priority {
  if (rec.severity === "CRITICAL") return "critical"

  if (
    rec.risk_score !== null &&
    rec.risk_score !== undefined &&
    rec.risk_score >= 70
  ) {
    return "high"
  }

  return "medium"
}

export function RecommendationsBoard({
  recommendations,
  opsType,
  assignees = [],
}: RecommendationsBoardProps) {
  const [taskMap, setTaskMap] =
    useState<Record<string, TaskMeta>>(() => loadTaskMap())

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] =
    useState<Status | null>(null)

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const cards = useMemo(
    () =>
      recommendations.map((rec, index) => {
        const id = getRecommendationId(rec, index)

        const stored = taskMap[id]

        return {
          id,
          rec,
          task: {
            status: stored?.status ?? "todo",
            assignee: stored?.assignee ?? null,
            deadline: stored?.deadline ?? null,
            priority:
              stored?.priority ?? getDefaultPriority(rec),
          },
        }
      }),
    [recommendations, taskMap]
  )

  function updateTask(
    id: string,
    patch: Partial<TaskMeta>
  ) {
    setTaskMap((current) => {
      const existing = current[id] ?? {
        status: "todo",
        assignee: null,
        deadline: null,
        priority: "medium",
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
    updateTask(id, { status })
  }

  function handleDragStart(
    e: React.DragEvent<HTMLDivElement>,
    id: string
  ) {
    e.stopPropagation()

    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", id)

    setDraggingId(id)
  }

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>,
    status: Status
  ) {
    e.preventDefault()
    e.stopPropagation()

    const id = e.dataTransfer.getData("text/plain")

    if (id) {
      moveTo(id, status)
    }

    setDraggingId(null)
    setDragOverColumn(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  const opsLabel = opsType
    ? OPS_TYPE_LABEL[opsType]
    : undefined

  if (recommendations.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-accent-foreground" />
        Aucune priorité urgente pour ce secteur pour le moment.
        Tout est sous contrôle ici.
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6">
      {/* HEADER */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
              <Sparkles className="h-4 w-4 text-accent-foreground" />
            </div>

            <div>
              <h3 className="font-heading text-lg font-bold">
                Priorités du moment
              </h3>

              <p className="text-xs text-muted-foreground">
                Pilotez chaque action comme une tâche opérationnelle.
              </p>
            </div>
          </div>

          {opsLabel && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
              <Shield className="h-3 w-3" />
              Vue adaptée : {opsLabel}
            </span>
          )}
        </div>

        <div className="rounded-xl border border-border bg-background px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Priorités
          </p>

          <p className="font-heading text-lg font-bold">
            {cards.length}
          </p>
        </div>
      </div>

      {/* BOARD */}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((column, columnIndex) => {
          const columnCards = cards.filter(
            (card) => card.task.status === column.id
          )

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
              onDragLeave={(e) => {
                if (
                  e.currentTarget === e.target
                ) {
                  setDragOverColumn(null)
                }
              }}
              onDrop={(e) =>
                handleDrop(e, column.id)
              }
              className={cn(
                "flex min-h-[260px] flex-col rounded-2xl border p-3 transition-all duration-200",
                "bg-background/70",
                dragOverColumn === column.id
                  ? "border-accent bg-accent/[0.06] shadow-[0_0_0_3px_hsl(var(--accent)/0.08)]"
                  : "border-border"
              )}
            >
              {/* COLUMN HEADER */}

              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      column.id === "todo" &&
                        "bg-amber-500",
                      column.id === "in_progress" &&
                        "bg-accent",
                      column.id === "done" &&
                        "bg-emerald-500"
                    )}
                  />

                  <div>
                    <p className="text-sm font-semibold">
                      {column.label}
                    </p>

                    <p className="text-[10px] text-muted-foreground">
                      {column.hint}
                    </p>
                  </div>
                </div>

                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {columnCards.length}
                </span>
              </div>

              {/* CARDS */}

              <div className="flex flex-1 flex-col gap-2">
                {columnCards.length === 0 && (
                  <div
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-xl border border-dashed py-8 text-[11px]",
                      dragOverColumn === column.id
                        ? "border-accent text-accent-foreground"
                        : "border-border/70 text-muted-foreground"
                    )}
                  >
                    Déposez une priorité ici
                  </div>
                )}

                {columnCards.map(
                  ({ id, rec, task }) => {
                    const Icon =
                      CATEGORY_ICON[
                        rec.action_category
                      ] ?? Sparkles

                    const isCritical =
                      rec.severity === "CRITICAL"

                    const overdue =
                      isDeadlineOverdue(
                        task.deadline
                      )

                    const assignee =
                      assignees.find(
                        (person) =>
                          person.id === task.assignee
                      )

                    return (
                      <div
                        key={id}
                        draggable
                        onDragStart={(e) =>
                          handleDragStart(e, id)
                        }
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "group relative rounded-xl border bg-card p-3.5",
                          "cursor-grab shadow-sm transition-all duration-200",
                          "hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md",
                          "active:cursor-grabbing",
                          draggingId === id &&
                            "scale-[0.98] opacity-40"
                        )}
                      >
                        {/* TOP */}

                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <GripVertical className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-100" />

                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10">
                              <Icon className="h-3.5 w-3.5 text-accent-foreground" />
                            </div>
                          </div>

                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                              isCritical
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-500/10 text-amber-600"
                            )}
                          >
                            {rec.severity}
                          </span>
                        </div>

                        {/* TITLE */}

                        <p className="mt-3 text-sm font-semibold leading-snug">
                          {rec.equipment}
                        </p>

                        <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                          {rec.recommended_action}
                        </p>

                        {/* META */}

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md border border-border bg-background px-2 py-1 text-[9px] font-medium text-muted-foreground">
                            {
                              CATEGORY_LABEL[
                                rec.action_category
                              ] ?? "Autre"
                            }
                          </span>

                          <span
                            className={cn(
                              "rounded-md px-2 py-1 text-[9px] font-medium",
                              task.priority ===
                                "critical" &&
                                "bg-destructive/10 text-destructive",
                              task.priority ===
                                "high" &&
                                "bg-orange-500/10 text-orange-600",
                              task.priority ===
                                "medium" &&
                                "bg-amber-500/10 text-amber-600",
                              task.priority ===
                                "low" &&
                                "bg-muted text-muted-foreground"
                            )}
                          >
                            {PRIORITY_LABEL[
                              task.priority
                            ]}
                          </span>
                        </div>

                        {/* FOOTER */}

                        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
                          {/* ASSIGNEE */}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingId(id)
                            }}
                            className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted"
                          >
                            {assignee ? (
                              <>
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                                  {getInitials(
                                    assignee.name
                                  )}
                                </span>

                                <span className="max-w-[90px] truncate text-[10px] font-medium">
                                  {assignee.name}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                                  <UserRound className="h-3 w-3" />
                                </span>

                                <span className="text-[10px] text-muted-foreground">
                                  Assigner
                                </span>
                              </>
                            )}
                          </button>

                          {/* DEADLINE */}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingId(id)
                            }}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] transition-colors hover:bg-muted",
                              overdue
                                ? "font-semibold text-destructive"
                                : "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="h-3 w-3" />

                            {task.deadline ? (
                              formatDeadline(
                                task.deadline
                              )
                            ) : (
                              "Échéance"
                            )}
                          </button>
                        </div>

                        {/* ACTION BUTTONS */}

                        <div className="mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            aria-label="Déplacer vers la colonne précédente"
                            disabled={
                              columnIndex === 0
                            }
                            onClick={() =>
                              moveTo(
                                id,
                                COLUMNS[
                                  columnIndex - 1
                                ].id
                              )
                            }
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-20"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            aria-label="Déplacer vers la colonne suivante"
                            disabled={
                              columnIndex ===
                              COLUMNS.length - 1
                            }
                            onClick={() =>
                              moveTo(
                                id,
                                COLUMNS[
                                  columnIndex + 1
                                ].id
                              )
                            }
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-20"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* EDIT PANEL */}

                        {editingId === id && (
                          <div
                            className="absolute inset-x-2 bottom-2 z-20 rounded-xl border border-border bg-card p-3 shadow-xl"
                            onClick={(e) =>
                              e.stopPropagation()
                            }
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <p className="text-xs font-semibold">
                                Détails de la priorité
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditingId(null)
                                }
                                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* ASSIGNEE */}

                            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                              Responsable
                            </label>

                            <select
                              value={
                                task.assignee ?? ""
                              }
                              onChange={(e) =>
                                updateTask(id, {
                                  assignee:
                                    e.target.value ||
                                    null,
                                })
                              }
                              className="mb-3 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-accent"
                            >
                              <option value="">
                                Non assigné
                              </option>

                              {assignees.map(
                                (person) => (
                                  <option
                                    key={person.id}
                                    value={person.id}
                                  >
                                    {person.name}
                                  </option>
                                )
                              )}
                            </select>

                            {/* DEADLINE */}

                            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                              Échéance
                            </label>

                            <div className="relative mb-3">
                              <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

                              <input
                                type="date"
                                value={
                                  task.deadline ?? ""
                                }
                                onChange={(e) =>
                                  updateTask(id, {
                                    deadline:
                                      e.target.value ||
                                      null,
                                  })
                                }
                                className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-xs outline-none focus:border-accent"
                              />
                            </div>

                            {/* PRIORITY */}

                            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                              Priorité
                            </label>

                            <select
                              value={task.priority}
                              onChange={(e) =>
                                updateTask(id, {
                                  priority:
                                    e.target
                                      .value as Priority,
                                })
                              }
                              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-accent"
                            >
                              <option value="low">
                                Faible
                              </option>
                              <option value="medium">
                                Moyenne
                              </option>
                              <option value="high">
                                Haute
                              </option>
                              <option value="critical">
                                Critique
                              </option>
                            </select>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingId(null)
                              }
                              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Enregistrer
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  }
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}