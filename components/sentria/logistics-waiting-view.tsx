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
import { useTx } from "@/lib/i18n"

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
  const tx = useTx()

  const queues = useMemo(
    () => deriveQueues(alerts, opsType, tx, selectedOpsTypesForMulti),
    [alerts, opsType, tx, selectedOpsTypesForMulti]
  )

  const stages = useMemo(
    () => deriveStages(alerts, opsType, tx, selectedOpsTypesForMulti),
    [alerts, opsType, tx, selectedOpsTypesForMulti]
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
          eyebrow={tx("Temps d'attente", "Waiting time")}
          opsType={opsType}
          selectedOpsTypes={selectedOpsTypesForMulti}
          title={tx(
            "Aucun temps d'attente mesuré.",
            "No waiting time measured."
          )}
          lede={tx(
            "Cette vue ne montre que des durées relevées par vos équipements. Elle reste vide tant qu'aucune n'a été enregistrée.",
            "This view only shows durations your equipment actually reported. It stays empty until one is recorded."
          )}
          risk={0}
          icon={Clock3}
        />

        <NoSignal
          title={tx("Aucune file mesurée", "No queue measured")}
          detail={tx(
            "Aucune alerte de type temps d'attente n'a été enregistrée pour cette activité.",
            "No waiting-time alert has been recorded for this activity."
          )}
          expected={tx(
            "La colonne attendue est avg_wait_hours. Au-delà de 4 h SentrIA émet un avertissement, au-delà de 8 h une alerte critique.",
            "The expected column is avg_wait_hours. Past 4 h SentrIA raises a warning, past 8 h a critical alert."
          )}
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
        eyebrow={tx("Temps d'attente", "Waiting time")}
        opsType={opsType}
        selectedOpsTypes={selectedOpsTypesForMulti}
        title={tx(
          `${worst.equipment} immobilise la file depuis ${formatHours(
            worst.hours
          )}.`,
          `${worst.equipment} has been holding the queue for ${formatHours(
            worst.hours
          )}.`
        )}
        lede={tx(
          `${countOf(queues.length, "file")} ${plural(
            queues.length,
            "mesurée",
            "mesurées"
          )}, ${overThreshold.length} au-delà du seuil de ${WAIT_THRESHOLD_HOURS} h.`,
          `${countOf(queues.length, "queue")} measured, ${
            overThreshold.length
          } past the ${WAIT_THRESHOLD_HOURS} h threshold.`
        )}
        risk={risk}
        icon={Clock3}
      />

      <FlowCard
        title={worst.stageName}
        subtitle={tx(
          `File la plus longue de la chaîne, sur ${worst.equipment}.`,
          `The longest queue on the chain, at ${worst.equipment}.`
        )}
        figureLabel={tx("Attente mesurée", "Measured wait")}
        figure={formatClock(worst.hours)}
        figureNote={
          openFor !== null
            ? tx(
                `Relevé il y a ${formatHours(
                  openFor
                )} · seuil critique à ${WAIT_THRESHOLD_HOURS} h.`,
                `Recorded ${formatHours(
                  openFor
                )} ago · critical threshold at ${WAIT_THRESHOLD_HOURS} h.`
              )
            : undefined
        }
        tone={worst.hours > WAIT_THRESHOLD_HOURS ? "risk" : "neutral"}
        aside={
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {tx("Heures au-delà du seuil", "Hours past the threshold")}
            </p>

            <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
              {Math.round(billableHours * 10) / 10}
            </p>

            <p className="text-xs text-muted-foreground">
              {tx(
                `cumulées sur ${countOf(overThreshold.length, "file")}`,
                `across ${countOf(overThreshold.length, "queue")}`
              )}
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
            ? tx(
                `La file se forme sur ${stages[blockingIndex].name}. Les étapes suivantes attendent son écoulement.`,
                `The queue forms at ${stages[blockingIndex].name}. The stages after it are waiting for it to clear.`
              )
            : tx(
                "Les files mesurées ne sont rattachées à aucune étape de cette chaîne.",
                "The measured queues are not attached to any stage of this chain."
              )}
        </p>
      </FlowCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={tx("File la plus longue", "Longest queue")}
          value={formatHours(maxHours)}
          note={worst.equipment}
          tone={maxHours > WAIT_THRESHOLD_HOURS ? "risk" : "watch"}
          icon={Hourglass}
        />

        <StatTile
          label={tx("Attente moyenne", "Average wait")}
          value={formatHours(average)}
          note={tx(
            `Sur ${countOf(queues.length, "relevé")}`,
            `Across ${countOf(queues.length, "reading")}`
          )}
          tone={average > WAIT_THRESHOLD_HOURS ? "risk" : "watch"}
          icon={Timer}
        />

        <StatTile
          label={tx("Files au-delà du seuil", "Queues over threshold")}
          value={`${overThreshold.length}`}
          unit={`/ ${queues.length}`}
          note={tx(
            `Seuil ${WAIT_THRESHOLD_HOURS} h`,
            `Threshold ${WAIT_THRESHOLD_HOURS} h`
          )}
          tone={overThreshold.length > 0 ? "risk" : "good"}
        />

        <StatTile
          label={tx("Heures cumulées", "Hours in total")}
          value={String(Math.round(total))}
          unit="h"
          note={tx(
            "Somme des attentes relevées",
            "The sum of the waits recorded"
          )}
          tone="watch"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-3">
          <SectionTitle
            note={tx(
              `Seuil critique ${WAIT_THRESHOLD_HOURS} h`,
              `Critical threshold ${WAIT_THRESHOLD_HOURS} h`
            )}
          >
            {tx("Files mesurées", "Queues measured")}
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
              {tx(
                `${countOf(
                  queues.length - 8,
                  "autre file",
                  "autres files"
                )} ${plural(
                  queues.length - 8,
                  "mesurée",
                  "mesurées"
                )}, plus ${plural(
                  queues.length - 8,
                  "courte",
                  "courtes"
                )}.`,
                `${countOf(
                  queues.length - 8,
                  "other queue"
                )} measured, shorter than these.`
              )}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <SectionTitle note={tx("7 derniers jours", "Last 7 days")}>
            {tx("Alertes d'attente", "Waiting alerts")}
          </SectionTitle>

          {trend.some((value) => value > 0) ? (
            <>
              <p className="font-heading text-3xl font-bold tabular-nums">
                {trend.reduce((sum, value) => sum + value, 0)}
              </p>

              <p className="text-xs text-muted-foreground">
                {tx(
                  "alertes de temps d'attente sur la période",
                  "waiting-time alerts over the period"
                )}
              </p>

              <Sparkline
                data={trend}
                className="mt-4 h-16 w-full text-destructive"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tx(
                "Aucune alerte d'attente sur les 7 derniers jours. Les relevés affichés sont plus anciens.",
                "No waiting alert in the last 7 days. The readings shown are older than that."
              )}
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
