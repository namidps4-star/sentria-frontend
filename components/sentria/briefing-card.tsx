"use client"

import { useMemo } from "react"

import { buildBriefing } from "@/lib/briefing"
import { useTx } from "@/lib/i18n"
import { ShieldAlert, TriangleAlert, Database } from "@/lib/icons"
import type { LogisticsAlert } from "@/lib/logistics-signals"
import { agoLabel } from "@/lib/relative-time"
import { StatusTag } from "./status-tag"

/** The week told as a story: a headline, what needs the boss now, what keeps
 *  coming back, what SentrIA cannot see, and a short plan. */
export function BriefingCard({ alerts, stale, staleDays }: { alerts: LogisticsAlert[]; stale: boolean; staleDays: number | null }) {
  const tx = useTx()
  const brief = useMemo(() => buildBriefing(alerts, tx, stale), [alerts, tx, stale])

  if (alerts.length === 0) return null

  return (
    <section data-testid="briefing" className="space-y-4 print:space-y-3">
      <div className="rounded-[28px] bg-brand p-6 text-[#141414] sm:p-8 print:bg-transparent">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#141414]/60">
          {tx("Votre semaine", "Your week")}
        </p>
        <h2 className="mt-2 max-w-2xl font-heading text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl">
          {brief.headline}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#141414]/80 sm:text-base">{brief.lead}</p>
      </div>

      <div>
        <h3 className="font-heading text-xl font-semibold tracking-tight">{tx("Ce qui vous attend", "What needs you now")}</h3>
        <ul className="mt-3 space-y-2.5">
          {brief.needs.map((item) => (
            <li key={`${item.equipment}-${item.finding}`} className="flex items-start gap-4 rounded-[24px] bg-card p-4 shadow-sm sm:p-5">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${item.critical ? "bg-destructive" : "bg-warning"}`}
                aria-hidden="true"
              >
                {item.critical ? <ShieldAlert className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.equipment}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.finding}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusTag tone={item.critical ? "danger" : "warning"} size="xs">
                    {item.critical ? tx("Critique", "Critical") : tx("Attention", "Warning")}
                  </StatusTag>
                  <StatusTag tone="neutral" size="xs">{agoLabel(item.date, tx)}</StatusTag>
                  {item.count > 1 && (
                    <StatusTag tone="neutral" size="xs">{tx(`${item.count} fois`, `${item.count} times`)}</StatusTag>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {brief.moreToWatch > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {tx(
              `Et ${brief.moreToWatch} autre${brief.moreToWatch > 1 ? "s" : ""} à surveiller, dans le tableau plus bas.`,
              `And ${brief.moreToWatch} more to watch, in the table below.`
            )}
          </p>
        )}
      </div>

      {brief.recurring.length > 0 && (
        <div>
          <h3 className="font-heading text-xl font-semibold tracking-tight">{tx("Ce qui revient", "What keeps coming back")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {brief.recurring.map((r) => tx(`${r.equipment} (${r.count} alertes)`, `${r.equipment} (${r.count} alerts)`)).join(" · ")}
          </p>
        </div>
      )}

      {stale && (
        <div className="flex items-start gap-3 rounded-[24px] bg-muted p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/10" aria-hidden="true">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold">{tx("Ce que SentrIA ne voit pas", "What SentrIA cannot see")}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {staleDays !== null
                ? tx(
                    `Le dernier fichier date d'il y a ${staleDays} jour${staleDays > 1 ? "s" : ""}. Les alertes ci-dessus décrivent cette date, pas aujourd'hui.`,
                    `The last file is ${staleDays} day${staleDays > 1 ? "s" : ""} old. The alerts above describe that date, not today.`
                  )
                : tx(
                    "Les données sont anciennes. Les alertes ci-dessus décrivent cette date, pas aujourd'hui.",
                    "The data is old. The alerts above describe that date, not today."
                  )}
            </p>
          </div>
        </div>
      )}

      {brief.plan.length > 0 && (
        <div className="rounded-[28px] bg-[var(--ink)] p-5 text-white sm:p-6 print:bg-transparent print:text-foreground">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">{tx("Le plan", "The plan")}</p>
          <ol className="mt-3 divide-y divide-white/10">
            {brief.plan.map((step, i) => (
              <li key={step} className="flex items-center gap-3 py-2.5 text-sm sm:text-base">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-[#141414]">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
