/** F-SUPPRESS: an alert the company keeps dismissing is lowered by the
 *  backend (pipeline/suppression.py) and labelled in its params:
 *  demo_dismissed of demo_of firings were dismissed, demo_from is the
 *  severity it would have had. Nothing is hidden, so the app says why. */

import type { Tx } from "@/lib/i18n"
import { asRecord, type AlertParams } from "@/lib/value-at-risk"

export type Demotion = {
  dismissed: number
  of: number
  /** The severity the alert would have had. */
  from: string
}

export function demotion(params: AlertParams): Demotion | null {
  const record = asRecord(params)
  if (!record) return null

  const dismissed = Number(record.demo_dismissed)
  const of = Number(record.demo_of)

  if (!Number.isFinite(dismissed) || !Number.isFinite(of) || of <= 0) return null

  return { dismissed, of, from: typeof record.demo_from === "string" ? record.demo_from : "" }
}

/** The one-sentence reason, in the reader's language. */
export function demotionSentence(d: Demotion, tx: Tx): string {
  const count = tx(
    `écartée ${d.dismissed} fois sur ses ${d.of} dernières apparitions`,
    `dismissed ${d.dismissed} of its last ${d.of} times`
  )

  return d.from === "CRITICAL"
    ? tx(
        `Abaissée de Critique à Attention : ${count}. Marquez-la traitée une fois et SentrIA la remonte à son niveau normal.`,
        `Lowered from Critical to Warning: ${count}. Mark it handled once and SentrIA raises it at full level again.`
      )
    : tx(
        `Souvent écartée : ${count}. Marquez-la traitée une fois pour réinitialiser.`,
        `Often dismissed: ${count}. Mark it handled once to reset.`
      )
}
