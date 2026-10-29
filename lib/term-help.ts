import type { Localized } from "@/lib/i18n/pair"

/* What the two numbers on an alert mean, for an admin, with examples
   (components/sentria/term-help.tsx shows them). Plain words, no formula:
   the scores themselves come from the API and from lib/confidence.ts. */

export type TermKey = "confidence" | "risk"

export type TermHelp = {
  label: Localized
  short: Localized
  examples: Localized[]
  /** How to act on the two numbers together. */
  rule?: Localized
}

export const TERM_HELP: Record<TermKey, TermHelp> = {
  confidence: {
    label: { fr: "Confiance", en: "Confidence" },
    short: {
      fr: "À quel point SentrIA est sûr que le problème est réel. 85 % ou plus : élevée. De 65 à 84 % : bonne. Moins de 65 % : modérée.",
      en: "How sure SentrIA is that the problem is real. 85% or more: high. 65 to 84%: good. Under 65%: moderate.",
    },
    examples: [
      {
        fr: "92 % (élevée) : le paracétamol sera épuisé dans 8 jours, données en direct, déjà réapprovisionné avant.",
        en: "92% (high): paracetamol runs out in 8 days, live data, restocked before.",
      },
      {
        fr: "70 % (bonne) : le stock a chuté, mais ce n'est jamais arrivé. Vérifiez le comptage.",
        en: "70% (good): stock dropped, but this has never happened. Check the count.",
      },
      {
        fr: "40 % (modérée) : une ligne bizarre dans le fichier peut tout expliquer.",
        en: "40% (moderate): one odd line in the file could explain it all.",
      },
    ],
  },
  risk: {
    label: { fr: "Risque", en: "Risk" },
    short: {
      fr: "Ce qui arrive si personne n'agit, sur 100. Plus le chiffre est haut, plus c'est grave.",
      en: "What happens if nobody acts, out of 100. The higher the number, the worse it is.",
    },
    examples: [
      {
        fr: "80/100 : rupture probable cette semaine, des ventes perdues.",
        en: "80/100: a stock-out is likely this week, with lost sales.",
      },
      {
        fr: "20/100 : un article qui se vend peu, avec beaucoup de stock. Rien d'urgent.",
        en: "20/100: a slow seller with plenty of stock. Nothing urgent.",
      },
    ],
    rule: {
      fr: "Risque élevé et confiance élevée : agissez maintenant. Risque élevé et confiance faible : vérifiez les données d'abord. Risque faible : attendez.",
      en: "High risk and high confidence: act now. High risk and low confidence: check the data first. Low risk: wait.",
    },
  },
}
