"use client"

import { useEffect, useState } from "react"

import {
  COST_BUCKETS,
  fetchOutcomes,
  outcomeErrorText,
  sendOutcome,
  type CostBucket,
  type Outcome,
  type OutcomeAnswer,
} from "@/lib/crm"
import { bucketRange } from "@/lib/cost-ranges"
import { outcomeLabel } from "@/lib/outcome-words"
import { atLeast } from "@/lib/plans"
import { useEffectivePlan } from "@/lib/use-plan"
import { resolve, useTx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/* --------------------------------------------------------------------------
 * "What happened?" on a closed task (F-OUTCOME). Three answers worded for
 * the sector, then, for an avoided problem, an optional cost range. The API
 * counts the answers per kind of problem and, from 3, moves the confidence
 * score of the next alerts of that kind. Pro and up: below that nothing is
 * asked and the server is not called.
 * -------------------------------------------------------------------------- */

const MIN_ANSWERS = 3

type Tally = { right: number; wrong: number }

export function OutcomeAsk({
  taskKey,
  alertKey,
  sector,
  symbol,
}: {
  taskKey: string
  alertKey: string
  sector: string | null | undefined
  symbol: string
}) {
  const tx = useTx()
  const plan = useEffectivePlan()
  const allowed = plan !== null && atLeast(plan, "pro")

  const [loaded, setLoaded] = useState(false)
  const [answer, setAnswer] = useState<OutcomeAnswer | null>(null)
  const [tally, setTally] = useState<Tally | null>(null)
  const [editing, setEditing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!allowed) return
    let live = true

    fetchOutcomes().then((result) => {
      if (!live) return

      if (!result.ok) {
        setError(resolve(outcomeErrorText(result.code, result.detail), tx))
      } else if (result.data.can_answer) {
        setAnswer(result.data.answers[taskKey] ?? null)
        setTally(result.data.kinds[alertKey] ?? null)
      }

      setLoaded(true)
    })

    return () => {
      live = false
    }
    // tx changes with the language; the answers do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, taskKey, alertKey])

  async function save(outcome: Outcome, bucket: CostBucket | null) {
    setSending(true)
    setError("")

    const result = await sendOutcome(taskKey, alertKey, outcome, bucket, symbol)
    setSending(false)

    if (!result.ok) {
      setError(resolve(outcomeErrorText(result.code, result.detail), tx))
      return
    }

    // Move the tally by hand: the old answer leaves it, the new one joins.
    setTally((old) => {
      const next = { right: old?.right ?? 0, wrong: old?.wrong ?? 0 }
      if (answer) next[answer.outcome === "false_alarm" ? "wrong" : "right"] -= 1
      next[outcome === "false_alarm" ? "wrong" : "right"] += 1
      return next
    })
    setAnswer(result.data)
    setEditing(false)
  }

  if (!allowed || !loaded) return null

  const total = tally ? tally.right + tally.wrong : 0
  const asking = !answer || editing

  return (
    <div data-outcome-ask="" className="space-y-2">
      {total > 0 && (
        <div
          data-outcome-tally=""
          className="tags-light rounded-2xl bg-brand px-4 py-3 text-brand-foreground"
        >
          <p className="text-sm font-semibold leading-5">
            {tx(
              `Sur ce type d'alerte : ${tally!.right} vrai${tally!.right === 1 ? "" : "s"} problème${tally!.right === 1 ? "" : "s"}, ${tally!.wrong} fausse${tally!.wrong === 1 ? "" : "s"} alerte${tally!.wrong === 1 ? "" : "s"}.`,
              `On this kind of alert: ${tally!.right} real problem${tally!.right === 1 ? "" : "s"}, ${tally!.wrong} false alarm${tally!.wrong === 1 ? "" : "s"}.`
            )}
          </p>
          <p className="mt-0.5 text-xs leading-5 opacity-80">
            {total >= MIN_ANSWERS
              ? tx(
                  "Le score de confiance de ce type d'alerte en tient compte.",
                  "The confidence score of this kind of alert takes them into account."
                )
              : tx(
                  `Le score de confiance en tiendra compte à partir de ${MIN_ANSWERS} réponses.`,
                  `The confidence score uses them from ${MIN_ANSWERS} answers.`
                )}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        {asking ? (
          <>
            <p className="text-sm font-semibold leading-6 text-foreground">
              {tx("Que s'est-il passé ?", "What happened?")}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {(["avoided", "happened", "false_alarm"] as Outcome[]).map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => save(outcome, null)}
                  disabled={sending}
                  data-outcome={outcome}
                  aria-pressed={answer?.outcome === outcome}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60",
                    answer?.outcome === outcome
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {outcomeLabel(outcome, sector, tx)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-outcome-saved={answer!.outcome}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                answer!.outcome === "false_alarm"
                  ? "bg-tag-danger-bg text-tag-danger-fg"
                  : "bg-tag-success-bg text-tag-success-fg"
              )}
            >
              {outcomeLabel(answer!.outcome, sector, tx)}
            </span>

            {answer!.bucket && (
              <span className="text-xs text-muted-foreground">
                {tx("Coût évité : ", "Cost avoided: ")}
                {bucketRange(answer!.bucket, answer!.currency || symbol, tx)}
              </span>
            )}

            <button
              type="button"
              onClick={() => setEditing(true)}
              data-outcome-change=""
              className="ml-auto rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Modifier", "Change")}
            </button>
          </div>
        )}

        {!asking && answer!.outcome === "avoided" && !answer!.bucket && (
          <div className="mt-3">
            <p className="text-xs leading-5 text-muted-foreground">
              {tx("Facultatif : environ, combien cela a-t-il évité ?", "Optional: roughly, what did it save?")}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {COST_BUCKETS.map((bucket) => (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => save("avoided", bucket)}
                  disabled={sending}
                  data-outcome-bucket={bucket}
                  className="rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
                >
                  {bucketRange(bucket, symbol, tx)}
                </button>
              ))}
            </div>
          </div>
        )}

        {!asking && answer!.outcome === "false_alarm" && (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {tx(
              "Les fausses alertes baissent le score de confiance de ce type d'alerte.",
              "False alarms lower the confidence score of this kind of alert."
            )}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-2 text-xs leading-5 text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
