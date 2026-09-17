"use client"

import { useMemo } from "react"
import { Clock3, Hourglass, Timer, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sparkline } from "./charts"
import { FlowCard, FlowTrack } from "./flow-track"
import {
  EvidenceBar,
  NoSignal,
  SectionTitle,
  StatTile,
  TONE_CHIP,
  ViewHeader,
} from "./logistics-ui"
import {
  countOf,
  dailyCounts,
  deriveQueues,
  deriveStages,
  formatClock,
  formatHours,
  globalRisk,
  hoursSince,
  metricFor,
  sentenceCase,
  plural,
  type LogisticsAlert,
  type OpsType,
} from "@/lib/logistics-signals"

/* --------------------------------------------------------------------------
 * "Réduire les temps d'attente".
 *
 * Reads the wait measurements the backend recorded (logistics.wait.*),
 * which carry the real hours in their message. The previous version
 * cycled through three written scenarios on a four-second timer and
 * derived its bar heights from the tick counter, so the queue lengths
 * moved on screen while the data behind them never changed.
 * -------------------------------------------------------------------------- */

const WAIT_THRESHOLD_HOURS = 8

type LogisticsWaitingViewProps = {
  alerts?: LogisticsAlert[]
  opsType?: OpsType
  selectedOpsTypesForMulti?: Exclude<OpsType, "multi">[]
}

