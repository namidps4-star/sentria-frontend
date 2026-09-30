"use client"

import {
  FileDown,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Settings2,
  Boxes,
  BatteryCharging,
  Thermometer,
  Wrench,
  ShieldAlert,
  Truck,
} from "@/lib/icons"
import { useEffect, useId, useMemo, useState } from "react"
import { API_BASE, apiFetch } from "@/lib/api"
import { readCompanyName, readTimezoneId } from "@/lib/company"
import { buildReport } from "@/lib/report"
import type { LogisticsAlert } from "@/lib/logistics-signals"
import { SECTOR_LABELS, sectorLabel, type Sector } from "@/lib/priorities"
import { cn } from "@/lib/utils"
import { StatusTag } from "./status-tag"
import { WeekCard } from "./week-card"
import { localized, resolve, useTx, type Localized } from "@/lib/i18n"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MonitoringKey =
  | "equipment"
  | "fleet"
  | "inventory"
  | "energy"
  | "conditions"
  | "maintenance"
  | "risks"

type Severity = "critical" | "warning" | "info"
type AlertStatus = "open" | "resolved"

interface KpiPoint {
  label: string
  value: string
  delta: number
  icon: React.ElementType
  /** Suffix for the delta, e.g. "%" for a rate. Empty for a count. */
  deltaUnit?: string
  /** Whether a rise is good news. False for anything counting alerts. */
  higherIsBetter?: boolean
  criticalCount: number
  warningCount: number
}

interface TrendPoint {
  date: string
  value: number
}

interface AlertRow {
  id: string
  timestamp: string
  site: string
  category: MonitoringKey
  severity: Severity
  status: AlertStatus
  message: string
  riskScore: number | null
}

interface Offender {
  equipment: string
  count: number
}

interface ReportData {
  siteName: string
  dateRange: string
  sectors: string[]
  monitoring: MonitoringKey[]
  kpis: Partial<Record<MonitoringKey, KpiPoint>>
  trends: Partial<Record<MonitoringKey, TrendPoint[]>>
  alerts: AlertRow[]
  topOffenders: Offender[]
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONITORING_META: Record<
  MonitoringKey,
  { label: Localized; icon: React.ElementType; unit?: string }
> = {
  equipment: {
    label: localized("Machines & équipements", "Machines & equipment"),
    icon: Settings2,
  },
  fleet: {
    label: localized("Flottes & véhicules", "Fleets & vehicles"),
    icon: Truck,
  },
  inventory: {
    label: localized("Stocks & inventaires", "Stock & inventory"),
    icon: Boxes,
  },
  energy: {
    label: localized("Énergie & consommation", "Energy & consumption"),
    icon: BatteryCharging,
    unit: "kWh",
  },
  conditions: {
    label: localized("Température & conditions", "Temperature & conditions"),
    icon: Thermometer,
    unit: "°C",
  },
  maintenance: {
    label: localized("Maintenance", "Maintenance"),
    icon: Wrench,
  },
  risks: {
    label: localized("Risques & anomalies", "Risks & anomalies"),
    icon: ShieldAlert,
  },
}

const SEVERITY_LABEL: Record<Severity, Localized> = {
  critical: localized("Critique", "Critical"),
  warning: localized("Attention", "Attention"),
  info: localized("Info", "Info"),
}

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-muted-foreground",
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

/** The sectors this company actually onboarded, read the same way the
 *  dashboard and profile page do: the multi-sector array first, the
 *  older single-sector key as a fallback. Never invents a sector nobody
 *  picked. */
function readOnboardedSectors(): Sector[] {
  if (typeof window === "undefined") return []

  try {
    const many = JSON.parse(localStorage.getItem("sentria_sectors") || "null")

    if (Array.isArray(many)) {
      const valid = many.filter(
        (key): key is Sector => typeof key === "string" && key in SECTOR_LABELS
      )

      if (valid.length > 0) return valid
    }
  } catch {
    /* fall through to the single-value key */
  }

  const one = localStorage.getItem("sentria_sector")

  return one && one in SECTOR_LABELS ? [one as Sector] : []
}

/** Only rendered when the company onboarded more than one sector — a
 *  single-sector company's report already is that sector's report, and
 *  a toggle with one real choice would be noise rather than a filter. */
function SectorTabs({
  sectors,
  alerts,
  activeSector,
  onChange,
}: {
  sectors: Sector[]
  alerts: LogisticsAlert[]
  activeSector: "all" | Sector
  onChange: (sector: "all" | Sector) => void
}) {
  const tx = useTx()

  function tabClass(active: boolean) {
    return cn(
      "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={tabClass(activeSector === "all")}
      >
        {tx("Tous les secteurs", "All sectors")}
        <span className="ml-1.5 text-[10px] opacity-60">{alerts.length}</span>
      </button>

      {sectors.map((sector) => (
        <button
          key={sector}
          type="button"
          onClick={() => onChange(sector)}
          className={tabClass(activeSector === sector)}
        >
          {sectorLabel(sector, tx)}
          <span className="ml-1.5 text-[10px] opacity-60">
            {alerts.filter((a) => a.sector === sector).length}
          </span>
        </button>
      ))}
    </div>
  )
}

/** The change since the previous day.
 *
 *  Two things were wrong while the data was mocked and nobody could
 *  tell. It appended a percent sign to a number that is a count of
 *  alerts, and it painted a rise green: for stock levels more is better,
 *  but every KPI in this report counts alerts, where more is worse. The
 *  unit and the direction are stated by the caller now. */
function DeltaBadge({
  delta,
  unit = "",
  higherIsBetter = false,
}: {
  delta: number
  unit?: string
  higherIsBetter?: boolean
}) {
  const tx = useTx()

  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden="true" />
        {tx("stable", "steady")}
      </span>
    )
  }

