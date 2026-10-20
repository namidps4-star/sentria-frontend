import type { Tx } from "@/lib/i18n"
import type { ViewKey } from "@/components/sentria/types"
import { priorityDescription, priorityLabel, prioritiesFor } from "@/lib/priorities"

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
 * department needs in its file. Some blocks exist for one sector only (the
 * logistics priorities, the vet disposal log): such a step is simply dropped
 * where its block is not on screen. */

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
  /** Only the block of this sector (its data-sector): the same block type exists for several. */
  anchorSector?: string
  /** The view this step is about: the tour opens it first. */
  view?: ViewKey
  /** Shown as small tags under the text (the columns of a file). */
  chips?: string[]
  /** Shown as a short list under the text, "Name: what it does" each. */
  bullets?: string[]
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
      bullets: [
        tx(
          "Que s'est-il passé ? : à la fin d'une tâche, répondez : problème évité, problème quand même, ou fausse alerte.",
          "What happened?: when a task is done, answer: problem avoided, problem happened anyway, or false alarm.",
        ),
        tx(
          "Dès 3 réponses : SentrIA ajuste la confiance des prochaines alertes du même type (Pro et plus).",
          "From 3 answers: SentrIA adjusts the confidence of the next alerts of that kind (Pro and up).",
        ),
      ],
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
  /** The sectors the account runs and its department id, to word the steps that depend on them.
   *  The sector the page is showing is not read from here: the dashboard clears its saved sector while
   *  the logistics overview is open. */
  sectors?: string[]
  departmentId?: string | null
}

export function deepSteps(tx: Tx, context: DeepContext): GuideStep[] {
  const { columns, department, sectors, departmentId } = context
  const logistics = !!sectors?.includes("logistics")

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
      id: "deep-priorities",
      pose: "point",
      anchor: "priorities",
      anchorSector: "logistics",
      title: tx("Vos priorités", "Your priorities"),
      body: tx(
        "Chaque bouton de cette barre noire est une question à laquelle SentrIA répond pour votre logistique, avec le nombre de signaux trouvés. Cliquez-en un pour ouvrir sa vue. La barre montre celles choisies à l'installation.",
        "Each button on this black bar is one question SentrIA answers about your logistics, with the number of signals it found. Click one to open its view. The bar shows the ones you chose at setup.",
      ),
      bullets: prioritiesFor("logistics", departmentId).map(
        (item) => `${priorityLabel("logistics", item.id, tx)} : ${priorityDescription("logistics", item.id, tx)}`,
      ),
    },
    {
      id: "deep-kpis",
      pose: "point",
      anchor: "kpis",
      needsData: true,
      title: tx("Les quatre cartes du haut", "The four cards at the top"),
      body: tx(
        "Chaque carte compte une chose pour votre activité. Le petit trait montre les derniers jours et l'étiquette compare avec avant.",
        "Each card counts one thing for your activity. The small line shows the last days and the tag compares with before.",
      ),
      example: tx(
        "Exemple : si la carte la plus grave monte, ouvrez les alertes derrière elle en premier.",
        "Example: if the most serious card goes up, open the alerts behind it first.",
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
      id: "deep-disposal",
      pose: "point",
      anchor: "disposal",
      title: tx("Journal des pertes", "Disposal log"),
      body: tx(
        "Notez chaque fois que du stock est jeté : comment, et ce que cela coûte. SentrIA additionne pour vous : ce que vous avez perdu en 30 jours et au total, la part qui finit en fosse, les 6 dernières semaines, la perte moyenne et la plus grosse.",
        "Write down every time stock is thrown away: how, and what it cost. SentrIA adds it up for you: what you lost in 30 days and in total, the share that ends in a pit, the last 6 weeks, the average loss and the biggest one.",
      ),
      example: tx(
        "Exemple : quand plus de la moitié finit en fosse, il le dit et propose de rendre le stock périmé au fournisseur ou de le donner.",
        "Example: when more than half ends in a pit, it says so and suggests returning expired stock to the supplier, or donating it.",
      ),
    },
    {
      id: "deep-disposal-form",
      pose: "point",
      anchor: "disposal-form",
      title: tx("Noter une perte", "Log a loss"),
      body: tx(
        "Une ligne par perte, puis Ajouter. Le produit est obligatoire ; la quantité et la valeur doivent être des nombres ; la date ne peut pas être dans le futur. Pour « Comment » : fosse, brûlé, retourné au fournisseur, donné ou autre.",
        "One line per loss, then Add. The product is required; the quantity and the value must be numbers; the date cannot be in the future. For \"How\": thrown in a pit, burned, returned to the supplier, donated or other.",
      ),
      chips: [
        tx("Produit", "Product"),
        tx("Valeur perdue", "Value lost"),
        tx("Comment", "How"),
        tx("Lot (facultatif)", "Batch (optional)"),
        tx("Quantité", "Quantity"),
        tx("Date", "Date"),
      ],
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
      id: "deep-departments",
      pose: "point",
      anchor: "departments",
      title: tx("Vos départements", "Your departments"),
      body: logistics
        ? tx(
            "Un onglet par département que vous gérez. Cliquez un onglet pour passer tout le tableau de bord dessus ; les onglets + en ajoutent un autre. Le nombre dépend de votre offre. La logistique en compte plusieurs, comme le port et conteneurs ou l'entrepôt et manutention.",
            "One tab per department you run. Click a tab to switch the whole dashboard to it; the + tabs add another. How many you can have depends on your plan. Logistics has several, such as port and containers or warehouse and handling.",
          )
        : tx(
            "Un onglet par département que vous gérez. Cliquez un onglet pour passer tout le tableau de bord dessus ; les onglets + en ajoutent un autre. Le nombre dépend de votre offre.",
            "One tab per department you run. Click a tab to switch the whole dashboard to it; the + tabs add another. How many you can have depends on your plan.",
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
