"use client"

import { useEffect, useState } from "react"
import { BrainCircuit, Check, Clock, Sparkles } from "lucide-react"

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

/** What each plan is for, in one line. */
const TAGLINES: Record<PlanId, Localized> = {
  decouverte: { fr: "Pour essayer SentrIA sur un département", en: "Try SentrIA on one department" },
  pro: { fr: "Pour un département qui tourne tous les jours", en: "For one department running every day" },
  business: { fr: "Pour plusieurs départements liés, avec l'IA", en: "For linked departments, with the AI" },
  entreprise: { fr: "Pour les groupes sur plusieurs secteurs", en: "For groups across several sectors" },
}

/** SentrIA Intelligence. `soon` marks what is not built yet: the page
 *  only states as available what the product does today. */
const ML_FEATURES: { label: Localized; soon?: boolean }[] = [
  { label: { fr: "Délais fournisseurs appris sur votre historique", en: "Supplier lead times learned from your history" } },
  { label: { fr: "Conseils de stock saisonniers (paludisme en saison des pluies, grippe à l'harmattan...)", en: "Seasonal stock advice (malaria in the rainy season, flu in the harmattan...)" }, soon: true },
  { label: { fr: "Prévision de la demande : quand chaque article sera épuisé", en: "Demand forecast: when each item will run out" }, soon: true },
  { label: { fr: "Détection d'anomalies sur stocks et machines", en: "Anomaly detection on stock and machines" }, soon: true },
]

const ADD_ONS: Localized[] = [
  { fr: "Chaîne du froid", en: "Cold chain" },
  { fr: "Groupes électrogènes de secours", en: "Backup generators" },
  { fr: "Flotte d'entreprise", en: "Company fleet" },
]

