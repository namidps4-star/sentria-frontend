"use client"

import { useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Timer,
  UserRound,
  X,
  Zap,
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

/** A site is a key, not a string.
 *
 *  Two reasons. The header counts distinct sites with a Set, and a Set
 *  of pair objects would count by identity rather than by site, so the
 *  same warehouse written twice would count twice. And a site name is
 *  not untranslatable: "Usine Lyon" holds a common noun an English
 *  reader does not read, even though "Lyon" itself stays put. */
type SiteKey =
  | "marseille"
  | "lyon"
  | "lille"
  | "toulouse"
  | "beauce"
  | "rungis"
  | "grenoble"
  | "corridorNord"

type CalendarEvent = {
  id: string
  day: number
  startHour: number
  endHour: number
  /* Mock content standing in for what a real alerts/tasks API would
     supply.

     It used to be plain French strings, on the reasoning that this is
     data like `alert.message` and so does not belong in the catalogue.
     The analogy does not hold: `alert.message` is French because the
     backend rendered it before storing it, and the frontend has nothing
     left to translate. This array is in the frontend, so no such
     constraint applies - it was simply French text on an English
     screen. Pairs rather than catalogue keys, because a module-level
     constant cannot call a hook. */
  title: Localized
  type: EventType
  sector: SectorKey
  site: SiteKey
  severity?: "WARNING" | "CRITICAL"
  detail: Localized
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

const SITE_LABEL: Record<SiteKey, Localized> = {
  marseille: localized("Port de Marseille", "Port of Marseille"),
  lyon: localized("Usine Lyon", "Lyon plant"),
  lille: localized("Entrepôt pharma Lille", "Lille pharma warehouse"),
  toulouse: localized("Dépôt Toulouse", "Toulouse depot"),
  beauce: localized("Silo Beauce", "Beauce silo"),
  rungis: localized("Entrepôt Rungis", "Rungis warehouse"),
  grenoble: localized("Centrale Grenoble", "Grenoble power station"),
  corridorNord: localized("Corridor Nord", "North corridor"),
}

/* A person's name reads the same in every language, so these are the
   one thing in this file that is not a pair. Named constants rather
   than repeated literals, so the checker has a single place to skip
   instead of twelve.

   i18n-ignore-start: people's names */
const PEOPLE = {
  karim: "Karim B.",
  sophie: "Sophie M.",
  nadia: "Nadia T.",
  yassine: "Yassine L.",
  julien: "Julien P.",
  marc: "Marc D.",
  amina: "Amina K.",
} as const
/* i18n-ignore-end */

const EVENTS: CalendarEvent[] = [
  {
    id: "evt-1",
    day: 0,
    startHour: 8,
    endHour: 9.5,
    title: localized(
      "Surestarie port — seuil dans 4h",
      "Port demurrage, threshold in 4h"
    ),
    type: "threshold",
    sector: "logistics",
    site: "marseille",
    severity: "CRITICAL",
    detail: localized(
      "Le conteneur LOT-2210 approche du seuil de surestarie. Une prise en charge sous 4h évite la pénalité.",
      "Container LOT-2210 is approaching the demurrage threshold. Handling it within 4h avoids the penalty."
    ),
    assignees: [PEOPLE.karim],
  },
  {
    id: "evt-2",
    day: 0,
    startHour: 10,
    endHour: 11,
    title: localized(
      "Vibration anormale — Compresseur C-12",
      "Abnormal vibration, compressor C-12"
    ),
    type: "incident",
    sector: "industry",
    site: "lyon",
    severity: "WARNING",
    detail: localized(
      "Vibration au-dessus du seuil habituel détectée sur le compresseur C-12 depuis 40 minutes.",
      "Vibration above the usual threshold on compressor C-12 for the past 40 minutes."
    ),
    assignees: [PEOPLE.sophie],
  },
  {
    id: "evt-3",
    day: 1,
    startHour: 9,
    endHour: 10,
    title: localized(
      "Audit conformité chaîne du froid",
      "Cold chain compliance audit"
    ),
    type: "deadline",
    sector: "health",
    site: "lille",
    detail: localized(
      "Audit trimestriel de conformité de la chaîne du froid à finaliser avant la date limite.",
      "The quarterly cold chain compliance audit has to be finished before the deadline."
    ),
    assignees: [PEOPLE.nadia],
  },
  {
    id: "evt-4",
    day: 1,
    startHour: 13,
    endHour: 14,
    title: localized(
      "Maintenance préventive effectuée — Flotte 12",
      "Preventive maintenance done, fleet 12"
    ),
    type: "resolved",
    sector: "transportation",
    site: "toulouse",
    detail: localized(
      "Maintenance préventive réalisée sur les 6 véhicules de la flotte 12.",
      "Preventive maintenance carried out on all 6 vehicles in fleet 12."
    ),
    assignees: [PEOPLE.yassine],
  },
  {
    id: "evt-5",
    day: 2,
    startHour: 11,
    endHour: 12,
    title: localized(
      "Seuil d'humidité dépassé — Silo 4",
      "Moisture threshold passed, silo 4"
    ),
    type: "incident",
    sector: "agriculture",
    site: "beauce",
    severity: "WARNING",
    detail: localized(
      "Taux d'humidité du silo 4 au-dessus du seuil recommandé pour le stockage.",
      "Silo 4's moisture level is above the threshold recommended for storage."
    ),
    assignees: [PEOPLE.julien],
  },
  {
    id: "evt-6",
    day: 2,
    startHour: 15,
    endHour: 16.5,
    title: localized(
      "Chaîne du froid — seuil critique produit",
      "Cold chain, product at its critical threshold"
    ),
    type: "threshold",
    sector: "logistics",
    site: "rungis",
    severity: "CRITICAL",
    detail: localized(
      "Température proche du seuil de rupture de la chaîne du froid sur le lot F-118.",
      "Temperature close to the cold chain break threshold on batch F-118."
    ),
    assignees: [PEOPLE.karim, PEOPLE.nadia],
  },
  {
    id: "evt-7",
    day: 3,
    startHour: 8.5,
    endHour: 10,
    title: localized("Révision turbine T-3", "Turbine T-3 overhaul"),
    type: "deadline",
    sector: "energy",
    site: "grenoble",
    detail: localized(
      "Révision périodique de la turbine T-3 à programmer avant échéance réglementaire.",
      "Turbine T-3's periodic overhaul has to be scheduled before the regulatory deadline."
    ),
    assignees: [PEOPLE.marc],
  },
  {
    id: "evt-8",
    day: 3,
    startHour: 12,
    endHour: 13,
    title: localized(
      "Retard douane — Corridor Nord",
      "Customs delay, North corridor"
    ),
    type: "incident",
    sector: "eac",
    site: "corridorNord",
    severity: "WARNING",
    detail: localized(
      "Retard de dédouanement signalé sur le corridor Nord, impact estimé +3h.",
      "A clearance delay was reported on the North corridor, estimated impact +3h."
    ),
    assignees: [PEOPLE.amina],
  },
  {
    id: "evt-9",
    day: 4,
    startHour: 9,
    endHour: 10,
    title: localized(
      "Remplacement filtre — Ligne 2",
      "Filter replacement, line 2"
    ),
    type: "deadline",
    sector: "industry",
    site: "lyon",
    detail: localized(
      "Remplacement du filtre de la ligne 2 à effectuer avant redémarrage de production.",
      "Line 2's filter has to be replaced before production restarts."
    ),
    assignees: [PEOPLE.sophie],
  },
  {
    id: "evt-10",
    day: 4,
    startHour: 16,
    endHour: 17,
    title: localized(
      "Livraison confirmée — Lot LOT-3390",
      "Delivery confirmed, batch LOT-3390"
    ),
    type: "resolved",
    sector: "logistics",
    site: "rungis",
    detail: localized(
      "Livraison du lot LOT-3390 confirmée dans la fenêtre prévue.",
      "Batch LOT-3390 was delivered inside the planned window."
    ),
    assignees: [PEOPLE.karim],
  },
  {
    id: "evt-11",
    day: 5,
    startHour: 10,
    endHour: 11,
    title: localized(
      "Fenêtre de livraison expirant",
      "Delivery window closing"
    ),
    type: "threshold",
    sector: "transportation",
    site: "toulouse",
    severity: "CRITICAL",
    detail: localized(
      "La fenêtre de livraison du client Delmas expire dans moins d'1h.",
      "The Delmas delivery window closes in under 1h."
    ),
    assignees: [PEOPLE.yassine],
  },
  {
    id: "evt-12",
    day: 6,
    startHour: 14,
    endHour: 15.5,
    title: localized(
      "Renouvellement certification équipement",
      "Equipment certification renewal"
    ),
    type: "deadline",
    sector: "health",
    site: "lille",
    detail: localized(
      "Certification de l'équipement de réfrigération à renouveler.",
      "The refrigeration equipment's certification is due for renewal."
    ),
    assignees: [PEOPLE.nadia],
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
    <div className="flex flex-col gap-6">
      {/* BANNER — same treatment as the Dashboard hero (bg-sidebar, the
          accent "Live" pill, a bold headline and an accent CTA), so the
          calendar opens with the same visual signature as the rest of
          the app instead of its own look. */}
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
      <div
        id="calendar-grid"
        className="overflow-x-auto rounded-3xl border border-border bg-gradient-to-b from-accent/15 via-accent/5 to-transparent p-4 shadow-sm"
      >
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
                          {px(event.title)}
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
                            {px(event.title)}
                          </p>

                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            {px(event.detail)}
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
                            {px(SITE_LABEL[event.site])}
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
