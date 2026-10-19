import type { Tx } from "@/lib/i18n"
import type { ViewKey } from "@/components/sentria/types"

/* The first-use tour (ONB-GUIDE). Scripted: no AI, no per-use cost. A step's
 * title is the menu item's own name, so the person finds the same word on screen.

 * A step with a `nav` points at that sidebar item (the button carries
 * data-nav="<id>"); a step without one is the hello or the goodbye. A target
 * the person can't see (a sector or role that hides it) drops its step, so the
 * tour never points at nothing.
 *
 * The quick tour is the sidebar, one minute. "Go deeper" opens a second
 * chapter on the dashboard itself and on what to import: its steps point at a
 * dashboard block (data-tour="<name>") and carry the columns the person's own
 * department needs in its file. */

/** One name, one place: the trademark check on "Robo" is still to do. */
export const GUIDE_NAME = "Robo"

/** Set once the tour is finished or skipped, so it never opens by itself again. */
export const GUIDE_DONE_KEY = "sentria_guide_done"

export type GuidePose = "wave" | "point" | "cheer"

export type GuideStep = {
  id: string
  pose: GuidePose
  /** The sidebar item to point at (data-nav), when there is one. */
  nav?: string
  title: string
  body: string
  /** One concrete example, so the item is not abstract. */
  example?: string
  /** A dashboard block to point at (data-tour), when it is not a menu item. */
  anchor?: string
  /** The view this step is about: the tour opens it first. */
  view?: ViewKey
  /** Shown as small tags under the text (the columns of a file). */
  chips?: string[]
  /** The block only exists once data is in. Without it the step is dropped
   *  and one "after your first import" step stands in for all of them. */
  needsData?: boolean
}

export function guideSteps(tx: Tx): GuideStep[] {
  return [
    {
      id: "hello",
      pose: "wave",
      title: tx(`Salut, moi c'est ${GUIDE_NAME}`, `Hi, I'm ${GUIDE_NAME}`),
      body: tx(
        "Je vous fais visiter SentrIA en une minute. Vous pouvez passer la visite à tout moment.",
        "I will show you around SentrIA in one minute. You can skip the tour at any time.",
      ),
    },
    {
      id: "dashboard",
      pose: "point",
      nav: "dashboard",
      title: tx("Dashboard", "Dashboard"),
      body: tx(
        "Vos alertes et vos chiffres clés sur un seul écran, les plus graves en premier.",
        "Your alerts and key numbers on one screen, the worst first.",
      ),
      example: tx(
        "Exemple : un frigo, un camion ou un groupe électrogène hors limite apparaît ici.",
        "Example: a fridge, a truck or a generator out of range shows up here.",
      ),
    },
    {
      id: "tracking",
      pose: "point",
      nav: "tracking",
      title: tx("Suivi", "Tracking"),
      body: tx(
        "Chaque problème devient une tâche avec un responsable.",
        "Every problem becomes a task with an owner.",
      ),
      example: tx(
        "Exemple : passez une tâche de À faire à Terminé quand c'est réparé.",
        "Example: move a task from To do to Done once it is fixed.",
      ),
    },
    {
      id: "sites",
      pose: "point",
      nav: "sites",
      title: tx("Sites", "Sites"),
      body: tx(
        "Vos lieux de travail. Chacun garde ses propres données.",
        "Your places of work. Each one keeps its own data.",
      ),
      example: tx(
        "Exemple : passez du dépôt principal à une deuxième boutique.",
        "Example: switch from the main depot to a second shop.",
      ),
    },
    {
      id: "contractors",
      pose: "point",
      nav: "contractors",
      title: tx("Intervenants", "Field team"),
      body: tx(
        "Les personnes que vous envoyez réparer sur le terrain.",
        "The people you send to fix things in the field.",
      ),
      example: tx(
        "Exemple : envoyez une tâche par SMS et suivez la réponse.",
        "Example: send a task by text and follow the answer.",
      ),
    },
    {
      id: "ask",
      pose: "point",
      nav: "ask",
      title: tx("Ask SentrIA", "Ask SentrIA"),
      body: tx(
        "Posez une question sur vos données avec vos propres mots.",
        "Ask a question about your data in your own words.",
      ),
      example: tx(
        "Exemple : quel frigo a dépassé 8 °C cette semaine ?",
        "Example: which fridge went over 8 °C this week?",
      ),
    },
    {
      id: "report",
      pose: "point",
      nav: "report",
      title: tx("Rapport", "Report"),
      body: tx(
        "Un résumé de la semaine que vous pouvez partager.",
        "A summary of the week you can share.",
      ),
      example: tx(
        "Exemple : envoyez-le à votre responsable le lundi.",
        "Example: send it to your manager on Monday.",
      ),
    },
    {
      id: "done",
      pose: "cheer",
      title: tx("C'est tout", "That is the tour"),
      body: tx(
        "Vous pouvez la refaire quand vous voulez depuis « Aide et retours », bouton « Visite guidée ».",
        "You can replay it any time from \"Help & feedback\", button \"Take the tour\".",
      ),
    },
  ]
}

/** What the deeper chapter needs to know about the account. */
export type DeepContext = {
  /** The columns the account's department asks for in its file, or none known. */
  columns: string[]
  /** The department's name in the person's language, when known. */
  department?: string
}

