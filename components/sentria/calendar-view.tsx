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

/* --------------------------------------------------------------------------
 * What's on the calendar, and where it comes from
 *
 * Every event here is one of the board's own recommendation cards, placed
 * on a real date:
 *
 *  - An assignment with a deadline (an admin's own date, set on the board)
 *    places the event on that date, as a "deadline" — or "resolved" once
 *    its status is done.
 *  - Anything else places the event on the alert's own timestamp: CRITICAL
 *    reads as an incident, WARNING as a threshold.
 *
 * "Who's assigned" is the same contractor_ids the board reads, resolved to
 * names and roles. Nothing here is invented: a task with nobody on it says
 * so, and a card with no real date to place it on is left off the
 * calendar rather than pinned to a guess.
 * -------------------------------------------------------------------------- */

type EventKind = "incident" | "threshold" | "deadline" | "resolved"

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
}

type CalendarEvent = {
  id: string
  date: Date
  /** Real time-of-day only exists for incident/threshold events, taken
   *  from the alert's own timestamp. A deadline is a plain date — an
   *  admin picked a day, not an hour. */
  hasTime: boolean
  kind: EventKind
  severity: string
  sector: string | null
  equipment: string
  title: string
  detail: string
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
  const day = copy.getDay() // 0 = Sunday
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

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

/** Joins recommendations to their assignment (by task_key === rec.id) and
 *  to the contractors on it, then places each on a real date. A card with
 *  neither a deadline nor a readable alert timestamp is dropped rather
 *  than guessed at. */
/** The backend answers with `alert_id`, never `id` — the dashboard and
 *  board both derive a stable id from the alert's own fields instead,
 *  and the board saves assignments keyed against that derived id. Using
 *  `rec.id` unmodified here would leave every event's id undefined,
 *  silently breaking both the assignment join and React's keys. Same
 *  algorithm as the dashboard, so a task saved from the board lands on
 *  the same id here. */
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
  const [activeSector, setActiveSector] = useState<string | null>(null)
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

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

  const weekEvents = useMemo(
    () =>
      allEvents.filter((e) =>
        weekDates.some((d) => sameDay(d, e.date))
      ),
    [allEvents, weekDates]
  )

  const sectorKeys = useMemo(() => {
    const seen: string[] = []
    for (const e of weekEvents) {
      if (e.sector && !seen.includes(e.sector)) seen.push(e.sector)
    }
    return seen
  }, [weekEvents])

  const roleKeys = useMemo(() => {
    const seen: string[] = []
    for (const c of contractors) {
      const key = c.role?.trim() || NO_ROLE
      if (!seen.includes(key)) seen.push(key)
    }
    return seen
  }, [contractors])

  const visibleEvents = weekEvents.filter((e) => {
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

  const equipmentCount = new Set(weekEvents.map((e) => e.equipment)).size

  const weekLabel = tx("fr-FR", "en-GB")
  const rangeLabel = `${new Intl.DateTimeFormat(weekLabel, {
    day: "numeric",
    month: "short",
  }).format(monday)} – ${new Intl.DateTimeFormat(weekLabel, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(weekDates[6])}`

  const dayLabelFormatter = new Intl.DateTimeFormat(weekLabel, { weekday: "short" })
  const timeFormatter = new Intl.DateTimeFormat(weekLabel, {
    hour: "2-digit",
    minute: "2-digit",
  })

  const today = startOfDay(new Date())

  return (
    <div className="flex flex-col gap-6">
      {/* BANNER — same treatment as the Dashboard hero, so the calendar
          opens with the same visual signature as the rest of the app. */}
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
            {rangeLabel}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("Semaine de travail", "Work week")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col items-center rounded-2xl bg-accent p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent-foreground/70">
            {tx("Échéances", "Deadlines")}
          </p>
          <p className="mt-1 font-heading text-4xl font-black leading-none text-accent-foreground">
            {loaded ? stats.deadlines : "—"}
          </p>
          <p className="mt-1.5 text-[10px] text-accent-foreground/60">
            {tx("à traiter cette semaine", "due this week")}
          </p>
        </div>

        <div className="flex flex-col items-center rounded-2xl bg-primary p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/50">
            {tx("Incidents actifs", "Active incidents")}
          </p>
          <p className="mt-1 font-heading text-4xl font-black leading-none text-blue-400">
            {loaded ? stats.incidents : "—"}
          </p>
          <p className="mt-1.5 text-[10px] text-primary-foreground/40">
            {tx("détectés cette semaine", "detected this week")}
          </p>
        </div>

        <div className="flex flex-col items-center rounded-2xl bg-primary p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/50">
            {tx("Seuils critiques", "Critical thresholds")}
          </p>
          <p className="mt-1 font-heading text-4xl font-black leading-none text-red-400">
            {loaded ? stats.thresholds : "—"}
          </p>
          <p className="mt-1.5 text-[10px] text-primary-foreground/40">
            {tx("à risque de dépassement", "at risk of being breached")}
          </p>
        </div>
      </div>

      {/* FILTERS — only real sectors/roles present this week, and only
          shown once there's more than one real choice to make. */}
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

      {/* WEEK AGENDA — a day-by-day list rather than an hourly grid, because
          a deadline is a date an admin picked, not an hour. Only an
          incident/threshold carries a real timestamp. */}
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

                              {event.title !== event.detail && (
                                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                                  {event.title}
                                </p>
                              )}

                              <div className="mt-3 flex flex-wrap gap-1.5">
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
