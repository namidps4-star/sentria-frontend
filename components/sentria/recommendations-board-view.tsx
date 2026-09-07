"use client"

import { useEffect, useMemo, useState } from "react"
import {
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
  TrendingUp,
  Wrench,
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

type RecommendationsBoardProps = {
  recommendations: Recommendation[]
  opsType?: string | null
}

const COLUMNS: { id: Status; label: string; hint: string }[] = [
  { id: "todo", label: "À traiter", hint: "Détecté, pas encore pris en charge" },
  { id: "in_progress", label: "En cours", hint: "Quelqu'un s'en occupe" },
  { id: "done", label: "Résolu", hint: "Situation traitée" },
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
  cold_chain: "Chaine du froid",
  expiry: "Expiration",
  capacity: "Capacite",
  predictive: "Predictif",
  other: "Autre",
}

const STORAGE_KEY = "sentria_recommendation_status"

function getRecommendationId(rec: Recommendation, index: number) {
  return rec.alert_key ?? `${rec.equipment}-${rec.date}-${index}`
}

function loadStatusMap(): Record<string, Status> {
  if (typeof window === "undefined") return {}

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    return stored && typeof stored === "object" ? stored : {}
  } catch {
    return {}
  }
}

function saveStatusMap(map: Record<string, Status>) {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota / privacy-mode failures, board still works this session
  }
}

export function RecommendationsBoard({
  recommendations,
  opsType,
}: RecommendationsBoardProps) {
  const [statusMap, setStatusMap] = useState<Record<string, Status>>(() =>
    loadStatusMap()
  )
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const cards = useMemo(
    () =>
      recommendations.map((rec, index) => {
        const id = getRecommendationId(rec, index)
        return { id, rec, status: statusMap[id] ?? "todo" }
      }),
    [recommendations, statusMap]
  )

  function moveTo(id: string, status: Status) {
    setStatusMap((current) => {
      const next = { ...current, [id]: status }
      saveStatusMap(next)
      return next
    })
  }

  function handleDrop(e: React.DragEvent, status: Status) {
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain")
    if (id) moveTo(id, status)
    setDragOverColumn(null)
    setDraggingId(null)
  }

  const opsLabel = opsType ? OPS_TYPE_LABEL[opsType] : undefined

  if (recommendations.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0" />
        Aucune priorité urgente pour ce secteur pour le moment. Tout est sous
        contrôle ici.
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent-foreground" />

            <h3 className="font-heading text-lg font-bold">
              Priorités du moment
            </h3>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Faites glisser une priorité pour suivre son traitement.
          </p>

          {opsLabel && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground">
              <Shield className="h-3 w-3" />
              Vue adaptée : {opsLabel}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((column, columnIndex) => {
          const columnCards = cards.filter((c) => c.status === column.id)

          return (
            <div
              key={column.id}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverColumn(column.id)
              }}
              onDragLeave={() =>
                setDragOverColumn((current) =>
                  current === column.id ? null : current
                )
              }
              onDrop={(e) => handleDrop(e, column.id)}
              className={cn(
                "flex min-h-[220px] flex-col rounded-2xl border bg-background p-3 transition-colors",
                dragOverColumn === column.id
                  ? "border-accent bg-accent/5"
                  : "border-border"
              )}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div>
                  <p className="text-sm font-semibold">{column.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {column.hint}
                  </p>
                </div>

                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {columnCards.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {columnCards.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 py-6 text-[11px] text-muted-foreground">
                    Aucune priorité ici
                  </div>
                )}

                {columnCards.map(({ id, rec }) => {
                  const Icon = CATEGORY_ICON[rec.action_category] ?? Sparkles
                  const isCritical = rec.severity === "CRITICAL"

                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", id)
                        setDraggingId(id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDragOverColumn(null)
                      }}
                      className={cn(
                        "group cursor-grab rounded-xl border border-border bg-card p-3 active:cursor-grabbing",
                        draggingId === id && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <GripVertical className="h-3.5 w-3.5" />
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                            isCritical
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-500/15 text-amber-600"
                          )}
                        >
                          {rec.severity}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold leading-snug">
                        {rec.equipment}
                      </p>

                      <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                        {rec.recommended_action}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {CATEGORY_LABEL[rec.action_category] ?? "Autre"}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Déplacer vers la colonne précédente"
                            disabled={columnIndex === 0}
                            onClick={() =>
                              moveTo(id, COLUMNS[columnIndex - 1].id)
                            }
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            aria-label="Déplacer vers la colonne suivante"
                            disabled={columnIndex === COLUMNS.length - 1}
                            onClick={() =>
                              moveTo(id, COLUMNS[columnIndex + 1].id)
                            }
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
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