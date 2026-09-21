import { useState } from "react";
import { Check, Sparkles, TrendingUp, X } from "lucide-react";

type Localized = { fr: string; en: string };

type Highlight = {
  icon: typeof TrendingUp;
  label: Localized;
  features: Localized[];
};

type Tier = {
  name: string;
  tagline: Localized;
  monthly: number | null;
  priceLabel?: Localized;
  cta: Localized;
  featured?: boolean;
  features: Localized[];
  missing?: Localized[];
  highlight?: Highlight;
};

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
      label: { fr: "SentrIA Intelligence", en: "SentrIA Intelligence" },
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
];

export function PricingView() {
  const [annual, setAnnual] = useState<boolean>(false);
  const [lang, setLang] = useState<"fr" | "en">("en");

  const t = (obj: Localized | string): string =>
    typeof obj === "string" ? obj : obj[lang] || obj.en;

  const formatPrice = (tier: Tier): string => {
    if (tier.monthly === null) {
      return t(tier.priceLabel || { fr: "Sur devis", en: "On request" });
    }
    if (tier.monthly === 0) return "Free";
    const price = annual ? Math.round(tier.monthly * 0.8) : tier.monthly;
    return `€${price}`;
  };

  return (
    <div
      className="w-full h-full min-h-screen py-12 px-4 overflow-y-auto"
      style={{
        background:
          "radial-gradient(ellipse at 20% 30%, #c8e06a 0%, #8fa84a 25%, #4a6a3a 50%, #1a2a20 80%, #0d1a14 100%)",
      }}
    >
      <div
        className="w-full max-w-6xl mx-auto rounded-2xl px-6 py-12 md:px-12 md:py-16"
        style={{ backgroundColor: "#e8e8e6" }}
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold mb-4"
            style={{ backgroundColor: "#d9f36e", color: "#1d1d1b" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Pricing
          </div>

          <h2
            className="text-3xl md:text-5xl font-bold tracking-tight mb-3"
            style={{ color: "#1a1a1a", fontFamily: "'Inter', sans-serif" }}
          >
            Operational intelligence at every scale
          </h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: "#6b6a5e" }}>
            From corner shops to institutions: pick the plan that fits your
            operations, anywhere in the world.
          </p>
        </div>

        {/* Language & Toggle */}
        <div className="flex flex-col items-center gap-4 mb-12">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang("fr")}
              className="px-3 py-1 text-xs font-semibold rounded-full transition-colors"
              style={{
                backgroundColor: lang === "fr" ? "#1d1d1b" : "transparent",
                color: lang === "fr" ? "#f5f4ec" : "#6b6a5e",
              }}
            >
              FR
            </button>
            <button
              onClick={() => setLang("en")}
              className="px-3 py-1 text-xs font-semibold rounded-full transition-colors"
              style={{
                backgroundColor: lang === "en" ? "#1d1d1b" : "transparent",
                color: lang === "en" ? "#f5f4ec" : "#6b6a5e",
              }}
            >
              EN
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="text-sm font-medium"
              style={{ color: !annual ? "#1a1a1a" : "#8a8a8a" }}
            >
              Monthly
            </span>

            <button
              onClick={() => setAnnual(!annual)}
              className="relative w-12 h-6 rounded-full transition-colors"
              style={{ backgroundColor: "#1a1a1a" }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ left: annual ? "26px" : "2px" }}
              />
            </button>

            <span
              className="text-sm font-medium"
              style={{ color: annual ? "#1a1a1a" : "#8a8a8a" }}
            >
              Annual
            </span>

            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "#d9f36e", color: "#1a1a1a" }}
            >
              −20%
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-12">
          {TIERS.map((tier: Tier) => (
            <div
              key={tier.name}
              className="flex flex-col rounded-2xl overflow-hidden"
              style={{
                backgroundColor: tier.featured ? "#0f1a14" : "#ffffff",
                border: tier.featured
                  ? "3px solid #0f1a14"
                  : "1px solid #e0e0dc",
                padding: "24px",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <h3
                  className="text-base font-bold"
                  style={{
                    color: tier.featured ? "#ffffff" : "#1a1a1a",
                  }}
                >
                  {tier.name}
                </h3>
                {tier.featured && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{ backgroundColor: "#d9f36e", color: "#1a1a1a" }}
                  >
                    Popular
                  </span>
                )}
              </div>

              <p
                className="text-xs mb-6"
                style={{
                  color: tier.featured ? "#b0b0a8" : "#8a8a8a",
                }}
              >
                {t(tier.tagline)}
              </p>

              <div className="flex items-end gap-1 mb-2">
                <span
                  className="text-5xl font-bold leading-none"
                  style={{
                    color: tier.featured ? "#d9f36e" : "#1a1a1a",
                  }}
                >
                  {formatPrice(tier)}
                </span>
                {tier.monthly !== null && tier.monthly > 0 && (
                  <span
                    className="text-sm mb-1 ml-1"
                    style={{
                      color: tier.featured ? "#b0b0a8" : "#8a8a8a",
                    }}
                  >
                    /month
                  </span>
                )}
              </div>

              <p
                className="text-[11px] min-h-4 mb-5"
                style={{ color: "#8a887a" }}
              >
                {tier.monthly !== null && tier.monthly > 0 && annual
                  ? "billed annually"
                  : tier.priceLabel && tier.monthly !== null
                  ? t(tier.priceLabel)
                  : ""}
              </p>

              <div
                className="rounded-xl p-4 flex-1 mb-5"
                style={{
                  backgroundColor: tier.featured ? "#ffffff" : "#e8e8e6",
                }}
              >
                <ul className="space-y-2.5">
                  {tier.features.map((f, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-[13px]"
                    >
                      <span
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: tier.featured
                            ? "#0f1a14"
                            : "#c9e5b8",
                        }}
                      >
                        <Check
                          className="h-2.5 w-2.5"
                          strokeWidth={3}
                          style={{
                            color: tier.featured ? "#ffffff" : "#1a1a1a",
                          }}
                        />
                      </span>
                      <span style={{ color: "#3c3b33" }}>{t(f)}</span>
                    </li>
                  ))}
                </ul>

                {tier.highlight && (
                  <div
                    className="mt-3 rounded-xl p-3.5"
                    style={{ backgroundColor: "#d9f36e33" }}
                  >
                    <div className="mb-2.5 flex items-center gap-2">
                      <TrendingUp
                        className="h-3.5 w-3.5"
                        style={{ color: "#1a1a1a" }}
                      />
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: "#1a1a1a" }}
                      >
                        {t(tier.highlight.label)}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {tier.highlight.features.map((f, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs"
                        >
                          <Check
                            className="mt-0.5 h-3 w-3 shrink-0"
                            strokeWidth={3}
                            style={{ color: "#1a1a1a" }}
                          />
                          <span style={{ color: "#3c3b33" }}>
                            {t(f)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <p
                className="text-xs leading-relaxed mb-5"
                style={{ color: "#6b6a5e" }}
              >
                {tier.featured
                  ? "Full power for operational teams who need scale, intelligence and flexibility."
                  : tier.monthly === null
                  ? "Custom deployment, dedicated models and enterprise-grade support for large institutions."
                  : "All the essentials to monitor, alert and act with confidence."}
              </p>

              <button
                className="w-full py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: tier.featured ? "#d9f36e" : "#1d1d1b",
                  color: tier.featured ? "#0f1a14" : "#f5f4ec",
                }}
              >
                {t(tier.cta)}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: "#6b6a5e" }}>
          Every plan includes data encryption and a 14-day trial with no
          commitment.
        </p>
      </div>
    </div>
  );
}
