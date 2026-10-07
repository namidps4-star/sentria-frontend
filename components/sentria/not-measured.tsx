"use client"

/* L4 trust layer: what stands where a number could not be measured. A dash
   and the words, or a notice that says the source did not answer. Never a
   0 or an empty list that reads as good news. */

import { AlertTriangle, Loader2, RefreshCw } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** The dash that stands in for a figure. Screen readers get the words. */
export function NotMeasuredFigure({ className }: { className?: string }) {
  const tx = useTx()

  return (
    <span data-not-measured="" className={cn("text-muted-foreground", className)}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{tx("Non mesuré", "Not measured")}</span>
    </span>
  )
}

/** The page-level notice: the source did not answer. It sits where the
 *  freshness note sits, in the same warning colours. */
export function SourceNotice({
  title,
  detail,
  onRetry,
  busy = false,
  className,
}: {
  title: string
  /** What the reader should take from the page meanwhile. */
  detail?: string
  onRetry?: () => void
  /** A new read is under way: the button waits. */
  busy?: boolean
  className?: string
}) {
  const tx = useTx()

  return (
    <div
      role="alert"
      data-source-down=""
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-[var(--tag-warning-bd)] bg-[var(--tag-warning-bg)] px-4 py-3 text-sm text-[var(--tag-warning-fg)]",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>

        <p className="mt-1 text-xs leading-5">
          {detail ??
            tx(
              "Les zéros et les listes vides de cette page ne sont pas des mesures. Rien ici ne dit que tout va bien.",
              "The zeros and empty lists on this page are not readings. Nothing here says all is well."
            )}
        </p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          data-source-retry=""
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-current px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
          )}
          {tx("Réessayer", "Try again")}
        </button>
      )}
    </div>
  )
}
