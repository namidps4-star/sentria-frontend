/* The legal pages: privacy and terms (F-LEGAL, from chantier LEG-1).
 *
 * These are DRAFTS. Nothing here has been reviewed by a lawyer and none of it
 * says the service "complies" with any law. The pages show that in a banner.
 *
 * The contact address is never written in code: it comes from the
 * NEXT_PUBLIC_LEGAL_EMAIL setting on Vercel. Without it the pages point to
 * Help & feedback in the app. */

export const LEGAL_VERSION = "2026-10-17"

export const LEGAL_COMPANY = "Sentria"

export type LegalDocId = "privacy" | "terms"

export type LegalSection = { title: [string, string]; body: [string, string][] }

export function legalEmail(): string {
  return (process.env.NEXT_PUBLIC_LEGAL_EMAIL ?? "").trim()
}

export const LEGAL_TITLES: Record<LegalDocId, [string, string]> = {
  privacy: ["Confidentialité", "Privacy"],
  terms: ["Conditions d'utilisation", "Terms of use"],
}

export const LEGAL_DOCS: Record<LegalDocId, LegalSection[]> = {
  privacy: [
    {
      title: ["Qui nous sommes", "Who we are"],
      body: [
        [
          `${LEGAL_COMPANY} publie SentrIA, un outil qui surveille vos données d'exploitation, lève des alertes et recommande des actions.`,
          `${LEGAL_COMPANY} publishes SentrIA, a tool that watches your operating data, raises alerts and recommends actions.`,
        ],
      ],
    },
    {
      title: ["Ce que nous collectons", "What we collect"],
      body: [
        [
          "Votre compte : nom, entreprise, nom d'utilisateur, email et, si vous le donnez, numéro de téléphone. Le mot de passe est géré par notre service d'authentification et n'est pas lisible par nous.",
          "Your account: name, company, username, email and, if you give it, a phone number. The password is handled by our sign-in service and we cannot read it.",
        ],
        [
          "Vos données : les fichiers CSV que vous importez, les sites que vous créez, les alertes qui en résultent et vos réglages.",
          "Your data: the CSV files you import, the sites you create, the alerts that result and your settings.",
        ],
        [
          "Vos messages : ce que vous écrivez dans Aide et retours et dans Demandez à SentrIA.",
          "Your messages: what you write in Help & feedback and in Ask SentrIA.",
        ],
        [
          "Des données techniques : pages vues et adresse IP, par notre hébergeur et notre outil de mesure d'audience.",
          "Technical data: page views and IP address, through our host and our audience measurement tool.",
        ],
      ],
    },
    {
      title: ["Pourquoi", "Why"],
      body: [
        [
          "Pour fournir le service : analyser vos fichiers, afficher vos alertes, envoyer des SMS et des emails d'alerte, répondre à vos messages, protéger le service contre les abus.",
          "To provide the service: analyse your files, show your alerts, send alert texts and emails, answer your messages, protect the service from abuse.",
        ],
      ],
    },
    {
      title: ["Qui reçoit vos données", "Who receives your data"],
      body: [
        [
          "Nous travaillons avec des prestataires qui traitent des données pour nous : Supabase (connexion et base de données), Vercel (hébergement du site et mesure d'audience), Render (hébergement de l'API), Twilio (SMS), Resend (emails) et Google (IA Gemini).",
          "We work with providers that handle data for us: Supabase (sign-in and database), Vercel (site hosting and audience measurement), Render (API hosting), Twilio (texts), Resend (email) and Google (Gemini AI).",
        ],
        [
          "Quand vous utilisez les recommandations ou Demandez à SentrIA, le texte de vos alertes et de vos questions est envoyé à Google pour produire la réponse. N'y mettez pas de données que vous ne voulez pas partager.",
          "When you use the recommendations or Ask SentrIA, the text of your alerts and questions is sent to Google to produce the answer. Do not put in data you do not want to share.",
        ],
        [
          "Nous ne vendons pas vos données. Les pays où ces prestataires les stockent restent à confirmer.",
          "We do not sell your data. The countries where these providers store it are still to be confirmed.",
        ],
      ],
    },
    {
      title: ["Dans votre navigateur", "In your browser"],
      body: [
        [
          "SentrIA garde votre session et vos réglages dans le stockage de votre navigateur. Nous ne posons pas de cookies publicitaires.",
          "SentrIA keeps your session and settings in your browser storage. We do not set advertising cookies.",
        ],
      ],
    },
    {
      title: ["Durée de conservation", "How long we keep it"],
      body: [
        [
          "Tant que votre compte est actif. À votre demande, nous supprimons votre compte et vos données. La durée exacte de conservation des sauvegardes reste à confirmer.",
          "While your account is active. On your request we delete your account and your data. The exact backup retention period is still to be confirmed.",
        ],
      ],
    },
    {
      title: ["Vos droits", "Your rights"],
      body: [
        [
          "Vous pouvez demander l'accès à vos données, leur correction, leur export ou leur suppression, en nous écrivant (voir Contact).",
          "You can ask for access to your data, to correct it, to export it or to delete it, by writing to us (see Contact).",
        ],
        [
          "Dans l'application, Paramètres, section « Vos données » : « Exporter mes données » télécharge un fichier avec tout ce que nous gardons sur votre compte, et « Supprimer mon compte » efface votre connexion et les données de l'entreprise. Si d'autres comptes partagent l'entreprise, seul le vôtre est supprimé.",
          "In the app, Settings, \"Your data\" section: \"Export my data\" downloads a file with everything we keep on your account, and \"Delete my account\" erases your login and the company's data. If other accounts share the company, only yours is deleted.",
        ],
      ],
    },
    {
      title: ["Sécurité", "Security"],
      body: [
        [
          "Nous prenons des mesures raisonnables pour protéger vos données. Aucun système n'est parfaitement sûr.",
          "We take reasonable steps to protect your data. No system is perfectly secure.",
        ],
      ],
    },
    {
      title: ["Changements", "Changes"],
      body: [
        [
          "Si cette page change de façon importante, nous vous le dirons dans l'application.",
          "If this page changes in an important way, we will tell you in the app.",
        ],
      ],
    },
  ],
  terms: [
    {
      title: ["Le service", "The service"],
      body: [
        [
          "SentrIA vous aide à repérer des problèmes dans vos données d'exploitation et à décider quoi faire. C'est un outil d'aide à la décision. Ce n'est pas un système de sécurité, ni un avis médical, juridique ou technique.",
          "SentrIA helps you spot problems in your operating data and decide what to do. It is a decision aid. It is not a safety system, and it is not medical, legal or technical advice.",
        ],
      ],
    },
    {
      title: ["Alertes et IA", "Alerts and AI"],
      body: [
        [
          "Une alerte ou une recommandation peut être fausse, incomplète ou en retard, par exemple si vos données le sont. Vérifiez avant d'agir. La décision et la responsabilité restent les vôtres.",
          "An alert or a recommendation can be wrong, incomplete or late, for example when your data is. Check before you act. The decision and the responsibility stay with you.",
        ],
      ],
    },
    {
      title: ["Votre compte", "Your account"],
      body: [
        [
          "Donnez des informations exactes et gardez votre mot de passe secret. Vous êtes responsable de ce qui se passe sous votre compte.",
          "Give accurate information and keep your password secret. You are responsible for what happens under your account.",
        ],
      ],
    },
    {
      title: ["Vos données", "Your data"],
      body: [
        [
          "Vos données restent les vôtres. Vous nous autorisez à les traiter pour fournir le service. Vous confirmez avoir le droit de les importer, y compris lorsqu'elles concernent d'autres personnes.",
          "Your data stays yours. You allow us to process it to provide the service. You confirm you have the right to import it, including when it concerns other people.",
        ],
      ],
    },
    {
      title: ["Usage autorisé", "Acceptable use"],
      body: [
        [
          "N'essayez pas d'accéder aux données d'un autre compte, de perturber le service ou de l'utiliser pour un but illégal.",
          "Do not try to reach another account's data, disrupt the service or use it for anything illegal.",
        ],
      ],
    },
    {
      title: ["Offres et paiement", "Plans and payment"],
      body: [
        [
          "Les fonctions dépendent de votre offre. Les prix et les conditions de paiement sont ceux affichés dans l'application au moment de votre choix.",
          "Features depend on your plan. Prices and payment terms are the ones shown in the app when you choose.",
        ],
      ],
    },
    {
      title: ["Disponibilité et changements", "Availability and changes"],
      body: [
        [
          "Nous faisons de notre mieux pour que le service fonctionne, sans garantir qu'il soit toujours disponible. Nous pouvons le faire évoluer.",
          "We do our best to keep the service running, without promising it is always available. We may change it.",
        ],
      ],
    },
    {
      title: ["Responsabilité", "Liability"],
      body: [
        [
          "Dans la mesure permise par la loi, notre responsabilité est limitée. Les limites exactes restent à confirmer par un juriste.",
          "To the extent the law allows, our liability is limited. The exact limits are still to be confirmed by a lawyer.",
        ],
      ],
    },
    {
      title: ["Fin du compte", "Ending your account"],
      body: [
        [
          "Vous pouvez fermer votre compte à tout moment en nous écrivant. Nous pouvons suspendre un compte qui enfreint ces conditions.",
          "You can close your account at any time by writing to us. We may suspend an account that breaks these terms.",
        ],
      ],
    },
    {
      title: ["Droit applicable", "Governing law"],
      body: [
        [
          "Le droit applicable et le tribunal compétent restent à définir.",
          "The governing law and the competent court are still to be defined.",
        ],
      ],
    },
  ],
}
