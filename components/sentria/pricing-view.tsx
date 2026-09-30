"use client"

import { useEffect, useState } from "react"
import { BrainCircuit, Check, Minus } from "@/lib/icons"

import { useTx, type Localized, resolve } from "@/lib/i18n"
import { currencyByCode, useLocale } from "@/lib/locale"
import {
  PLAN_LIMITS,
  PLAN_NAMES,
  PLAN_ORDER,
  PLAN_UPDATED_EVENT,
  PRICES,
  PRICE_FALLBACK_CURRENCY,
  TRIAL_DAYS,
  atLeast,
  monthlyPrice,
  readAccountPlan,
  trialDaysLeft,
  type AccountPlan,
  type PlanId,
} from "@/lib/plans"
import { cn } from "@/lib/utils"

import { StatusTag } from "./status-tag"

const TAGLINES: Record<PlanId, Localized> = {
  decouverte: { fr: "Pour découvrir SentrIA sur un département.", en: "Try SentrIA on one department." },
  pro: { fr: "Pour un département qui tourne tous les jours.", en: "For one department running every day." },
  business: { fr: "Pour plusieurs départements liés, avec l'IA.", en: "For linked departments, with the AI." },
  entreprise: { fr: "Pour les groupes sur plusieurs secteurs.", en: "For groups across several sectors." },
}

/** Card looks, after the reference: white, white, lime (most popular),
 *  deep green (most complete). */
const LOOK: Record<PlanId, {
  card: string
  muted: string
  rule: string
  check: string
  off: string
  button: string
  badge?: Localized
  badgeClass?: string
}> = {
  decouverte: {
    card: "bg-card text-card-foreground border border-border",
    muted: "text-muted-foreground",
    rule: "border-border",
    check: "text-[#1f5c2e] dark:text-lime-300",
    off: "text-muted-foreground/45",
    button: "bg-[#d9f36e] text-[#10261a] hover:bg-[#cdea55]",
  },
  pro: {
    card: "bg-card text-card-foreground border border-border",
    muted: "text-muted-foreground",
    rule: "border-border",
    check: "text-[#1f5c2e] dark:text-lime-300",
    off: "text-muted-foreground/45",
    button: "bg-[#d9f36e] text-[#10261a] hover:bg-[#cdea55]",
  },
  business: {
    card: "bg-[#d4f542] text-[#10261a] shadow-[0_24px_60px_-20px_rgba(120,160,20,0.55)]",
    muted: "text-[#10261a]/70",
    rule: "border-[#10261a]/15",
    check: "text-[#10261a]",
    off: "text-[#10261a]/35",
    button: "bg-[#10261a] text-white hover:bg-[#1c3a29]",
    badge: { fr: "Le plus choisi", en: "Most popular" },
    badgeClass: "border-[#10261a]/60 text-[#10261a]",
  },
  entreprise: {
    card: "bg-[#0f2e1f] text-white shadow-[0_24px_60px_-20px_rgba(15,46,31,0.7)]",
    muted: "text-[#d4f542]/85",
    rule: "border-white/15",
    check: "text-[#d4f542]",
    off: "text-white/35",
    button: "bg-[#d4f542] text-[#10261a] hover:bg-[#c7ea2f]",
    badge: { fr: "Le plus complet", en: "Most complete" },
    badgeClass: "border-[#d4f542]/70 text-[#d4f542]",
  },
}

/** The same rows on every card, so plans compare line by line: a row a
 *  plan lacks is shown struck through, as in the reference. */
type Row = { label: (plan: PlanId) => Localized; has: (plan: PlanId) => boolean }

const ROWS: Row[] = [
  { label: (p) => PLAN_LIMITS[p].sectors, has: () => true },
  { label: (p) => PLAN_LIMITS[p].departments, has: () => true },
  { label: (p) => PLAN_LIMITS[p].sitesUsers, has: () => true },
  { label: (p) => PLAN_LIMITS[p].alerts, has: () => true },
  { label: (p) => PLAN_LIMITS[p].ask, has: () => true },
  { label: (p) => PLAN_LIMITS[p].history, has: () => true },
  {
    label: () => ({ fr: "Suivi, calendrier, sous-traitants, rapports", en: "Tracking, calendar, contractors, reports" }),
    has: (p) => PLAN_LIMITS[p].tracking,
  },
  {
    label: () => ({ fr: "SentrIA Intelligence (IA)", en: "SentrIA Intelligence (AI)" }),
    has: (p) => PLAN_LIMITS[p].ml,
  },
]

