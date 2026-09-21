import { useState } from "react";
import { Check, Sparkles, TrendingUp } from "lucide-react";

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
      { fr: "Ask SentrIA · 20/mois", en: "Ask SentrIA · 20 queries/month" },
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
      { fr: "Historique 12 mois & exports", en: "12-month history & CSV/PDF exports" },
      { fr: "IA prédictive & anomalies", en: "Predictive AI & anomaly detection" },
      { fr: "SentrIA Network Insights", en: "SentrIA Network Insights" },
    ],
    highlight: {
      icon: TrendingUp,
      label: { fr: "SentrIA Intelligence", en: "SentrIA Intelligence" },
      features: [
        { fr: "Tendances du secteur", en: "Benchmarked against sector trends" },
        { fr: "Benchmarks anonymisés", en: "Anonymised benchmarks" },
        { fr: "Alertes marché", en: "Alerts driven by market trends" },
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
      { fr: "Espaces partagés + rôles", en: "Shared workspaces + roles & permissions" },
      { fr: "API & webhooks", en: "API access & webhooks" },
      { fr: "Scoring de risque", en: "Custom risk scoring" },
      { fr: "Support prioritaire", en: "Priority support" },
    ],
  },
  {
    name: "Enterprise",
    tagline: { fr: "Pour les institutions", en: "Best for institutions & scale" },
    monthly: null,
    priceLabel: { fr: "Sur devis", en: "On request" },
    cta: { fr: "Contacter les ventes", en: "Contact sales" },
    features: [
      { fr: "SSO / SAML, journaux", en: "SSO / SAML, audit logs" },
      { fr: "Modèles dédiés & on-premise", en: "Dedicated models & on-premise option" },
      { fr: "SLA + responsable dédié", en: "SLA + dedicated account manager" },
      { fr: "Sièges & API illimités", en: "Unlimited seats & API volume" },
      { fr: "Marque blanche", en: "White label available" },
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
      className="w-full h-full overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 20% 30%, #c8e06a 0%, #8fa84a 25%, #4a6a3a 50%, #1a2a20 80%, #0d1a14 100%)",
      }}
    >
      <div className="w-full h-full px-6 py-8 flex flex-col">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: "#d9f36e", color: "#1d1d1b" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Pricing
            </div>
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#ffffff" }}
            >
              Operational intelligence at every scale
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setLang("fr")}
                className="px-3 py-1 text-xs font-semibold rounded-full transition-colors"
                style={{
                  backgroundColor: lang === "fr" ? "#ffffff" : "transparent",
                  color: lang === "fr" ? "#1d1d1b" : "#c8e06a",
                  border: lang === "fr" ? "none" : "1px solid #c8e06a44",
                }}
              >
                FR
              </button>
              <button
                onClick={() => setLang("en")}
                className="px-3 py-1 text-xs font-semibold rounded-full transition-colors"
                style={{
                  backgroundColor: lang === "en" ? "#ffffff" : "transparent",
                  color: lang === "en" ? "#1d1d1b" : "#c8e06a",
                  border: lang === "en" ? "none" : "1px solid #c8e06a44",
                }}
              >
                EN
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ backgroundColor: "#0f1a14", border: "1px solid #c8e06a33" }}>
              <span
                className="text-xs font-medium"
                style={{ color: !annual ? "#d9f36e" : "#8a8a8a" }}
              >
                Monthly
              </span>
              <button
                onClick={() => setAnnual(!annual)}
                className="relative w-10 h-5 rounded-full transition-colors"
                style={{ backgroundColor: "#d9f36e" }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                  style={{
                    backgroundColor: "#0f1a14",
                    left: annual ? "22px" : "2px",
                  }}
                />
              </button>
              <span
                className="text-xs font-medium"
                style={{ color: annual ? "#d9f36e" : "#8a8a8a" }}
              >
                Annual
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#d9f36e", color: "#1d1d1b" }}
              >
                −20%
              </span>
            </div>
          </div>
        </div>

        {/* Cards row */}
        <div className="grid grid-cols-4 gap-4 flex-1">
          {TIERS.map((tier: Tier) => (
            <div
              key={tier.name}
              className="flex flex-col rounded-2xl overflow-hidden"
              style={{
                backgroundColor: tier.featured ? "#0f1a14" : "#ffffff",
                border: tier.featured
                  ? "2px solid #d9f36e"
                  : "1px solid #e0e0dc",
                padding: "18px",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <h3
                  className="text-sm font-bold"
                  style={{
                    color: tier.featured ? "#d9f36e" : "#1a1a1a",
                  }}
                >
                  {tier.name}
                </h3>
                {tier.featured && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "#d9f36e", color: "#1a1a1a" }}
                  >
                    Popular
                  </span>
                )}
              </div>

              <p
                className="text-[11px] mb-3"
                style={{
                  color: tier.featured ? "#b0b0a8" : "#8a8a8a",
                }}
              >
                {t(tier.tagline)}
              </p>

              <div className="flex items-end gap-1 mb-1">
                <span
                  className="text-3xl font-bold leading-none"
                  style={{
                    color: tier.featured ? "#d9f36e" : "#1a1a1a",
                  }}
                >
                  {formatPrice(tier)}
                </span>
                {tier.monthly !== null && tier.monthly > 0 && (
                  <span
                    className="text-[11px] mb-0.5 ml-0.5"
                    style={{
                      color: tier.featured ? "#b0b0a8" : "#8a8a8a",
                    }}
                  >
                    /mo
                  </span>
                )}
              </div>

              <p
                className="text-[10px] min-h-3 mb-3"
                style={{ color: "#8a887a" }}
              >
                {tier.monthly !== null && tier.monthly > 0 && annual
                  ? "billed annually"
                  : tier.priceLabel && tier.monthly !== null
                  ? t(tier.priceLabel)
                  : ""}
              </p>

              <div
                className="rounded-lg p-3 flex-1 mb-3"
                style={{
                  backgroundColor: tier.featured ? "#ffffff10" : "#f0f0ec",
                }}
              >
                <ul className="space-y-1.5">
                  {tier.features.map((f, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-1.5 text-[11px]"
                    >
                      <span
                        className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: tier.featured
                            ? "#d9f36e"
                            : "#c9e5b8",
                        }}
                      >
                        <Check
                          className="h-2 w-2"
                          strokeWidth={3}
                          style={{
                            color: tier.featured ? "#0f1a14" : "#1a1a1a",
                          }}
                        />
                      </span>
                      <span style={{ color: tier.featured ? "#e8e8e6" : "#3c3b33" }}>
                        {t(f)}
                      </span>
                    </li>
                  ))}
                </ul>

                {tier.highlight && (
                  <div
                    className="mt-2 rounded-lg p-2"
                    style={{ backgroundColor: "#d9f36e22" }}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <TrendingUp
                        className="h-3 w-3"
                        style={{ color: "#d9f36e" }}
                      />
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: "#d9f36e" }}
                      >
                        {t(tier.highlight.label)}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {tier.highlight.features.map((f, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1.5 text-[10px]"
                        >
                          <Check
                            className="mt-0.5 h-2.5 w-2.5 shrink-0"
                            strokeWidth={3}
                            style={{ color: "#d9f36e" }}
                          />
                          <span style={{ color: "#e8e8e6" }}>
                            {t(f)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                className="w-full py-2 rounded-full text-xs font-semibold transition-opacity hover:opacity-90 mt-auto"
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
        <p className="text-center text-[11px] mt-4" style={{ color: "#c8e06a" }}>
          Every plan includes data encryption and a 14-day trial with no commitment.
        </p>
      </div>
    </div>
  );
}
