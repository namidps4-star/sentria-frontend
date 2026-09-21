"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  Timer,
  UserRound,
  Wrench,
  X,
  Zap,
  ChevronDown,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCompanyIdentity } from "@/lib/company"
import { API_BASE } from "@/lib/api"
import {
  fetchAssignments,
  fetchContractors,
  type Assignment,
  type Contractor,
} from "@/lib/crm"
import { sectorLabel } from "@/lib/priorities"
import { localized, useTx, type Localized } from "@/lib/i18n"

type EventKind = "incident" | "threshold" | "deadline" | "resolved"
type ViewMode = "week" | "month"

type Recommendation = {
  id: string
  equipment: string
  sector?: string | null
  severity: "WARNING" | "CRITICAL" | string
  date: string
  message: string
  recommended_action?: string
  alert_key?: string | null
  action_category?: string
  risk_score?: number | null
  confidence?: number | null
}

type CalendarEvent = {
  id: string
  date: Date
  hasTime: boolean
  kind: EventKind
  severity: string
  sector: string | null
  equipment: string
  title: string
  detail: string
  recommendedAction: string | null
  riskScore: number | null
  confidence: number | null
  overdue: boolean
  assignees: Contractor[]
}

const NO_ROLE = "__no_role__"

const TYPE_LABEL: Record<EventKind, Localized> = {
  incident: localized("Incident", "Incident"),
  threshold: localized("Seuil critique", "Critical threshold"),
  deadline: localized("Échéance", "Deadline"),
  resolved: localized("Résolu", "Resolved"),
}

const TYPE_ICON: Record<EventKind, typeof AlertTriangle> = {
  incident: AlertTriangle,
  threshold: Timer,
  deadline: CalendarClock,
  resolved: CheckCircle2,
}