/** Only "supplier lead times" exists today; the rest is marked Soon. */
const ML_FEATURES: { label: Localized; soon?: boolean }[] = [
  { label: { fr: "Délais fournisseurs appris sur votre historique", en: "Supplier lead times learned from your history" } },
  { label: { fr: "Conseils de stock saisonniers (paludisme en saison des pluies, grippe à l'harmattan…)", en: "Seasonal stock advice (malaria in the rainy season, flu in the harmattan…)" }, soon: true },
  { label: { fr: "Prévision de la demande : quand chaque article sera épuisé", en: "Demand forecast: when each item will run out" }, soon: true },
  { label: { fr: "Détection d'anomalies sur stocks et machines", en: "Anomaly detection on stock and machines" }, soon: true },
]

const ADD_ONS: Localized[] = [
  { fr: "Chaîne du froid", en: "Cold chain" },
  { fr: "Groupes électrogènes de secours", en: "Backup generators" },
  { fr: "Flotte d'entreprise", en: "Company fleet" },
]

export function PricingView() {
  const tx = useTx()
  const { currency } = useLocale()
  const [annual, setAnnual] = useState(false)
  const [account, setAccount] = useState<AccountPlan | null>(null)

  useEffect(() => {
    const sync = () => setAccount(readAccountPlan())
    sync()
    window.addEventListener(PLAN_UPDATED_EVENT, sync)
    return () => window.removeEventListener(PLAN_UPDATED_EVENT, sync)
  }, [])

  const locale = tx("fr-FR", "en-GB")
  const priced = PRICES[currency.code] ? currency.code : PRICE_FALLBACK_CURRENCY
  const trialLeft = account ? trialDaysLeft(account.trialEndsAt) : 0
  const paidPlan = account?.plan ?? "decouverte"

  const price = (plan: PlanId) => {
    if (plan === "decouverte") return { main: tx("Gratuit", "Free"), per: "" }
    if (plan === "entreprise") return { main: tx("Sur devis", "On request"), per: "" }
    const p = monthlyPrice(plan, currency.code)!
    const amount = (annual ? p.amount * 10 : p.amount).toLocaleString(locale)
    const symbol = currencyByCode(p.currency)?.symbol ?? p.currency
    return { main: `${amount} ${symbol}`, per: annual ? tx("/ an", "/ year") : tx("/ mois", "/ month") }
  }

  return (
    // Negative margins: the page fills the whole content box, padding
    // included, instead of leaving a strip of the box around it.
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-canvas px-4 py-10 text-foreground lg:-m-8 lg:min-h-[calc(100%+4rem)] lg:px-10 lg:py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        {/* Header */}
        <header className="flex flex-col items-center text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {tx("Offres", "Plans")}
          </p>
          <div className="mt-2 h-px w-40 bg-border" />
          <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight md:text-4xl">
            {tx("L'offre qui suit votre activité", "The plan that fits your operation")}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {priced === currency.code
              ? tx(
                  `Prix en ${currency.code}, fixés pour votre marché, pas convertis.`,
                  `Prices in ${currency.code}, set for your market, not converted.`
                )
              : tx(
                  `Pas encore de prix en ${currency.code} : prix en dollars US.`,
                  `No ${currency.code} prices yet: prices in US dollars.`
                )}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-sm" role="group" aria-label={tx("Facturation", "Billing")}>
              {[false, true].map((yearly) => (
                <button
                  key={String(yearly)}
                  type="button"
                  onClick={() => setAnnual(yearly)}
                  aria-pressed={annual === yearly}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    annual === yearly ? "bg-[#0f2e1f] text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {yearly ? tx("Annuel", "Annual") : tx("Mensuel", "Monthly")}
                </button>
              ))}
            </div>
            <StatusTag tone="brand" size="sm">{tx("2 mois offerts à l'année", "2 months free yearly")}</StatusTag>
          </div>

          {trialLeft > 0 && (
            <div className="mt-4" role="status">
              <StatusTag tone="info" size="md">
                {tx(
                  `Essai Business : encore ${trialLeft} jour${trialLeft > 1 ? "s" : ""}, puis ${PLAN_NAMES[paidPlan]}`,
                  `Business trial: ${trialLeft} day${trialLeft > 1 ? "s" : ""} left, then ${PLAN_NAMES[paidPlan]}`
                )}
              </StatusTag>
            </div>
          )}
        </header>

        {/* Plans */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PLAN_ORDER.map((plan) => {
            const look = LOOK[plan]
            const current = account?.effective === plan
            const included = account ? atLeast(account.effective, plan) : false
            const { main, per } = price(plan)

            return (
              <section
                key={plan}
                aria-labelledby={`plan-${plan}`}
                className={cn("relative flex flex-col rounded-[28px] p-7", look.card)}
              >
                <div className="flex min-h-7 flex-wrap items-center gap-2">
                  {look.badge && (
                    <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", look.badgeClass)}>
                      {resolve(look.badge, tx)}
                    </span>
                  )}
                  {current && (
                    <StatusTag
                      tone="success"
                      size="xs"
                      // On the lime and green cards the tag keeps its light
                      // colours in dark mode too: the card stays bright.
                      className={plan === "business" || plan === "entreprise" ? "dark:border-green-500/60 dark:bg-green-100 dark:text-green-700" : undefined}
                    >
                      {trialLeft > 0 && plan === "business" ? tx("Votre essai", "Your trial") : tx("Votre offre", "Your plan")}
                    </StatusTag>
                  )}
                </div>

                <h3 id={`plan-${plan}`} className="mt-4 font-heading text-2xl font-bold">
                  {PLAN_NAMES[plan]}
                </h3>
                <p className={cn("mt-1 text-sm", look.muted)}>{resolve(TAGLINES[plan], tx)}</p>

                <ul className={cn("mt-6 flex flex-1 flex-col gap-3 border-t pt-6 text-sm", look.rule)}>
                  {ROWS.map((row, index) => {
                    const has = row.has(plan)
                    return (
                      <li key={index} className={cn("flex gap-2.5", !has && look.off)}>
                        {has ? (
                          <Check className={cn("mt-0.5 h-4 w-4 shrink-0", look.check)} strokeWidth={2.5} aria-hidden="true" />
                        ) : (
                          <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {has ? null : <span className="sr-only">{tx("Non inclus : ", "Not included: ")}</span>}
                          {resolve(row.label(plan), tx)}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <div className={cn("mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-5", look.rule)}>
                  <p className="font-heading font-bold tabular-nums">
                    <span className="text-xl">{main}</span>
                    {per && <span className={cn("ml-1 text-sm font-semibold", look.muted)}>{per}</span>}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-bold",
                      look.button,
                      (current || included) && "opacity-60"
                    )}
                  >
                    {current
                      ? tx("Actuelle", "Current")
                      : included
                        ? tx("Incluse", "Included")
                        : plan === "entreprise"
                          ? tx("Nous contacter", "Contact us")
                          : tx("Bientôt", "Soon")}
                  </span>
                </div>
              </section>
            )
          })}
        </div>

        <p className="-mt-4 text-center text-xs text-muted-foreground">
          {tx(
            "Le paiement en ligne (carte et mobile money) arrive bientôt.",
            "Online payment (card and mobile money) is coming soon."
          )}
        </p>

        {/* SentrIA Intelligence + add-ons */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-[28px] bg-[#0f2e1f] p-7 text-white">
            <h3 className="flex flex-wrap items-center gap-2 font-heading text-xl font-bold">
              <BrainCircuit className="h-5 w-5 text-[#d4f542]" aria-hidden="true" />
              SentrIA Intelligence
              <span className="text-sm font-medium text-white/60">· Business {tx("et", "and")} Entreprise</span>
            </h3>
            <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              {ML_FEATURES.map((feature) => (
                <li key={feature.label.en} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d4f542]" strokeWidth={2.5} aria-hidden="true" />
                  <span>
                    {resolve(feature.label, tx)}
                    {feature.soon && (
                      <StatusTag tone="neutral" size="xs" className="ml-2 align-middle">
                        {tx("Bientôt", "Soon")}
                      </StatusTag>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-white/55">
              {tx(
                "Les conseils saisonniers partent du calendrier de votre région, puis de votre propre historique après 3 mois de données. Ce sont des conseils de stock, jamais des conseils médicaux.",
                "Seasonal advice starts from your region's calendar, then from your own history after 3 months of data. It is stock advice, never medical advice."
              )}
            </p>
          </section>

          <section className="rounded-[28px] border border-border bg-card p-7">
            <h3 className="flex flex-wrap items-center gap-2 font-heading text-xl font-bold">
              {tx("Options", "Add-ons")}
              <StatusTag tone="neutral" size="xs">{tx("Bientôt", "Soon")}</StatusTag>
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {tx("Sur toute offre payante, quel que soit votre secteur.", "On any paid plan, whatever your sector.")}
            </p>
            <ul className="mt-5 flex flex-col gap-3 text-sm">
              {ADD_ONS.map((addOn) => (
                <li key={addOn.en} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1f5c2e] dark:text-lime-300" strokeWidth={2.5} aria-hidden="true" />
                  {resolve(addOn, tx)}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {tx(
            `Chaque nouveau compte essaie Business pendant ${TRIAL_DAYS} jours. Départements liés (Business) : clinique + pharmacie + laboratoire, coopérative ou exploitation + silo, centrale + distribution, grossiste + magasins, transporteur + location, et toute la logistique.`,
            `Every new account tries Business for ${TRIAL_DAYS} days. Linked departments (Business): clinic + pharmacy + lab, cooperative or farm + silo, power plant + distribution, wholesaler + stores, haulier + rental, and all of logistics.`
          )}
        </p>
      </div>
    </div>
  )
}
