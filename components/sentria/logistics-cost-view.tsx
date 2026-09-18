"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CircleDollarSign,
  Info,
  Pencil,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
  DEFAULT_COST_RATES,
  deriveExposure,
  deriveStages,
  formatEuros,
  globalRisk,
  RATE_LABELS,
  RATE_UNITS,
  type CostRates,
  plural,
  type LogisticsAlert,
  type OpsType,
} from "@/lib/logistics-signals"

/* --------------------------------------------------------------------------
 * "Réduire les coûts imprévus".
 *
 * The overruns are measured: each line is an alert whose reading went
 * past its threshold, and the overrun is the part past it. The euro
 * figure is not measured, and this screen says so out loud. The rate
 * per unit is an assumption the operator owns, shown next to the
 * result and editable, with the arithmetic printed on every line.
 *
 * The previous version invented both halves: fixed euro rates buried in
 * a config object, and a setInterval that nudged the elapsed time every
 * four seconds so the total would visibly move.
 * -------------------------------------------------------------------------- */

const RATES_KEY = "sentria_cost_rates"

function readRates(): CostRates {
  if (typeof window === "undefined") return DEFAULT_COST_RATES

  try {
    const stored = JSON.parse(localStorage.getItem(RATES_KEY) || "null")

    if (!stored || typeof stored !== "object") return DEFAULT_COST_RATES

    const merged = { ...DEFAULT_COST_RATES }

    for (const key of Object.keys(DEFAULT_COST_RATES) as (keyof CostRates)[]) {
      const value = Number(stored[key])

      if (Number.isFinite(value) && value >= 0) merged[key] = value
    }

    return merged
  } catch {
    return DEFAULT_COST_RATES
  }
}

type LogisticsCostViewProps = {
  alerts?: LogisticsAlert[]
  opsType?: OpsType
  selectedOpsTypesForMulti?: Exclude<OpsType, "multi">[]
}

