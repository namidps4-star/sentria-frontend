"use client"

import { useState } from "react"
import { Check, Sparkles, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Tier = {
  name: string
  tagline: string
  monthly: number | null
  priceLabel?: string
  cta: string
  featured?: boolean
  features: string[]
  missing?: string[]
  highlight?: { icon: typeof TrendingUp; label: string; features: string[] }
}

const TIERS: Tier[] = [
  {
    name: "Starter",
    tagline: "Best for getting started",
    monthly: 0,
    cta: "Commencer gratuitement",
    features: [
      "1 site surveillé",
      "1 secteur au choix",
      "Upload CSV manuel",
      "Alertes SMS · 10/mois",
      "Ask SentrIA · 20 requêtes/mois",
      "Historique 7 jours",
    ],
  },
  {
    name: "Pro",
    tagline: "Perfect to get started",
    monthly: 49,
    cta: "Passer au Pro",
    featured: true,
    features: [
      "Jusqu'à 5 sites · 3 secteurs",
      "Alertes SMS illimitées",
      "Ask SentrIA illimité",
      "Historique 12 mois & exports CSV/PDF",
      "IA prédictive & détection d'anomalies",
      "SentrIA Network Insights",
    ],
    highlight: {
      icon: TrendingUp,
      label: "SentrIA Intelligence",
      features: [
        "Comparaison avec les tendances du secteur",
        "Benchmarks anonymisés",
        "Alertes basées sur les tendances du marché",
      ],
    },
  },
  {
    name: "Team",
    tagline: "Best for teams and agencies",
    monthly: 199,
    priceLabel: "jusqu'à 5 sièges",
    cta: "Choisir Team",
    missing: ["Modèles dédiés & option on-premise"],
    features: [
      "Sites & secteurs illimités",
      "IoT sensors intégrés",
      "Espaces partagés + rôles & permissions",
      "Accès API & webhooks",
      "Scoring de risque personnalisé",
      "Support prioritaire",
    ],
  },
  {
    name: "Enterprise",
    tagline: "Best for institutions & scale",
    monthly: null,
    priceLabel: "Sur devis",
    cta: "Contacter les ventes",
    features: [
      "SSO / SAML, journaux d'audit",
      "Modèles dédiés & option on-premise",
      "SLA + responsable de compte dédié",
      "Sièges & volume API illimités",
      "White label disponible",
    ],
  },
]

export function PricingView() {
  const [annual, setAnnual] = useState(false)

  const formatPrice = (t: Tier) => {
    if (t.monthly === null) return t.priceLabel
    if (t.monthly === 0) return "Gratuit"
    const price = annual ? Math.round(t.monthly * 0.8) : t.monthly
    return `€${price.toFixed(2)}`
  }

  return (
    <div className="min-h-full bg-[#dcdacd] py-16">
      <div className="mx-auto max-w-6xl space-y-10 px-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d9f36e] px-3 py-1 text-xs font-semibold text-[#1d1d1b]">
            <Sparkles className="h-3.5 w-3.5" /> Tarification
          </span>
          <h2 className="max-w-2xl text-balance font-heading text-3xl font-bold tracking-tight text-[#1d1d1b] sm:text-4xl">
            Une intelligence opérationnelle pour chaque échelle
          </h2>
          <p className="max-w-xl text-pretty text-sm text-[#6b6a5e]">
            Des petits commerçants aux institutions : choisissez le plan adapté à vos opérations, partout dans le monde.
          </p>

          {/* Billing toggle */}
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#cfccbc] p-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                !annual ? "bg-[#1d1d1b] text-[#f5f4ec]" : "text-[#6b6a5e] hover:text-[#1d1d1b]",
              )}
            >
              Mensuel
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                annual ? "bg-[#1d1d1b] text-[#f5f4ec]" : "text-[#6b6a5e] hover:text-[#1d1d1b]",
              )}
            >
              Annuel
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  annual ? "bg-[#d9f36e] text-[#1d1d1b]" : "bg-[#d9f36e]/50 text-[#1d1d1b]",
                )}
              >
                −20%
              </span>
            </button>
          </div>
        </div>

        {/* Cards */}
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
              {/* Name + tagline */}
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-xl font-bold text-[#1d1d1b]">{t.name}</h3>
                {t.featured && (
                  <span className="rounded-full bg-[#d9f36e] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1d1d1b]">
                    Populaire
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#8a887a]">{t.tagline}</p>

              {/* Price */}
              <div className="mt-6 flex items-end gap-1.5">
                <span className="font-heading text-5xl font-bold tracking-tight text-[#1d1d1b]">
                  {formatPrice(t)}
                </span>
                {t.monthly !== null && t.monthly > 0 && (
                  <span className="pb-1.5 text-sm text-[#8a887a]">/mois</span>
                )}
              </div>
              <p className="mt-1 min-h-4 text-[11px] text-[#8a887a]">
                {t.monthly !== null && t.monthly > 0 && annual
                  ? "facturé annuellement"
                  : (t.priceLabel && t.monthly !== null ? t.priceLabel : "")}
              </p>

              {/* Feature box */}
              <div
                className={cn(
                  "mt-6 rounded-2xl p-4",
                  t.featured ? "bg-[#e4e1ea]" : "bg-[#e7e5d8]",
                )}
              >
                <ul className="space-y-2.5">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#3c3b33]">
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                          t.featured ? "bg-[#d9f36e]/70" : "bg-[#c9e5b8]",
                        )}
                      >
                        <Check className="h-2.5 w-2.5 text-[#1d1d1b]" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                  {(t.missing ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#b0ae9f]">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#e2d4d4]">
                        <X className="h-2.5 w-2.5 text-[#c08a8a]" strokeWidth={3} />
                      </span>
                      <span className="line-through decoration-[#c08a8a]/60">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* SentrIA Insights highlight — Pro only */}
                {t.highlight && (
                  <div className="mt-3 rounded-xl bg-[#d9f36e]/25 p-3.5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <t.highlight.icon className="h-3.5 w-3.5 text-[#1d1d1b]" />
                      <span className="text-[11px] font-bold text-[#1d1d1b]">{t.highlight.label}</span>
                    </div>
                    <ul className="space-y-2">
                      {t.highlight.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-[#3c3b33]">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#1d1d1b]" strokeWidth={3} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="mt-5 text-xs leading-relaxed text-[#6b6a5e]">
                {t.featured
                  ? "Full power for operational teams who need scale, intelligence and flexibility."
                  : t.monthly === null
                    ? "Custom deployment, dedicated models and enterprise-grade support for large institutions."
                    : "All the essentials to monitor, alert and act with confidence."}
              </p>

              {/* CTA */}
              <button
                className={cn(
                  "mt-auto w-full rounded-full py-3 text-sm font-semibold text-[#1d1d1b] transition-all hover:opacity-90",
                  t.featured ? "mt-5 bg-[#d9f36e]" : "mt-5 bg-[#1d1d1b] text-[#f5f4ec]",
                )}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-[#6b6a5e]">
          Tous les plans incluent le chiffrement des données et un essai de 14 jours sans engagement.
          Paiement par MTN Mobile Money, Orange Money ou carte bancaire.
        </p>
      </div>
    </div>
  )
}

