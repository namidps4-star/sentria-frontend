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
  const lines = useMemo(
    () => deriveAnticipation(alerts, opsType, selectedOpsTypesForMulti),
    [alerts, opsType, selectedOpsTypesForMulti]
  )

  const stages = useMemo(
    () => deriveStages(alerts, opsType, selectedOpsTypesForMulti),
    [alerts, opsType, selectedOpsTypesForMulti]
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
          eyebrow="Anticipation"
          opsType={opsType}
        selectedOpsTypes={selectedOpsTypesForMulti}
          title="Aucune alerte préventive enregistrée."
          lede="Cette vue mesure l'avance réelle de SentrIA : le temps entre son alerte préventive et le moment où un seuil a effectivement été franchi. Sans alerte préventive, il n'y a pas d'avance à mesurer."
          risk={0}
          icon={Radar}
        />

        <NoSignal
          title="Rien à mesurer pour l'instant"
          detail="SentrIA émet une alerte préventive quand plusieurs signaux faibles se combinent sans qu'aucun seuil ne soit encore franchi (score composite au-delà de 55)."
          expected="Plus votre CSV contient de colonnes suivies en même temps (attente, température, cycles, pression, carburant, entretien), plus le score composite peut se déclencher tôt."
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
        eyebrow="Anticipation"
        opsType={opsType}
        selectedOpsTypes={selectedOpsTypesForMulti}
        title={
          bestLead
            ? `Prévenu ${formatHours(
                bestLead.leadHours ?? 0
              )} avant le franchissement.`
            : `${countOf(watching.length, "alerte")} ${plural(
                watching.length,
                "préventive",
                "préventives"
              )} en cours.`
        }
        lede={
          bestLead
            ? `${countOf(confirmed.length, "alerte")} ${plural(
                confirmed.length,
                "préventive",
                "préventives"
              )} ${plural(
                confirmed.length,
                "confirmée",
                "confirmées"
              )} ensuite par un seuil, ${watching.length} encore sous surveillance.`
            : "Aucune n'a encore été confirmée par le franchissement d'un seuil. L'avance ne sera mesurable qu'à ce moment."
        }
        risk={risk}
        icon={Radar}
      />

      <FlowCard
        title={bestLead ? bestLead.stageName : "Sous surveillance"}
        subtitle={
          bestLead
            ? `${bestLead.equipment} : alerte préventive, puis ${
                bestLead.confirmedBy?.toLowerCase() ?? "franchissement"
              } confirmé.`
            : `${countOf(watching.length, "équipement")} ${plural(
                watching.length,
                "signalé",
                "signalés"
              )} par le score composite, avant tout franchissement de seuil.`
        }
        figureLabel={bestLead ? "Avance mesurée" : "Ouvert depuis"}
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
            ? `Alerte le ${new Date(bestLead.warnedAt).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              })}, seuil franchi le ${new Date(
                bestLead.confirmedAt!
              ).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              })}.`
            : "Aucun seuil franchi depuis l'alerte préventive."
        }
        aside={
          averageLead !== null ? (
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Avance moyenne
              </p>

              <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                {formatHours(averageLead)}
              </p>

              <p className="text-xs text-muted-foreground">
                sur {countOf(confirmed.length, "cas", "cas")}{" "}
                {plural(confirmed.length, "confirmé", "confirmés")}
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
            ? `L'alerte préventive la plus en avance portait sur ${stages[blockingIndex].name}.`
            : "Les alertes préventives ne sont rattachées à aucune étape de cette chaîne."}
        </p>
      </FlowCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Alertes préventives"
          value={String(lines.length)}
          note="Score composite au-delà de 55"
          tone="watch"
          icon={Radar}
        />

        <StatTile
          label="Confirmées ensuite"
          value={String(confirmed.length)}
          note="Un seuil a été franchi après"
          tone={confirmed.length > 0 ? "risk" : "good"}
          icon={CheckCircle2}
        />

        <StatTile
          label="Encore sous surveillance"
          value={String(watching.length)}
          note="Aucun seuil franchi à ce jour"
          tone="watch"
          icon={Eye}
        />

        <StatTile
          label="Avance moyenne"
          value={averageLead !== null ? formatHours(averageLead) : "Non mesurable"}
          note={
            averageLead !== null
              ? `Sur ${confirmed.length} cas`
              : "Aucune confirmation encore"
          }
          tone="good"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-3">
          <SectionTitle note="Avance la plus longue en premier">
            Chaque alerte préventive
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
                      {line.stageName} · risque {line.warnedRisk}/100 · alerte
                      le{" "}
                      {new Date(line.warnedAt).toLocaleDateString("fr-FR", {
                        dateStyle: "short",
                      })}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold",
                      TONE_CHIP[line.leadHours !== null ? "risk" : "watch"]
                    )}
                  >
                    {line.leadHours !== null
                      ? `${formatHours(line.leadHours)} d'avance`
                      : "Sous surveillance"}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {line.leadHours !== null ? (
                    <>
                      Confirmé ensuite par{" "}
                      <span className="font-semibold text-foreground">
                        {line.confirmedBy?.toLowerCase() ?? "un franchissement"}
                      </span>
                      {line.confirmedSeverity === "CRITICAL" && " (critique)"}.
                    </>
                  ) : (
                    <>
                      Ouvert depuis{" "}
                      <span className="font-semibold text-foreground">
                        {line.openHours !== null
                          ? formatHours(line.openHours)
                          : "une durée inconnue"}
                      </span>
                      , aucun seuil franchi.
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>

          {lines.length > 10 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {countOf(lines.length - 10, "autre alerte", "autres alertes")}{" "}
              {plural(lines.length - 10, "préventive", "préventives")}{" "}
              {plural(lines.length - 10, "non affichée", "non affichées")}.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <SectionTitle note="7 derniers jours">
            Alertes préventives
          </SectionTitle>

          {trend.some((value) => value > 0) ? (
            <>
              <p className="font-heading text-3xl font-bold tabular-nums">
                {trend.reduce((sum, value) => sum + value, 0)}
              </p>

              <p className="text-xs text-muted-foreground">
                émises sur la période
              </p>

              <Sparkline data={trend} className="mt-4 h-16 w-full text-brand" />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune alerte préventive sur les 7 derniers jours. Celles
              affichées sont plus anciennes.
            </p>
          )}

          <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Comment l&apos;avance est calculée
            </p>

            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              L&apos;écart entre l&apos;alerte préventive et la première
              alerte de seuil sur le même équipement. Tant qu&apos;aucun
              seuil n&apos;est franchi, l&apos;avance reste non mesurable
              plutôt qu&apos;estimée.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