  const isUp = delta > 0
  const isGood = isUp === higherIsBetter

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        isGood
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-destructive/10 text-destructive"
      )}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
      ) : (
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
      )}

      {isUp ? "+" : "-"}
      {Math.abs(delta)}
      {unit}
    </span>
  )
}

function KpiCard({ point }: { point: KpiPoint }) {
  const tx = useTx()
  const Icon = point.icon

  return (
    <div className="rounded-[22px] bg-card p-5 shadow-sm print:border print:border-border print:shadow-none">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <DeltaBadge
          delta={point.delta}
          unit={point.deltaUnit}
          higherIsBetter={point.higherIsBetter}
        />
      </div>

      <p className="mt-4 font-heading text-3xl font-bold tracking-tight">
        {point.value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{point.label}</p>

      {/* The mix, not just the total: ten warnings and ten criticals are
          not the same alert count to react to. */}
      {(point.criticalCount > 0 || point.warningCount > 0) && (
        <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-xs">
          {point.criticalCount > 0 && (
            <span className="flex items-center gap-1.5 font-semibold text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              {point.criticalCount} {tx("critique", "critical")}
            </span>
          )}
          {point.warningCount > 0 && (
            <span className="flex items-center gap-1.5 text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              {point.warningCount} {tx("attention", "warning")}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Named once, up top, so a chronic problem isn't left for the reader
 *  to notice by scanning forty rows of the alerts table below. */
function OffendersCallout({ offenders }: { offenders: Offender[] }) {
  const tx = useTx()

  if (offenders.length === 0) return null

  return (
    <div className="rounded-[28px] bg-card p-5 shadow-sm print:border print:border-border print:shadow-none">
      <p className="font-heading text-xl font-semibold tracking-tight">
        {tx("Ça revient souvent", "Keeps coming back")}
      </p>

      <ul className="mt-3 space-y-2">
        {offenders.map((offender) => (
          <li
            key={offender.equipment}
            className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-2.5 text-sm"
          >
            <span className="min-w-0 truncate font-semibold">{offender.equipment}</span>
            <StatusTag tone="warning" size="xs">
              {tx(
                `${offender.count} alertes`,
                `${offender.count} alerts`
              )}
            </StatusTag>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Inline SVG sparkline with gradient fill. No chart library dependency.
function Sparkline({ data }: { data: TrendPoint[] }) {
  const width = 320
  const height = 100
  const padding = 4

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2)
    const y =
      height - padding - ((d.value - min) / range) * (height - padding * 2)
    return { x, y }
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ")

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: 100 }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} className="text-accent" />
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={4}
        className="fill-accent"
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={7}
        className="fill-accent/20"
      />
    </svg>
  )
}

function TrendCard({
  monitoringKey,
  data,
  delta,
}: {
  monitoringKey: MonitoringKey
  data: TrendPoint[]
  /** This week's count minus last week's, from the same KPI card, so
   *  the two never disagree the way day-over-day and the sparkline
   *  used to. */
  delta: number
}) {
  const tx = useTx()

  const meta = MONITORING_META[monitoringKey]
  const Icon = meta.icon
  const weekTotal = data.reduce((sum, point) => sum + point.value, 0)

  return (
    <div className="rounded-[22px] bg-card p-5 shadow-sm print:border print:border-border print:shadow-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold">
            {tx(meta.label.fr, meta.label.en)}
          </p>
        </div>
        <DeltaBadge delta={delta} higherIsBetter={false} />
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">
          {weekTotal}
        </span>

        {/* Week against the week before, not day against day: a single
            bad day used to be able to flip this on its own. */}
        <span className="text-sm text-muted-foreground">
          {weekTotal > 1
            ? tx("alertes cette semaine", "alerts this week")
            : tx("alerte cette semaine", "alert this week")}
        </span>
      </div>

      <div className="mt-3 text-accent">
        <Sparkline data={data} />
      </div>

      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alerts table, styled as a real data table rather than a card list
// ---------------------------------------------------------------------------

function AlertsTable({ alerts }: { alerts: AlertRow[] }) {
  const tx = useTx()

  const [filter, setFilter] = useState<"all" | AlertStatus>("all")
  const visible = alerts.filter((a) => filter === "all" || a.status === filter)

  const filters: { key: "all" | AlertStatus; label: string }[] = [
    { key: "all", label: tx("Toutes", "All") },
    { key: "open", label: tx("Ouvertes", "Open") },
    { key: "resolved", label: tx("Résolues", "Resolved") },
  ]

  return (
    <div className="rounded-[22px] bg-card shadow-sm print:border print:border-border print:shadow-none">
      <div className="flex items-center justify-between px-5 py-4">
        <SectionLabel>{tx("Alertes & anomalies", "Alerts & anomalies")}</SectionLabel>

        <div className="flex gap-4 print:hidden">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "border-b-2 pb-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="whitespace-nowrap px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tx("Horodatage", "Timestamp")}
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tx("Site", "Site")}
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tx("Catégorie", "Category")}
              </th>
              <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tx("Description", "Description")}
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tx("Gravité", "Severity")}
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tx("Score de risque", "Risk score")}
              </th>
              <th className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tx("Statut", "Status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-sm text-muted-foreground"
                >
                  {tx("Aucune alerte pour ce filtre.", "No alert matches this filter.")}
                </td>
              </tr>
            )}

            {visible.map((alert) => {
              const meta = MONITORING_META[alert.category]

              return (
                <tr
                  key={alert.id}
                  className="border-b border-border last:border-0 hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">
                    {alert.timestamp}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-medium">
                    {alert.site}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                    {tx(meta.label.fr, meta.label.en)}
                  </td>
                  <td className="px-3 py-3">{alert.message}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          SEVERITY_DOT[alert.severity]
                        )}
                      />
                      {resolve(
                        SEVERITY_LABEL[alert.severity],
                        tx,
                        alert.severity
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                    {/* The backend's own score, carried through unchanged.
                        A dash when it never computed one, never a guess
                        filled in on this end. */}
                    {alert.riskScore ?? (
                      <span aria-hidden="true">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        alert.status === "open"
                          ? "text-warning"
                          : "text-emerald-600"
                      )}
                    >
                      {alert.status === "open"
                        ? tx("Ouverte", "Open")
                        : tx("Résolue", "Resolved")}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report view
// ---------------------------------------------------------------------------

export function ReportView({ data }: { data?: ReportData }) {
  const tx = useTx()

  /* This defaulted to a MOCK_DATA constant and app-shell rendered the
     view with no props, so every customer saw "Clinique Nord, Site
     principal" with a stock level of 82 percent and a cold chain at 98.6
     percent, none of which came from anywhere. Putting the real company
     name on that would only have made the invented figures look like
     the customer's own, so the report reads the alerts instead and says
     so when there are none. */
  const [alerts, setAlerts] = useState<LogisticsAlert[]>([])
  const [loaded, setLoaded] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [timezoneId, setTimezoneId] = useState("")
  const [sectors] = useState<Sector[]>(readOnboardedSectors)
  const [activeSector, setActiveSector] = useState<"all" | Sector>("all")

  useEffect(() => {
    setCompanyName(readCompanyName())
    setTimezoneId(readTimezoneId())

    apiFetch(`${API_BASE}/alerts?lang=${tx("fr", "en")}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAlerts(Array.isArray(d) ? d : []))
      .catch((error) => {
        console.error("Failed to load alerts for the report:", error)
      })
      .finally(() => setLoaded(true))
    // Refetched on a language switch: /alerts rebuilds messages (B-11).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx("fr", "en")])

  /* Only actually filters once there is more than one real choice — see
     SectorTabs. A single-sector company keeps seeing every one of its
     own alerts rather than a strict equality check silently dropping
     rows whose sector field is missing or stale. */
  const scopedAlerts = useMemo(
    () =>
      sectors.length > 1 && activeSector !== "all"
        ? alerts.filter((a) => a.sector === activeSector)
        : alerts,
    [alerts, sectors, activeSector]
  )

  const built = useMemo(
    () => buildReport(scopedAlerts, companyName, timezoneId, tx),
    [scopedAlerts, companyName, timezoneId, tx]
  )

  const resolved: ReportData = useMemo(
    () =>
      data ?? {
        siteName: built.siteName,
        dateRange: built.dateRange,
        sectors: [],
        monitoring: built.monitoring,
        kpis: Object.fromEntries(
          Object.entries(built.kpis).map(([key, kpi]) => [
            key,
            {
              label: tx(kpi!.label.fr, kpi!.label.en),
              value: kpi!.value,
              delta: kpi!.delta,
              deltaUnit: "",
              higherIsBetter: false,
              criticalCount: kpi!.criticalCount,
              warningCount: kpi!.warningCount,
              icon:
                MONITORING_META[key as MonitoringKey]?.icon ?? ShieldAlert,
            },
          ])
        ),
        trends: built.trends as ReportData["trends"],
        alerts: built.alerts as ReportData["alerts"],
        topOffenders: built.topOffenders,
      },
    [data, built]
  )

  const showSectorTabs = !data && sectors.length > 1
  const activeSectorLabel =
    !data && activeSector !== "all" ? sectorLabel(activeSector, tx) : null

  if (!data && loaded && built.empty) {
    return (
      <div className="space-y-6">
        {showSectorTabs && (
          <SectorTabs
            sectors={sectors}
            alerts={alerts}
            activeSector={activeSector}
            onChange={setActiveSector}
          />
        )}

        <section className="rounded-[28px] bg-foreground/[0.055] p-5 sm:p-6">
          <h2 className="font-heading text-3xl font-semibold leading-[1.05] tracking-tight">
            {activeSectorLabel
              ? tx(
                  `Aucune alerte pour ${activeSectorLabel}`,
                  `No alerts for ${activeSectorLabel}`
                )
              : tx("Aucun rapport à produire", "No report to produce")}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
            {tx("Rapport", "Report")}
          </p>

          <div className="mt-5 max-w-xl rounded-[22px] bg-[var(--ink)] p-4 text-sm leading-relaxed text-white">
            {tx(
              "Le rapport est construit à partir de vos alertes. Tant qu'aucun fichier n'a été importé, il n'y a rien à rapporter, et remplir la page de chiffres inventés ne vous aiderait pas.",
              "The report is built from your alerts. Until a file has been imported there is nothing to report, and filling the page with invented figures would not help you."
            )}
          </div>

          <p className="mt-3 inline-block rounded-full bg-card px-4 py-2 text-sm font-medium">
            {tx(
              "Importez un CSV depuis le tableau de bord pour générer votre premier rapport.",
              "Import a CSV from the dashboard to produce your first report."
            )}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showSectorTabs && (
        <SectorTabs
          sectors={sectors}
          alerts={alerts}
          activeSector={activeSector}
          onChange={setActiveSector}
        />
      )}

      {/* F-REPORT: the week in the numbers the Monday email sends. */}
      {!data && <WeekCard />}

      <ReportBody
        data={resolved}
        timezoneLabel={built.timezoneLabel}
        sectorContext={activeSectorLabel}
      />
    </div>
  )
}

function ReportBody({
  data,
  timezoneLabel,
  sectorContext,
}: {
  data: ReportData
  timezoneLabel?: string
  /** The onboarded sector this report is currently scoped to, already
   *  resolved to its display label. Null when showing every sector. */
  sectorContext?: string | null
}) {
  const tx = useTx()

  const openAlerts = data.alerts.filter((a) => a.status === "open").length
  const criticalAlerts = data.alerts.filter((a) => a.severity === "critical").length
  const warningAlerts = data.alerts.filter((a) => a.severity === "warning").length
  const resolvedAlerts = data.alerts.filter((a) => a.status === "resolved").length

  const kpiEntries = useMemo(
    () =>
      data.monitoring
        .map((key) => data.kpis[key])
        .filter((v): v is KpiPoint => Boolean(v)),
    [data]
  )

  const trendEntries = useMemo(
    () =>
      data.monitoring
        .filter((key) => data.trends[key])
        .map((key) => ({
          key,
          points: data.trends[key]!,
          delta: data.kpis[key]?.delta ?? 0,
        })),
    [data]
  )

  return (
    <div className="print:space-y-4">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #sentria-report,
          #sentria-report * {
            visibility: visible;
          }
          #sentria-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      {/* The Ask SentrIA layout: lime card (whose report, which
          period), grey panel (figures, trends, alerts), black card (the
          count that matters). Printing falls back to one column. */}
      <div
        id="sentria-report"
        className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_290px] print:block print:space-y-4"
      >
        {/* -------------------------------------------------------- LEFT */}
        <div className="flex flex-col gap-4">
          <div className="rounded-[28px] bg-brand p-5 text-[#141414] print:rounded-none print:bg-transparent print:p-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-brand print:hidden">
                <FileDown className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold">SentrIA</span>
                <span className="block text-[11px] text-[#141414]/65">{tx("Rapport", "Report")}</span>
              </span>
            </div>

            <h1 className="mt-5 break-words font-heading text-2xl font-semibold leading-tight tracking-tight">
              {data.siteName}
            </h1>

            {sectorContext && (
              <span className="mt-2 inline-block rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                {sectorContext}
              </span>
            )}

            <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-[#141414]/75">
              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {data.dateRange}
                {timezoneLabel && (
                  <span className="block text-[11px]">
                    {tx("heures en", "times in")} {timezoneLabel}
                  </span>
                )}
              </span>
            </p>

            <button
              type="button"
              onClick={() => window.print()}
              className="mt-4 flex w-full items-center justify-between rounded-full bg-[var(--ink)] py-2 pl-5 pr-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414] print:hidden"
            >
              {tx("Exporter en PDF", "Export as PDF")}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[#141414]">
                <FileDown className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>

          {/* Auto-generated summary */}
          <div className="rounded-[28px] bg-card p-5 shadow-sm print:shadow-none">
            <p className="font-heading text-xl font-semibold tracking-tight">{tx("En bref", "In short")}</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li className="flex items-center justify-between rounded-2xl bg-muted px-4 py-2.5">
                <span>{tx("Ouvertes", "Open")}</span>
                <span className="font-bold tabular-nums">{openAlerts}</span>
              </li>
              <li className="flex items-center justify-between rounded-2xl bg-muted px-4 py-2.5">
                <span>{tx("Résolues", "Resolved")}</span>
                <span className="font-bold tabular-nums">{resolvedAlerts}</span>
              </li>
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {tx(
                `${openAlerts} alerte${openAlerts > 1 ? "s" : ""} ouverte${openAlerts > 1 ? "s" : ""}, ${resolvedAlerts} résolue${resolvedAlerts > 1 ? "s" : ""} sur la période sélectionnée.`,
                `${openAlerts} alert${openAlerts > 1 ? "s" : ""} open, ${resolvedAlerts} resolved over the selected period.`
              )}
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------ CENTER */}
        <section className="min-w-0 space-y-6 rounded-[28px] bg-foreground/[0.055] p-5 sm:p-6 print:bg-transparent print:p-0">
          <div>
            <h2 className="font-heading text-3xl font-semibold leading-[1.05] tracking-tight">
              {tx("Votre rapport", "Your report")}
            </h2>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-brand ring-2 ring-brand/30" aria-hidden="true" />
              {tx("Construit à partir de vos alertes", "Built from your alerts")}
            </p>
          </div>

          {/* KPI summary */}
          <div>
            <SectionLabel>{tx("Indicateurs clés", "Key figures")}</SectionLabel>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3 print:grid-cols-4">
              {kpiEntries.map((point) => (
                <KpiCard key={point.label} point={point} />
              ))}
            </div>
          </div>

          {/* Trends */}
          {trendEntries.length > 0 && (
            <div>
              <SectionLabel>{tx("Tendances", "Trends")}</SectionLabel>
              <div className="mt-3 grid grid-cols-1 gap-3 2xl:grid-cols-2 print:grid-cols-2">
                {trendEntries.map(({ key, points, delta }) => (
                  <TrendCard key={key} monitoringKey={key} data={points} delta={delta} />
                ))}
              </div>
            </div>
          )}

          {/* Alerts */}
          <AlertsTable alerts={data.alerts} />
        </section>

        {/* ------------------------------------------------------- RIGHT */}
        <div className="flex flex-col gap-4 lg:col-start-2 xl:col-start-auto">
          <div className="rounded-[28px] bg-[var(--ink)] p-5 text-white print:hidden">
            <div className="flex items-center justify-between">
              <p className="font-heading text-xl font-semibold tracking-tight">{tx("La période", "The period")}</p>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">{tx("Alertes", "Alerts")}</span>
            </div>
            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-white/55">{tx("Critiques", "Critical")}</dt>
                <dd className="font-semibold tabular-nums">{criticalAlerts}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-white/55">{tx("Attention", "Warning")}</dt>
                <dd className="font-semibold tabular-nums">{warningAlerts}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-white/55">{tx("Résolues", "Resolved")}</dt>
                <dd className="font-semibold tabular-nums">{resolvedAlerts}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
              <span className="text-xs text-white/55">{tx("Alertes au total", "Alerts in all")}</span>
              <span className="font-heading text-4xl font-bold leading-none text-brand">{data.alerts.length}</span>
            </div>
          </div>

          {/* Repeat offenders */}
          <OffendersCallout offenders={data.topOffenders} />
        </div>
      </div>
    </div>
  )
}
