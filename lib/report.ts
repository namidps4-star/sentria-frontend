import {
  dailyCounts,
  metricFor,
  messageFinding,
  type LogisticsAlert,
} from "@/lib/logistics-signals"
import { formatInCompanyZone, timezoneFor } from "@/lib/company"
import { localized, type Localized, type Tx } from "@/lib/i18n/pair"

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
  label: Localized
  value: string
  /** Week-over-week: this 7-day window's count minus the previous 7-day
   *  window's, not day-over-day. A single bad day used to flip the
   *  badge on its own; this reads a real week of signal. */
  delta: number
  criticalCount: number
  warningCount: number
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
  /** The backend's own 0-100 composite score for this row. Null when
   *  the backend didn't compute one — never filled in on this end. */
  riskScore: number | null
}

export type ReportOffender = {
  equipment: string
  count: number
}

export type BuiltReport = {
  siteName: string
  dateRange: string
  timezoneLabel: string
  monitoring: ReportMonitoringKey[]
  kpis: Partial<Record<ReportMonitoringKey, ReportKpi>>
  trends: Partial<Record<ReportMonitoringKey, ReportTrendPoint[]>>
  alerts: ReportAlertRow[]
  /** Equipment/sites named on 2+ alerts this period, worst first. A
   *  chronic problem named once rather than left to drown in the
   *  table below. */
  topOffenders: ReportOffender[]
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

const CATEGORY_KPI_LABEL: Record<ReportMonitoringKey, Localized> = {
  equipment: localized("Alertes équipements", "Equipment alerts"),
  fleet: localized("Alertes flotte", "Fleet alerts"),
  inventory: localized("Alertes stocks", "Stock alerts"),
  energy: localized("Alertes énergie", "Energy alerts"),
  conditions: localized("Alertes conditions", "Condition alerts"),
  maintenance: localized("Alertes maintenance", "Maintenance alerts"),
  risks: localized("Alertes risques", "Risk alerts"),
}

function severityOf(alert: LogisticsAlert): ReportSeverity {
  return alert.severity === "CRITICAL" ? "critical" : "warning"
}

/** Day labels for the trend axis, in the company's zone. */
function dayLabels(days: number, zone: string, tx: Tx): string[] {
  const out: string[] = []

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 864e5)

    try {
      out.push(
        new Intl.DateTimeFormat(tx("fr-FR", "en-GB"), {
          day: "numeric",
          month: "short",
          timeZone: zone,
        }).format(date)
      )
    } catch {
      out.push(date.toLocaleDateString(tx("fr-FR", "en-GB")))
    }
  }

  return out
}

export function buildReport(
  alerts: LogisticsAlert[],
  companyName: string,
  timezoneId: string,
  tx: Tx,
  days = 7
): BuiltReport {
  const zone = timezoneFor(timezoneId)
  const name =
    companyName.trim() || tx("Votre entreprise", "Your company")

  if (alerts.length === 0) {
    return {
      siteName: name,
      dateRange: "",
      timezoneLabel: zone.label,
      monitoring: [],
      kpis: {},
      trends: {},
      alerts: [],
      topOffenders: [],
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
  const labels = dayLabels(days, zone.zone, tx)

  for (const [key, list] of byCategory) {
    /* Two windows back to back so the delta is a week against the week
       before it, not one day against the one before it: a single bad
       day used to be able to flip the badge on its own. */
    const counts = dailyCounts(list, days * 2, () => true)
    const previousWindow = counts.slice(0, days)
    const currentWindow = counts.slice(days)

    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

    const criticalCount = list.filter(
      (alert) => severityOf(alert) === "critical"
    ).length

    kpis[key] = {
      label: CATEGORY_KPI_LABEL[key],
      value: String(list.length),
      delta: sum(currentWindow) - sum(previousWindow),
      criticalCount,
      warningCount: list.length - criticalCount,
    }

    trends[key] = currentWindow.map((value, index) => ({
      date: labels[index] ?? "",
      value,
    }))
  }

  /* Named once here rather than left for the reader to spot by
     scanning forty rows of the table below. */
  const offenderCounts = new Map<string, number>()

  for (const alert of alerts) {
    offenderCounts.set(
      alert.equipment,
      (offenderCounts.get(alert.equipment) ?? 0) + 1
    )
  }

  const topOffenders: ReportOffender[] = [...offenderCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([equipment, count]) => ({ equipment, count }))

  const rows: ReportAlertRow[] = [...alerts]
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .slice(0, 40)
    .map((alert, index) => ({
      id: `${alert.equipment}-${index}`,
      timestamp: formatInCompanyZone(alert.date, tx, timezoneId),
      site: alert.equipment,
      category: categoryOf(alert),
      severity: severityOf(alert),
      /* The alerts table has no resolved state yet, so everything the
         backend returns is open. Marking some resolved would be an
         invention. */
      status: "open" as const,
      message: messageFinding(alert) || alert.message,
      riskScore:
        typeof alert.risk_score === "number" ? alert.risk_score : null,
    }))

  return {
    siteName: name,
    dateRange: (() => {
      const from = formatInCompanyZone(first.date, tx, timezoneId)
      const to = formatInCompanyZone(last.date, tx, timezoneId)

      return tx(`${from} au ${to}`, `${from} to ${to}`)
    })(),
    timezoneLabel: zone.label,
    monitoring,
    kpis,
    trends,
    alerts: rows,
    topOffenders,
    empty: false,
  }
}
