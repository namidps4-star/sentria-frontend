"use client"

import { useMemo } from "react"
import { CheckCircle2, Eye, Radar, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sparkline } from "./charts"
import { FlowCard, FlowTrack } from "./flow-track"
import {
  NoSignal,
  SectionTitle,
  StatTile,
  TONE_CHIP,
  ViewHeader,
} from "./logistics-ui"
import {
  countOf,
  dailyCounts,
  deriveAnticipation,
  deriveStages,
  formatHours,
  globalRisk,
  isPredictive,
  plural,
  type LogisticsAlert,
  type OpsType,
} from "@/lib/logistics-signals"
import { useTx } from "@/lib/i18n"

/* --------------------------------------------------------------------------
 * "Être alerté à temps".
 *
 * The backend fires logistics.risk.elevated on a composite score before
 * any single metric crosses its own threshold. Those rows are the only
 * place a lead-time claim can be measured rather than asserted: pair a
 * predictive warning with the threshold alert that later confirmed it on
 * the same equipment, and the gap between them is the advance notice.
 *
 * The previous version stated a fixed "detected 14 h early" per ops type
 * next to an invented manual-inspection baseline, for assets whose ids
 * were written by hand.
 * -------------------------------------------------------------------------- */

type LogisticsAnticipateViewProps = {
  alerts?: LogisticsAlert[]
  opsType?: OpsType
  selectedOpsTypesForMulti?: Exclude<OpsType, "multi">[]
}

