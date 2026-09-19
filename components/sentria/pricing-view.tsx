"use client"

import { useState } from "react"
import { Check, Sparkles, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/locale"
import { localized, pick, useTx, type Localized } from "@/lib/i18n"

/* Built at module level, outside any render, so the copy is stored as
   { fr, en } pairs and resolved with pick(). `name` stays a plain string:
   "Pro" and "Enterprise" are product names, not prose. */
type Tier = {
  name: string
  tagline: Localized
  monthly: number | null
  priceLabel?: Localized
  cta: Localized
  featured?: boolean
  features: Localized[]
  missing?: Localized[]
  highlight?: {
    icon: typeof TrendingUp
    label: Localized
    features: Localized[]
  }
}

const TIERS: Tier[] = [
  {
    name: "Starter",
    tagline: { fr: "Idéal pour démarrer", en: "Best for getting started" },
    monthly: 0,
    cta: { fr: "Commencer gratuitement", en: "Start for free" },
    features: [
      { fr: "1 site surveillé", en: "1 site monitored" },
      { fr: "1 secteur au choix", en: "1 sector of your choice" },
      { fr: "Upload CSV manuel", en: "Manual CSV upload" },
      { fr: "Alertes SMS · 10/mois", en: "SMS alerts · 10/month" },
      { fr: "Ask SentrIA · 20 requêtes/mois", en: "Ask SentrIA · 20 queries/month" },
      { fr: "Historique 7 jours", en: "7-day history" },
    ],
  },
  {
    name: "Pro",
    tagline: { fr: "Le bon départ", en: "Perfect to get started" },
    monthly: 49,
    cta: { fr: "Passer au Pro", en: "Upgrade to Pro" },
    featured: true,
    features: [
      { fr: "Jusqu'à 5 sites · 3 secteurs", en: "Up to 5 sites · 3 sectors" },
      { fr: "Alertes SMS illimitées", en: "Unlimited SMS alerts" },
      { fr: "Ask SentrIA illimité", en: "Unlimited Ask SentrIA" },
      { fr: "Historique 12 mois & exports CSV/PDF", en: "12-month history & CSV/PDF exports" },
      { fr: "IA prédictive & détection d'anomalies", en: "Predictive AI & anomaly detection" },
      { fr: "SentrIA Network Insights", en: "SentrIA Network Insights" },
    ],
    highlight: {
      icon: TrendingUp,
      label: localized("SentrIA Intelligence", "SentrIA Intelligence"),
      features: [
        { fr: "Comparaison avec les tendances du secteur", en: "Benchmarked against sector trends" },
        { fr: "Benchmarks anonymisés", en: "Anonymised benchmarks" },
        { fr: "Alertes basées sur les tendances du marché", en: "Alerts driven by market trends" },
      ],
    },
  },
  {
    name: "Team",
    tagline: { fr: "Pour les équipes et les agences", en: "Best for teams and agencies" },
    monthly: 199,
    priceLabel: { fr: "jusqu'à 5 sièges", en: "up to 5 seats" },
    cta: { fr: "Choisir Team", en: "Choose Team" },
    missing: [
      {
        fr: "Modèles dédiés & option on-premise",
        en: "Dedicated models & on-premise option",
      },
    ],
    features: [
      { fr: "Sites & secteurs illimités", en: "Unlimited sites & sectors" },
      { fr: "Capteurs IoT intégrés", en: "Built-in IoT sensors" },
      { fr: "Espaces partagés + rôles & permissions", en: "Shared workspaces + roles & permissions" },
      { fr: "Accès API & webhooks", en: "API access & webhooks" },
      { fr: "Scoring de risque personnalisé", en: "Custom risk scoring" },
      { fr: "Support prioritaire", en: "Priority support" },
    ],
  },
  {
    name: "Enterprise",
    tagline: { fr: "Pour les institutions et les grands volumes", en: "Best for institutions & scale" },
    monthly: null,
    priceLabel: { fr: "Sur devis", en: "On request" },
    cta: { fr: "Contacter les ventes", en: "Contact sales" },
    features: [
      { fr: "SSO / SAML, journaux d'audit", en: "SSO / SAML, audit logs" },
      { fr: "Modèles dédiés & option on-premise", en: "Dedicated models & on-premise option" },
      { fr: "SLA + responsable de compte dédié", en: "SLA + dedicated account manager" },
      { fr: "Sièges & volume API illimités", en: "Unlimited seats & API volume" },
      { fr: "Marque blanche disponible", en: "White label available" },
    ],
  },
]

export function PricingView() {
  const tx = useTx()
  const { ui } = useLocale()

  /* The tier copy lives in module-level pairs, so it is resolved here
     rather than translated here. */
  const p = (text: Localized) => pick(text, ui)

  const [annual, setAnnual] = useState(false)

  const formatPrice = (t: Tier) => {
    if (t.monthly === null) return t.priceLabel ? p(t.priceLabel) : ""
    if (t.monthly === 0) return tx("Gratuit", "Free")

    const price = annual ? Math.round(t.monthly * 0.8) : t.monthly

    return `€${price.toFixed(2)}`
  }

  return (
    <div className="min-h-full bg-[#dcdacd] py-16">
      <div className="mx-auto max-w-6xl space-y-10 px-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d9f36e] px-3 py-1 text-xs font-semibold text-[#1d1d1b]">
            <Sparkles className="h-3.5 w-3.5" />
            {tx("Tarification", "Pricing")}
          </span>

          <h2 className="max-w-2xl text-balance font-heading text-3xl font-bold tracking-tight text-[#1d1d1b] sm:text-4xl">
            {tx(
              "Une intelligence opérationnelle pour chaque échelle",
              "Operational intelligence at every scale"
            )}
          </h2>

          <p className="max-w-xl text-pretty text-sm text-[#6b6a5e]">
            {tx(
              "Des petits commerçants aux institutions : choisissez le plan adapté à vos opérations, partout dans le monde.",
              "From corner shops to institutions: pick the plan that fits your operations, anywhere in the world."
            )}
          </p>

          {/* Billing toggle */}
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#cfccbc] p-1.5">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                !annual
                  ? "bg-[#1d1d1b] text-[#f5f4ec]"
                  : "text-[#6b6a5e] hover:text-[#1d1d1b]",
              )}
            >
              {tx("Mensuel", "Monthly")}
            </button>

            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                annual
                  ? "bg-[#1d1d1b] text-[#f5f4ec]"
                  : "text-[#6b6a5e] hover:text-[#1d1d1b]",
              )}
            >
              {tx("Annuel", "Annual")}

              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  annual
                    ? "bg-[#d9f36e] text-[#1d1d1b]"
                    : "bg-[#d9f36e]/50 text-[#1d1d1b]",
                )}
              >
                −20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={cn(
                "flex flex-col rounded-[2rem] border p-7 transition-shadow",
                t.featured
                  ? "border-transparent bg-[#efecf3] shadow-[0_20px_50px_-20px_rgba(29,29,27,0.25)]"
                  : "border-transparent bg-[#f7f6f0] shadow-[0_20px_50px_-25px_rgba(29,29,27,0.2)]",
              )}
            >
              {/* Name + badge */}
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-xl font-bold text-[#1d1d1b]">
                  {t.name}
                </h3>

                {t.featured && (
                  <span className="rounded-full bg-[#d9f36e] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1d1d1b]">
                    {tx("Populaire", "Popular")}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-[#8a887a]">{p(t.tagline)}</p>

              {/* Price */}
              <div className="mt-6 flex items-end gap-1.5">
                <span className="font-heading text-5xl font-bold tracking-tight text-[#1d1d1b]">
                  {formatPrice(t)}
                </span>

                {t.monthly !== null && t.monthly > 0 && (
                  <span className="pb-1.5 text-sm text-[#8a887a]">
                    {tx("/mois", "/month")}
                  </span>
                )}
              </div>

              <p className="mt-1 min-h-4 text-[11px] text-[#8a887a]">
                {t.monthly !== null && t.monthly > 0 && annual
                  ? tx("facturé annuellement", "billed annually")
                  : t.priceLabel && t.monthly !== null
                    ? p(t.priceLabel)
                    : ""}
              </p>

              {/* Features */}
              <div
                className={cn(
                  "mt-6 rounded-2xl p-4",
                  t.featured ? "bg-[#e4e1ea]" : "bg-[#e7e5d8]",
                )}
              >
                <ul className="space-y-2.5">
                  {t.features.map((feature) => (
                    <li
                      key={feature.fr}
                      className="flex items-start gap-2.5 text-[13px] text-[#3c3b33]"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                          t.featured
                            ? "bg-[#d9f36e]/70"
                            : "bg-[#c9e5b8]",
                        )}
                      >
                        <Check
                          className="h-2.5 w-2.5 text-[#1d1d1b]"
                          strokeWidth={3}
                        />
                      </span>

                      <span>{p(feature)}</span>
                    </li>
                  ))}

                  {/* Missing features */}
                  {(t.missing ?? []).map((feature) => (
                    <li
                      key={feature.fr}
                      className="flex items-start gap-2.5 text-[13px] text-[#b0ae9f]"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#e2d4d4]">
                        <X
                          className="h-2.5 w-2.5 text-[#c08a8a]"
                          strokeWidth={3}
                        />
                      </span>

                      <span className="line-through decoration-[#c08a8a]/60">
                        {p(feature)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Intelligence highlight */}
                {t.highlight && (
                  <div className="mt-3 rounded-xl bg-[#d9f36e]/25 p-3.5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <t.highlight.icon className="h-3.5 w-3.5 text-[#1d1d1b]" />

                      <span className="text-[11px] font-bold text-[#1d1d1b]">
                        {p(t.highlight.label)}
                      </span>
                    </div>

                    <ul className="space-y-2">
                      {t.highlight.features.map((feature) => (
                        <li
                          key={feature.fr}
                          className="flex items-start gap-2 text-xs text-[#3c3b33]"
                        >
                          <Check
                            className="mt-0.5 h-3 w-3 shrink-0 text-[#1d1d1b]"
                            strokeWidth={3}
                          />

                          <span>{p(feature)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Plan description */}
              <p className="mt-5 text-xs leading-relaxed text-[#6b6a5e]">
                {/* These three were English only, which was the same bug
                    in the other direction: a French operator read them in
                    English. */}
                {t.featured
                  ? tx(
                      "Toute la puissance pour les équipes qui ont besoin d'échelle, d'intelligence et de souplesse.",
                      "Full power for operational teams who need scale, intelligence and flexibility."
                    )
                  : t.monthly === null
                    ? tx(
                        "Déploiement sur mesure, modèles dédiés et support de niveau entreprise pour les grandes institutions.",
                        "Custom deployment, dedicated models and enterprise-grade support for large institutions."
                      )
                    : tx(
                        "L'essentiel pour surveiller, alerter et agir en confiance.",
                        "All the essentials to monitor, alert and act with confidence."
                      )}
              </p>

              {/* CTA */}
              <button
                type="button"
                className={cn(
                  "mt-auto w-full rounded-full py-3 text-sm font-semibold transition-all hover:opacity-90",
                  t.featured
                    ? "mt-5 bg-[#d9f36e] text-[#1d1d1b]"
                    : "mt-5 bg-[#1d1d1b] text-[#f5f4ec]",
                )}
              >
                {p(t.cta)}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#6b6a5e]">
          {tx(
            "Tous les plans incluent le chiffrement des données et un essai de 14 jours sans engagement. Paiement par MTN Mobile Money, Orange Money ou carte bancaire.",
            "Every plan includes data encryption and a 14-day trial with no commitment. Pay by MTN Mobile Money, Orange Money or card."
          )}
        </p>
      </div>
    </div>
  )
}