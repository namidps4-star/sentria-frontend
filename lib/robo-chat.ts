import type { Tx } from "@/lib/i18n"
import type { PartId } from "@/lib/guide-steps"

/* Robo's chat answers a few plain questions with fixed text: no AI, no cost per
 * question. Each answer offers to show the tour step that explains it. */

/** Where the tour starts when the person says "Show me": a part, and optionally one of its steps. */
export type RoboStart = { part: PartId; step?: string }

export type RoboQuestion = {
  id: string
  ask: string
  answer: string
  start: RoboStart
}

export function roboQuestions(tx: Tx): RoboQuestion[] {
  return [
    {
      id: "risk",
      ask: tx("Qu'est-ce que le risque ?", "What is risk?"),
      answer: tx(
        "Le risque dit ce qui arrive si personne n'agit, sur 100. Plus il est haut, plus il faut agir vite.",
        "Risk says what happens if nobody acts, out of 100. The higher it is, the sooner you need to act.",
      ),
      start: { part: "menu", step: "meaning" },
    },
    {
      id: "confidence",
      ask: tx("Qu'est-ce que la confiance ?", "What is confidence?"),
      answer: tx(
        "La confiance dit à quel point SentrIA est sûr que le problème est réel.",
        "Confidence says how sure SentrIA is that the problem is real.",
      ),
      start: { part: "menu", step: "meaning" },
    },
    {
      id: "tracking",
      ask: tx("Où voir le suivi ?", "Where do I see tracking?"),
      answer: tx(
        "Dans Suivi. Chaque problème y devient une tâche avec un responsable.",
        "In Tracking. Every problem becomes a task with an owner there.",
      ),
      start: { part: "tracking" },
    },
  ]
}
