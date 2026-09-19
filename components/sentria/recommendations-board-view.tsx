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
import { useCompanyIdentity } from "@/lib/company"
import {
  AVAILABILITY_LABEL,
  fetchAssignments,
  fetchContractors,
  saveAssignment,
  type Assignment,
  type Contractor,
} from "@/lib/crm"
import { formatMoney, useLocale } from "@/lib/locale"
import { localized, useTx, type Localized, type Tx } from "@/lib/i18n"

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

/** One card's state. The field names are the server's column names on
 *  purpose: a translation layer between "assignee" here and
 *  "contractor_id" there would be one more place to get it wrong. */
type TaskMeta = {
  status: Status
  contractor_id: string | null
  deadline: string | null
  priority: Priority
}

type RecommendationsBoardProps = {
  recommendations: Recommendation[]
  opsType?: string | null
}

/** Which cards the pill row is showing. Every one of these is counted
 *  from the cards themselves, so a pill can never claim a number the
 *  board does not hold. */
type Filter = "all" | "critical" | "unassigned"

const COLUMNS: {
  id: Status
  label: Localized
  hint: Localized
}[] = [
  {
    id: "todo",
    label: localized("À traiter", "To do"),
    hint: localized(
      "Détecté, pas encore pris en charge",
      "Detected, nobody on it yet"
    ),
  },
  {
    id: "in_progress",
    label: localized("En cours", "In progress"),
    hint: localized("Quelqu'un s'en occupe", "Somebody is on it"),
  },
  {
    id: "done",
    label: localized("Résolu", "Resolved"),
    hint: localized("Situation traitée", "The situation is handled"),
  },
]

const OPS_TYPE_LABEL: Record<string, Localized> = {
  port: localized("Port & conteneurs", "Port & containers"),
  entrepot: localized("Entrepôt & manutention", "Warehouse & handling"),
  transport: localized("Transport & distribution", "Transport & distribution"),
  expedition: localized("Expédition", "Dispatch"),
  froid: localized("Chaîne du froid", "Cold chain"),
  multi: localized("Opérations logistiques", "Logistics operations"),
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

const CATEGORY_LABEL: Record<string, Localized> = {
  maintenance: localized("Maintenance", "Maintenance"),
  fuel: localized("Carburant", "Fuel"),
  delay: localized("Retard", "Delay"),
  stock: localized("Stock", "Stock"),
  cold_chain: localized("Chaîne du froid", "Cold chain"),
  expiry: localized("Expiration", "Expiry"),
  capacity: localized("Capacité", "Capacity"),
  predictive: localized("Prédictif", "Predictive"),
  other: localized("Autre", "Other"),
}

const PRIORITY_LABEL: Record<Priority, Localized> = {
  low: localized("Faible", "Low"),
  medium: localized("Moyenne", "Medium"),
  high: localized("Haute", "High"),
  critical: localized("Critique", "Critical"),
}

/* Where the board used to keep its assignments.
 *
 * It is a migration source now, not a store. Every assignment lived in
 * the administrator's own browser, which meant assigning a task to a
 * contractor and the contractor never seeing it. The rows are pushed to
 * the server once, then this key is dropped. */
const LEGACY_STORAGE_KEY = "sentria_recommendation_tasks_v2"

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

function loadLegacyTaskMap(): Record<string, TaskMeta> {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)

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

function clearLegacyTaskMap() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Ignore localStorage errors.
  }
}

/** The state a card has before anyone has touched it. Priority is
 *  seeded from the severity so a critical card does not sit in the
 *  board as "medium" until somebody sets it. */
function defaultTask(rec: Recommendation): TaskMeta {
  return {
    status: "todo",
    contractor_id: null,
    deadline: null,
    priority: getDefaultPriority(rec),
  }
}

function taskMapFrom(rows: Assignment[]): Record<string, TaskMeta> {
  const map: Record<string, TaskMeta> = {}

  for (const row of rows) {
    if (!row?.task_key) continue

    map[row.task_key] = {
      status: (row.status ?? "todo") as Status,
      contractor_id: row.contractor_id ?? null,
      deadline: row.deadline ?? null,
      priority: (row.priority ?? "medium") as Priority,
    }
  }

  return map
}

