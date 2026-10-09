import type { ReactNode } from "react"

import type { Tx } from "@/lib/i18n"
import {
  LADDER_DAYS,
  type Advice,
  type Moment,
  type Reading,
  type Wholesaler,
} from "@/lib/wholesalers"

/* The words the Wholesalers page and the stock alerts both use to say when to
 * order and what a miss would cost. One copy, so the page and the alerts
 * cannot disagree. */

export const DANGER = "#ff8a8a"

export function formatTime(minutes: number, lang: string): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const mm = String(m).padStart(2, "0")

  if (lang === "fr") return `${String(h).padStart(2, "0")}:${mm}`

  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? "am" : "pm"}`
}

/** A weekday name, Monday first (0). */
export function weekdayName(index: number, lang: string, style: "long" | "short" | "narrow"): string {
  // 1 January 2024 is a Monday.
  return new Intl.DateTimeFormat(lang, { weekday: style }).format(new Date(2024, 0, 1 + index))
}

export function leadLabel(days: number, tx: Tx): string {
  if (days === 0) return tx("Le jour même", "Same day")
  if (days === 1) return tx("Le lendemain", "Next day")

  return tx(`Dans ${days} jours`, `In ${days} days`)
}

export function daysWord(n: number, tx: Tx): string {
  return n === 1 ? tx("1 jour", "1 day") : tx(`${n} jours`, `${n} days`)
}

/** "today", "tomorrow", a weekday, or "in 9 days". */
export function when(arrives: number, today: Moment, lang: string, tx: Tx): string {
  if (arrives === 0) return tx("aujourd'hui", "today")
  if (arrives === 1) return tx("demain", "tomorrow")
  if (arrives < LADDER_DAYS) return weekdayName((today.weekday + arrives) % 7, lang, "long")

  return tx(`dans ${arrives} jours`, `in ${arrives} days`)
}

/** The sentence that says what to order and where, and the line under it that
 *  says what happens if the first wholesaler has none. `strong` is the class
 *  of the bold lead-in, so it reads on a dark card and on a light one. */
export function adviceLines(
  list: Wholesaler[],
  readings: Reading[],
  advice: Advice,
  today: Moment,
  lang: string,
  tx: Tx,
  strong = "text-sidebar-foreground"
) {
  const name = (r: Reading) =>
    r.wholesaler.name.trim() || tx(`Grossiste ${list.indexOf(r.wholesaler) + 1}`, `Wholesaler ${list.indexOf(r.wholesaler) + 1}`)

  let message: ReactNode = null
  let fallback: ReactNode = null
  let late = false
  /** The folded version: a few words, for a card that shows it closed. */
  let short = ""

  if (advice.kind === "order") {
    const { pick, fallback: next } = advice
    const day = when(pick.arrives as number, today, lang, tx)
    const early = pick.wholesaler.cutoff !== null && pick.beforeCutoff && pick.arrives === pick.wholesaler.before
    const timing = early
      ? tx(`avant ${formatTime(pick.wholesaler.cutoff as number, lang)}`, `before ${formatTime(pick.wholesaler.cutoff as number, lang)}`)
      : tx("maintenant", "now")

    message = tx(
      `Commandez chez ${name(pick)} ${timing}. Livraison ${day}.`,
      `Order from ${name(pick)} ${timing}. It arrives ${day}.`
    )
    short = tx(`Commander : ${name(pick)}, ${day}`, `Order: ${name(pick)}, ${day}`)

    fallback = next ? (
      <>
        <b className={strong}>{tx(`Si ${name(pick)} n'en a pas :`, `If ${name(pick)} has none:`)}</b>{" "}
        {next.arrives === null
          ? tx(`${name(next)} ne livre aucun jour.`, `${name(next)} never delivers.`)
          : next.inTime
            ? tx(
                `${name(next)} livre ${when(next.arrives, today, lang, tx)}, à temps.`,
                `${name(next)} arrives ${when(next.arrives, today, lang, tx)}, in time.`
              )
            : (
              <>
                {tx(
                  `${name(next)} livre ${when(next.arrives, today, lang, tx)}. Vous seriez en rupture `,
                  `${name(next)} arrives ${when(next.arrives, today, lang, tx)}. You would run out for `
                )}
                <b style={{ color: DANGER }}>{daysWord(next.gap, tx)}</b>.
              </>
            )}
      </>
    ) : (
      <>
        <b className={strong}>{tx(`Si ${name(pick)} n'en a pas :`, `If ${name(pick)} has none:`)}</b>{" "}
        {tx("aucun autre grossiste dans la liste.", "no other wholesaler on the list.")}
      </>
    )
  } else if (advice.kind === "late") {
    late = true
    short = advice.fastest
      ? tx("Aucun grossiste à temps", "No wholesaler in time")
      : tx("Aucune livraison réglée", "No delivery day set")
    const f = advice.fastest
    message = f
      ? tx(
          `Aucun grossiste n'arrive à temps. ${name(f)} est le plus rapide : ${when(f.arrives as number, today, lang, tx)}.`,
          `No wholesaler arrives in time. ${name(f)} is the fastest: ${when(f.arrives as number, today, lang, tx)}.`
        )
      : tx("Aucun grossiste ne livre un jour que vous avez réglé.", "No wholesaler delivers on a day you set.")
    fallback = f ? (
      <>
        {tx("Vous seriez en rupture ", "You would run out for ")}
        <b style={{ color: DANGER }}>{daysWord(f.gap, tx)}</b>.
      </>
    ) : null
  }

  return { message, fallback, late, name, short }
}
