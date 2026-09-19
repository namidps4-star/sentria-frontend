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
  AlertTriangle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { API_BASE } from "@/lib/api"
import { readCompanyName, readTimezoneId } from "@/lib/company"
import { buildReport } from "@/lib/report"
import type { LogisticsAlert } from "@/lib/logistics-signals"
import { cn } from "@/lib/utils"
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
}

interface ReportData {
  siteName: string
  dateRange: string
  sectors: string[]
  monitoring: MonitoringKey[]
  kpis: Partial<Record<MonitoringKey, KpiPoint>>
  trends: Partial<Record<MonitoringKey, TrendPoint[]>>
  alerts: AlertRow[]
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
  warning: "bg-amber-500",
  info: "bg-blue-500",
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
  const Icon = point.icon

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
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
  const gradientId = useMemo(
    () => `spark-${Math.random().toString(36).slice(2)}`,
    []
  )

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
}: {
  monitoringKey: MonitoringKey
  data: TrendPoint[]
}) {
  const tx = useTx()

  const meta = MONITORING_META[monitoringKey]
  const Icon = meta.icon
  const last = data[data.length - 1]?.value ?? 0
  const previous = data[data.length - 2]?.value ?? 0

  /* Day against previous day, the same comparison the KPI card makes.
     It used to be first against last as a percentage, so a card could
     read "stable" while its own KPI said "+15", and a series starting
     at zero divided by zero and always came out flat. */
  const delta = last - previous

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
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
          {last}
        </span>

        {/* The unit used to come from MONITORING_META, so the conditions
            card printed "1.0 °C" for what is a count of one alert, as if
            the temperature were one degree. These series count alerts
            per day, and that is what the label says. */}
        <span className="text-sm text-muted-foreground">
          {last > 1
            ? tx("alertes le dernier jour", "alerts on the last day")
            : tx("alerte le dernier jour", "alert on the last day")}
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
    <div className="rounded-2xl border border-border bg-card">
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
              <th className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tx("Statut", "Status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={6}
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
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        alert.status === "open"
                          ? "text-amber-600"
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

  useEffect(() => {
    setCompanyName(readCompanyName())
    setTimezoneId(readTimezoneId())

    fetch(`${API_BASE}/alerts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAlerts(Array.isArray(d) ? d : []))
      .catch((error) => {
        console.error("Failed to load alerts for the report:", error)
      })
      .finally(() => setLoaded(true))
  }, [])

  const built = useMemo(
    () => buildReport(alerts, companyName, timezoneId, tx),
    [alerts, companyName, timezoneId, tx]
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
              icon:
                MONITORING_META[key as MonitoringKey]?.icon ?? ShieldAlert,
            },
          ])
        ),
        trends: built.trends as ReportData["trends"],
        alerts: built.alerts as ReportData["alerts"],
      },
    [data, built]
  )

  if (!data && loaded && built.empty) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <FileDown
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <h2 className="mt-4 font-heading text-lg font-bold">
          {tx("Aucun rapport à produire", "No report to produce")}
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {tx(
            "Le rapport est construit à partir de vos alertes. Tant qu'aucun fichier n'a été importé, il n'y a rien à rapporter, et remplir la page de chiffres inventés ne vous aiderait pas.",
            "The report is built from your alerts. Until a file has been imported there is nothing to report, and filling the page with invented figures would not help you."
          )}
        </p>

        <p className="mt-3 text-xs text-muted-foreground">
          {tx(
            "Importez un CSV depuis le tableau de bord pour générer votre premier rapport.",
            "Import a CSV from the dashboard to produce your first report."
          )}
        </p>
      </div>
    )
  }

  return (
    <ReportBody data={resolved} timezoneLabel={built.timezoneLabel} />
  )
}

function ReportBody({
  data,
  timezoneLabel,
}: {
  data: ReportData
  timezoneLabel?: string
}) {
  const tx = useTx()

  const openAlerts = data.alerts.filter((a) => a.status === "open").length
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
        .map((key) => ({ key, points: data.trends[key]! })),
    [data]
  )

  function handleExportPdf() {
    window.print()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 print:space-y-4">
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

      <div id="sentria-report" className="space-y-8 print:space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-border bg-card p-6 print:rounded-none print:border-0 print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionLabel>{tx("Rapport", "Report")}</SectionLabel>
              <h1 className="mt-1.5 font-heading text-2xl font-bold tracking-tight">
                {data.siteName}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                {data.dateRange}

                {timezoneLabel && (
                  <span className="text-xs">
                    {" · "}
                    {tx("heures en", "times in")} {timezoneLabel}
                  </span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 print:hidden"
            >
              <FileDown className="h-4 w-4" />
              {tx("Exporter en PDF", "Export as PDF")}
            </button>
          </div>
        </div>

        {/* KPI summary */}
        <div>
          <SectionLabel>{tx("Indicateurs clés", "Key figures")}</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4">
            {kpiEntries.map((point) => (
              <KpiCard key={point.label} point={point} />
            ))}
          </div>
        </div>

        {/* Trends */}
        {trendEntries.length > 0 && (
          <div>
            <SectionLabel>{tx("Tendances", "Trends")}</SectionLabel>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
              {trendEntries.map(({ key, points }) => (
                <TrendCard key={key} monitoringKey={key} data={points} />
              ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        <AlertsTable alerts={data.alerts} />

        {/* Auto-generated summary */}
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <p className="pt-1.5">
            {tx(
              `${openAlerts} alerte${
                openAlerts > 1 ? "s" : ""
              } ouverte${openAlerts > 1 ? "s" : ""}, ${resolvedAlerts} résolue${
                resolvedAlerts > 1 ? "s" : ""
              } sur la période sélectionnée.`,
              `${openAlerts} alert${
                openAlerts > 1 ? "s" : ""
              } open, ${resolvedAlerts} resolved over the selected period.`
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
