"use client"

import { useMemo, useState } from "react"
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
import { cn } from "@/lib/utils"

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
  { label: string; icon: React.ElementType; unit?: string }
> = {
  equipment: { label: "Machines & équipements", icon: Settings2 },
  fleet: { label: "Flottes & véhicules", icon: Truck },
  inventory: { label: "Stocks & inventaires", icon: Boxes },
  energy: { label: "Énergie & consommation", icon: BatteryCharging, unit: "kWh" },
  conditions: { label: "Température & conditions", icon: Thermometer, unit: "°C" },
  maintenance: { label: "Maintenance", icon: Wrench },
  risks: { label: "Risques & anomalies", icon: ShieldAlert },
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critique",
  warning: "Attention",
  info: "Info",
}

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-blue-500",
}

// ---------------------------------------------------------------------------
// Mock data, replace with your API response shaped as ReportData
// ---------------------------------------------------------------------------

const MOCK_DATA: ReportData = {
  siteName: "Clinique Nord, Site principal",
  dateRange: "1 au 26 août 2026",
  sectors: ["health"],
  monitoring: ["inventory", "conditions", "maintenance", "risks"],
  kpis: {
    inventory: { label: "Stock médicaments", value: "82%", delta: -4, icon: Boxes },
    conditions: { label: "Chaîne du froid", value: "98.6%", delta: 1.2, icon: Thermometer },
    maintenance: { label: "Interventions en attente", value: "3", delta: -2, icon: Wrench },
    risks: { label: "Alertes ouvertes", value: "5", delta: 2, icon: ShieldAlert },
  },
  trends: {
    conditions: [
      { date: "19 août", value: 4.1 },
      { date: "20 août", value: 4.3 },
      { date: "21 août", value: 3.9 },
      { date: "22 août", value: 5.2 },
      { date: "23 août", value: 4.0 },
      { date: "24 août", value: 3.8 },
      { date: "25 août", value: 4.2 },
    ],
    inventory: [
      { date: "19 août", value: 91 },
      { date: "20 août", value: 89 },
      { date: "21 août", value: 87 },
      { date: "22 août", value: 85 },
      { date: "23 août", value: 84 },
      { date: "24 août", value: 83 },
      { date: "25 août", value: 82 },
    ],
  },
  alerts: [
    {
      id: "a1",
      timestamp: "25 août, 14:32",
      site: "Réfrigérateur R2",
      category: "conditions",
      severity: "critical",
      status: "open",
      message: "Dépassement de seuil de température (5.2°C)",
    },
    {
      id: "a2",
      timestamp: "25 août, 09:10",
      site: "Pharmacie centrale",
      category: "inventory",
      severity: "warning",
      status: "open",
      message: "Stock de Paracétamol sous le seuil critique",
    },
    {
      id: "a3",
      timestamp: "24 août, 18:45",
      site: "Réfrigérateur R1",
      category: "maintenance",
      severity: "info",
      status: "resolved",
      message: "Maintenance préventive effectuée",
    },
    {
      id: "a4",
      timestamp: "23 août, 11:02",
      site: "Pharmacie centrale",
      category: "risks",
      severity: "warning",
      status: "resolved",
      message: "Anomalie de consommation détectée puis résolue",
    },
  ],
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

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        stable
      </span>
    )
  }

  const isUp = delta > 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        isUp
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-destructive/10 text-destructive"
      )}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(delta)}%
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
        <DeltaBadge delta={point.delta} />
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
  const meta = MONITORING_META[monitoringKey]
  const Icon = meta.icon
  const first = data[0]?.value
  const last = data[data.length - 1]?.value
  const delta = first ? ((last - first) / first) * 100 : 0

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold">{meta.label}</p>
        </div>
        <DeltaBadge delta={Number(delta.toFixed(1))} />
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-heading text-2xl font-bold tracking-tight">
          {last?.toFixed(1)}
        </span>
        {meta.unit && (
          <span className="text-sm text-muted-foreground">{meta.unit}</span>
        )}
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
  const [filter, setFilter] = useState<"all" | AlertStatus>("all")
  const visible = alerts.filter((a) => filter === "all" || a.status === filter)

  const filters: { key: "all" | AlertStatus; label: string }[] = [
    { key: "all", label: "Toutes" },
    { key: "open", label: "Ouvertes" },
    { key: "resolved", label: "Résolues" },
  ]

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between px-5 py-4">
        <SectionLabel>Alertes & anomalies</SectionLabel>

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
                Horodatage
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Site
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Catégorie
              </th>
              <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Gravité
              </th>
              <th className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Statut
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
                  Aucune alerte pour ce filtre.
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
                    {meta.label}
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
                      {SEVERITY_LABEL[alert.severity]}
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
                      {alert.status === "open" ? "Ouverte" : "Résolue"}
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

export function ReportView({ data = MOCK_DATA }: { data?: ReportData }) {
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
              <SectionLabel>Rapport</SectionLabel>
              <h1 className="mt-1.5 font-heading text-2xl font-bold tracking-tight">
                {data.siteName}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {data.dateRange}
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 print:hidden"
            >
              <FileDown className="h-4 w-4" />
              Exporter en PDF
            </button>
          </div>
        </div>

        {/* KPI summary */}
        <div>
          <SectionLabel>Indicateurs clés</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4">
            {kpiEntries.map((point) => (
              <KpiCard key={point.label} point={point} />
            ))}
          </div>
        </div>

        {/* Trends */}
        {trendEntries.length > 0 && (
          <div>
            <SectionLabel>Tendances</SectionLabel>
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
            {openAlerts} alerte{openAlerts > 1 ? "s" : ""} ouverte
            {openAlerts > 1 ? "s" : ""}, {resolvedAlerts} résolue
            {resolvedAlerts > 1 ? "s" : ""} sur la période sélectionnée.
          </p>
        </div>
      </div>
    </div>
  )
}
