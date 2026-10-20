import { AuthGate } from "@/components/sentria/auth-gate"
import { siteUrl } from "@/lib/site"

/* The sign-in screen is drawn in the browser, so the server HTML of "/" was
   only "loading". This block gives a crawler the same pitch the screen shows,
   in both languages. It is hidden from the eye, not from the reader: it
   repeats the visible text and nothing else.

   i18n-ignore-start: server-rendered text for search engines, both languages kept */
const FEATURES = {
  fr: [
    ["Alertes en temps réel", "Stocks, machines, flux : prévenu avant la panne ou la rupture."],
    ["Des actions, pas juste des chiffres", "Chaque alerte dit quoi faire, à qui, et suit le résultat."],
    ["Vos données restent les vôtres", "Chaque entreprise ne voit que ses propres données."],
  ],
  en: [
    ["Real-time alerts", "Stock, machines, flows: warned before a breakdown or a stock-out."],
    ["Actions, not just numbers", "Every alert says what to do, who does it, and tracks it."],
    ["Your data stays yours", "Each company sees its own data, and only its own."],
  ],
} as const

const SECTORS = {
  fr: ["Logistique", "Industrie", "Santé", "Agriculture", "Transport", "Énergie", "Commerce"],
  en: ["Logistics", "Industry", "Health", "Agriculture", "Transport", "Energy", "Retail"],
} as const

const COPY = {
  fr: {
    h1: "Voyez les problèmes avant qu'ils ne coûtent.",
    lead: "SentrIA lit vos données d'exploitation et vous dit quoi faire, et quand.",
    sectors: "Secteurs couverts",
  },
  en: {
    h1: "See problems before they cost you.",
    lead: "SentrIA reads your operating data and tells you what to do, and when.",
    sectors: "Sectors covered",
  },
} as const
/* i18n-ignore-end */

export default function Page() {
  const url = siteUrl()
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${url}/#org`, name: "SentrIA", url, logo: `${url}/logo-mark.png` },
      {
        "@type": "SoftwareApplication",
        name: "SentrIA",
        url,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: ["fr", "en"],
        description: COPY.fr.lead,
        publisher: { "@id": `${url}/#org` },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="sr-only">
        {(["fr", "en"] as const).map((lang) => (
          <section key={lang} lang={lang}>
            <h1>{COPY[lang].h1}</h1>
            <p>{COPY[lang].lead}</p>
            <ul>
              {FEATURES[lang].map(([title, body]) => (
                <li key={title}>
                  <strong>{title}</strong> {body}
                </li>
              ))}
            </ul>
            <h2>{COPY[lang].sectors}</h2>
            <ul>
              {SECTORS[lang].map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <AuthGate />
    </>
  )
}
