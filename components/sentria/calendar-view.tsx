"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Timer,
  UserRound,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { localized, resolve, useTx, type Localized } from "@/lib/i18n"

type EventType = "incident" | "deadline" | "threshold" | "resolved"

type SectorKey =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"
  | "eac"

type CalendarEvent = {
  id: string
  day: number
  startHour: number
  endHour: number
  // Mock content standing in for what a real alerts/tasks API would
  // supply. Like `alert.equipment` and `alert.message` elsewhere in the
  // app, this is data rather than UI chrome, so it is not run through
  // tx() — see lib/i18n/fr.ts's note on what never belongs in the
  // catalogue.
  title: string
  type: EventType
  sector: SectorKey
  site: string
  severity?: "WARNING" | "CRITICAL"
  detail: string
  assignees: string[]
}

const MONTH_LABEL: Localized = localized("Septembre", "September")

const WEEK_DAYS: { label: Localized; date: number }[] = [
  { label: localized("LU", "MO"), date: 14 },
  { label: localized("MA", "TU"), date: 15 },
  { label: localized("ME", "WE"), date: 16 },
  { label: localized("JE", "TH"), date: 17 },
  { label: localized("VE", "FR"), date: 18 },
  { label: localized("SA", "SA"), date: 19 },
  { label: localized("DI", "SU"), date: 20 },
]

const TODAY_INDEX = 5

const START_HOUR = 7
const END_HOUR = 20
const ROW_HEIGHT = 64

const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR + i
)

const EVENTS: CalendarEvent[] = [
  {
    id: "evt-1",
    day: 0,
    startHour: 8,
    endHour: 9.5,
    title: "Surestarie port — seuil dans 4h",
    type: "threshold",
    sector: "logistics",
    site: "Port de Marseille",
    severity: "CRITICAL",
    detail:
      "Le conteneur LOT-2210 approche du seuil de surestarie. Une prise en charge sous 4h évite la pénalité.",
    assignees: ["Karim B."],
  },
  {
    id: "evt-2",
    day: 0,
    startHour: 10,
    endHour: 11,
    title: "Vibration anormale — Compresseur C-12",
    type: "incident",
    sector: "industry",
    site: "Usine Lyon",
    severity: "WARNING",
    detail:
      "Vibration au-dessus du seuil habituel détectée sur le compresseur C-12 depuis 40 minutes.",
    assignees: ["Sophie M."],
  },
  {
    id: "evt-3",
    day: 1,
    startHour: 9,
    endHour: 10,
    title: "Audit conformité chaîne du froid",
    type: "deadline",
    sector: "health",
    site: "Entrepôt pharma Lille",
    detail:
      "Audit trimestriel de conformité de la chaîne du froid à finaliser avant la date limite.",
    assignees: ["Nadia T."],
  },
  {
    id: "evt-4",
    day: 1,
    startHour: 13,
    endHour: 14,
    title: "Maintenance préventive effectuée — Flotte 12",
    type: "resolved",
    sector: "transportation",
    site: "Dépôt Toulouse",
    detail: "Maintenance préventive réalisée sur les 6 véhicules de la flotte 12.",
    assignees: ["Yassine L."],
  },
  {
    id: "evt-5",
    day: 2,
    startHour: 11,
    endHour: 12,
    title: "Seuil d'humidité dépassé — Silo 4",
    type: "incident",
    sector: "agriculture",
    site: "Silo Beauce",
    severity: "WARNING",
    detail: "Taux d'humidité du silo 4 au-dessus du seuil recommandé pour le stockage.",
    assignees: ["Julien P."],
  },
  {
    id: "evt-6",
    day: 2,
    startHour: 15,
    endHour: 16.5,
    title: "Chaîne du froid — seuil critique produit",
    type: "threshold",
    sector: "logistics",
    site: "Entrepôt Rungis",
    severity: "CRITICAL",
    detail: "Température proche du seuil de rupture de la chaîne du froid sur le lot F-118.",
    assignees: ["Karim B.", "Nadia T."],
  },
  {
    id: "evt-7",
    day: 3,
    startHour: 8.5,
    endHour: 10,
    title: "Révision turbine T-3",
    type: "deadline",
    sector: "energy",
    site: "Centrale Grenoble",
    detail: "Révision périodique de la turbine T-3 à programmer avant échéance réglementaire.",
    assignees: ["Marc D."],
  },
  {
    id: "evt-8",
    day: 3,
    startHour: 12,
    endHour: 13,
    title: "Retard douane — Corridor Nord",
    type: "incident",
    sector: "eac",
    site: "Corridor Nord",
    severity: "WARNING",
    detail: "Retard de dédouanement signalé sur le corridor Nord, impact estimé +3h.",
    assignees: ["Amina K."],
  },
  {
    id: "evt-9",
    day: 4,
    startHour: 9,
    endHour: 10,
    title: "Remplacement filtre — Ligne 2",
    type: "deadline",
    sector: "industry",
    site: "Usine Lyon",
    detail: "Remplacement du filtre de la ligne 2 à effectuer avant redémarrage de production.",
    assignees: ["Sophie M."],
  },
  {
    id: "evt-10",
    day: 4,
    startHour: 16,
    endHour: 17,
    title: "Livraison confirmée — Lot LOT-3390",
    type: "resolved",
    sector: "logistics",
    site: "Entrepôt Rungis",
    detail: "Livraison du lot LOT-3390 confirmée dans la fenêtre prévue.",
    assignees: ["Karim B."],
  },
  {
    id: "evt-11",
    day: 5,
    startHour: 10,
    endHour: 11,
    title: "Fenêtre de livraison expirant",
    type: "threshold",
    sector: "transportation",
    site: "Dépôt Toulouse",
    severity: "CRITICAL",
    detail: "La fenêtre de livraison du client Delmas expire dans moins d'1h.",
    assignees: ["Yassine L."],
  },
  {
    id: "evt-12",
    day: 6,
    startHour: 14,
    endHour: 15.5,
    title: "Renouvellement certification équipement",
    type: "deadline",
    sector: "health",
    site: "Entrepôt pharma Lille",
    detail: "Certification de l'équipement de réfrigération à renouveler.",
    assignees: ["Nadia T."],
  },
]