export function deepSteps(tx: Tx, context: DeepContext): GuideStep[] {
  const { columns, department } = context

  return [
    {
      id: "deep-hello",
      pose: "wave",
      view: "dashboard",
      title: tx("Le tableau de bord, pas à pas", "The dashboard, step by step"),
      body: tx(
        "Je vous montre à quoi sert chaque bloc, puis ce qu'il faut importer pour qu'il se remplisse.",
        "I will show you what each block is for, then what to import so it fills in.",
      ),
    },
    {
      id: "deep-kpis",
      pose: "point",
      anchor: "kpis",
      needsData: true,
      title: tx("Les quatre cartes du haut", "The four cards at the top"),
      body: tx(
        "Chaque carte compte une chose : les actifs en alerte, les alertes critiques, les avertissements et le total. Le petit trait montre les derniers jours et l'étiquette compare avec avant.",
        "Each card counts one thing: assets in alert, critical alerts, warnings and the total. The small line shows the last days and the tag compares with before.",
      ),
      example: tx(
        "Exemple : si la carte Critique monte, lisez d'abord le tableau des alertes.",
        "Example: if the Critical card goes up, read the alerts table first.",
      ),
    },
    {
      id: "deep-trend",
      pose: "point",
      anchor: "trend",
      needsData: true,
      title: tx("La courbe des alertes", "The alert trend"),
      body: tx(
        "Les alertes jour après jour. Le menu « … » permet de superposer des secteurs, de changer la mesure et de choisir 7, 30 ou 90 jours.",
        "Alerts day after day. The \"…\" menu lets you overlay sectors, change the measure and pick 7, 30 or 90 days.",
      ),
      example: tx(
        "Exemple : une courbe qui grimpe depuis trois jours dit que le problème s'installe.",
        "Example: a line climbing for three days says the problem is settling in.",
      ),
    },
    {
      id: "deep-breakdown",
      pose: "point",
      anchor: "breakdown",
      needsData: true,
      title: tx("La répartition", "The breakdown"),
      body: tx(
        "Chaque couleur est un type de problème, et le chiffre dit combien. La plus grosse part est là où regarder en premier.",
        "Each colour is one kind of problem and the number says how many. The biggest slice is where to look first.",
      ),
    },
    {
      id: "deep-alerts",
      pose: "point",
      anchor: "alerts",
      title: tx("Le tableau des alertes", "The alerts table"),
      body: tx(
        "Toutes les alertes en une liste. Cliquez une ligne pour l'ouvrir : le message, quoi faire, pourquoi, et le niveau de confiance de SentrIA. Les filtres et la recherche réduisent la liste.",
        "Every alert in one list. Click a row to open it: the message, what to do, why, and how sure SentrIA is. The filters and the search narrow the list.",
      ),
      example: tx(
        "Exemple : ouvrez une ligne critique, lisez la recommandation, puis envoyez-la à quelqu'un depuis Suivi.",
        "Example: open a critical row, read the recommendation, then send it to someone from Tracking.",
      ),
    },
    {
      id: "deep-import",
      pose: "point",
      anchor: "import",
      title: tx("Importer vos données", "Import your data"),
      body: columns.length > 0
        ? tx(
            `Ce bouton citron vert fait entrer les données. Cliquez-le, choisissez un fichier CSV de votre système${department ? ` (${department})` : ""}, et SentrIA le vérifie puis crée les alertes. Votre fichier doit avoir ces colonnes :`,
            `This lime button is where data goes in. Click it, pick a CSV file from your system${department ? ` (${department})` : ""}, and SentrIA checks it and raises the alerts. Your file needs these columns:`,
          )
        : tx(
            "Ce bouton citron vert fait entrer les données. Cliquez-le, choisissez un fichier CSV de votre système, et SentrIA le vérifie puis crée les alertes.",
            "This lime button is where data goes in. Click it, pick a CSV file from your system, and SentrIA checks it and raises the alerts.",
          ),
      chips: columns.length > 0 ? columns : undefined,
      example: tx(
        "Pas sûr du format ? La fenêtre d'import propose un CSV vide à remplir. Réimportez à chaque nouveau relevé.",
        "Not sure of the format? The import window offers an empty CSV to fill in. Import again with every new reading.",
      ),
    },
    {
      id: "deep-after",
      pose: "wave",
      title: tx("Après l'import", "After the import"),
      body: tx(
        "Les cartes se remplissent, les alertes apparaissent et chacune porte une recommandation. Envoyez le travail à votre équipe depuis Suivi et Intervenants.",
        "The cards fill in, alerts appear and each one carries a recommendation. Send the work to your team from Tracking and Field team.",
      ),
    },
    {
      id: "deep-done",
      pose: "cheer",
      title: tx("À vous de jouer", "Your turn"),
      body: tx(
        "Importez votre premier fichier. Vous pouvez refaire ce guide depuis « Aide et retours », bouton « Visite guidée ».",
        "Import your first file. You can replay this guide from \"Help & feedback\", button \"Take the tour\".",
      ),
    },
  ]
}

/** Stands in for the data-dependent dashboard steps while the account has no
 *  data: what the page will show once the first file is in. */
export function previewStep(tx: Tx): GuideStep {
  return {
    id: "deep-preview",
    pose: "wave",
    title: tx("Ce que vous verrez après un import", "What you will see after an import"),
    body: tx(
      "Quatre cartes avec le total des alertes, une courbe jour après jour, une répartition par type de problème, puis le tableau des alertes. Rien de tout cela n'apparaît tant qu'aucun fichier n'est importé.",
      "Four cards with the alert totals, a line day after day, a breakdown by kind of problem, then the alerts table. None of it shows until a file is imported.",
    ),
  }
}
