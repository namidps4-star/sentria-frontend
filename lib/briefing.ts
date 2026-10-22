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
  /** How many alerts of this kind this asset has in the period. */
  count: number
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
  // One row per asset and kind: a repeat is a count, not a second story.
  const groups = new Map<string, BriefItem & { risk: number }>()

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
        risk: riskOf(alert),
      })
      continue
    }

    held.count += 1
    held.critical = held.critical || critical
    held.risk = Math.max(held.risk, riskOf(alert))

    if (at > Date.parse(held.date)) {
      held.date = alert.date
      held.finding = messageFinding(alert) || alert.message
    }
  }

  const ranked = [...groups.values()].sort(
    (a, b) =>
      Number(b.critical) - Number(a.critical) ||
      b.risk - a.risk ||
      Date.parse(b.date) - Date.parse(a.date)
  )

  const critical = alerts.filter((a) => a.severity === "CRITICAL").length
  const warning = alerts.length - critical
  const needs: BriefItem[] = ranked.slice(0, NEEDS_SHOWN).map((r) => ({ equipment: r.equipment, finding: r.finding, critical: r.critical, date: r.date, count: r.count }))
  const first = needs[0]

  // The headline counts things that need a person, not repeats of one.
  const criticalThings = ranked.filter((r) => r.critical).length

  const headline = !first
    ? tx("Rien à signaler.", "Nothing to report.")
    : critical === 0
      ? tx(
          `Rien de critique. ${warning} point${warning > 1 ? "s" : ""} à surveiller.`,
          `Nothing critical. ${warning} thing${warning > 1 ? "s" : ""} to watch.`
        )
      : criticalThings === 1
        ? tx(`${first.equipment} a besoin de vous maintenant.`, `${first.equipment} needs you now.`)
        : tx(
            `${criticalThings} points critiques vous attendent, à commencer par ${first.equipment}.`,
            `${criticalThings} critical things need you, starting with ${first.equipment}.`
          )

  const lead = tx(
    `${alerts.length} alerte${alerts.length > 1 ? "s" : ""} sur la période : ${critical} critique${critical > 1 ? "s" : ""}, ${warning} à surveiller. Voici ce qui demande votre attention, ce qui revient, et quoi faire ensuite.`,
    `${alerts.length} alert${alerts.length > 1 ? "s" : ""} in the period: ${critical} critical, ${warning} to watch. Here is what needs your attention, what keeps coming back, and what to do next.`
  )

  const perAsset = new Map<string, number>()

  for (const alert of alerts) perAsset.set(alert.equipment, (perAsset.get(alert.equipment) ?? 0) + 1)

  const recurring = [...perAsset.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([equipment, count]) => ({ equipment, count }))

  const plan: string[] = []

  for (const item of needs.filter((n) => n.critical)) {
    plan.push(tx(`Aujourd'hui : traiter ${item.equipment}.`, `Today: deal with ${item.equipment}.`))
  }

  if (recurring[0]) {
    plan.push(
      tx(
        `Cette semaine : chercher pourquoi ${recurring[0].equipment} alerte si souvent (${recurring[0].count} fois).`,
        `This week: find out why ${recurring[0].equipment} alerts so often (${recurring[0].count} times).`
      )
    )
  }

  if (stale) plan.push(tx("Cette semaine : importer un fichier récent.", "This week: import a recent file."))

  return { headline, lead, needs, moreToWatch: Math.max(0, ranked.filter((r) => !r.critical).length - needs.filter((n) => !n.critical).length), recurring, plan: plan.slice(0, 5) }
}
