import type { Outcome } from "@/lib/crm"
import type { Tx } from "@/lib/i18n"

/* The words of the "What happened?" answers (F-OUTCOME), per sector: a
   pharmacy avoids a stock-out, a factory a breakdown. The three answers and
   what the API does with them stay the same everywhere. The app calls the
   retail sector `commerce`, the API `retail`: both are listed. */

type Noun = { fr: [avoided: string, happened: string]; en: [avoided: string, happened: string] }

const STOCK_OUT: Noun = { fr: ["Rupture évitée", "Rupture quand même"], en: ["Stock-out avoided", "Stock-out happened"] }
const BREAKDOWN: Noun = { fr: ["Panne évitée", "Panne quand même"], en: ["Breakdown avoided", "Breakdown happened"] }
const LOSS: Noun = { fr: ["Perte évitée", "Perte quand même"], en: ["Loss avoided", "Loss happened"] }
const DELAY: Noun = { fr: ["Retard évité", "Retard quand même"], en: ["Delay avoided", "Delay happened"] }
const PROBLEM: Noun = { fr: ["Problème évité", "Problème quand même"], en: ["Problem avoided", "Problem happened"] }

const BY_SECTOR: Record<string, Noun> = {
  health: STOCK_OUT,
  retail: STOCK_OUT,
  commerce: STOCK_OUT,
  industry: BREAKDOWN,
  energy: BREAKDOWN,
  transportation: BREAKDOWN,
  agriculture: LOSS,
  logistics: DELAY,
}

export function outcomeLabel(outcome: Outcome, sector: string | null | undefined, tx: Tx): string {
  if (outcome === "false_alarm") return tx("Fausse alerte", "False alarm")

  const noun = BY_SECTOR[sector ?? ""] ?? PROBLEM
  const index = outcome === "avoided" ? 0 : 1

  return tx(noun.fr[index], noun.en[index])
}
