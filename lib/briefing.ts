import { countAlerts } from "@/lib/alert-count"
import { messageFinding, riskOf, type LogisticsAlert } from "@/lib/logistics-signals"
import type { Tx } from "@/lib/i18n/pair"

/**
 * The report as a story for the boss: what needs them, what keeps coming
 * back, what to do. Built from the alerts alone, by fixed rules, in the
 * language on screen. It carries no money figure and no advice the alerts
 * do not hold: a number or a step we cannot back would cost more trust than
 * it earns.
 */

export type BriefItem = {
  equipment: string
  /** The measured part of the alert's message. */
  finding: string
  critical: boolean
  /** ISO date of the newest alert on this asset and kind. */
  date: string
  /** Days in the period this alert fired on. */
  count: number
  /** Times it came in during the period: rows, not alerts. */
  fires: number
}

export type Briefing = {
  headline: string
  lead: string
  /** Critical first, then by the backend's risk score, newest last resort. */
  needs: BriefItem[]
  /** Alerts to watch that did not make the list above. */
  moreToWatch: number
  recurring: { equipment: string; count: number }[]
  plan: string[]
}

const NEEDS_SHOWN = 3

export function buildBriefing(alerts: LogisticsAlert[], tx: Tx, stale = false): Briefing {
  const dayOf = (date: string) => {
    const d = new Date(date)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }

  const groups = new Map<string, BriefItem & { risk: number; days: Set<string> }>()

  for (const alert of alerts) {
    const key = `${alert.equipment}|${alert.alert_key ?? messageFinding(alert)}`
    const held = groups.get(key)
    const critical = alert.severity === "CRITICAL"
    const at = Date.parse(alert.date)

    if (!held) {
      groups.set(key, {
        equipment: alert.equipment,
        finding: messageFinding(alert) || alert.message,
        critical,
        date: alert.date,
        count: 1,
        fires: 1,
        risk: riskOf(alert),
        days: new Set([dayOf(alert.date)]),
      })
      continue
    }

    held.days.add(dayOf(alert.date))
    held.count = held.days.size
    held.fires += 1
    held.risk = Math.max(held.risk, riskOf(alert))

    if (at > Date.parse(held.date)) {
      held.date = alert.date
      held.finding = messageFinding(alert) || alert.message
      held.critical = critical
    }
  }

  const ranked = [...groups.values()].sort(
    (a, b) =>
      Number(b.critical) - Number(a.critical) ||
      b.risk - a.risk ||
      Date.parse(b.date) - Date.parse(a.date)
  )

  const alertCount = ranked.length
  const criticalCount = ranked.filter((r) => r.critical).length
  const warningCount = alertCount - criticalCount
  const needs: BriefItem[] = ranked.slice(0, NEEDS_SHOWN).map((r) => ({ equipment: r.equipment, finding: r.finding, critical: r.critical, date: r.date, count: r.count, fires: r.fires }))
  const first = needs[0]

  const headline = !first
    ? tx("Rien à signaler.", "Nothing to report.")
    : criticalCount === 0
      ? tx(
          `Rien de critique. ${warningCount} point${warningCount > 1 ? "s" : ""} à surveiller.`,
          `Nothing critical. ${warningCount} thing${warningCount > 1 ? "s" : ""} to watch.`
        )
      : criticalCount === 1
        ? tx(`${first.equipment} a besoin de vous maintenant.`, `${first.equipment} needs you now.`)
        : tx(
            `${criticalCount} points critiques vous attendent, à commencer par ${first.equipment}.`,
            `${criticalCount} critical things need you, starting with ${first.equipment}.`
          )

  const lead = tx(
    `${alertCount} alerte${alertCount > 1 ? "s" : ""} sur la période : ${criticalCount} critique${criticalCount > 1 ? "s" : ""}, ${warningCount} à surveiller. Voici ce qui demande votre attention, ce qui revient, et quoi faire ensuite.`,
    `${alertCount} alert${alertCount > 1 ? "s" : ""} in the period: ${criticalCount} critical, ${warningCount} to watch. Here is what needs your attention, what keeps coming back, and what to do next.`
  )

  const recurring = ranked
    .filter((group) => group.days.size >= 2)
    .sort((a, b) => b.days.size - a.days.size)
    .slice(0, 3)
    .map((group) => ({ equipment: group.equipment, count: group.days.size }))

  const plan: string[] = []

  for (const item of needs.filter((n) => n.critical)) {
    plan.push(tx(`Aujourd'hui : traiter ${item.equipment}.`, `Today: deal with ${item.equipment}.`))
  }

  if (recurring[0]) {
    plan.push(
      tx(
        `Cette semaine : chercher pourquoi ${recurring[0].equipment} alerte si souvent (${recurring[0].count} jours).`,
        `This week: find out why ${recurring[0].equipment} alerts so often (${recurring[0].count} days).`
      )
    )
  }

  if (stale) plan.push(tx("Cette semaine : importer un fichier récent.", "This week: import a recent file."))

  return { headline, lead, needs, moreToWatch: Math.max(0, ranked.filter((r) => !r.critical).length - needs.filter((n) => !n.critical).length), recurring, plan: plan.slice(0, 5) }
}
