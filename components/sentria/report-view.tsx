"use client"

import { useMemo, useState } from "react"
import {
  Download,
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
  CheckCircle2,
  Clock,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
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

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
}

// ---------------------------------------------------------------------------
// Mock data — replace with your API response shaped as ReportData
// ---------------------------------------------------------------------------

const MOCK_DATA: ReportData = {
  siteName: "Clinique Nord — Site principal",
  dateRange: "1 – 26 août 2026",
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

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        stable
      </span>
    )
  }

  const isUp = delta > 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isUp ? "text-emerald-600" : "text-destructive"
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
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <DeltaBadge delta={point.delta} />
      </div>

      <p className="mt-3 font-heading text-2xl font-bold tracking-tight">
        {point.value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{point.label}</p>
    </div>
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

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-semibold">{meta.label}</p>
        {meta.unit && (
          <span className="text-xs text-muted-foreground">({meta.unit})</span>
        )}
      </div>

      <div className="mt-3 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AlertsTable({ alerts }: { alerts: AlertRow[] }) {
  const [filter, setFilter] = useState<"all" | AlertStatus>("all")

  const visible = alerts.filter((a) => filter === "all" || a.status === filter)

  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Alertes & anomalies</p>

        <div className="flex gap-1">
          {(["all", "open", "resolved"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                filter === key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {key === "all" ? "Toutes" : key === "open" ? "Ouvertes" : "Résolues"}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border">
        {visible.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune alerte pour ce filtre.
          </p>
        )}

        {visible.map((alert) => {
          const meta = MONITORING_META[alert.category]
          const Icon = meta.icon

          return (
            <div
              key={alert.id}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                  SEVERITY_STYLES[alert.severity]
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{alert.message}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {alert.site} · {alert.timestamp}
                </p>
              </div>

              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  alert.status === "open"
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                )}
              >
                {alert.status === "open" ? (
                  <Clock className="h-3 w-3" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {alert.status === "open" ? "Ouverte" : "Résolue"}
              </span>
            </div>
          )
        })}
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            {data.siteName}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {data.dateRange}
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <Download className="h-4 w-4" />
          Exporter
        </button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiEntries.map((point) => (
          <KpiCard key={point.label} point={point} />
        ))}
      </div>

      {/* Trends */}
      {trendEntries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trendEntries.map(({ key, points }) => (
            <TrendCard key={key} monitoringKey={key} data={points} />
          ))}
        </div>
      )}

      {/* Alerts */}
      <AlertsTable alerts={data.alerts} />

      {/* Auto-generated summary */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {openAlerts} alerte{openAlerts > 1 ? "s" : ""} ouverte
          {openAlerts > 1 ? "s" : ""}, {resolvedAlerts} résolue
          {resolvedAlerts > 1 ? "s" : ""} sur la période sélectionnée.
        </p>
      </div>
    </div>
  )
}