export function LogisticsCostView({
  alerts = [],
  opsType,
  selectedOpsTypesForMulti = [],
}: LogisticsCostViewProps) {
  const [rates, setRates] = useState<CostRates>(DEFAULT_COST_RATES)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setRates(readRates())
  }, [])

  function updateRate(key: keyof CostRates, value: number) {
    setRates((current) => {
      const next = { ...current, [key]: value }

      try {
        localStorage.setItem(RATES_KEY, JSON.stringify(next))
      } catch {
        /* A blocked localStorage must not break the view. */
      }

      return next
    })
  }

  function resetRates() {
    setRates(DEFAULT_COST_RATES)

    try {
      localStorage.removeItem(RATES_KEY)
    } catch {
      /* ignore */
    }
  }

  const lines = useMemo(
    () => deriveExposure(alerts, opsType, rates, selectedOpsTypesForMulti),
    [alerts, opsType, rates, selectedOpsTypesForMulti]
  )

  const stages = useMemo(
    () => deriveStages(alerts, opsType, selectedOpsTypesForMulti),
    [alerts, opsType, selectedOpsTypesForMulti]
  )

  const blockingIndex = useMemo(() => {
    if (lines.length === 0) return -1

    return stages.findIndex((stage) => stage.id === lines[0].stage)
  }, [stages, lines])

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        <ViewHeader
          eyebrow="Coûts"
          opsType={opsType}
        selectedOpsTypes={selectedOpsTypesForMulti}
          title="Aucun dépassement facturable mesuré."
          lede="Cette vue ne chiffre que des dépassements réels. Tant qu'aucun relevé ne franchit son seuil, il n'y a rien à chiffrer."
          risk={0}
          icon={CircleDollarSign}
        />

        <NoSignal
          title="Aucune exposition à chiffrer"
          detail="Aucune alerte n'a franchi un seuil facturable pour cette activité : ni immobilisation au-delà de 8 h, ni écart de température, ni sur-utilisation, ni entretien différé."
          expected="Les colonnes attendues sont avg_wait_hours, temperature, daily_cycles et last_service_date."
        />
      </div>
    )
  }

  const totalExposure = lines.reduce((sum, line) => sum + line.exposure, 0)
  const critical = lines.filter((line) => line.severity === "CRITICAL")
  const criticalExposure = critical.reduce((sum, line) => sum + line.exposure, 0)
  const worst = lines[0]
  const risk = globalRisk(stages)

  const byKind = (Object.keys(RATE_LABELS) as (keyof CostRates)[])
    .map((kind) => {
      const kindLines = lines.filter((line) => line.kind === kind)

      return {
        kind,
        count: kindLines.length,
        overrun: kindLines.reduce((sum, line) => sum + line.overrun, 0),
        exposure: kindLines.reduce((sum, line) => sum + line.exposure, 0),
      }
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.exposure - a.exposure)

  return (
    <div className="space-y-4">
      <ViewHeader
        eyebrow="Coûts"
        opsType={opsType}
        selectedOpsTypes={selectedOpsTypesForMulti}
        title={`${countOf(
          lines.length,
          "dépassement"
        )} au-delà de leur seuil.`}
        lede={`Le plus coûteux est ${worst.equipment} sur ${worst.stageName} : ${worst.overrun} ${worst.unit} au-delà du seuil.`}
        risk={risk}
        icon={CircleDollarSign}
      />

      <FlowCard
        title={worst.stageName}
        subtitle={`${worst.kindLabel} à ${worst.measured} ${worst.unit} sur ${worst.equipment}.`}
        figureLabel="Exposition estimée, tous dépassements"
        figure={`${formatEuros(totalExposure)} €`}
        figureNote="Estimation, pas un montant facturé : dépassement mesuré multiplié par vos taux, détaillés ci-dessous."
        tone={critical.length > 0 ? "risk" : "neutral"}
        aside={
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dont critiques
            </p>

            <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
              {formatEuros(criticalExposure)} €
            </p>

            <p className="text-xs text-muted-foreground">
              sur {countOf(critical.length, "ligne")}
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
            ? `Le poste le plus coûteux se situe sur ${stages[blockingIndex].name}.`
            : "Les dépassements ne sont rattachés à aucune étape de cette chaîne."}
        </p>
      </FlowCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Exposition totale"
          value={`${formatEuros(totalExposure)} €`}
          note="Estimation à partir de vos taux"
          tone="risk"
          icon={TrendingUp}
        />

        <StatTile
          label="Lignes en dépassement"
          value={String(lines.length)}
          note="Relevés au-delà du seuil"
          tone="watch"
        />

        <StatTile
          label="Poste le plus lourd"
          value={`${formatEuros(worst.exposure)} €`}
          note={`${worst.equipment} · ${worst.kindLabel.toLowerCase()}`}
          tone="risk"
        />

        <StatTile
          label="Part critique"
          value={`${formatEuros(criticalExposure)} €`}
          note="Portée par des alertes CRITICAL"
          tone="watch"
          icon={TrendingDown}
        />
      </div>

      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle note="Dépassement mesuré × votre taux">
            Détail du chiffrage
          </SectionTitle>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              {editing ? "Masquer les taux" : "Régler mes taux"}
            </button>

            {editing && (
              <button
                type="button"
                onClick={resetRates}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Valeurs par défaut
              </button>
            )}
          </div>
        </div>

        <p className="flex items-start gap-1.5 rounded-2xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Les dépassements viennent de vos relevés. Les euros viennent des
          taux ci-dessous, qui sont des hypothèses que vous contrôlez :
          SentrIA ne mesure pas votre facturation.
        </p>

        {editing && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(RATE_LABELS) as (keyof CostRates)[]).map((key) => (
              <label
                key={key}
                className="rounded-2xl border border-border bg-muted/30 p-3"
              >
                <span className="block text-xs font-semibold">
                  {RATE_LABELS[key]}
                </span>

                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {RATE_UNITS[key]}
                </span>

                <input
                  type="number"
                  min={0}
                  step={1}
                  value={rates[key]}
                  onChange={(event) =>
                    updateRate(key, Math.max(0, Number(event.target.value) || 0))
                  }
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-bold tabular-nums"
                />
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Équipement
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Étape
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Relevé
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Dépassement
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Taux
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Exposition
                </th>
              </tr>
            </thead>

            <tbody>
              {lines.slice(0, 12).map((line, index) => (
                <tr
                  key={`${line.equipment}-${line.alertKey}-${index}`}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold">{line.equipment}</span>

                    {line.severity === "CRITICAL" && (
                      <span
                        className={cn(
                          "ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
                          TONE_CHIP.risk
                        )}
                      >
                        Critique
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {line.stageName}
                  </td>

                  <td className="py-2.5 pr-3 tabular-nums">
                    {line.measured} {line.unit}
                  </td>

                  <td className="py-2.5 pr-3 tabular-nums">
                    {line.overrun} {line.unit}
                  </td>

                  <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                    × {line.ratePerUnit} €
                  </td>

                  <td className="py-2.5 text-right font-bold tabular-nums">
                    {formatEuros(line.exposure)} €
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={5} className="pt-3 text-xs text-muted-foreground">
                  {lines.length > 12
                    ? `12 lignes sur ${lines.length} affichées, les plus coûteuses.`
                    : `${countOf(lines.length, "ligne")}.`}
                </td>

                <td className="pt-3 text-right font-heading text-lg font-bold tabular-nums">
                  {formatEuros(totalExposure)} €
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6">
        <SectionTitle note="Par nature de dépassement">
          Où part l&apos;argent
        </SectionTitle>

        <div className="space-y-4">
          {byKind.map((entry) => (
            <div key={entry.kind}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">
                  {RATE_LABELS[entry.kind]}

                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {countOf(entry.count, "ligne")} ·{" "}
                    {Math.round(entry.overrun * 10) / 10} de dépassement cumulé
                  </span>
                </p>

                <p className="shrink-0 text-sm font-bold tabular-nums">
                  {formatEuros(entry.exposure)} €
                </p>
              </div>

              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-destructive"
                  style={{
                    width: `${
                      totalExposure > 0
                        ? Math.max(2, (entry.exposure / totalExposure) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
