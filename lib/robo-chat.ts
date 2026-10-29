import type { Tx } from "@/lib/i18n"
import type { PartId } from "@/lib/guide-steps"

/* Robo's chat answers what the person types with fixed text: no AI, no cost per
 * question. A topic answers when one of its words is in the question (accents and
 * capitals do not count, and a word of five letters or more also matches its
 * longer forms). Each answer can offer to show the tour step that explains it. */

/** Where the tour starts when the person says "Show me": a part, and optionally one of its steps. */
export type RoboStart = { part: PartId; step?: string }

export type RoboTopic = {
  id: string
  words: string[]
  answer: string
  start?: RoboStart
}

export function roboTopics(tx: Tx): RoboTopic[] {
  return [
    {
      id: "risk",
      words: ["risque", "risques", "danger", "risk", "risks"],
      answer: tx(
        "Le risque dit ce qui arrive si personne n'agit, sur 100. Plus il est haut, plus il faut agir vite.",
        "Risk says what happens if nobody acts, out of 100. The higher it is, the sooner you need to act.",
      ),
      start: { part: "menu", step: "meaning" },
    },
    {
      id: "confidence",
      words: ["confiance", "fiable", "certitude", "confidence", "reliable", "certain"],
      answer: tx(
        "La confiance dit à quel point SentrIA est sûr que le problème est réel.",
        "Confidence says how sure SentrIA is that the problem is real.",
      ),
      start: { part: "menu", step: "meaning" },
    },
    {
      id: "alert",
      words: ["alerte", "alertes", "alert", "alerts"],
      answer: tx(
        "Une alerte est un problème repéré dans votre fichier : un stock bas, une chaîne du froid rompue, un lot qui expire.",
        "An alert is a problem found in your file: low stock, a broken cold chain, a batch about to expire.",
      ),
      start: { part: "dashboard" },
    },
    {
      id: "tracking",
      words: ["suivi", "tache", "taches", "responsable", "tracking", "task", "tasks", "owner"],
      answer: tx(
        "Dans Suivi. Chaque problème y devient une tâche avec un responsable.",
        "In Tracking. Every problem becomes a task with an owner there.",
      ),
      start: { part: "tracking" },
    },
    {
      id: "import",
      words: ["import", "importer", "csv", "fichier", "colonne", "colonnes", "file", "files", "upload", "column", "columns"],
      answer: tx(
        "Le bouton d'import envoie votre fichier CSV. SentrIA lit les colonnes et crée les alertes.",
        "The import button sends your CSV file. SentrIA reads the columns and raises the alerts.",
      ),
      start: { part: "import" },
    },
    {
      id: "sites",
      words: ["site", "sites"],
      answer: tx(
        "Un site est un lieu de votre entreprise, avec ses propres données. La liste est dans Sites.",
        "A site is one place in your company, with its own data. The list is in Sites.",
      ),
      start: { part: "sites" },
    },
    {
      id: "tour",
      words: ["visite", "guide", "tutoriel", "tour", "tutorial"],
      answer: tx(
        "Je vous fais visiter SentrIA en une minute.",
        "I will show you around SentrIA in one minute.",
      ),
      start: { part: "menu" },
    },
  ]
}

/** The answer when no topic matches: says which words work. */
export function roboFallback(tx: Tx): string {
  return tx(
    "Je n'ai pas encore de réponse pour cela. Essayez un mot comme : risque, confiance, suivi, alerte, import, sites.",
    "I do not have an answer for that yet. Try a word like: risk, confidence, tracking, alert, import, sites.",
  )
}

/** Accents and capitals do not count. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** The first topic whose word is in the question, or null. */
export function roboAnswer(question: string, tx: Tx): RoboTopic | null {
  const tokens = fold(question).split(/[^a-z0-9]+/).filter(Boolean)

  for (const topic of roboTopics(tx)) {
    const hit = topic.words.some((word) => {
      const w = fold(word)
      return tokens.some((token) => token === w || (w.length >= 5 && token.startsWith(w)))
    })
    if (hit) return topic
  }

  return null
}
