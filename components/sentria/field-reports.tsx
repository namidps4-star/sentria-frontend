"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchFieldPhoto, fetchFieldReports, type FieldReport } from "@/lib/field-link"
import { useTx } from "@/lib/i18n"

/* What field people sent from their link on one task (F-CONTRACTOR): notes in
 * words, photos as small pictures that open full size. It shows nothing until
 * something has arrived. Photos are fetched signed in, one at a time. */

export function FieldReports({ taskKey }: { taskKey: string }) {
  const tx = useTx()
  const [reports, setReports] = useState<FieldReport[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const got = await fetchFieldReports(taskKey)

    if (got?.available) setReports(got.reports)
  }, [taskKey])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let alive = true
    const made: string[] = []

    ;(async () => {
      for (const report of reports.filter((r) => r.kind === "photo" && !urls[r.id])) {
        const url = await fetchFieldPhoto(report.id)

        if (!alive) return

        if (url) {
          made.push(url)
          setUrls((current) => ({ ...current, [report.id]: url }))
        }
      }
    })()

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports])

  useEffect(() => () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url)), [urls])

  if (reports.length === 0) return null

  const day = (iso: string) => new Date(iso).toLocaleString(tx("fr-FR", "en-GB"), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

  return (
    <section data-testid="field-reports" className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx("Du terrain", "From the field")}</p>
        <button type="button" onClick={() => void load()} className="text-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {tx("Actualiser", "Refresh")}
        </button>
      </div>

      <ul className="space-y-2">
        {reports.map((report) => (
          <li key={report.id} data-testid="field-report-item" data-kind={report.kind} className="rounded-xl border border-border px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">
              {report.name || tx("Intervenant", "Contractor")} · {day(report.created_at)}
            </p>
            {report.kind === "note" ? (
              <p className="mt-0.5 whitespace-pre-wrap break-words leading-6">{report.note}</p>
            ) : urls[report.id] ? (
              <button type="button" onClick={() => window.open(urls[report.id], "_blank", "noopener")} aria-label={tx("Ouvrir la photo", "Open the photo")} className="mt-1 block overflow-hidden rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[report.id]} alt={tx("Photo envoyée du terrain", "Photo sent from the field")} className="h-24 w-24 object-cover" />
              </button>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">{tx("Photo en chargement…", "Loading photo…")}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
