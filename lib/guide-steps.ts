import type { Tx } from "@/lib/i18n"

/* The first-use tour (ONB-GUIDE). Scripted: no AI, no per-use cost. A step's
 * title is the menu item's own name, so the person finds the same word on screen.

 * A step with a `nav` points at that sidebar item (the button carries
 * data-nav="<id>"); a step without one is the hello or the goodbye. A target
 * the person can't see (a sector or role that hides it) drops its step, so the
 * tour never points at nothing. */

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
