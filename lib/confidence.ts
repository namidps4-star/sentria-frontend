import type { Tx } from "@/lib/i18n/pair"

/**
 * SentrIA's confidence score — the "how sure are we?" step of the
 * decision loop (evidence → confidence → impact → reasoning →
 * recommendation → outcome).
 *
 * This is NOT a raw ML probability pasted onto the UI. It's a
 * transparent, checkable score built from five things a human can
 * actually verify, plus one thing that makes it specific to SentrIA:
 * it learns from what this deployment's own users do.
 *
 *   1. Signal severity   — how far past normal is the raw metric?
 *   2. Threshold crossing — did it actually cross the critical line?
 *   3. Recurrence        — has this exact pattern shown up before?
 *   4. Data quality       — is this "live" (connected ERP/IoT/CSV) data,
 *                           or a "template" pattern not yet confirmed?
 *   5. Signal convergence — do multiple independent signals agree?
 *   6. Feedback loop      — has this deployment's team historically
 *                           acted on this category of alert, or
 *                           dismissed it? (This is the part a generic
 *                           BI-plus-AI tool can't copy: it only works
 *                           because SentrIA closes the loop with real
 *                           human decisions, not just alerts.)
 *
 * The score is deliberately never allowed to hit the extremes: floored
 * at 30 (something real triggered the alert, so confidence is never
 * "none") and capped at 96 (claiming near-certainty is the fastest way
 * to lose a team's trust the first time you're wrong).
 *
 * This is a v1 heuristic, written to be honest about its inputs rather
 * than to look sophisticated. The moment the backend has a real,
 * calibrated model score, that should replace step 1-3 here — but the
 * data-quality and feedback-loop pieces are still worth keeping even
 * then, since they're about trustworthiness, not just raw prediction.
 */

export interface ConfidenceInput {
  /** 0-100, or 0-1 (will be normalized). Falls back to 60 if unknown. */
  riskScore?: number | null
  severity: "WARNING" | "CRITICAL" | string
  /** How many times this same equipment/pattern has already alerted. */
  recurrence: number
  /**
   * Fraction (0-1) of the signals behind this alert that come from a
   * connected, real data source rather than an unconfirmed template
   * pattern. Defaults to 1 (fully live) when not specified — e.g. for
   * alerts that already came through the live /alerts API.
   */
  dataQuality?: number
  /**
   * 0-1: how strongly the individual signals behind this alert agree
   * with each other (e.g. 3 out of 3 signals in the "severe" band vs.
   * only 1 out of 3). Defaults to 0.5 (unknown / not measured) rather
   * than 0, since we don't want to punish alerts that just don't
   * expose sub-signals.
   */
  signalConvergence?: number
  /**
   * This deployment's own history for this alert category: how often
   * a human acted on it ("done") vs. dismissed it ("dismissed"). Below
   * 3 total data points we don't trust the sample yet and skip this
   * term entirely, to avoid one early dismissal permanently tanking a
   * category's confidence.
   */
  trackRecord?: { done: number; dismissed: number }
}

function normalizeRisk(riskScore?: number | null): number {
  if (typeof riskScore !== "number") return 60
  return riskScore > 1 ? Math.max(0, Math.min(100, riskScore)) : riskScore * 100
}

export function computeConfidence(input: ConfidenceInput): number {
  const risk = normalizeRisk(input.riskScore)
  const dataQuality = input.dataQuality ?? 1
  const convergence = input.signalConvergence ?? 0.5

  let score = 50

  // 1. How extreme is the raw signal, centered on the midpoint (50).
  score += ((risk - 50) / 50) * 12.5

  // 2. Crossing the critical threshold is itself evidence, beyond the
  //    raw number — a metric right at the line behaves differently
  //    once it's actually over it (escalation, penalties, SLA breaches).
  if (input.severity === "CRITICAL") score += 6

  // 3. Recurrence: a pattern seen 3 times this week is not noise.
  //    Capped so a single runaway counter doesn't dominate the score.
  score += Math.min(input.recurrence, 5) * 3

  // 4. Data quality: live/connected data is trusted more than an
  //    unconfirmed template pattern (SentrIA marks these "à confirmer").
  score += (dataQuality - 0.5) * 16

  // 5. Signal convergence: multiple independent signals agreeing is
  //    much stronger evidence than one signal in isolation.
  score += convergence * 15

  // 6. The feedback loop — this deployment's own track record. Only
  //    applied once there's enough history to mean something.
  if (input.trackRecord) {
    const total = input.trackRecord.done + input.trackRecord.dismissed
    if (total >= 3) {
      const actedRatio = input.trackRecord.done / total
      score += (actedRatio - 0.5) * 20
    }
  }

  return Math.round(Math.max(30, Math.min(96, score)))
}

/** How to say a confidence score in plain words, not just a number. */
export function confidenceWord(pct: number, tx: Tx): string {
  if (pct >= 85) return tx("Élevée", "High")
  if (pct >= 65) return tx("Bonne", "Good")
  return tx("Modérée", "Moderate")
}