const TYPE_TONE: Record<EventKind, string> = {
  resolved: "bg-primary text-primary-foreground",
  threshold: "bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  incident: "bg-blue-600 text-white",
  deadline: "bg-accent text-accent-foreground",
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function mondayOf(date: Date): Date {
  const copy = startOfDay(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(copy, diff)
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function lastOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function normalizeRecommendations(
  raw: (Partial<Recommendation> & { id?: string | null })[]
): Recommendation[] {
  const usedIds = new Set<string>()

  return raw.map((rec, index) => {
    const baseId =
      rec.id ??
      [
        rec.alert_key ?? "",
        rec.equipment,
        rec.date,
        rec.action_category,
        rec.recommended_action,
      ].join("::")

    let id = String(baseId)

    if (usedIds.has(id)) id = `${id}::${index}`
    while (usedIds.has(id)) id = `${id}::${Math.random().toString(36).slice(2, 8)}`

    usedIds.add(id)

    return {
      id,
      equipment: rec.equipment ?? "",
      sector: rec.sector ?? null,
      severity: rec.severity ?? "WARNING",
      date: rec.date ?? "",
      message: rec.message ?? "",
      recommended_action: rec.recommended_action,
      alert_key: rec.alert_key,
      action_category: rec.action_category,
      risk_score: rec.risk_score ?? null,
      confidence: rec.confidence ?? null,
    }
  })
}

function buildEvents(
  recommendations: Recommendation[],
  assignments: Assignment[],
  contractorsById: Map<string, Contractor>
): CalendarEvent[] {
  const assignmentByTaskKey = new Map(assignments.map((a) => [a.task_key, a]))
  const today = startOfDay(new Date())
  const events: CalendarEvent[] = []

  for (const rec of recommendations) {
    const assignment = assignmentByTaskKey.get(rec.id)
    const alertDate = parseDate(rec.date)
    const deadlineDate = parseDate(assignment?.deadline ?? null)

    const assignees = (assignment?.contractor_ids ?? [])
      .map((id) => contractorsById.get(id))
      .filter((c): c is Contractor => Boolean(c))

    let kind: EventKind
    let placement: Date
    let hasTime: boolean

    if (assignment?.status === "done") {
      const resolvedOn = deadlineDate ?? alertDate
      if (!resolvedOn) continue
      kind = "resolved"
      placement = resolvedOn
      hasTime = false
    } else if (deadlineDate) {
      kind = "deadline"
      placement = deadlineDate
      hasTime = false
    } else if (alertDate) {
      kind = rec.severity === "CRITICAL" ? "incident" : "threshold"
      placement = alertDate
      hasTime = true
    } else {
      continue
    }

    events.push({
      id: rec.id,
      date: placement,
      hasTime,
      kind,
      severity: rec.severity,
      sector: rec.sector ?? null,
      equipment: rec.equipment,
      title: rec.recommended_action || rec.message,
      detail: rec.message,
      recommendedAction: rec.recommended_action ?? null,
      riskScore: rec.risk_score ?? null,
      confidence: rec.confidence ?? null,
      overdue: kind === "deadline" && startOfDay(placement) < today,
      assignees,
    })
  }

  return events
}

export function CalendarView() {
  const tx = useTx()
  const { name: companyName } = useCompanyIdentity()

  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loaded, setLoaded] = useState(false)

  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [activeSector, setActiveSector] = useState<string | null>(null)
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const recsPromise = fetch(
        `${API_BASE}/recommendations?limit=100&lang=${tx("fr", "en")}`
      )
        .then((r) => r.json())
        .then((d) => (Array.isArray(d?.recommendations) ? d.recommendations : []))
        .catch(() => [])

      const [recs, assignmentsResult, contractorsResult] = await Promise.all([
        recsPromise,
        companyName ? fetchAssignments(companyName) : Promise.resolve(null),
        companyName ? fetchContractors(companyName) : Promise.resolve(null),
      ])

      if (cancelled) return

      setRecommendations(normalizeRecommendations(recs))
      setAssignments(assignmentsResult?.ok ? assignmentsResult.data : [])
      setContractors(contractorsResult?.ok ? contractorsResult.data : [])
      setLoaded(true)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [companyName, tx])

  const contractorsById = useMemo(
    () => new Map(contractors.map((c) => [c.id, c])),
    [contractors]
  )

  const allEvents = useMemo(
    () => buildEvents(recommendations, assignments, contractorsById),
    [recommendations, assignments, contractorsById]
  )

  const monday = useMemo(
    () => addDays(mondayOf(new Date()), weekOffset * 7),
    [weekOffset]
  )
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  )

  const currentMonth = useMemo(() => {
    const base = new Date()
    base.setMonth(base.getMonth() + monthOffset)
    return base
  }, [monthOffset])

  const monthStart = useMemo(() => firstOfMonth(currentMonth), [currentMonth])
  const monthEnd = useMemo(() => lastOfMonth(currentMonth), [currentMonth])

  const monthGrid = useMemo(() => {
    const firstDay = monthStart.getDay()
    const offset = firstDay === 0 ? 6 : firstDay - 1
    const gridStart = addDays(monthStart, -offset)
    const rows: Date[][] = []
    let current = gridStart
    for (let r = 0; r < 6; r++) {
      const row: Date[] = []
      for (let c = 0; c < 7; c++) {
        row.push(current)
        current = addDays(current, 1)
      }
      rows.push(row)
    }
    return rows
  }, [monthStart])

  const weekEvents = useMemo(
    () => allEvents.filter((e) => weekDates.some((d) => sameDay(d, e.date))),
    [allEvents, weekDates]
  )

  const monthEvents = useMemo(
    () =>
      allEvents.filter(
        (e) => e.date >= startOfDay(monthStart) && e.date <= startOfDay(monthEnd)
      ),
    [allEvents, monthStart, monthEnd]
  )

  const sectorKeys = useMemo(() => {
    const source = viewMode === "month" ? monthEvents : weekEvents
    const seen: string[] = []
    for (const e of source) {
      if (e.sector && !seen.includes(e.sector)) seen.push(e.sector)
    }
    return seen
  }, [viewMode, weekEvents, monthEvents])

  const roleKeys = useMemo(() => {
    const seen: string[] = []
    for (const c of contractors) {
      const key = c.role?.trim() || NO_ROLE
      if (!seen.includes(key)) seen.push(key)
    }
    return seen
  }, [contractors])

  const visibleEvents = (viewMode === "month" ? monthEvents : weekEvents).filter((e) => {
    if (activeSector && e.sector !== activeSector) return false
    if (activeRole) {
      const roles = e.assignees.map((a) => a.role?.trim() || NO_ROLE)
      if (activeRole === NO_ROLE ? e.assignees.length > 0 : !roles.includes(activeRole))
        return false
    }
    return true
  })

  const stats = {
    deadlines: visibleEvents.filter((e) => e.kind === "deadline").length,
    incidents: visibleEvents.filter((e) => e.kind === "incident").length,
    thresholds: visibleEvents.filter((e) => e.kind === "threshold").length,
  }

  const equipmentCount = new Set(visibleEvents.map((e) => e.equipment)).size

  const weekLabel = tx("fr-FR", "en-GB")
  const rangeLabel = `${new Intl.DateTimeFormat(weekLabel, {
    day: "numeric",
    month: "short",
  }).format(monday)} – ${new Intl.DateTimeFormat(weekLabel, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(weekDates[6])}`

  const monthLabel = new Intl.DateTimeFormat(weekLabel, {
    month: "long",
    year: "numeric",
  }).format(currentMonth)

  const dayLabelFormatter = new Intl.DateTimeFormat(weekLabel, { weekday: "short" })
  const dayLabelShort = new Intl.DateTimeFormat(weekLabel, { weekday: "narrow" })
  const timeFormatter = new Intl.DateTimeFormat(weekLabel, {
    hour: "2-digit",
    minute: "2-digit",
  })

  const today = startOfDay(new Date())

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of visibleEvents) {
      const key = e.date.toISOString().split("T")[0]
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
    return map
  }, [visibleEvents])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return []
    return (eventsByDay.get(selectedDay.toISOString().split("T")[0]) ?? []).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    )
  }, [selectedDay, eventsByDay])

  return (
    <div className="flex flex-col gap-6">
      {/* BANNER */}
      <div className="flex flex-col gap-4 rounded-3xl bg-sidebar p-6 text-sidebar-foreground md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Zap className="h-3.5 w-3.5" />
            {tx("Temps réel", "Live")}
          </span>

          <h2 className="mt-3 text-balance font-heading text-2xl font-bold leading-tight md:text-3xl">
            {tx(
              "Qu'est-ce qui arrive cette semaine ?",
              "What's coming up this week?"
            )}
          </h2>

          <p className="mt-2 text-pretty text-sm text-sidebar-foreground/70">
            {tx(
              "Échéances, seuils critiques et incidents, réunis en un coup d'œil.",
              "Deadlines, critical thresholds and incidents, brought together at a glance."
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            document
              .getElementById("calendar-grid")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
        >
          {tx("Voir le calendrier", "View calendar")}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {!companyName && (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-xs leading-5 text-muted-foreground">
          {tx(
            "Renseignez le nom de votre entreprise dans les Paramètres pour voir les échéances et qui est assigné.",
            "Set your company name in Settings to see deadlines and who's assigned."
          )}
        </p>
      )}

      {/* HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
            {viewMode === "week" ? rangeLabel : monthLabel}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {viewMode === "week"
              ? tx("Semaine de travail", "Work week")
              : tx("Vue mensuelle", "Monthly view")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "week"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tx("Semaine", "Week")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "month"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tx("Mois", "Month")}
            </button>
          </div>

          {viewMode === "week" ? (
            <>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                aria-label={tx("Semaine précédente", "Previous week")}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tx("Aujourd'hui", "Today")}
              </button>

              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label={tx("Semaine suivante", "Next week")}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMonthOffset((m) => m - 1)}
                aria-label={tx("Mois précédent", "Previous month")}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setMonthOffset(0)}
                disabled={monthOffset === 0}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tx("Ce mois", "This month")}
              </button>

              <button
                type="button"
                onClick={() => setMonthOffset((m) => m + 1)}
                aria-label={tx("Mois suivant", "Next month")}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          <span className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
            <Wrench className="h-3.5 w-3.5 text-accent" />
            {equipmentCount}{" "}
            {equipmentCount > 1
              ? tx("équipements suivis", "assets tracked")
              : tx("équipement suivi", "asset tracked")}
          </span>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className="relative flex flex-col justify-between overflow-hidden rounded-3xl p-6"
          style={{
            background: "linear-gradient(135deg, #d9f36e 0%, #b8d84a 100%)",
            minHeight: "180px",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "#1d1d1b", opacity: 0.6 }}
              >
                {tx("Échéances", "Deadlines")}
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "#1d1d1b" }}
              >
                {tx("à traiter cette semaine", "due this week")}
              </p>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(29, 29, 27, 0.1)" }}
            >
              <CalendarClock
                className="h-5 w-5"
                style={{ color: "#1d1d1b" }}
              />
            </div>
          </div>

          <div className="mt-4">
            <p
              className="font-heading text-6xl font-black leading-none tracking-tight"
              style={{ color: "#1d1d1b" }}
            >
              {loaded ? stats.deadlines : "—"}
            </p>
          </div>

          <div
            className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full opacity-20"
            style={{ backgroundColor: "#1d1d1b" }}
          />
        </div>

        <div
          className="relative flex flex-col justify-between overflow-hidden rounded-3xl p-6"
          style={{
            background: "#0f1a14",
            border: "1px solid rgba(217, 243, 110, 0.2)",
            minHeight: "180px",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "#d9f36e", opacity: 0.7 }}
              >
                {tx("Incidents actifs", "Active incidents")}
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "#e8e8e6" }}
              >
                {tx("détectés cette semaine", "detected this week")}
              </p>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(217, 243, 110, 0.15)" }}
            >
              <AlertTriangle
                className="h-5 w-5"
                style={{ color: "#d9f36e" }}
              />
            </div>
          </div>

          <div className="mt-4">
            <p
              className="font-heading text-6xl font-black leading-none tracking-tight"
              style={{ color: "#d9f36e" }}
            >
              {loaded ? stats.incidents : "—"}
            </p>
          </div>

          <div
            className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full opacity-10"
            style={{ backgroundColor: "#d9f36e" }}
          />
        </div>

        <div
          className="relative flex flex-col justify-between overflow-hidden rounded-3xl p-6"
          style={{
            background: "#0f1a14",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            minHeight: "180px",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "#ef4444", opacity: 0.8 }}
              >
                {tx("Seuils critiques", "Critical thresholds")}
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "#e8e8e6" }}
              >
                {tx("à risque de dépassement", "at risk of being breached")}
              </p>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(239, 68, 68, 0.15)" }}
            >
              <Timer
                className="h-5 w-5"
                style={{ color: "#ef4444" }}
              />
            </div>
          </div>

          <div className="mt-4">
            <p
              className="font-heading text-6xl font-black leading-none tracking-tight"
              style={{ color: "#ef4444" }}
            >
              {loaded ? stats.thresholds : "—"}
            </p>
          </div>

          <div
            className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full opacity-10"
            style={{ backgroundColor: "#ef4444" }}
          />
        </div>
      </div>

      {/* FILTERS */}
      {(sectorKeys.length > 1 || roleKeys.length > 1) && (
        <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-border bg-card p-4">
          {sectorKeys.length > 1 && (
            <>
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {tx("Secteur", "Sector")}
              </span>
              <button
                type="button"
                onClick={() => setActiveSector(null)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                  activeSector === null
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {tx("Tous", "All")}
              </button>
              {sectorKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSector(key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                    activeSector === key
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {sectorLabel(key, tx)}
                </button>
              ))}
            </>
          )}

          {sectorKeys.length > 1 && roleKeys.length > 1 && (
            <span className="mx-1 h-5 w-px shrink-0 bg-border" />
          )}

          {roleKeys.length > 1 && (
            <>
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {tx("Département", "Department")}
              </span>
              <button
                type="button"
                onClick={() => setActiveRole(null)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                  activeRole === null
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {tx("Tous", "All")}
              </button>
              {roleKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveRole(key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                    activeRole === key
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  {key === NO_ROLE ? tx("Sans fonction", "No role") : key}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* MONTH VIEW — October-style aesthetics */}
      {viewMode === "month" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          {/* Calendar grid */}
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: "#c8e06a",
              border: "1px solid rgba(29, 29, 27, 0.1)",
            }}
          >
            {/* Lime header */}
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "#1d1d1b", opacity: 0.55 }}
                >
                  {tx("Calendrier", "Calendar")}
                </p>
                <h3
                  className="mt-0.5 font-heading text-2xl font-black tracking-tight"
                  style={{ color: "#1d1d1b" }}
                >
                  {monthLabel}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMonthOffset((m) => m - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1d1d1b]/20 bg-white/30 text-[#1d1d1b] transition-colors hover:bg-white/50"
                  aria-label={tx("Mois précédent", "Previous month")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMonthOffset(0)}
                  disabled={monthOffset === 0}
                  className="rounded-full border border-[#1d1d1b]/20 bg-white/30 px-3 py-1.5 text-xs font-semibold text-[#1d1d1b] transition-colors hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tx("Aujourd'hui", "Today")}
                </button>
                <button
                  type="button"
                  onClick={() => setMonthOffset((m) => m + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1d1d1b]/20 bg-white/30 text-[#1d1d1b] transition-colors hover:bg-white/50"
                  aria-label={tx("Mois suivant", "Next month")}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div
              className="grid grid-cols-7 border-t border-[#1d1d1b]/10"
              style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
            >
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(mondayOf(new Date()), i)
                return (
                  <div
                    key={i}
                    className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "#1d1d1b", opacity: 0.7 }}
                  >
                    {dayLabelShort.format(d)}
                  </div>
                )
              })}
            </div>

            {/* Day cells */}
            <div
              className="grid grid-cols-7"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              {monthGrid.flat().map((day, idx) => {
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
                const isToday = sameDay(day, today)
                const isSelected =
                  selectedDay !== null && sameDay(day, selectedDay)
                const key = day.toISOString().split("T")[0]
                const dayEvts = eventsByDay.get(key) ?? []

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setSelectedDay(isSelected ? null : day)
                    }
                    className={cn(
                      "relative flex min-h-[110px] flex-col border-b border-r border-[#1d1d1b]/10 p-1.5 text-left transition-colors",
                      !isCurrentMonth && "opacity-30",
                      isToday && "bg-white/40",
                      isSelected && "bg-white/60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                          isToday
                            ? "bg-[#1d1d1b] text-[#c8e06a]"
                            : "text-[#1d1d1b]"
                        )}
                      >
                        {day.getDate()}
                      </span>
                      {dayEvts.length > 0 && (
                        <span
                          className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[9px] font-bold"
                          style={{
                            backgroundColor: "#1d1d1b",
                            color: "#c8e06a",
                          }}
                        >
                          {dayEvts.length}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-col gap-1">
                      {dayEvts.slice(0, 3).map((event) => {
                        const Icon = TYPE_ICON[event.kind]
                        return (
                          <div
                            key={event.id}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-1.5 py-1 text-left shadow-sm",
                              event.kind === "deadline" &&
                                "bg-[#1d1d1b] text-[#c8e06a]",
                              event.kind === "incident" &&
                                "bg-[#2563eb] text-white",
                              event.kind === "threshold" &&
                                "bg-[#ef4444]/90 text-white",
                              event.kind === "resolved" &&
                                "bg-white text-[#1d1d1b]"
                            )}
                          >
                            <Icon className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate text-[9px] font-semibold leading-tight">
                              {event.title}
                            </span>
                          </div>
                        )
                      })}
                      {dayEvts.length > 3 && (
                        <span className="text-[9px] font-semibold text-[#1d1d1b]/70">
                          +{dayEvts.length - 3}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected day detail — workout-card style */}
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: "#0f1a14",
              border: "1px solid rgba(217, 243, 110, 0.15)",
            }}
          >
            <div className="px-5 py-4">
              {selectedDay ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: "#d9f36e", opacity: 0.7 }}
                      >
                        {tx("Détails du jour", "Day details")}
                      </p>
                      <h3
                        className="mt-0.5 font-heading text-xl font-black tracking-tight"
                        style={{ color: "#ffffff" }}
                      >
                        {new Intl.DateTimeFormat(weekLabel, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        }).format(selectedDay)}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:bg-white/5"
                      aria-label={tx("Fermer", "Close")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                      style={{
                        backgroundColor: "#d9f36e",
                        color: "#1d1d1b",
                      }}
                    >
                      <Wrench className="h-3 w-3" />
                      {selectedDayEvents.length}{" "}
                      {selectedDayEvents.length > 1
                        ? tx("événements", "events")
                        : tx("événement", "event")}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: "#d9f36e", opacity: 0.7 }}
                  >
                    {tx("Sélectionnez un jour", "Select a day")}
                  </p>
                  <h3
                    className="mt-0.5 font-heading text-xl font-black tracking-tight"
                    style={{ color: "#ffffff" }}
                  >
                    {tx("Aperçu du mois", "Month overview")}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-white/60">
                    {tx(
                      "Touchez une journée du calendrier pour voir ses événements en détail.",
                      "Tap a day on the calendar to see its events in detail."
                    )}
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2 px-5 pb-5">
              {selectedDay ? (
                selectedDayEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
                    <Inbox
                      className="mx-auto h-6 w-6 text-white/40"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-xs text-white/50">
                      {tx("Rien ce jour-là", "Nothing on this day")}
                    </p>
                  </div>
                ) : (
                  selectedDayEvents.map((event) => {
                    const Icon = TYPE_ICON[event.kind]
                    const isResolved = event.kind === "resolved"
                    const isDeadline = event.kind === "deadline"
                    const isIncident = event.kind === "incident"
                    const isThreshold = event.kind === "threshold"

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelected(event.id)}
                        className={cn(
                          "w-full rounded-2xl border p-3 text-left transition-transform hover:-translate-y-0.5",
                          isDeadline &&
                            "border-[#d9f36e]/30 bg-[#d9f36e]/10",
                          isIncident &&
                            "border-[#2563eb]/30 bg-[#2563eb]/10",
                          isThreshold &&
                            "border-[#ef4444]/30 bg-[#ef4444]/10",
                          isResolved &&
                            "border-white/10 bg-white/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                isDeadline && "bg-[#d9f36e]/20",
                                isIncident && "bg-[#2563eb]/20",
                                isThreshold && "bg-[#ef4444]/20",
                                isResolved && "bg-white/10"
                              )}
                            >
                              <Icon
                                className={cn(
                                  "h-4 w-4",
                                  isDeadline && "text-[#d9f36e]",
                                  isIncident && "text-[#60a5fa]",
                                  isThreshold && "text-[#ef4444]",
                                  isResolved && "text-white/70"
                                )}
                              />
                            </div>

                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-bold"
                                style={{ color: "#ffffff" }}
                              >
                                {event.title}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-white/50">
                                {event.detail}
                              </p>
                            </div>
                          </div>

                          {event.overdue && (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
                              style={{
                                backgroundColor: "#ef4444",
                                color: "#ffffff",
                              }}
                            >
                              {tx("En retard", "Overdue")}
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: "#d9f36e",
                              color: "#1d1d1b",
                            }}
                          >
                            {tx(TYPE_LABEL[event.kind].fr, TYPE_LABEL[event.kind].en)}
                          </span>

                          {event.sector && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/70">
                              {sectorLabel(event.sector, tx)}
                            </span>
                          )}

                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/70">
                            {event.equipment}
                          </span>

                          {event.hasTime && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/70">
                              {timeFormatter.format(event.date)}
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {event.assignees.length > 0 ? (
                              <div className="flex -space-x-1.5">
                                {event.assignees.slice(0, 3).map((p) => (
                                  <span
                                    key={p.id}
                                    title={p.name}
                                    className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0f1a14] bg-[#d9f36e] text-[8px] font-bold text-[#1d1d1b]"
                                  >
                                    {getInitials(p.name)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-white/20 text-white/40">
                                <UserRound className="h-2.5 w-2.5" />
                              </span>
                            )}
                            <span className="text-[9px] text-white/50">
                              {event.assignees.length > 0
                                ? `${event.assignees.length} ${tx("assigné(s)", "assigned")}`
                                : tx("Non assigné", "Unassigned")}
                            </span>
                          </div>

                          <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                        </div>
                      </button>
                    )
                  })
                )
              ) : (
                /* Month summary list */
                <div className="space-y-2">
                  {visibleEvents
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .slice(0, 8)
                    .map((event) => {
                      const Icon = TYPE_ICON[event.kind]
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => {
                            setSelectedDay(event.date)
                            setSelected(event.id)
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10"
                        >
                          <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-[#d9f36e]/15">
                            <span
                              className="text-[8px] font-bold uppercase leading-none"
                              style={{ color: "#d9f36e" }}
                            >
                              {new Intl.DateTimeFormat(weekLabel, {
                                month: "short",
                              })
                                .format(event.date)
                                .slice(0, 3)}
                            </span>
                            <span
                              className="text-sm font-black leading-none"
                              style={{ color: "#d9f36e" }}
                            >
                              {event.date.getDate()}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-white">
                              {event.title}
                            </p>
                            <p className="truncate text-[10px] text-white/50">
                              {event.equipment}
                            </p>
                          </div>

                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              event.kind === "deadline" && "text-[#d9f36e]",
                              event.kind === "incident" && "text-[#60a5fa]",
                              event.kind === "threshold" && "text-[#ef4444]",
                              event.kind === "resolved" && "text-white/60"
                            )}
                          />
                        </button>
                      )
                    })}

                  {visibleEvents.length > 8 && (
                    <p className="text-center text-[10px] text-white/40">
                      +{visibleEvents.length - 8}{" "}
                      {tx("autres événements", "more events")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WEEK AGENDA */}
      {viewMode === "week" && (
        <div id="calendar-grid" className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          {!loaded ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {tx("Chargement du calendrier…", "Loading the calendar…")}
            </div>
          ) : allEvents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="font-heading text-base font-bold">
                {tx("Rien à afficher", "Nothing to show")}
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                {tx(
                  "Le calendrier se remplit dès qu'une alerte est détectée ou qu'une échéance est fixée sur le tableau des priorités.",
                  "The calendar fills in as soon as an alert is detected or a deadline is set on the priorities board."
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
              {weekDates.map((day) => {
                const isToday = sameDay(day, today)
                const dayEvents = visibleEvents
                  .filter((e) => sameDay(e.date, day))
                  .sort((a, b) => a.date.getTime() - b.date.getTime())

                return (
                  <div key={day.toISOString()} className="min-w-[150px]">
                    <div
                      className={cn(
                        "mb-2 flex items-center justify-between rounded-xl px-2.5 py-1.5",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                        {dayLabelFormatter.format(day)}
                      </span>
                      <span className="font-heading text-sm font-bold">
                        {day.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {dayEvents.length === 0 && (
                        <p className="rounded-xl border border-dashed border-border/60 px-2 py-3 text-center text-[10px] text-muted-foreground">
                          {tx("Rien", "Nothing")}
                        </p>
                      )}

                      {dayEvents.map((event) => {
                        const Icon = TYPE_ICON[event.kind]
                        const isOpen = selected === event.id

                        return (
                          <div key={event.id} className="relative">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelected(isOpen ? null : event.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  setSelected(isOpen ? null : event.id)
                                }
                              }}
                              className={cn(
                                "flex cursor-pointer flex-col gap-0.5 rounded-xl px-2.5 py-1.5 text-left shadow-sm transition-transform hover:-translate-y-0.5",
                                TYPE_TONE[event.kind]
                              )}
                            >
                              <div className="flex items-center gap-1">
                                <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="truncate text-[10px] font-bold">
                                  {event.title}
                                </span>
                              </div>

                              <span className="truncate text-[9px] opacity-80">
                                {event.hasTime
                                  ? timeFormatter.format(event.date)
                                  : tx("Toute la journée", "All day")}
                              </span>

                              {event.overdue && (
                                <span className="text-[9px] font-bold">
                                  {tx("En retard", "Overdue")}
                                </span>
                              )}
                            </div>

                            {isOpen && (
                              <div
                                className="absolute left-0 top-full z-40 mt-2 w-64 rounded-3xl bg-popover p-4 text-foreground shadow-xl"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                      TYPE_TONE[event.kind]
                                    )}
                                  >
                                    <Icon className="h-3 w-3" aria-hidden="true" />
                                    {tx(TYPE_LABEL[event.kind].fr, TYPE_LABEL[event.kind].en)}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => setSelected(null)}
                                    className="rounded-md p-0.5 text-muted-foreground hover:bg-muted"
                                    aria-label={tx("Fermer", "Close")}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <p className="mt-2.5 text-sm font-bold leading-snug">
                                  {event.detail}
                                </p>

                                <div className="mt-2 rounded-xl bg-muted/60 px-2.5 py-2">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {tx("Recommandation", "Recommendation")}
                                  </p>
                                  <p className="mt-0.5 text-[11px] leading-4 text-foreground">
                                    {event.recommendedAction ??
                                      tx(
                                        "Aucune recommandation disponible.",
                                        "No recommendation available."
                                      )}
                                  </p>
                                </div>

                                <div className="mt-2 flex gap-1.5">
                                  <div className="flex-1 rounded-xl border border-border px-2.5 py-1.5 text-center">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
                                      {tx("Risque", "Risk")}
                                    </p>
                                    <p className="text-xs font-bold tabular-nums">
                                      {event.riskScore != null ? `${event.riskScore}/100` : "—"}
                                    </p>
                                  </div>
                                  <div className="flex-1 rounded-xl border border-border px-2.5 py-1.5 text-center">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
                                      {tx("Confiance", "Confidence")}
                                    </p>
                                    <p className="text-xs font-bold tabular-nums">
                                      {event.confidence != null ? `${event.confidence}%` : "—"}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-semibold text-foreground/80">
                                    {event.equipment}
                                  </span>
                                  {event.sector && (
                                    <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-semibold text-foreground/80">
                                      {sectorLabel(event.sector, tx)}
                                    </span>
                                  )}
                                  <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-semibold text-foreground/80">
                                    {event.hasTime
                                      ? timeFormatter.format(event.date)
                                      : tx("Toute la journée", "All day")}
                                  </span>
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                  <p className="text-[10px] font-medium text-muted-foreground">
                                    {tx("Assigné à", "Assigned to")}
                                  </p>

                                  {event.assignees.length > 0 ? (
                                    <div className="flex -space-x-1.5">
                                      {event.assignees.map((person) => (
                                        <span
                                          key={person.id}
                                          title={`${person.name}${person.role ? ` — ${person.role}` : ""}`}
                                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-popover bg-accent text-[9px] font-bold text-accent-foreground"
                                        >
                                          {getInitials(person.name)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                                      <UserRound className="h-3 w-3" />
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setSelected(null)}
                                  className="mt-3 w-full rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-accent-foreground transition-colors hover:bg-accent/90"
                                >
                                  {tx("Fermer", "Close")}
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
          )}
        </div>
      )}

      {/* LEGEND */}
      <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] text-muted-foreground">
        {(Object.keys(TYPE_LABEL) as EventKind[]).map((kind) => {
          const Icon = TYPE_ICON[kind]
          return (
            <div key={kind} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {tx(TYPE_LABEL[kind].fr, TYPE_LABEL[kind].en)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
