"use client"

import { useState } from "react"
import { Check, Sparkles, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

type Tier = {
  name: string
  tagline: string
  monthly: number | null
  priceLabel?: string
  cta: string
  featured?: boolean
  features: string[]
  highlight?: { icon: typeof TrendingUp; label: string; features: string[] }
}

const TIERS: Tier[] = [
  {
    name: "Starter",
    tagline: "Pour les petites entreprises qui démarrent",
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
    tagline: "Pour les PME, cliniques, coopératives et opérateurs",
    monthly: 49,
    cta: "Passer au Pro",
    featured: true,
    features: [
      "Jusqu'à 5 sites · 3 secteurs",
      "Alertes SMS illimitées",
      "Ask SentrIA illimité",
      "Historique 12 mois & exports CSV/PDF",
      "Alertes e-mail + rapport hebdomadaire",
      "Dashboard multi-sites",
    ],
    highlight: {
      icon: TrendingUp,
      label: "SentrIA Insights inclus",
      features: [
        "Comparaison avec les tendances du secteur",
        "Benchmarks anonymisés",
        "Alertes basées sur les tendances du marché",
      ],
    },
  },
  {
    name: "Team",
    tagline: "Pour les flottes, réseaux et organisations multi-sites",
    monthly: 199,
    priceLabel: "jusqu'à 5 sièges",
    cta: "Choisir Team",
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
    tagline: "Pour les gouvernements, ports et grandes institutions",
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
    return `€${price}`
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Tarification
        </span>
        <h2 className="max-w-2xl text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Une intelligence opérationnelle pour chaque échelle
        </h2>
        <p className="max-w-xl text-pretty text-muted-foreground">
          Des petits commerçants aux institutions : choisissez le plan adapté à vos opérations, partout dans le monde.
        </p>
        <div className="mt-2 inline-flex items-center gap-3 rounded-full border border-border bg-card p-1.5">
          <button
            onClick={() => setAnnual(false)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              !annual ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Mensuel
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              annual ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Annuel
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", annual ? "bg-accent text-accent-foreground" : "bg-accent/30 text-accent-foreground")}>
              −20%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={cn(
              "flex flex-col rounded-3xl border p-6 transition-shadow",
              t.featured ? "border-foreground bg-primary text-primary-foreground shadow-xl" : "border-border bg-card",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-xl font-bold">{t.name}</h3>
              {t.featured && (
                <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                  Populaire
                </span>
              )}
            </div>
            <p className={cn("mt-1.5 min-h-10 text-sm", t.featured ? "text-primary-foreground/70" : "text-muted-foreground")}>
              {t.tagline}
            </p>
            <div className="mt-5 flex items-end gap-1.5">
              <span className="font-heading text-4xl font-bold tracking-tight">{formatPrice(t)}</span>
              {t.monthly !== null && t.monthly > 0 && (
                <span className={cn("pb-1 text-sm", t.featured ? "text-primary-foreground/60" : "text-muted-foreground")}>/mois</span>
              )}
            </div>
            <p className={cn("mt-1 min-h-5 text-xs", t.featured ? "text-primary-foreground/60" : "text-muted-foreground")}>
              {t.monthly !== null && t.monthly > 0 && annual ? "facturé annuellement" : t.priceLabel && t.monthly !== null ? t.priceLabel : ""}
            </p>
            <button className={cn("mt-5 w-full rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90", t.featured ? "bg-accent text-accent-foreground" : "bg-foreground text-background")}>
              {t.cta}
            </button>
            <ul className="mt-6 space-y-3">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full", t.featured ? "bg-accent text-accent-foreground" : "bg-accent/25 text-accent-foreground")}>
                    <Check className="h-3 w-3" />
                  </span>
                  <span className={t.featured ? "text-primary-foreground/90" : "text-foreground/80"}>{f}</span>
                </li>
              ))}
            </ul>

            {/* Sentria Insights highlight — Pro only */}
            {t.highlight && (
              <div className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <t.highlight.icon className="h-4 w-4 text-accent-foreground" />
                  <span className="text-xs font-bold text-accent-foreground">{t.highlight.label}</span>
                </div>
                <ul className="space-y-2">
                  {t.highlight.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent-foreground" />
                      <span className="text-primary-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Tous les plans incluent le chiffrement des données et un essai de 14 jours sans engagement. Paiement par MTN Mobile Money, Orange Money ou carte bancaire.
      </p>
    </div>
  )
}
