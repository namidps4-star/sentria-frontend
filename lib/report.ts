import {
  dailyCounts,
  metricFor,
  messageFinding,
  type LogisticsAlert,
} from "@/lib/logistics-signals"
import { formatInCompanyZone, timezoneFor } from "@/lib/company"

/**
 * Turns the alerts the backend produced into the report.
 *
 * The report view shipped with a MOCK_DATA constant and app-shell
 * rendered <ReportView /> with no props, so every customer saw "Clinique
 * Nord, Site principal", a stock level of 82 percent and a cold chain at
 * 98.6 percent, none of which came from anywhere. Putting the real
 * company name on that would only have made the invented figures look
 * like the customer's own.
 *
 * So this derives what the alerts can actually support, and the view
 * renders nothing for the rest rather than filling the gap. Dates are
 * formatted in the company's timezone, because a report that says an
 * asset was blocked at 14:00 should mean 14:00 where the operator is.
 */

export type ReportSeverity = "critical" | "warning" | "info"

export type ReportMonitoringKey =
  | "equipment"
  | "fleet"
  | "inventory"
  | "energy"
  | "conditions"
  | "maintenance"
  | "risks"

export type ReportKpi = {
  label: string
  value: string
  delta: number
}

export type ReportTrendPoint = { date: string; value: number }

export type ReportAlertRow = {
  id: string
  timestamp: string
  site: string
  category: ReportMonitoringKey
  severity: ReportSeverity
  status: "open" | "resolved"
  message: string
}

export type BuiltReport = {
  siteName: string
  dateRange: string
  timezoneLabel: string
  monitoring: ReportMonitoringKey[]
  kpis: Partial<Record<ReportMonitoringKey, ReportKpi>>
  trends: Partial<Record<ReportMonitoringKey, ReportTrendPoint[]>>
  alerts: ReportAlertRow[]
  /** True when there is nothing to report, so the view can say so
   *  instead of drawing an empty frame. */
  empty: boolean
}

/** Which section of the report an alert belongs in, from its metric. */
function categoryOf(alert: LogisticsAlert): ReportMonitoringKey {
  const kind = metricFor(alert)?.kind

  switch (kind) {
    case "temperature":
      return "conditions"
    case "fuel":
      return "energy"
    case "service":
    case "mileage":
    case "pressure":
    case "oil":
    case "engine":
    case "tires":
      return "maintenance"
    case "cycles":
    case "discharge":
      return "equipment"
    case "wait":
    case "berth":
    case "eta":
    case "demurrage":
    case "documents":
    case "dwell":
    case "inspection":
      return "risks"
    default:
      return "risks"
  }
}

const CATEGORY_KPI_LABEL: Record<ReportMonitoringKey, string> = {
  equipment: "Alertes équipements",
  fleet: "Alertes flotte",
  inventory: "Alertes stocks",
  energy: "Alertes énergie",
  conditions: "Alertes conditions",
  maintenance: "Alertes maintenance",
  risks: "Alertes risques",
}

function severityOf(alert: LogisticsAlert): ReportSeverity {
  return alert.severity === "CRITICAL" ? "critical" : "warning"
}

/** Day labels for the trend axis, in the company's zone. */
function dayLabels(days: number, zone: string): string[] {
  const out: string[] = []

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 864e5)

    try {
      out.push(
        new Intl.DateTimeFormat("fr-FR", {
          day: "numeric",
          month: "short",
          timeZone: zone,
        }).format(date)
      )
    } catch {
      out.push(date.toLocaleDateString("fr-FR"))
    }
  }

  return out
}

export function buildReport(
  alerts: LogisticsAlert[],
  companyName: string,
  timezoneId: string,
  days = 7
): BuiltReport {
  const zone = timezoneFor(timezoneId)
  const name = companyName.trim() || "Votre entreprise"

  if (alerts.length === 0) {
    return {
      siteName: name,
      dateRange: "",
      timezoneLabel: zone.label,
      monitoring: [],
      kpis: {},
      trends: {},
      alerts: [],
      empty: true,
    }
  }

  const sorted = [...alerts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  /* Only the categories that actually have alerts. The mock listed four
     fixed sections whatever the data said. */
  const byCategory = new Map<ReportMonitoringKey, LogisticsAlert[]>()

  for (const alert of alerts) {
    const key = categoryOf(alert)
    const bucket = byCategory.get(key)

    if (bucket) bucket.push(alert)
    else byCategory.set(key, [alert])
  }

  const monitoring = [...byCategory.keys()]
  const kpis: Partial<Record<ReportMonitoringKey, ReportKpi>> = {}
  const trends: Partial<Record<ReportMonitoringKey, ReportTrendPoint[]>> = {}
  const labels = dayLabels(days, zone.zone)

  for (const [key, list] of byCategory) {
    const counts = dailyCounts(
      list,
      days,
      () => true
    )

    /* The delta is the last day against the one before it, which is a
       real comparison. The mock's deltas were written by hand. */
    const today = counts[counts.length - 1] ?? 0
    const yesterday = counts[counts.length - 2] ?? 0

    kpis[key] = {
      label: CATEGORY_KPI_LABEL[key],
      value: String(list.length),
      delta: today - yesterday,
    }

    trends[key] = counts.map((value, index) => ({
      date: labels[index] ?? "",
      value,
    }))
  }

  const rows: ReportAlertRow[] = [...alerts]
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .slice(0, 40)
    .map((alert, index) => ({
      id: `${alert.equipment}-${index}`,
      timestamp: formatInCompanyZone(alert.date, timezoneId),
      site: alert.equipment,
      category: categoryOf(alert),
      severity: severityOf(alert),
      /* The alerts table has no resolved state yet, so everything the
         backend returns is open. Marking some resolved would be an
         invention. */
      status: "open" as const,
      message: messageFinding(alert) || alert.message,
    }))

  return {
    siteName: name,
    dateRange: `${formatInCompanyZone(first.date, timezoneId)} au ${formatInCompanyZone(
      last.date,
      timezoneId
    )}`,
    timezoneLabel: zone.label,
    monitoring,
    kpis,
    trends,
    alerts: rows,
    empty: false,
  }
}
