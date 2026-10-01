"use client"

/* What the data behind a dashboard says about itself (L4 trust layer):
   nothing when it cannot tell, a quiet "updated N days ago" when the data is
   recent, and a plain warning when a department has gone silent. */

import { AlertTriangle, Clock } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import type { Assessment } from "@/lib/freshness"

const MAX_LISTED = 3

export function FreshnessNote({
  assessment,
  sectorName,
  locale,
}: {
  assessment: Assessment
  sectorName: (sector: string) => string
  locale: string
}) {
  const tx = useTx()

  if (assessment.kind === "unknown") return null

  const dateOf = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" })

  if (assessment.kind === "fresh" && assessment.newest) {
    const { ageDays, lastUploadAt } = assessment.newest
    const when =
      ageDays === 0
        ? tx("aujourd'hui", "today")
        : ageDays === 1
        ? tx("hier", "yesterday")
        : tx(`il y a ${ageDays} jours`, `${ageDays} days ago`)

    return (
      <p
        role="status"
        data-freshness="fresh"
        title={dateOf(lastUploadAt)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {tx(`Données mises à jour ${when}`, `Data updated ${when}`)}
      </p>
    )
  }

  const listed = assessment.stale.slice(0, MAX_LISTED)
  const more = assessment.stale.length - listed.length

  return (
    <div
      role="status"
      data-freshness="stale"
      className="flex items-start gap-3 rounded-2xl border border-[var(--tag-warning-bd)] bg-[var(--tag-warning-bg)] px-4 py-3 text-sm text-[var(--tag-warning-fg)]"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />

      <div className="min-w-0">
        <ul className="space-y-0.5 font-semibold">
          {listed.map((s) => (
            <li key={s.sector} data-stale-sector={s.sector}>
              {tx(
                `${sectorName(s.sector)} : aucune donnée depuis ${s.ageDays} jours (dernier fichier le ${dateOf(s.lastUploadAt)}).`,
                `${sectorName(s.sector)}: no data for ${s.ageDays} days (last file ${dateOf(s.lastUploadAt)}).`
              )}
            </li>
          ))}
          {more > 0 && (
            <li>{tx(`et ${more} autre${more > 1 ? "s" : ""}`, `and ${more} more`)}</li>
          )}
        </ul>

        <p className="mt-1 text-xs leading-5">
          {tx(
            "Ce que vous voyez date de ce moment-là, et un zéro n'est pas une mesure. Importez un fichier pour actualiser.",
            "What you see is as of then, and a zero here is not a measurement. Import a file to refresh."
          )}
        </p>
      </div>
    </div>
  )
}
