/* The title and description search engines show, in both languages, in one
   place. app/layout.tsx serves the French pair (what a crawler reads at
   build time) and components/sentria/document-language.tsx swaps in the
   pair for the language the visitor chose.

   Target phrases, one page and one main phrase each:
     fr: "alertes de stock en temps réel"
     en: "real-time stock alerts"
   Markets: West Africa (Benin, Côte d'Ivoire, Senegal) and East Africa
   (Kenya, Uganda). Change the phrases here and in docs/google-search-console.md.

   i18n-ignore-start: search metadata, both languages kept */
export const SEO = {
  fr: {
    title: "SentrIA | Alertes de stock en temps réel",
    description:
      "SentrIA lit vos données de stock, de machines et de flux, et vous dit quoi faire, et quand. Alertes en temps réel pour pharmacies, usines et commerces.",
  },
  en: {
    title: "SentrIA | Real-time stock alerts for operations",
    description:
      "SentrIA reads your stock, machine and flow data and tells you what to do, and when. Real-time alerts for pharmacies, factories and shops.",
  },
} as const
/* i18n-ignore-end */

export const TITLE_LIMIT = 60
export const DESCRIPTION_LIMIT = 160