function formatDeadline(deadline: string | null, tx: Tx) {
  if (!deadline) {
    return null
  }

  const date = new Date(`${deadline}T23:59:59`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toLocaleDateString(tx("fr-FR", "en-GB"), {
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
  const tx = useTx()

  const score = rec.risk_score

  if (score === null || score === undefined || !Number.isFinite(score)) {
    return null
  }

  const filled = Math.max(0, Math.min(10, Math.round(score / 10)))
  const tone = toneOf(rec)

  const srRisk = tx(
    `Risque ${Math.round(score)} sur 100`,
    `Risk ${Math.round(score)} out of 100`
  )

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

      <span className="sr-only">{srRisk}</span>
    </div>
  )
}

export function RecommendationsBoard({
  recommendations,
  opsType,
}: RecommendationsBoardProps) {
  const tx = useTx()

  /** Resolve a module-level pair. */
  const px = (text: Localized) => tx(text.fr, text.en)

  /* The company name is the partition these rows live under. It is read
     after mount, like every other stored value in the app, so the first
     client render cannot disagree with the server markup. */
  const { name: companyName } = useCompanyIdentity()

  /* Exposure is the operator's own rate times a real overrun, so the
     symbol is theirs too. It read euros for everyone before. */
  const { currency } = useLocale()

  const [taskMap, setTaskMap] = useState<Record<string, TaskMeta>>({})
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loaded, setLoaded] = useState(false)

  /* Two separate failures, because they need different words. One means
     the board is showing nothing when there may be something; the other
     means a change the administrator just made did not stick. */
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!companyName) {
      setLoaded(true)
      return
    }

    let cancelled = false

    async function load() {
      const [stored, people] = await Promise.all([
        fetchAssignments(companyName),
        fetchContractors(companyName),
      ])

      if (cancelled) return

      if (people.ok) setContractors(people.data)

      if (!stored.ok) {
        setLoadError(px(stored.detail))
        setLoaded(true)
        return
      }

      setLoadError(null)

      const map = taskMapFrom(stored.data)

      /* One-shot rescue of the assignments that were stranded in this
         browser before there was a server to hold them. Only when the
         server has none: if it already has rows, they are the truth and
         a stale local copy must not overwrite them. */
      const legacy = loadLegacyTaskMap()
      const legacyKeys = Object.keys(legacy)

      if (stored.data.length === 0 && legacyKeys.length > 0) {
        const pushed: string[] = []

        for (const key of legacyKeys) {
          const task = legacy[key]

          const result = await saveAssignment(companyName, {
            task_key: key,
            status: (task.status ?? "todo") as Status,
            priority: (task.priority ?? "medium") as Priority,
            deadline: task.deadline ?? null,
            /* The old shape called this "assignee" and its values were
               never real contractor ids, so they cannot be carried over
               without inventing a link. Status, priority and deadline
               are real; the assignment has to be made again. */
            contractor_id: null,
          })

          if (result.ok) pushed.push(key)
        }

        if (cancelled) return

        if (pushed.length === legacyKeys.length) {
          clearLegacyTaskMap()
        }

        for (const key of pushed) {
          map[key] = {
            status: (legacy[key].status ?? "todo") as Status,
            priority: (legacy[key].priority ?? "medium") as Priority,
            deadline: legacy[key].deadline ?? null,
            contractor_id: null,
          }
        }

        console.info(
          `[SentrIA] Migrated ${pushed.length}/${legacyKeys.length} board ` +
            "assignments out of localStorage and onto the server."
        )
      }

      setTaskMap(map)
      setLoaded(true)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [companyName])

  async function refreshContractors() {
    if (!companyName) return

    const people = await fetchContractors(companyName)

    if (people.ok) setContractors(people.data)
  }

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
        task: stored ?? defaultTask(rec),
      }
    })
  }, [recommendations, taskMap])

  const criticalCount = cards.filter(
    (card) => card.rec.severity === "CRITICAL"
  ).length

  const unassignedCount = cards.filter(
    (card) => !card.task.contractor_id
  ).length

  const totalExposure = cards.reduce(
    (sum, card) => sum + (card.rec.exposureEUR ?? 0),
    0
  )

  const visible = useMemo(() => {
    if (filter === "critical") {
      return cards.filter((card) => card.rec.severity === "CRITICAL")
    }

    if (filter === "unassigned") {
      return cards.filter((card) => !card.task.contractor_id)
    }

    return cards
  }, [cards, filter])

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: tx("Toutes", "All"), count: cards.length },
    { id: "critical", label: tx("Critiques", "Critical"), count: criticalCount },
    {
      id: "unassigned",
      label: tx("Non assignées", "Unassigned"),
      count: unassignedCount,
    },
  ]

  /** Apply a change, then persist it.
   *
   *  Optimistic, because waiting on a round trip before moving a card
   *  makes the board feel broken. But a rejected save is rolled back and
   *  said out loud: a board that keeps a change the server refused is
   *  lying about the state of the operation, which is worse than a board
   *  that feels slow.
   */
  function updateTask(id: string, patch: Partial<TaskMeta>) {
    const card = cards.find((entry) => entry.id === id)

    if (!card) return

    const before = taskMap[id]
    const next: TaskMeta = { ...card.task, ...patch }

    setTaskMap((current) => ({ ...current, [id]: next }))

    if (!companyName) {
      setSaveError(
        tx(
          "Aucun nom d'entreprise renseigné : la modification ne peut pas être enregistrée. Renseignez-le dans les Paramètres.",
          "No company name is set, so the change cannot be saved. Set it in Settings."
        )
      )
      return
    }

    saveAssignment(companyName, { task_key: id, ...next }).then((result) => {
      if (result.ok) {
        setSaveError(null)

        /* The open-task counts next to each contractor are derived from
           these rows, so they move whenever one does. */
        if ("contractor_id" in patch || "status" in patch) {
          refreshContractors()
        }

        return
      }

      setSaveError(px(result.detail))

      setTaskMap((current) => {
        const rolledBack = { ...current }

        if (before) rolledBack[id] = before
        else delete rolledBack[id]

        return rolledBack
      })
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

  const opsMeta = opsType ? OPS_TYPE_LABEL[opsType] : undefined
  const opsLabel = opsMeta ? px(opsMeta) : undefined

  if (recommendations.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-accent-foreground" />
        {tx(
          "Aucune priorité urgente pour ce secteur pour le moment. Tout est sous contrôle ici.",
          "No urgent priority for this sector right now. Everything here is under control."
        )}
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
            {opsLabel ?? tx("Opérations", "Operations")}
          </p>

          <h3 className="mt-1 font-heading text-2xl font-bold tracking-tight">
            {tx("Priorités du moment", "What matters now")}
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
              {tx("Priorités", "Priorities")}
            </dt>
            <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">
              {cards.length}
            </dd>
          </div>

          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {tx("Critiques", "Critical")}
            </dt>
            <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">
              {criticalCount}
            </dd>
          </div>

          {totalExposure > 0 && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {tx("Exposition", "Exposure")}
              </dt>
              <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">
                {formatMoney(totalExposure, currency, tx)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Nothing here is silent. A board that cannot read its
          assignments and a board that has none look identical, and a
          change that did not reach the server must not sit on screen
          looking saved. */}
      {loadError && (
        <p className="mt-5 rounded-2xl border border-dashed border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">
            {tx("Assignations non chargées.", "Assignments not loaded.")}
          </span>{" "}
          {loadError}{" "}
          {tx(
            "Les cartes ci-dessous sont réelles, mais leur statut et leur responsable ne sont pas ceux enregistrés.",
            "The cards below are real, but their status and owner are not the saved ones."
          )}
        </p>
      )}

      {saveError && (
        <p
          role="alert"
          className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-xs leading-5"
        >
          <span className="font-semibold text-destructive">
            {tx("Modification non enregistrée.", "Change not saved.")}
          </span>{" "}
          {saveError}{" "}
          {tx(
            "La carte a été remise dans son état précédent.",
            "The card has been put back the way it was."
          )}
        </p>
      )}

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
                  <p className="text-sm font-bold">{px(column.label)}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {px(column.hint)}
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
                      ? tx("Déposez une priorité ici", "Drop a priority here")
                      : tx("Rien dans ce filtre", "Nothing in this filter")}
                  </div>
                )}

                {columnCards.map(({ id, rec, task }) => {
                  const Icon = CATEGORY_ICON[rec.action_category] ?? Sparkles
                  const tone = toneOf(rec)
                  const isDragging = draggingId === id
                  const overdue = isDeadlineOverdue(task.deadline)

                  const assignee = contractors.find(
                    (person) => person.id === task.contractor_id
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
                          {formatMoney(rec.exposureEUR!, currency, tx)} exposés
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
                          {px(
                            CATEGORY_LABEL[rec.action_category] ??
                              CATEGORY_LABEL.other
                          )}
                        </span>

                        {(rec.downstream ?? 0) > 0 && (
                          <span className="rounded-md border border-brand/40 bg-brand/10 px-2 py-1 text-[9px] font-semibold">
                            {tx(
                              `${rec.downstream} en aval`,
                              `${rec.downstream} downstream`
                            )}
                          </span>
                        )}

                        {(rec.alertCount ?? 0) > 1 && (
                          <span className="rounded-md border border-border bg-background/60 px-2 py-1 text-[9px] font-medium text-muted-foreground">
                            {tx(
                              `${rec.alertCount} signaux`,
                              `${rec.alertCount} signals`
                            )}
                          </span>
                        )}

                        <span className="rounded-md border border-border bg-background/60 px-2 py-1 text-[9px] font-medium text-muted-foreground">
                          {px(PRIORITY_LABEL[task.priority])}
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
                                {tx("Assigner", "Assign")}
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
                            ? formatDeadline(task.deadline, tx)
                            : tx("Échéance", "Due date")}
                        </button>
                      </div>

                      <div className="pointer-events-none absolute bottom-1.5 right-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label={tx(
                            "Déplacer vers la colonne précédente",
                            "Move to the previous column"
                          )}
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
                          aria-label={tx(
                            "Déplacer vers la colonne suivante",
                            "Move to the next column"
                          )}
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
                              {tx(
                                "Détails de la priorité",
                                "Priority detail"
                              )}
                            </p>

                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label={tx("Fermer", "Close")}
                              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                            {tx("Responsable", "Owner")}
                          </label>

                          {/* Each option carries what the person said
                              about themselves and how much they are
                              already holding, because "disponible" next
                              to "4 en cours" is the case worth seeing
                              before handing them a fifth. */}
                          <select
                            value={task.contractor_id ?? ""}
                            onChange={(e) =>
                              updateTask(id, {
                                contractor_id: e.target.value || null,
                              })
                            }
                            className="mb-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-accent"
                          >
                            <option value="">
                              {tx("Non assigné", "Unassigned")}
                            </option>

                            {contractors.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name}
                                {" · "}
                                {px(AVAILABILITY_LABEL[person.availability])}
                                {person.open_assignments > 0 &&
                                  tx(
                                    ` · ${person.open_assignments} en cours`,
                                    ` · ${person.open_assignments} open`
                                  )}
                              </option>
                            ))}
                          </select>

                          {contractors.length === 0 && (
                            <p className="mb-3 text-[10px] leading-4 text-muted-foreground">
                              {loaded
                                ? tx(
                                    "Aucun intervenant enregistré. Ajoutez-les depuis Intervenants.",
                                    "No contractor on file. Add them from Contractors."
                                  )
                                : tx(
                                    "Chargement des intervenants…",
                                    "Loading contractors…"
                                  )}
                            </p>
                          )}

                          <label className="mb-1 mt-2 block text-[10px] font-medium text-muted-foreground">
                            {tx("Échéance", "Due date")}
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
                            {tx("Priorité", "Priority")}
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
                            <option value="low">
                              {px(PRIORITY_LABEL.low)}
                            </option>
                            <option value="medium">
                              {px(PRIORITY_LABEL.medium)}
                            </option>
                            <option value="high">
                              {px(PRIORITY_LABEL.high)}
                            </option>
                            <option value="critical">
                              {px(PRIORITY_LABEL.critical)}
                            </option>
                          </select>

                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {tx("Enregistrer", "Save")}
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