function formatAmount(amount: number, currency: string, locale: string) {
  const symbol = currencyByCode(currency)?.symbol ?? currency
  return `${amount.toLocaleString(locale)} ${symbol}`
}

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

  const priceText = (plan: PlanId) => {
    if (plan === "decouverte") return tx("Gratuit", "Free")
    if (plan === "entreprise") return tx("Sur devis", "On request")
    const price = monthlyPrice(plan, currency.code)!
    return formatAmount(annual ? price.amount * 10 : price.amount, price.currency, locale)
  }

  return (
    // Negative margins: the page fills the whole content box, padding
    // included, instead of leaving a strip of the box around it.
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-[radial-gradient(ellipse_at_15%_10%,#c8e06a_0%,#85934f_30%,#34382a_65%,#1d1d1b_100%)] px-4 py-8 text-white lg:-m-8 lg:min-h-[calc(100%+4rem)] lg:px-10 lg:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d9f36e] px-3.5 py-1.5 text-xs font-semibold text-[#1d1d1b]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {tx("Offres", "Plans")}
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.35)] md:text-4xl">
              {tx("L'offre qui suit votre activité", "The plan that fits your operation")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
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
          </div>

          <div className="flex items-center gap-2.5 self-start rounded-full border border-[#c8e06a]/25 bg-[#1d1d1b]/60 px-4 py-2 backdrop-blur lg:self-auto">
            <span className={cn("text-xs font-medium", annual ? "text-white/50" : "text-[#d9f36e]")}>
              {tx("Mensuel", "Monthly")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              aria-label={tx("Facturation annuelle", "Annual billing")}
              onClick={() => setAnnual((v) => !v)}
              className="relative h-5 w-11 rounded-full bg-[#d9f36e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-[#1d1d1b] transition-all", annual ? "left-6" : "left-0.5")} />
            </button>
            <span className={cn("text-xs font-medium", annual ? "text-[#d9f36e]" : "text-white/50")}>
              {tx("Annuel", "Annual")}
            </span>
            <span className="rounded-full bg-[#d9f36e] px-2 py-0.5 text-[10px] font-bold text-[#1d1d1b]">
              {tx("2 mois offerts", "2 months free")}
            </span>
          </div>
        </div>

        {trialLeft > 0 && (
          <p role="status" className="flex items-center gap-2 rounded-2xl border border-[#d9f36e]/30 bg-[#1d1d1b]/50 px-4 py-3 text-sm">
            <Clock className="h-4 w-4 text-[#d9f36e]" aria-hidden="true" />
            {tx(
              `Essai Business : encore ${trialLeft} jour${trialLeft > 1 ? "s" : ""}. Ensuite, votre compte passe en ${PLAN_NAMES[paidPlan]}.`,
              `Business trial: ${trialLeft} day${trialLeft > 1 ? "s" : ""} left. Then your account moves to ${PLAN_NAMES[paidPlan]}.`
            )}
          </p>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PLAN_ORDER.map((plan) => {
            const limits = PLAN_LIMITS[plan]
            const featured = plan === "business"
            const current = account?.effective === plan
            const included = account ? atLeast(account.effective, plan) : false

            return (
              <section
                key={plan}
                aria-labelledby={`plan-${plan}`}
                className={cn(
                  "relative flex flex-col rounded-3xl p-6",
                  featured
                    ? "border border-[#d9f36e]/60 bg-[#1d1d1b] shadow-[0_20px_50px_-15px_rgba(217,243,110,0.35)]"
                    : "border border-white/60 bg-white text-[#1a1a1a]"
                )}
              >
                {current && (
                  <span className="absolute -top-3 left-6 rounded-full bg-[#d9f36e] px-3 py-1 text-[11px] font-bold text-[#1d1d1b]">
                    {trialLeft > 0 && plan === "business" ? tx("Votre essai", "Your trial") : tx("Votre offre", "Your plan")}
                  </span>
                )}

                <h3 id={`plan-${plan}`} className={cn("text-lg font-bold", featured && "text-[#d9f36e]")}>
                  {PLAN_NAMES[plan]}
                </h3>
                <p className={cn("mt-1 text-xs", featured ? "text-white/60" : "text-[#6b6b6b]")}>
                  {resolve(TAGLINES[plan], tx)}
                </p>

                <p className={cn("mt-5 text-3xl font-bold tabular-nums", featured && "text-[#d9f36e]")}>
                  {priceText(plan)}
                </p>
                <p className={cn("mt-1 h-4 text-xs", featured ? "text-white/50" : "text-[#8a8a8a]")}>
                  {plan === "pro" || plan === "business"
                    ? annual
                      ? tx("par an", "per year")
                      : tx("par mois", "per month")
                    : ""}
                </p>

                <ul className={cn("mt-5 flex flex-1 flex-col gap-2.5 border-t pt-5 text-sm", featured ? "border-white/10" : "border-black/10")}>
                  {[limits.sectors, limits.departments, limits.sitesUsers, limits.alerts, limits.ask, limits.history].map((line) => (
                    <li key={line.en} className="flex gap-2">
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", featured ? "text-[#d9f36e]" : "text-[#5f7a1f]")} aria-hidden="true" />
                      {resolve(line, tx)}
                    </li>
                  ))}
                  {limits.tracking && (
                    <li className="flex gap-2">
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", featured ? "text-[#d9f36e]" : "text-[#5f7a1f]")} aria-hidden="true" />
                      {tx("Suivi, calendrier, sous-traitants, rapports PDF", "Tracking, calendar, contractors, PDF reports")}
                    </li>
                  )}
                  {limits.ml && (
                    <li className="flex gap-2 font-semibold">
                      <BrainCircuit className={cn("mt-0.5 h-4 w-4 shrink-0", featured ? "text-[#d9f36e]" : "text-[#5f7a1f]")} aria-hidden="true" />
                      {plan === "entreprise"
                        ? tx("SentrIA Intelligence + modèles dédiés", "SentrIA Intelligence + dedicated models")
                        : "SentrIA Intelligence"}
                    </li>
                  )}
                </ul>

                <div
                  className={cn(
                    "mt-6 rounded-xl px-4 py-3 text-center text-sm font-semibold",
                    featured ? "bg-[#d9f36e] text-[#1d1d1b]" : "bg-[#1d1d1b] text-white",
                    (current || included) && "opacity-60"
                  )}
                >
                  {current
                    ? tx("Offre actuelle", "Current plan")
                    : included
                      ? tx("Inclus dans votre offre", "Included in your plan")
                      : plan === "entreprise"
                        ? tx("Nous contacter", "Contact us")
                        : tx("Paiement en ligne : bientôt", "Online payment: coming soon")}
                </div>
              </section>
            )
          })}
        </div>

        {/* SentrIA Intelligence + add-ons */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-[#d9f36e]/30 bg-[#1d1d1b]/70 p-6 backdrop-blur">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#d9f36e]">
              <BrainCircuit className="h-5 w-5" aria-hidden="true" />
              SentrIA Intelligence
              <span className="text-xs font-medium text-white/60">· Business {tx("et", "and")} Entreprise</span>
            </h3>
            <ul className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
              {ML_FEATURES.map((feature) => (
                <li key={feature.label.en} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d9f36e]" aria-hidden="true" />
                  <span>
                    {resolve(feature.label, tx)}
                    {feature.soon && (
                      <span className="ml-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-white/70">
                        {tx("Bientôt", "Soon")}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-white/55">
              {tx(
                "Les conseils saisonniers partent du calendrier de votre région, puis de votre propre historique après 3 mois de données. Ce sont des conseils de stock, jamais des conseils médicaux.",
                "Seasonal advice starts from your region's calendar, then from your own history after 3 months of data. It is stock advice, never medical advice."
              )}
            </p>
          </section>

          <section className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
            <h3 className="text-lg font-bold">
              {tx("Options", "Add-ons")}{" "}
              <span className="rounded-full bg-white/15 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase text-white/80">
                {tx("Bientôt", "Soon")}
              </span>
            </h3>
            <p className="mt-1 text-xs text-white/60">
              {tx("Sur toute offre payante, quel que soit votre secteur.", "On any paid plan, whatever your sector.")}
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {ADD_ONS.map((addOn) => (
                <li key={addOn.en} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d9f36e]" aria-hidden="true" />
                  {resolve(addOn, tx)}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="text-center text-xs text-white/55">
          {tx(
            `Chaque nouveau compte essaie Business pendant ${TRIAL_DAYS} jours. Départements liés (Business) : clinique + pharmacie + laboratoire, coopérative ou exploitation + silo, centrale + distribution, grossiste + magasins, transporteur + location, et toute la logistique.`,
            `Every new account tries Business for ${TRIAL_DAYS} days. Linked departments (Business): clinic + pharmacy + lab, cooperative or farm + silo, power plant + distribution, wholesaler + stores, haulier + rental, and all of logistics.`
          )}
        </p>
      </div>
    </div>
  )
}