export function LogisticsAnticipateView({
  alerts = [],
  opsType,
  selectedOpsTypesForMulti = [],
}: LogisticsAnticipateViewProps) {
  const tx = useTx()

  const lines = useMemo(
    () => deriveAnticipation(alerts, opsType, tx, selectedOpsTypesForMulti),
    [alerts, opsType, tx, selectedOpsTypesForMulti]
  )

  const stages = useMemo(
    () => deriveStages(alerts, opsType, tx, selectedOpsTypesForMulti),
    [alerts, opsType, tx, selectedOpsTypesForMulti]
  )

  const trend = useMemo(() => dailyCounts(alerts, 7, isPredictive), [alerts])

  const confirmed = lines.filter((line) => line.leadHours !== null)
  const watching = lines.filter((line) => line.leadHours === null)

  const blockingIndex = useMemo(() => {
    if (lines.length === 0) return -1

    return stages.findIndex((stage) => stage.id === lines[0].stage)
  }, [stages, lines])

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        <ViewHeader
          eyebrow={tx("Anticipation", "Anticipation")}
          opsType={opsType}
          selectedOpsTypes={selectedOpsTypesForMulti}
          title={tx(
            "Aucune alerte préventive enregistrée.",
            "No early warning recorded."
          )}
          lede={tx(
            "Cette vue mesure l'avance réelle de SentrIA : le temps entre son alerte préventive et le moment où un seuil a effectivement été franchi. Sans alerte préventive, il n'y a pas d'avance à mesurer.",
            "This view measures how much warning SentrIA actually gave: the time between its early warning and the moment a threshold was really crossed. With no early warning, there is no lead time to measure."
          )}
          risk={0}
          icon={Radar}
        />

        <NoSignal
          title={tx(
            "Rien à mesurer pour l'instant",
            "Nothing to measure yet"
          )}
          detail={tx(
            "SentrIA émet une alerte préventive quand plusieurs signaux faibles se combinent sans qu'aucun seuil ne soit encore franchi (score composite au-delà de 55).",
            "SentrIA raises an early warning when several weak signals combine before any single threshold is crossed (composite score past 55)."
          )}
          expected={tx(
            "Plus votre CSV contient de colonnes suivies en même temps (attente, température, cycles, pression, carburant, entretien), plus le score composite peut se déclencher tôt.",
            "The more columns your CSV carries at once (waiting, temperature, cycles, pressure, fuel, servicing), the earlier the composite score can fire."
          )}
        />
      </div>
    )
  }

  const bestLead = confirmed.length > 0 ? confirmed[0] : null
  const averageLead =
    confirmed.length > 0
      ? confirmed.reduce((sum, line) => sum + (line.leadHours ?? 0), 0) /
        confirmed.length
      : null

  const risk = globalRisk(stages)

  return (
    <div className="space-y-4">
      <ViewHeader
        eyebrow={tx("Anticipation", "Anticipation")}
        opsType={opsType}
        selectedOpsTypes={selectedOpsTypesForMulti}
        title={
          bestLead
            ? tx(
                `Prévenu ${formatHours(
                  bestLead.leadHours ?? 0
                )} avant le franchissement.`,
                `Warned ${formatHours(
                  bestLead.leadHours ?? 0
                )} before the threshold was crossed.`
              )
            : tx(
                `${countOf(watching.length, "alerte")} ${plural(
                  watching.length,
                  "préventive",
                  "préventives"
                )} en cours.`,
                `${countOf(watching.length, "early warning")} open.`
              )
        }
        lede={
          bestLead
            ? tx(
                `${countOf(confirmed.length, "alerte")} ${plural(
                  confirmed.length,
                  "préventive",
                  "préventives"
                )} ${plural(
                  confirmed.length,
                  "confirmée",
                  "confirmées"
                )} ensuite par un seuil, ${watching.length} encore sous surveillance.`,
                `${countOf(
                  confirmed.length,
                  "early warning"
                )} later confirmed by a threshold, ${
                  watching.length
                } still being watched.`
              )
            : tx(
                "Aucune n'a encore été confirmée par le franchissement d'un seuil. L'avance ne sera mesurable qu'à ce moment.",
                "None has been confirmed by a threshold yet. The lead time only becomes measurable then."
              )
        }
        risk={risk}
        icon={Radar}
      />

      <FlowCard
        title={
          bestLead
            ? bestLead.stageName
            : tx("Sous surveillance", "Being watched")
        }
        subtitle={
          bestLead
            ? tx(
                `${bestLead.equipment} : alerte préventive, puis ${
                  bestLead.confirmedBy?.toLowerCase() ?? "franchissement"
                } confirmé.`,
                `${bestLead.equipment}: early warning, then ${
                  bestLead.confirmedBy?.toLowerCase() ?? "a threshold"
                } confirmed it.`
              )
            : tx(
                `${countOf(watching.length, "équipement")} ${plural(
                  watching.length,
                  "signalé",
                  "signalés"
                )} par le score composite, avant tout franchissement de seuil.`,
                `${countOf(
                  watching.length,
                  "asset"
                )} flagged by the composite score, before any threshold was crossed.`
              )
        }
        figureLabel={
          bestLead
            ? tx("Avance mesurée", "Lead time measured")
            : tx("Ouvert depuis", "Open for")
        }
        figure={
          bestLead
            ? formatHours(bestLead.leadHours ?? 0)
            : watching[0]?.openHours !== null &&
                watching[0]?.openHours !== undefined
              ? formatHours(watching[0].openHours)
              : undefined
        }
        figureNote={
          bestLead
            ? (() => {
                const format = { dateStyle: "short", timeStyle: "short" } as const
                const locale = tx("fr-FR", "en-GB")
                const warned = new Date(bestLead.warnedAt).toLocaleString(
                  locale,
                  format
                )
                const crossed = new Date(bestLead.confirmedAt!).toLocaleString(
                  locale,
                  format
                )

                return tx(
                  `Alerte le ${warned}, seuil franchi le ${crossed}.`,
                  `Warned on ${warned}, threshold crossed on ${crossed}.`
                )
              })()
            : tx(
                "Aucun seuil franchi depuis l'alerte préventive.",
                "No threshold crossed since the early warning."
              )
        }
        aside={
          averageLead !== null ? (
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tx("Avance moyenne", "Average lead time")}
              </p>

              <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                {formatHours(averageLead)}
              </p>

              <p className="text-xs text-muted-foreground">
                {tx(
                  `sur ${countOf(confirmed.length, "cas", "cas")} ${plural(
                    confirmed.length,
                    "confirmé",
                    "confirmés"
                  )}`,
                  `across ${countOf(confirmed.length, "confirmed case")}`
                )}
              </p>
            </div>
          ) : undefined
        }
      >
        <FlowTrack
          nodes={stages.map((stage) => ({
            id: stage.id,
            name: stage.name,
            status: stage.status,
            alertCount: stage.alerts.length,
          }))}
          blockingIndex={blockingIndex}
        />

        <p className="mt-3 text-xs text-muted-foreground">
          {blockingIndex >= 0
            ? tx(
                `L'alerte préventive la plus en avance portait sur ${stages[blockingIndex].name}.`,
                `The earliest warning was about ${stages[blockingIndex].name}.`
              )
            : tx(
                "Les alertes préventives ne sont rattachées à aucune étape de cette chaîne.",
                "The early warnings are not attached to any stage of this chain."
              )}
        </p>
      </FlowCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={tx("Alertes préventives", "Early warnings")}
          value={String(lines.length)}
          note={tx(
            "Score composite au-delà de 55",
            "Composite score past 55"
          )}
          tone="watch"
          icon={Radar}
        />

        <StatTile
          label={tx("Confirmées ensuite", "Confirmed later")}
          value={String(confirmed.length)}
          note={tx(
            "Un seuil a été franchi après",
            "A threshold was crossed afterwards"
          )}
          tone={confirmed.length > 0 ? "risk" : "good"}
          icon={CheckCircle2}
        />

        <StatTile
          label={tx("Encore sous surveillance", "Still being watched")}
          value={String(watching.length)}
          note={tx(
            "Aucun seuil franchi à ce jour",
            "No threshold crossed so far"
          )}
          tone="watch"
          icon={Eye}
        />

        <StatTile
          label={tx("Avance moyenne", "Average lead time")}
          value={
            averageLead !== null
              ? formatHours(averageLead)
              : tx("Non mesurable", "Not measurable")
          }
          note={
            averageLead !== null
              ? tx(
                  `Sur ${confirmed.length} cas`,
                  `Across ${confirmed.length} cases`
                )
              : tx("Aucune confirmation encore", "No confirmation yet")
          }
          tone="good"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-3">
          <SectionTitle
            note={tx("Avance la plus longue en premier", "Longest lead time first")}
          >
            {tx("Chaque alerte préventive", "Every early warning")}
          </SectionTitle>

          <ul className="space-y-2">
            {lines.slice(0, 10).map((line, index) => (
              <li
                key={`${line.equipment}-${index}`}
                className="rounded-2xl border border-border bg-muted/30 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{line.equipment}</p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {line.stageName}
                      {tx(
                        ` · risque ${line.warnedRisk}/100 · alerte le `,
                        ` · risk ${line.warnedRisk}/100 · warned on `
                      )}
                      {new Date(line.warnedAt).toLocaleDateString(
                        tx("fr-FR", "en-GB"),
                        { dateStyle: "short" }
                      )}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold",
                      TONE_CHIP[line.leadHours !== null ? "risk" : "watch"]
                    )}
                  >
                    {line.leadHours !== null
                      ? tx(
                          `${formatHours(line.leadHours)} d'avance`,
                          `${formatHours(line.leadHours)} of warning`
                        )
                      : tx("Sous surveillance", "Being watched")}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {line.leadHours !== null ? (
                    <>
                      {tx("Confirmé ensuite par", "Later confirmed by")}{" "}
                      <span className="font-semibold text-foreground">
                        {line.confirmedBy?.toLowerCase() ??
                          tx("un franchissement", "a threshold crossing")}
                      </span>
                      {line.confirmedSeverity === "CRITICAL" &&
                        tx(" (critique)", " (critical)")}
                      .
                    </>
                  ) : (
                    <>
                      {tx("Ouvert depuis", "Open for")}{" "}
                      <span className="font-semibold text-foreground">
                        {line.openHours !== null
                          ? formatHours(line.openHours)
                          : tx("une durée inconnue", "an unknown time")}
                      </span>
                      {tx(", aucun seuil franchi.", ", no threshold crossed.")}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>

          {lines.length > 10 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {tx(
                `${countOf(
                  lines.length - 10,
                  "autre alerte",
                  "autres alertes"
                )} ${plural(
                  lines.length - 10,
                  "préventive",
                  "préventives"
                )} ${plural(
                  lines.length - 10,
                  "non affichée",
                  "non affichées"
                )}.`,
                `${countOf(
                  lines.length - 10,
                  "other early warning"
                )} not shown.`
              )}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <SectionTitle note={tx("7 derniers jours", "Last 7 days")}>
            {tx("Alertes préventives", "Early warnings")}
          </SectionTitle>

          {trend.some((value) => value > 0) ? (
            <>
              <p className="font-heading text-3xl font-bold tabular-nums">
                {trend.reduce((sum, value) => sum + value, 0)}
              </p>

              <p className="text-xs text-muted-foreground">
                {tx("émises sur la période", "raised over the period")}
              </p>

              <Sparkline data={trend} className="mt-4 h-16 w-full text-brand" />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tx(
                "Aucune alerte préventive sur les 7 derniers jours. Celles affichées sont plus anciennes.",
                "No early warning in the last 7 days. The ones shown are older than that."
              )}
            </p>
          )}

          <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {tx(
                "Comment l'avance est calculée",
                "How the lead time is worked out"
              )}
            </p>

            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {tx(
                "L'écart entre l'alerte préventive et la première alerte de seuil sur le même équipement. Tant qu'aucun seuil n'est franchi, l'avance reste non mesurable plutôt qu'estimée.",
                "The gap between the early warning and the first threshold alert on the same asset. While no threshold has been crossed, the lead time stays not measurable rather than estimated."
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