export function LogisticsWaitingView({
  alerts = [],
  opsType,
  selectedOpsTypesForMulti = [],
}: LogisticsWaitingViewProps) {
  const queues = useMemo(() => deriveQueues(alerts, opsType), [alerts, opsType])

  const stages = useMemo(
    () => deriveStages(alerts, opsType, selectedOpsTypesForMulti),
    [alerts, opsType, selectedOpsTypesForMulti]
  )

  /* The blocking stage here is the one holding the longest queue, which
     is a different question from the blockages view's worst risk. */
  const blockingIndex = useMemo(() => {
    if (queues.length === 0) return -1

    return stages.findIndex((stage) => stage.id === queues[0].stage)
  }, [stages, queues])

  const trend = useMemo(
    () =>
      dailyCounts(alerts, 7, (alert) => metricFor(alert)?.kind === "wait"),
    [alerts]
  )

  if (queues.length === 0) {
    return (
      <div className="space-y-4">
        <ViewHeader
          eyebrow="Temps d'attente"
          opsType={opsType}
          title="Aucun temps d'attente mesuré."
          lede="Cette vue ne montre que des durées relevées par vos équipements. Elle reste vide tant qu'aucune n'a été enregistrée."
          risk={0}
          icon={Clock3}
        />

        <NoSignal
          title="Aucune file mesurée"
          detail="Aucune alerte de type temps d'attente n'a été enregistrée pour cette activité."
          expected="La colonne attendue est avg_wait_hours. Au-delà de 4 h SentrIA émet un avertissement, au-delà de 8 h une alerte critique."
        />
      </div>
    )
  }

  const worst = queues[0]
  const total = queues.reduce((sum, line) => sum + line.hours, 0)
  const average = total / queues.length
  const overThreshold = queues.filter((q) => q.hours > WAIT_THRESHOLD_HOURS)
  const billableHours = overThreshold.reduce(
    (sum, line) => sum + (line.hours - WAIT_THRESHOLD_HOURS),
    0
  )
  const maxHours = Math.max(...queues.map((q) => q.hours))
  const risk = globalRisk(stages)
  const openFor = hoursSince(worst.date)

  return (
    <div className="space-y-4">
      <ViewHeader
        eyebrow="Temps d'attente"
        opsType={opsType}
        title={`${worst.equipment} immobilise la file depuis ${formatHours(
          worst.hours
        )}.`}
        lede={`${countOf(queues.length, "file")} ${plural(
          queues.length,
          "mesurée",
          "mesurées"
        )}, ${overThreshold.length} au-delà du seuil de ${WAIT_THRESHOLD_HOURS} h.`}
        risk={risk}
        icon={Clock3}
      />

      <FlowCard
        title={worst.stageName}
        subtitle={`File la plus longue de la chaîne, sur ${worst.equipment}.`}
        figureLabel="Attente mesurée"
        figure={formatClock(worst.hours)}
        figureNote={
          openFor !== null
            ? `Relevé il y a ${formatHours(openFor)} · seuil critique à ${
                WAIT_THRESHOLD_HOURS
              } h.`
            : undefined
        }
        tone={worst.hours > WAIT_THRESHOLD_HOURS ? "risk" : "neutral"}
        aside={
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Heures au-delà du seuil
            </p>

            <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
              {Math.round(billableHours * 10) / 10}
            </p>

            <p className="text-xs text-muted-foreground">
              cumulées sur {countOf(overThreshold.length, "file")}
            </p>
          </div>
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
            ? `La file se forme sur ${stages[blockingIndex].name}. Les étapes suivantes attendent son écoulement.`
            : "Les files mesurées ne sont rattachées à aucune étape de cette chaîne."}
        </p>
      </FlowCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="File la plus longue"
          value={formatHours(maxHours)}
          note={worst.equipment}
          tone={maxHours > WAIT_THRESHOLD_HOURS ? "risk" : "watch"}
          icon={Hourglass}
        />

        <StatTile
          label="Attente moyenne"
          value={formatHours(average)}
          note={`Sur ${countOf(queues.length, "relevé")}`}
          tone={average > WAIT_THRESHOLD_HOURS ? "risk" : "watch"}
          icon={Timer}
        />

        <StatTile
          label="Files au-delà du seuil"
          value={`${overThreshold.length}`}
          unit={`/ ${queues.length}`}
          note={`Seuil ${WAIT_THRESHOLD_HOURS} h`}
          tone={overThreshold.length > 0 ? "risk" : "good"}
        />

        <StatTile
          label="Heures cumulées"
          value={String(Math.round(total))}
          unit="h"
          note="Somme des attentes relevées"
          tone="watch"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-3">
          <SectionTitle note={`Seuil critique ${WAIT_THRESHOLD_HOURS} h`}>
            Files mesurées
          </SectionTitle>

          <div className="space-y-4">
            {queues.slice(0, 8).map((line, index) => (
              <div key={`${line.equipment}-${index}`}>
                <EvidenceBar
                  label={`${line.equipment} · ${line.stageName}`}
                  value={formatHours(line.hours)}
                  percent={(line.hours / Math.max(maxHours, WAIT_THRESHOLD_HOURS)) * 100}
                  tone={line.hours > WAIT_THRESHOLD_HOURS ? "risk" : "watch"}
                />

                {line.advice && (
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {sentenceCase(line.advice)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {queues.length > 8 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {countOf(queues.length - 8, "autre file", "autres files")}{" "}
              {plural(queues.length - 8, "mesurée", "mesurées")}, plus{" "}
              {plural(queues.length - 8, "courte", "courtes")}.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <SectionTitle note="7 derniers jours">
            Alertes d&apos;attente
          </SectionTitle>

          {trend.some((value) => value > 0) ? (
            <>
              <p className="font-heading text-3xl font-bold tabular-nums">
                {trend.reduce((sum, value) => sum + value, 0)}
              </p>

              <p className="text-xs text-muted-foreground">
                alertes de temps d&apos;attente sur la période
              </p>

              <Sparkline
                data={trend}
                className="mt-4 h-16 w-full text-destructive"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune alerte d&apos;attente sur les 7 derniers jours. Les
              relevés affichés sont plus anciens.
            </p>
          )}

          <div className="mt-5 space-y-2">
            {queues.slice(0, 3).map((line, index) => (
              <div
                key={`top-${line.equipment}-${index}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2"
              >
                <span className="min-w-0 truncate text-xs font-semibold">
                  {line.equipment}
                </span>

                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums",
                    TONE_CHIP[line.hours > WAIT_THRESHOLD_HOURS ? "risk" : "watch"]
                  )}
                >
                  {formatHours(line.hours)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
