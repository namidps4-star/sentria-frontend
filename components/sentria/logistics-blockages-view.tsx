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
import { useTx } from "@/lib/i18n"

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
  const tx = useTx()

  const [openStage, setOpenStage] = useState<PrimitiveId | null>(null)

  const stages = useMemo(
    () => deriveStages(alerts, opsType, tx, selectedOpsTypesForMulti),
    [alerts, opsType, tx, selectedOpsTypesForMulti]
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
  const breakpoints = useMemo(
    () => deriveBreakpoints(stages, tx),
    [stages, tx]
  )
  const projection = useMemo(
    () => deriveProjection(lead, blockingStage, tx),
    [lead, blockingStage, tx]
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
          eyebrow={tx("Blocages", "Blockages")}
          opsType={opsType}
          selectedOpsTypes={selectedOpsTypesForMulti}
          title={tx(
            "Aucun blocage détecté pour le moment.",
            "No blockage detected so far."
          )}
          lede={tx(
            "Cette vue lit vos alertes logistiques. Elle reste vide jusqu'au premier fichier importé, parce qu'afficher des zéros donnerait l'impression que tout va bien.",
            "This view reads your logistics alerts. It stays empty until the first file is imported, because showing zeroes would read as all clear."
          )}
          risk={0}
          icon={PackageX}
        />

        <NoSignal
          title={tx(
            "Rien à analyser pour cette activité",
            "Nothing to analyse for this activity"
          )}
          detail={tx(
            "Aucune alerte logistique n'a encore été enregistrée, ou aucune ne correspond aux étapes de votre chaîne.",
            "No logistics alert has been recorded yet, or none matches a stage of your chain."
          )}
          expected={tx(
            "Les colonnes attendues sont avg_wait_hours, temperature, daily_cycles, hydraulic_pressure, fuel_level et last_service_date. Importez votre CSV via le bouton Importer CSV du tableau de bord.",
            "The expected columns are avg_wait_hours, temperature, daily_cycles, hydraulic_pressure, fuel_level and last_service_date. Import your CSV with the Import CSV button on the dashboard."
          )}
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
        eyebrow={tx("Blocages", "Blockages")}
        opsType={opsType}
        selectedOpsTypes={selectedOpsTypesForMulti}
        title={
          blockingStage
            ? tx(
                `Le flux s'arrête sur ${blockingStage.name}.`,
                `The flow stops at ${blockingStage.name}.`
              )
            : tx(
                "Votre chaîne est fluide sur toutes les étapes suivies.",
                "Your chain is running clear at every stage being followed."
              )
        }
        lede={
          blockingStage
            ? tx(
                `${countOf(
                  blockingStage.alerts.length,
                  "signal",
                  "signaux"
                )} sur cette étape, ${countOf(
                  downstream,
                  "étape"
                )} en aval qui en ${plural(
                  downstream,
                  "dépend",
                  "dépendent"
                )}.`,
                `${countOf(
                  blockingStage.alerts.length,
                  "signal"
                )} at this stage, ${countOf(
                  downstream,
                  "stage"
                )} downstream ${plural(
                  downstream,
                  "depends",
                  "depend"
                )} on it.`
              )
            : tx(
                "Aucune étape ne présente de signal critique sur la période analysée.",
                "No stage shows a critical signal over the period analysed."
              )
        }
        risk={risk}
        icon={PackageX}
      />

      <FlowCard
        title={
          blockingStage
            ? blockingStage.name
            : tx("Chaîne fluide", "Chain running clear")
        }
        subtitle={
          lead
            ? messageFinding(lead)
            : tx(
                "Aucune rupture mesurée sur la chaîne.",
                "No breakdown measured anywhere on the chain."
              )
        }
        figureLabel={
          openFor !== null ? tx("Ouvert depuis", "Open for") : undefined
        }
        figure={openFor !== null ? formatHours(openFor) : undefined}
        figureNote={
          firstSeen
            ? (() => {
                const when = new Date(firstSeen.date).toLocaleString(
                  tx("fr-FR", "en-GB"),
                  { dateStyle: "short", timeStyle: "short" }
                )

                return tx(
                  `Premier relevé le ${when} sur ${firstSeen.equipment}${
                    lastSeen !== null
                      ? `, dernier il y a ${formatHours(lastSeen)}`
                      : ""
                  }.`,
                  `First reading on ${when} at ${firstSeen.equipment}${
                    lastSeen !== null
                      ? `, latest ${formatHours(lastSeen)} ago`
                      : ""
                  }.`
                )
              })()
            : undefined
        }
        tone={blockingStage?.status === "risk" ? "risk" : "neutral"}
        aside={
          confidence !== null ? (
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tx("Confiance", "Confidence")}
              </p>

              <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                {confidence}%
              </p>

              <p className="text-xs text-muted-foreground">
                {confidenceWord(confidence, tx)}
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
          {tx(
            "Touchez une étape pour voir les relevés qui la concernent.",
            "Tap a stage to see the readings that belong to it."
          )}
          {blockingIndex >= 0 &&
            tx(
              ` Les étapes après ${stages[blockingIndex].name} attendent son déblocage.`,
              ` The stages after ${stages[blockingIndex].name} are waiting on it.`
            )}
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
                    ? tx(
                        "Aucun relevé pour cette étape.",
                        "No reading for this stage."
                      )
                    : tx(
                        `${countOf(
                          selected.alerts.length,
                          "relevé"
                        )} · risque ${selected.risk}/100`,
                        `${countOf(
                          selected.alerts.length,
                          "reading"
                        )} · risk ${selected.risk}/100`
                      )}
                </p>
              </div>
            </div>

            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                TONE_CHIP[selected.status]
              )}
            >
              {tx(
                STATUS_WORDS[selected.status].fr,
                STATUS_WORDS[selected.status].en
              )}
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
          label={tx("Signaux sur la chaîne", "Signals on the chain")}
          value={String(attributed.length)}
          note={tx(
            "Alertes rattachées à une étape",
            "Alerts attached to a stage"
          )}
          tone={attributed.length > 0 ? "watch" : "good"}
          icon={CircleAlert}
        />

        <StatTile
          label={tx("Dont critiques", "Of which critical")}
          value={String(criticalCount)}
          note={tx("Severité CRITICAL", "CRITICAL severity")}
          tone={criticalCount > 0 ? "risk" : "good"}
          icon={TrendingUp}
        />

        <StatTile
          label={tx("Équipements concernés", "Assets affected")}
          value={String(assets)}
          note={tx("Identifiants distincts", "Distinct identifiers")}
          tone="watch"
        />

        <StatTile
          label={tx("Étapes en aval", "Stages downstream")}
          value={String(downstream)}
          note={tx("Dépendent du déblocage", "Waiting on this to clear")}
          tone={downstream > 0 ? "watch" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-3">
          <SectionTitle note={tx("Classés par risque mesuré", "Ranked by measured risk")}>
            {tx("Points de rupture", "Breaking points")}
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
                      {bp.stageName} ·{" "}
                      {tx(
                        countOf(bp.equipmentCount, "équipement"),
                        countOf(bp.equipmentCount, "asset")
                      )}{" "}
                      ·{" "}
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
          <SectionTitle>
            {tx("Ce qui se passe ensuite", "What happens next")}
          </SectionTitle>

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
                      {step.measured && tx(" · mesuré", " · measured")}
                    </p>

                    <p className="mt-0.5 text-sm leading-5">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tx(
                "Pas assez de relevés pour projeter une suite.",
                "Not enough readings to project what comes next."
              )}
            </p>
          )}

          {lead && messageAdvice(lead) && (
            <div className="mt-5 rounded-2xl border border-brand/40 bg-brand/10 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {tx("Action recommandée", "Recommended action")}
              </p>

              <p className="mt-1.5 text-sm font-semibold leading-5">
                {sentenceCase(messageAdvice(lead))}
              </p>

              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                {tx("Sur", "On")} {lead.equipment}
                {metricFor(lead) &&
                  ` · ${tx(
                    metricFor(lead)!.label.fr,
                    metricFor(lead)!.label.en
                  ).toLowerCase()}`}
                {tx(
                  ` · risque ${riskOf(lead)}/100`,
                  ` · risk ${riskOf(lead)}/100`
                )}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export type { OpsType }
