"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
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
} from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useCompanyIdentity } from "@/lib/company"
import { inAccountScope, readSectors } from "@/lib/activities"
import { API_BASE, apiFetch } from "@/lib/api"
import { fromApiSector } from "@/lib/sector"
import {
  fetchAssignments,
  fetchContractors,
  taskKeyFor,
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
  business_type?: string | null
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

/* The same colours as the severity tags: an incident is a critical alert
   (solid red), a threshold at risk a warning (solid amber). */
const TYPE_TONE: Record<EventKind, string> = {
  resolved: "bg-primary text-primary-foreground",
  threshold: "bg-[var(--tag-warning-bg)] text-[var(--tag-warning-fg)]",
  incident: "bg-[var(--tag-danger-bg)] text-[var(--tag-danger-fg)]",
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
      // Our spelling (retail -> commerce), as the account's sectors are.
      sector: fromApiSector(rec.sector) || null,
      business_type: rec.business_type ?? null,
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

function readBusinessType(): string | null {
  try {
    return localStorage.getItem("sentria_business_type")
  } catch {
    return null
  }
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
    // taskKeyFor first: the tracking board and "Mark handled" save under
    // it, so their deadlines and status land on the calendar (P-TRACK).
    const assignment =
      assignmentByTaskKey.get(taskKeyFor(rec)) ??
      assignmentByTaskKey.get(rec.id)
    // F-SUPPRESS: a card the user dismissed is not on the calendar.
    if (assignment?.status === "dismissed") continue

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
      const recsPromise = apiFetch(
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

      // Only the account's sectors and activity, as on the dashboard.
      setRecommendations(
        inAccountScope(
          normalizeRecommendations(recs),
          readSectors(),
          readBusinessType()
        )
      )
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

  const monthName = new Intl.DateTimeFormat(weekLabel, {
    month: "long",
  }).format(currentMonth)

  const monthYear = currentMonth.getFullYear()

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

  // Compact month overview: only today + next 4 days with events (max 5 days)
  const upcomingDays = useMemo(() => {
    const daysWithEvents: Array<{ date: Date; events: CalendarEvent[] }> = []
    const todayKey = today.toISOString().split("T")[0]

    // Check today + next 14 days, collect first 5 days that have events
    for (let i = 0; i < 14 && daysWithEvents.length < 5; i++) {
      const checkDay = addDays(today, i)
      const key = checkDay.toISOString().split("T")[0]
      const dayEvts = eventsByDay.get(key) ?? []
      if (dayEvts.length > 0) {
        daysWithEvents.push({ date: checkDay, events: dayEvts })
      }
    }

    // If today has no events, still show it as empty for context
    if (daysWithEvents.length === 0 || !sameDay(daysWithEvents[0].date, today)) {
      daysWithEvents.unshift({ date: today, events: eventsByDay.get(todayKey) ?? [] })
    }

    return daysWithEvents.slice(0, 5)
  }, [eventsByDay, today])

  const selectedDayCounts = useMemo(() => {
    const counts: Record<EventKind, number> = {
      incident: 0,
      threshold: 0,
      deadline: 0,
      resolved: 0,
    }
    for (const e of selectedDayEvents) {
      counts[e.kind] += 1
    }
    return counts
  }, [selectedDayEvents])

  return (
    <div className="flex flex-col gap-6">
      {/* The Ask SentrIA layout: lime card (which view), grey panel (the
          period, its controls and filters, in words), black card (the
          week's three counts). */}
      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_290px]">
        {/* -------------------------------------------------------- LEFT */}
        <div className="rounded-[28px] bg-brand p-5 text-[#141414]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">SentrIA</span>
              <span className="block text-[11px] text-[#141414]/65">{tx("Calendrier", "Calendar")}</span>
            </span>
          </div>

          <p className="mt-5 font-heading text-2xl font-semibold leading-tight tracking-tight">
            {tx("Qu'est-ce qui arrive cette semaine ?", "What's coming up this week?")}
          </p>

          <div className="mt-4 flex items-center rounded-full bg-white/70 p-1" role="group" aria-label={tx("Affichage", "View")}>
            {(["week", "month"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]",
                  viewMode === mode ? "bg-[var(--ink)] text-white" : "text-[#141414]/70 hover:text-[#141414]"
                )}
              >
                {mode === "week" ? tx("Semaine", "Week") : tx("Mois", "Month")}
              </button>
            ))}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            {equipmentCount}{" "}
            {equipmentCount > 1
              ? tx("équipements suivis", "assets tracked")
              : tx("équipement suivi", "asset tracked")}
          </p>
        </div>

        {/* ------------------------------------------------------ CENTER */}
        <section className="flex flex-col rounded-[28px] bg-foreground/[0.055] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-heading text-3xl font-semibold leading-[1.05] tracking-tight">
                {viewMode === "week" ? rangeLabel : `${monthName} ${monthYear}`}
              </h2>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-brand ring-2 ring-brand/30" aria-hidden="true" />
                {viewMode === "week" ? tx("Semaine de travail", "Work week") : tx("Vue mensuelle", "Monthly view")}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => (viewMode === "week" ? setWeekOffset((w) => w - 1) : setMonthOffset((m) => m - 1))}
                aria-label={viewMode === "week" ? tx("Semaine précédente", "Previous week") : tx("Mois précédent", "Previous month")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-card transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => (viewMode === "week" ? setWeekOffset(0) : setMonthOffset(0))}
                disabled={viewMode === "week" ? weekOffset === 0 : monthOffset === 0}
                className="rounded-full bg-card px-4 py-2 text-xs font-semibold transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                {viewMode === "week" ? tx("Aujourd'hui", "Today") : tx("Ce mois", "This month")}
              </button>
              <button
                type="button"
                onClick={() => (viewMode === "week" ? setWeekOffset((w) => w + 1) : setMonthOffset((m) => m + 1))}
                aria-label={viewMode === "week" ? tx("Semaine suivante", "Next week") : tx("Mois suivant", "Next month")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-card transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 max-w-[85%] self-start rounded-[22px] bg-[var(--ink)] p-4 text-sm leading-relaxed text-white">
            {!companyName
              ? tx(
                  "Renseignez le nom de votre entreprise dans les Paramètres pour voir les échéances et qui est assigné.",
                  "Set your company name in Settings to see deadlines and who's assigned."
                )
              : !loaded
                ? tx("Je rassemble vos échéances…", "Gathering your deadlines…")
                : tx(
                    `Cette semaine : ${stats.deadlines} échéance${stats.deadlines > 1 ? "s" : ""}, ${stats.incidents} incident${stats.incidents > 1 ? "s" : ""} actif${stats.incidents > 1 ? "s" : ""} et ${stats.thresholds} seuil${stats.thresholds > 1 ? "s" : ""} critique${stats.thresholds > 1 ? "s" : ""} à surveiller.`,
                    `This week: ${stats.deadlines} deadline${stats.deadlines === 1 ? "" : "s"}, ${stats.incidents} active incident${stats.incidents === 1 ? "" : "s"} and ${stats.thresholds} critical threshold${stats.thresholds === 1 ? "" : "s"} to watch.`
                  )}
          </div>

          {/* FILTERS */}
          {(sectorKeys.length > 1 || roleKeys.length > 1) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {sectorKeys.length > 1 && (
                <>
                  <span className="px-1 text-xs text-muted-foreground">{tx("Secteur :", "Sector:")}</span>
                  {[null, ...sectorKeys].map((key) => (
                    <button
                      key={key ?? "all"}
                      type="button"
                      onClick={() => setActiveSector(key)}
                      aria-pressed={activeSector === key}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activeSector === key ? "bg-brand text-[#141414]" : "bg-card hover:bg-card/70"
                      )}
                    >
                      {key === null ? tx("Tous", "All") : sectorLabel(key, tx)}
                    </button>
                  ))}
                </>
              )}

              {roleKeys.length > 1 && (
                <>
                  <span className="px-1 text-xs text-muted-foreground">{tx("Département :", "Department:")}</span>
                  {[null, ...roleKeys].map((key) => (
                    <button
                      key={key ?? "all"}
                      type="button"
                      onClick={() => setActiveRole(key)}
                      aria-pressed={activeRole === key}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activeRole === key ? "bg-brand text-[#141414]" : "bg-card hover:bg-card/70"
                      )}
                    >
                      {key === null ? tx("Tous", "All") : key === NO_ROLE ? tx("Sans fonction", "No role") : key}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        {/* ------------------------------------------------------- RIGHT */}
        <div className="rounded-[28px] bg-[var(--ink)] p-5 text-white lg:col-start-2 xl:col-start-auto">
          <div className="flex items-center justify-between">
            <p className="font-heading text-xl font-semibold tracking-tight">{tx("Cette semaine", "This week")}</p>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">{tx("En direct", "Live")}</span>
          </div>
          <dl className="mt-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-white/55">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {tx("Échéances à traiter", "Deadlines due")}
              </dt>
              <dd className="font-semibold tabular-nums">{loaded ? stats.deadlines : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-white/55">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {tx("Incidents actifs", "Active incidents")}
              </dt>
              <dd className="font-semibold tabular-nums">{loaded ? stats.incidents : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-white/55">
                <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                {tx("Seuils à risque", "Thresholds at risk")}
              </dt>
              <dd className={cn("font-semibold tabular-nums", loaded && stats.thresholds > 0 && "text-[#ffd97a]")}>
                {loaded ? stats.thresholds : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
            <span className="text-xs text-white/55">{tx("Échéances cette semaine", "Deadlines this week")}</span>
            <span className="font-heading text-4xl font-bold leading-none text-brand">{loaded ? stats.deadlines : "—"}</span>
          </div>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === "month" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          {/* October-style calendar */}
          <div className="overflow-hidden rounded-[28px] bg-card shadow-sm">
            <div
              className="px-6 pt-6 pb-4"
              style={{
                background: "linear-gradient(135deg, #d9f36e 0%, #c8e06a 100%)",
              }}
            >
              <h1
                className="font-heading leading-none tracking-tighter"
                style={{
                  fontSize: "clamp(3rem, 8vw, 5rem)",
                  fontWeight: 900,
                  color: "#1d1d1b",
                  letterSpacing: "-0.04em",
                }}
              >
                {monthName}
              </h1>
            </div>

            <div className="grid grid-cols-7 border-b border-border bg-card">
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(mondayOf(new Date()), i)
                return (
                  <div
                    key={i}
                    className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {dayLabelShort.format(d)}
                  </div>
                )
              })}
            </div>

            <div className="bg-card px-4 py-2 text-center border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground">
                {monthName} {monthYear}
              </span>
            </div>

            <div className="grid grid-cols-7 bg-card">
              {monthGrid.flat().map((day, idx) => {
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
                const isToday = sameDay(day, today)
                const isSelected =
                  selectedDay !== null && sameDay(day, selectedDay)
                const key = day.toISOString().split("T")[0]
                const dayEvts = eventsByDay.get(key) ?? []
                const hasEvents = dayEvts.length > 0
                const hasDeadline = dayEvts.some((e) => e.kind === "deadline")

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setSelectedDay(isSelected ? null : day)
                    }
                    className={cn(
                      "relative flex min-h-[90px] flex-col border-b border-r border-border p-1.5 text-left transition-all",
                      !isCurrentMonth && "bg-muted opacity-40",
                      isSelected && "bg-foreground/5",
                      hasDeadline && !isSelected && "bg-brand/15"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          "text-[11px] font-bold",
                          isToday
                            ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ink)] text-brand"
                            : isSelected
                            ? "text-foreground"
                            : "text-foreground/70"
                        )}
                      >
                        {day.getDate()}
                      </span>
                      {hasEvents && (
                        <span
                          className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[8px] font-black"
                          style={{
                            backgroundColor: "#d9f36e",
                            color: "#1d1d1b",
                          }}
                        >
                          {dayEvts.length}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-0.5">
                      {dayEvts.slice(0, 2).map((event) => {
                        const Icon = TYPE_ICON[event.kind]
                        return (
                          <div
                            key={event.id}
                            className="flex items-center gap-1 rounded-md bg-[var(--ink)] px-1.5 py-1 shadow-sm"
                          >
                            <Icon className="h-2 w-2 shrink-0 text-[#d9f36e]" />
                            <span className="truncate text-[8px] font-bold leading-tight text-white">
                              {event.title}
                            </span>
                          </div>
                        )
                      })}
                      {dayEvts.length > 2 && (
                        <span className="text-[8px] font-bold text-muted-foreground">
                          +{dayEvts.length - 2}
                        </span>
                      )}
                    </div>

                    {hasDeadline && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                        style={{ backgroundColor: "#d9f36e" }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* RIGHT PANEL — Compact Wegrow-style, limited to 5 upcoming days */}
          <div
            className="flex flex-col overflow-hidden rounded-[28px] bg-[var(--ink)]"
          >
            {/* Panel header */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#c8e06a" }}
                  >
                    <CalendarClock className="h-3.5 w-3.5" style={{ color: "#1d1d1b" }} />
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "#c8e06a" }}
                  >
                    {tx("À venir", "Upcoming")}
                  </span>
                </div>

                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "#c8e06a", opacity: 0.6 }}
                >
                  {monthName} {monthYear}
                </span>
              </div>
            </div>

            {/* Compact day list — max 5 days */}
            <div className="px-5 pb-5 flex flex-col gap-2.5">
              {upcomingDays.map(({ date, events: dayEvts }) => {
                const isToday = sameDay(date, today)
                const eventMonth = new Intl.DateTimeFormat(weekLabel, {
                  month: "short",
                }).format(date)
                const eventDay = date.getDate()

                return (
                  <div
                    key={date.toISOString()}
                    className="rounded-2xl p-3"
                    style={{ backgroundColor: "#c8e06a" }}
                  >
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: "#1d1d1b", opacity: 0.7 }}
                          >
                            {eventMonth}
                          </span>
                          <span
                            className="font-heading text-lg font-black leading-none"
                            style={{ color: "#1d1d1b" }}
                          >
                            {eventDay}
                          </span>
                        </div>

                        {isToday && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase"
                            style={{
                              backgroundColor: "#1d1d1b",
                              color: "#c8e06a",
                            }}
                          >
                            {tx("Aujourd'hui", "Today")}
                          </span>
                        )}
                      </div>

                      {dayEvts.length > 0 && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                          style={{
                            backgroundColor: "rgba(29, 29, 27, 0.15)",
                            color: "#1d1d1b",
                          }}
                        >
                          {dayEvts.length}
                        </span>
                      )}
                    </div>

                    {/* Events — max 2 per day to keep compact */}
                    {dayEvts.length === 0 ? (
                      <p
                        className="text-[10px] font-semibold italic"
                        style={{ color: "#1d1d1b", opacity: 0.5 }}
                      >
                        {tx("Rien", "Nothing")}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayEvts.slice(0, 2).map((event) => {
                          const Icon = TYPE_ICON[event.kind]
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => setSelected(event.id)}
                              className="w-full rounded-xl p-2 text-left transition-transform hover:-translate-y-0.5"
                              style={{
                                backgroundColor: "rgba(29, 29, 27, 0.08)",
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                                  style={{
                                    backgroundColor:
                                      event.kind === "deadline"
                                        ? "#1d1d1b"
                                        : event.kind === "incident"
                                        ? "var(--tag-danger-bg)"
                                        : event.kind === "threshold"
                                        ? "var(--tag-warning-bg)"
                                        : "rgba(29, 29, 27, 0.2)",
                                  }}
                                >
                                  <Icon
                                    className="h-2.5 w-2.5"
                                    style={{
                                      color:
                                        event.kind === "deadline"
                                          ? "#c8e06a"
                                          : event.kind === "incident"
                                          ? "var(--tag-danger-fg)"
                                          : event.kind === "threshold"
                                          ? "var(--tag-warning-fg)"
                                          : "#1d1d1b",
                                    }}
                                  />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p
                                    className="text-[10px] font-bold leading-tight truncate"
                                    style={{ color: "#1d1d1b" }}
                                  >
                                    {event.title}
                                  </p>
                                  <p
                                    className="text-[9px] font-semibold truncate"
                                    style={{
                                      color: "#1d1d1b",
                                      opacity: 0.7,
                                    }}
                                  >
                                    {event.equipment}
                                  </p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                        {dayEvts.length > 2 && (
                          <p
                            className="text-[9px] font-bold text-center"
                            style={{ color: "#1d1d1b", opacity: 0.6 }}
                          >
                            +{dayEvts.length - 2}{" "}
                            {tx("autres", "more")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Summary pill at bottom */}
              <div
                className="rounded-full px-4 py-2 flex items-center justify-between"
                style={{
                  backgroundColor: "rgba(200, 224, 106, 0.15)",
                  border: "1px solid rgba(200, 224, 106, 0.25)",
                }}
              >
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: "#c8e06a" }}
                >
                  {tx("Ce mois", "This month")}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: "#c8e06a" }}
                  >
                    {visibleEvents.length} {tx("événements", "events")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WEEK AGENDA */}
      {viewMode === "week" && (
        <div id="calendar-grid" className="rounded-[28px] bg-card p-4 shadow-sm">
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