const TYPE_LABEL: Record<EventType, Localized> = {
  incident: localized("Incident", "Incident"),
  deadline: localized("Échéance", "Deadline"),
  threshold: localized("Seuil critique", "Critical threshold"),
  resolved: localized("Résolu", "Resolved"),
}

const TYPE_ICON: Record<EventType, typeof AlertTriangle> = {
  incident: AlertTriangle,
  deadline: CalendarClock,
  threshold: Timer,
  resolved: CheckCircle2,
}

const SECTOR_LABEL: Record<SectorKey, Localized> = {
  industry: localized("Industrie", "Industry"),
  health: localized("Santé", "Health"),
  agriculture: localized("Agriculture", "Agriculture"),
  transportation: localized("Transport", "Transport"),
  logistics: localized("Logistique", "Logistics"),
  energy: localized("Énergie", "Energy"),
  eac: localized("EAC", "EAC"),
}

const ALL_SECTOR_KEYS = Object.keys(SECTOR_LABEL) as SectorKey[]

function getOnboardedSectors(): SectorKey[] {
  if (typeof window === "undefined") {
    return ALL_SECTOR_KEYS
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem("sentria_sectors") || "[]"
    )

    const valid = Array.isArray(stored)
      ? stored.filter((key): key is SectorKey =>
          ALL_SECTOR_KEYS.includes(key)
        )
      : []

    // Fall back to every sector so the preview stays populated when the
    // company hasn't gone through onboarding yet (e.g. local dev).
    return valid.length > 0 ? valid : ALL_SECTOR_KEYS
  } catch {
    return ALL_SECTOR_KEYS
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function formatHour(hour: number) {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`
}

function isPast(day: number, endHour: number) {
  if (day < TODAY_INDEX) return true
  if (day > TODAY_INDEX) return false
  return endHour < 13
}

// Solid, block-color treatment: one bold tone per event type so the week
// reads at a glance, the way a shift calendar does.
function getEventColors(event: CalendarEvent, overdue: boolean) {
  if (event.type === "resolved") {
    return "bg-primary text-primary-foreground"
  }

  if (event.type === "threshold" || overdue) {
    return "bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-300"
  }

  if (event.type === "incident") {
    return "bg-blue-600 text-white"
  }

  return "bg-accent text-accent-foreground"
}

export function CalendarView() {
  const tx = useTx()
  const px = (text: Localized) => resolve(text, tx)

  const [companySectors] = useState<SectorKey[]>(getOnboardedSectors)
  const [activeSector, setActiveSector] = useState<SectorKey | null>(null)
  const [viewMode, setViewMode] = useState<"week" | "day">("week")
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  const scopedEvents = EVENTS.filter((e) =>
    companySectors.includes(e.sector)
  )

  const events = activeSector
    ? scopedEvents.filter((e) => e.sector === activeSector)
    : scopedEvents

  const visibleDays = viewMode === "day" ? [TODAY_INDEX] : WEEK_DAYS.map((_, i) => i)

  const siteCount = new Set(scopedEvents.map((e) => e.site)).size

  const stats = {
    incidents: events.filter((e) => e.type === "incident").length,
    thresholds: events.filter((e) => e.type === "threshold").length,
    deadlines: events.filter((e) => e.type === "deadline").length,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-5xl font-black leading-[0.85] tracking-tight text-foreground sm:text-6xl">
            {px(MONTH_LABEL)}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("2026 — semaine du 14 au 20", "2026 — week of Sep 14–20")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={tx("Semaine précédente", "Previous week")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            {tx("Aujourd'hui", "Today")}
          </button>

          <button
            type="button"
            aria-label={tx("Semaine suivante", "Next week")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="flex items-center rounded-xl bg-primary p-1">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg px-3 py-1.5 text-xs font-medium text-primary-foreground/30"
            >
              {tx("Mois", "Month")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "week"
                  ? "bg-accent text-accent-foreground"
                  : "text-primary-foreground/60 hover:text-primary-foreground"
              )}
            >
              {tx("Semaine", "Week")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "day"
                  ? "bg-accent text-accent-foreground"
                  : "text-primary-foreground/60 hover:text-primary-foreground"
              )}
            >
              {tx("Jour", "Day")}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            aria-label={tx("Filtrer par secteur", "Filter by sector")}
            aria-pressed={showFilters}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
              showFilters
                ? "border-accent bg-accent/10 text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            <Filter className="h-4 w-4" />
          </button>

          <span className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
            <MapPin className="h-3.5 w-3.5 text-accent" />
            {siteCount}{" "}
            {siteCount > 1
              ? tx("sites suivis", "sites tracked")
              : tx("site suivi", "site tracked")}
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
            {stats.deadlines}
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
            {stats.incidents}
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
            {stats.thresholds}
          </p>
          <p className="mt-1.5 text-[10px] text-primary-foreground/40">
            {tx("à risque de dépassement", "at risk of being breached")}
          </p>
        </div>
      </div>

      {/* SECTOR FILTERS */}
      {showFilters && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSector(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
              activeSector === null
                ? "border-accent bg-accent/10 text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {tx("Tous", "All")}
          </button>

          {companySectors.map((sector) => (
            <button
              key={sector}
              type="button"
              onClick={() => setActiveSector(sector)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                activeSector === sector
                  ? "border-accent bg-accent/10 text-accent-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {px(SECTOR_LABEL[sector])}
            </button>
          ))}
        </div>
      )}

      {/* CALENDAR GRID */}
      <div className="overflow-x-auto rounded-3xl border border-border bg-gradient-to-b from-accent/15 via-accent/5 to-transparent p-4 shadow-sm">
        <div
          className="grid min-w-[720px]"
          style={{
            gridTemplateColumns: `56px repeat(${visibleDays.length}, 1fr)`,
          }}
        >
          {/* day headers */}
          <div />
          {visibleDays.map((dayIndex) => {
            const day = WEEK_DAYS[dayIndex]
            const isToday = dayIndex === TODAY_INDEX

            return (
              <div key={dayIndex} className="flex justify-center pb-3">
                <div
                  className={cn(
                    "flex flex-col items-center rounded-xl px-3 py-1.5",
                    isToday && "bg-primary text-primary-foreground"
                  )}
                >
                  <span className="text-[10px] font-semibold tracking-wide opacity-70">
                    {px(day.label)}
                  </span>
                  <span className="font-heading text-sm font-bold">
                    {day.date}
                  </span>
                </div>
              </div>
            )
          })}

          {/* hour labels */}
          <div className="relative" style={{ height: HOURS.length * ROW_HEIGHT }}>
            {HOURS.map((hour, i) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                style={{ top: i * ROW_HEIGHT }}
              >
                {hour}h
              </div>
            ))}
          </div>

          {/* day columns */}
          {visibleDays.map((dayIndex) => {
            const dayEvents = events.filter((e) => e.day === dayIndex)

            return (
              <div
                key={dayIndex}
                className="relative border-l border-border/60"
                style={{ height: HOURS.length * ROW_HEIGHT }}
              >
                {HOURS.map((hour, i) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-border/40"
                    style={{ top: i * ROW_HEIGHT }}
                  />
                ))}

                {dayEvents.map((event) => {
                  const Icon = TYPE_ICON[event.type]
                  const top = (event.startHour - START_HOUR) * ROW_HEIGHT
                  const height = Math.max(
                    (event.endHour - event.startHour) * ROW_HEIGHT - 4,
                    28
                  )
                  const overdue =
                    event.type === "deadline" && isPast(event.day, event.endHour)

                  return (
                    <div
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setSelected(
                          selected?.id === event.id ? null : event
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSelected(
                            selected?.id === event.id ? null : event
                          )
                        }
                      }}
                      className={cn(
                        "absolute inset-x-1 flex cursor-pointer flex-col rounded-2xl px-2.5 py-1.5 text-left shadow-sm transition-transform hover:-translate-y-0.5",
                        selected?.id === event.id ? "z-40" : "z-10",
                        getEventColors(event, overdue)
                      )}
                      style={{ top: top + 2, height }}
                    >
                      <div className="flex items-center gap-1">
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate text-[10px] font-bold">
                          {event.title}
                        </span>
                      </div>

                      {height > 44 && (
                        <span className="mt-0.5 truncate text-[9px] opacity-80">
                          {formatHour(event.startHour)} – {formatHour(event.endHour)}
                        </span>
                      )}

                      {overdue && height > 44 && (
                        <span className="mt-auto text-[9px] font-bold">
                          {tx("En retard", "Overdue")}
                        </span>
                      )}

                      {selected?.id === event.id && (
                        <div
                          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-3xl bg-popover p-4 text-foreground shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                getEventColors(event, overdue)
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              {px(TYPE_LABEL[event.type])}
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

                          <p className="mt-2.5 text-base font-bold leading-snug">
                            {event.title}
                          </p>

                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            {event.detail}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-semibold text-foreground/80">
                              {px(WEEK_DAYS[event.day].label)} {WEEK_DAYS[event.day].date}
                            </span>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-semibold text-foreground/80">
                              {px(SECTOR_LABEL[event.sector])}
                            </span>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-semibold text-foreground/80">
                              {formatHour(event.startHour)} – {formatHour(event.endHour)}
                            </span>
                          </div>

                          <p className="mt-2 text-[10px] text-muted-foreground">
                            {event.site}
                          </p>

                          <button
                            type="button"
                            onClick={() => setSelected(null)}
                            className="mt-3 w-full rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-accent-foreground transition-colors hover:bg-accent/90"
                          >
                            {tx("Fermer", "Close")}
                          </button>

                          <div className="mt-3 flex items-center gap-2">
                            <p className="text-[10px] font-medium text-muted-foreground">
                              {tx("Assigné à", "Assigned to")}
                            </p>

                            {event.assignees.length > 0 ? (
                              <div className="flex -space-x-1.5">
                                {event.assignees.map((name) => (
                                  <span
                                    key={name}
                                    title={name}
                                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-popover bg-accent text-[9px] font-bold text-accent-foreground"
                                  >
                                    {getInitials(name)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                                <UserRound className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] text-muted-foreground">
        {(Object.keys(TYPE_LABEL) as EventType[]).map((type) => {
          const Icon = TYPE_ICON[type]
          return (
            <div key={type} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {px(TYPE_LABEL[type])}
            </div>
          )
        })}
      </div>
    </div>
  )
}
