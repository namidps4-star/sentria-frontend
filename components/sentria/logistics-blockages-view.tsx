"use client"

import { useMemo, useState } from "react"
import {
  ArrowRight,
  CircleAlert,
  PackageX,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { computeConfidence, confidenceWord } from "@/lib/confidence"
import { FlowCard, FlowTrack, STAGE_ICONS } from "./flow-track"
import {
  EvidenceBar,
  NoSignal,
  SectionTitle,
  StatTile,
  TONE_CHIP,
  ViewHeader,
} from "./logistics-ui"
import {
  convergenceOf,
  deriveBreakpoints,
  deriveProjection,
  deriveStages,
  formatHours,
  globalRisk,
  hoursSince,
  leadAlert,
  countOf,
  messageAdvice,
  messageFinding,
  metricFor,
  plural,
  recurrenceOf,
  riskOf,
  sentenceCase,
  STATUS_WORDS,
  type LogisticsAlert,
  type OpsType,
  type PrimitiveId,
} from "@/lib/logistics-signals"

/* --------------------------------------------------------------------------
 * "Éviter les blocages".
 *
 * Everything on this screen is read off the alerts the backend produced:
 * which stage is blocking, how long it has been open, which assets are
 * behind it, how sure we are, and what the backend told the operator to
 * do. The previous version carried a hand-written scenario per ops type
 * (fixed risk percentages, fixed euro figures, three invented signal
 * bars) that never changed whatever the data said.
 * -------------------------------------------------------------------------- */

type LogisticsBlockagesViewProps = {
  alerts?: LogisticsAlert[]
  opsType?: OpsType
  selectedOpsTypesForMulti?: Exclude<OpsType, "multi">[]
}

export function LogisticsBlockagesView({
  alerts = [],
  opsType,
  selectedOpsTypesForMulti = [],
}: LogisticsBlockagesViewProps) {
  const [openStage, setOpenStage] = useState<PrimitiveId | null>(null)

  const stages = useMemo(
    () => deriveStages(alerts, opsType, selectedOpsTypesForMulti),
    [alerts, opsType, selectedOpsTypesForMulti]
  )

  const attributed = useMemo(
    () => stages.flatMap((stage) => stage.alerts),
    [stages]
  )

  /* The blocking stage is the worst one the data actually points at:
     a rupture first, otherwise the highest measured risk. */
  const blockingIndex = useMemo(() => {
    let best = -1
    let bestScore = -1

    stages.forEach((stage, index) => {
      if (stage.alerts.length === 0) return

      const score = (stage.status === "risk" ? 1000 : 0) + stage.risk

      if (score > bestScore) {
        bestScore = score
        best = index
      }
    })

    return best
  }, [stages])

  const blockingStage = blockingIndex >= 0 ? stages[blockingIndex] : undefined
  const lead = useMemo(() => leadAlert(blockingStage?.alerts ?? []), [blockingStage])
  const risk = globalRisk(stages)
  const breakpoints = useMemo(() => deriveBreakpoints(stages), [stages])
  const projection = useMemo(
    () => deriveProjection(lead, blockingStage),
    [lead, blockingStage]
  )

  const confidence = useMemo(() => {
    if (!lead) return null

    return computeConfidence({
      riskScore: lead.risk_score ?? null,
      severity: lead.severity,
      recurrence: recurrenceOf(lead, alerts),
      signalConvergence: convergenceOf(blockingStage),
    })
  }, [lead, alerts, blockingStage])

  const selected = openStage
    ? stages.find((stage) => stage.id === openStage)
    : undefined

  if (attributed.length === 0) {
    return (
      <div className="space-y-4">
        <ViewHeader
          eyebrow="Blocages"
          opsType={opsType}
        selectedOpsTypes={selectedOpsTypesForMulti}
          title="Aucun blocage détecté pour le moment."
          lede="Cette vue lit vos alertes logistiques. Elle reste vide jusqu'au premier fichier importé, parce qu'afficher des zéros donnerait l'impression que tout va bien."
          risk={0}
          icon={PackageX}
        />

        <NoSignal
          title="Rien à analyser pour cette activité"
          detail="Aucune alerte logistique n'a encore été enregistrée, ou aucune ne correspond aux étapes de votre chaîne."
          expected="Les colonnes attendues sont avg_wait_hours, temperature, daily_cycles, hydraulic_pressure, fuel_level et last_service_date. Importez votre CSV via le bouton Importer CSV du tableau de bord."
        />
      </div>
    )
  }

  /* How long this stage has been in trouble, which is the age of its
     OLDEST reading. Using the lead alert's own date measured the newest
     one instead, so a stage that had been alerting for 48 h reported
     "ouvert depuis 2 h" as soon as a fresher reading arrived. */
  const firstSeen =
    blockingStage && blockingStage.alerts.length > 0
      ? blockingStage.alerts.reduce(
          (oldest, alert) =>
            new Date(alert.date).getTime() < new Date(oldest.date).getTime()
              ? alert
              : oldest,
          blockingStage.alerts[0]
        )
      : null

  const openFor = firstSeen ? hoursSince(firstSeen.date) : null
  const lastSeen = lead ? hoursSince(lead.date) : null
  const criticalCount = attributed.filter((a) => a.severity === "CRITICAL").length
  const assets = new Set(attributed.map((a) => a.equipment)).size
  const downstream =
    blockingIndex >= 0 ? stages.length - blockingIndex - 1 : 0

  return (
    <div className="space-y-4">
      <ViewHeader
        eyebrow="Blocages"
        opsType={opsType}
        selectedOpsTypes={selectedOpsTypesForMulti}
        title={
          blockingStage
            ? `Le flux s'arrête sur ${blockingStage.name}.`
            : "Votre chaîne est fluide sur toutes les étapes suivies."
        }
        lede={
          blockingStage
            ? `${countOf(
                blockingStage.alerts.length,
                "signal",
                "signaux"
              )} sur cette étape, ${countOf(
                downstream,
                "étape"
              )} en aval qui en ${plural(downstream, "dépend", "dépendent")}.`
            : "Aucune étape ne présente de signal critique sur la période analysée."
        }
        risk={risk}
        icon={PackageX}
      />

      <FlowCard
        title={
          blockingStage
            ? blockingStage.name
            : "Chaîne fluide"
        }
        subtitle={
          lead
            ? messageFinding(lead)
            : "Aucune rupture mesurée sur la chaîne."
        }
        figureLabel={openFor !== null ? "Ouvert depuis" : undefined}
        figure={openFor !== null ? formatHours(openFor) : undefined}
        figureNote={
          firstSeen
            ? `Premier relevé le ${new Date(firstSeen.date).toLocaleString(
                "fr-FR",
                { dateStyle: "short", timeStyle: "short" }
              )} sur ${firstSeen.equipment}${
                lastSeen !== null
                  ? `, dernier il y a ${formatHours(lastSeen)}`
                  : ""
              }.`
            : undefined
        }
        tone={blockingStage?.status === "risk" ? "risk" : "neutral"}
        aside={
          confidence !== null ? (
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Confiance
              </p>

              <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                {confidence}%
              </p>

              <p className="text-xs text-muted-foreground">
                {confidenceWord(confidence)}
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
          onSelect={(id) => setOpenStage((current) => (current === id ? null : id))}
          selectedId={openStage}
        />

        <p className="mt-3 text-xs text-muted-foreground">
          Touchez une étape pour voir les relevés qui la concernent.
          {blockingIndex >= 0 &&
            ` Les étapes après ${stages[blockingIndex].name} attendent son déblocage.`}
        </p>
      </FlowCard>

      {selected && (
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {(() => {
                const Icon = STAGE_ICONS[selected.id]

                return (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                )
              })()}

              <div>
                <h3 className="font-heading text-lg font-bold">
                  {selected.name}
                </h3>

                <p className="text-sm text-muted-foreground">
                  {selected.alerts.length === 0
                    ? "Aucun relevé pour cette étape."
                    : `${countOf(
                        selected.alerts.length,
                        "relevé"
                      )} · risque ${selected.risk}/100`}
                </p>
              </div>
            </div>

            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                TONE_CHIP[selected.status]
              )}
            >
              {STATUS_WORDS[selected.status]}
            </span>
          </div>

          {selected.signals.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {selected.signals.slice(0, 6).map((signal, index) => (
                <EvidenceBar
                  key={`${signal.alertKey}-${signal.equipment}-${index}`}
                  label={signal.label}
                  value={signal.value}
                  percent={signal.percent}
                  tone={signal.tone}
                  source={signal.equipment}
                />
              ))}
            </div>
          )}

          {selected.alerts.length > 0 && selected.signals.length === 0 && (
            <ul className="mt-4 space-y-2">
              {selected.alerts.slice(0, 5).map((alert, index) => (
                <li
                  key={`${alert.equipment}-${index}`}
                  className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="font-semibold">{alert.equipment}</span>
                  {" · "}
                  <span className="text-muted-foreground">
                    {messageFinding(alert)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Signaux sur la chaîne"
          value={String(attributed.length)}
          note="Alertes rattachées à une étape"
          tone={attributed.length > 0 ? "watch" : "good"}
          icon={CircleAlert}
        />

        <StatTile
          label="Dont critiques"
          value={String(criticalCount)}
          note="Severité CRITICAL"
          tone={criticalCount > 0 ? "risk" : "good"}
          icon={TrendingUp}
        />

        <StatTile
          label="Équipements concernés"
          value={String(assets)}
          note="Identifiants distincts"
          tone="watch"
        />

        <StatTile
          label="Étapes en aval"
          value={String(downstream)}
          note="Dépendent du déblocage"
          tone={downstream > 0 ? "watch" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-3">
          <SectionTitle note="Classés par risque mesuré">
            Points de rupture
          </SectionTitle>

          <ul className="space-y-2">
            {breakpoints.map((bp) => (
              <li
                key={`${bp.stage}-${bp.title}`}
                className="rounded-2xl border border-border bg-muted/30 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{bp.title}</p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {bp.stageName} · {countOf(bp.equipmentCount, "équipement")} ·{" "}
                      {bp.equipment.slice(0, 2).join(", ")}
                      {bp.equipment.length > 2 &&
                        ` +${bp.equipment.length - 2}`}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums",
                      TONE_CHIP[bp.tone]
                    )}
                  >
                    {bp.risk}/100
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      bp.tone === "risk" ? "bg-destructive" : "bg-brand"
                    )}
                    style={{ width: `${bp.risk}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <SectionTitle>Ce qui se passe ensuite</SectionTitle>

          {projection.length > 0 ? (
            <ol className="space-y-3">
              {projection.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      step.measured
                        ? "bg-foreground"
                        : step.tone === "risk"
                          ? "bg-destructive"
                          : "bg-brand"
                    )}
                    aria-hidden="true"
                  />

                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {step.when}
                      {step.measured && " · mesuré"}
                    </p>

                    <p className="mt-0.5 text-sm leading-5">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pas assez de relevés pour projeter une suite.
            </p>
          )}

          {lead && messageAdvice(lead) && (
            <div className="mt-5 rounded-2xl border border-brand/40 bg-brand/10 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Action recommandée
              </p>

              <p className="mt-1.5 text-sm font-semibold leading-5">
                {sentenceCase(messageAdvice(lead))}
              </p>

              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                Sur {lead.equipment}
                {metricFor(lead) && ` · ${metricFor(lead)!.label.toLowerCase()}`}
                {` · risque ${riskOf(lead)}/100`}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export type { OpsType }
