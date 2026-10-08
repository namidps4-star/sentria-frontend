"use client"

import { useState } from "react"

import { COST_BUCKETS, costErrorText, sendCostTap, type CostBucket } from "@/lib/crm"
import { bucketRange } from "@/lib/cost-ranges"
import { resolve, useTx } from "@/lib/i18n"

/* --------------------------------------------------------------------------
 * "Roughly what did this cost?" (I-COST step 2), one tap after a task is
 * handled. Four ranges and Skip: never a number to type, because a guess
 * made after the fact is not precise. Business and up, and only asked when
 * the alert has no amount from the file. One answer per task; the API
 * replaces a second one.
 * -------------------------------------------------------------------------- */

type State = { kind: "ask" } | { kind: "sending" } | { kind: "thanks" } | { kind: "skipped" } | { kind: "error"; message: string }

export function CostTap({
  taskKey,
  alertKey,
  symbol,
  onAnswered,
}: {
  taskKey: string
  alertKey: string
  symbol: string
  /** Called after an answer was saved, so the figures can be read again. */
  onAnswered?: () => void
}) {
  const tx = useTx()
  const [state, setState] = useState<State>({ kind: "ask" })

  async function answer(bucket: CostBucket) {
    setState({ kind: "sending" })

    const result = await sendCostTap(taskKey, alertKey, bucket, symbol)

    if (!result.ok) {
      setState({ kind: "error", message: resolve(costErrorText(result.code, result.detail), tx) })
      return
    }

    setState({ kind: "thanks" })
    onAnswered?.()
  }

  if (state.kind === "skipped") return null

  if (state.kind === "thanks") {
    return (
      <p data-cost-tap-thanks="" role="status" className="text-xs leading-5 text-muted-foreground">
        {tx("Merci. SentrIA s'en souviendra.", "Thanks. SentrIA will remember it.")}
      </p>
    )
  }

  return (
    <div data-cost-tap="" className="rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {tx("Facultatif", "Optional")}
      </p>

      <p className="mt-1.5 text-sm font-semibold leading-6 text-foreground">
        {tx("Environ, combien cela a-t-il coûté ?", "Roughly, what did this cost?")}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {COST_BUCKETS.map((bucket) => (
          <button
            key={bucket}
            type="button"
            onClick={() => answer(bucket)}
            disabled={state.kind === "sending"}
            data-cost-bucket={bucket}
            className="rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
          >
            {bucketRange(bucket, symbol, tx)}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setState({ kind: "skipped" })}
          disabled={state.kind === "sending"}
          data-cost-skip=""
          className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tx("Passer", "Skip")}
        </button>
      </div>

      {state.kind === "error" && (
        <p role="alert" className="mt-2 text-xs leading-5 text-destructive">
          {state.message}
        </p>
      )}
    </div>
  )
}
