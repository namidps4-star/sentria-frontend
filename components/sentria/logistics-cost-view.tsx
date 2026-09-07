"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  Anchor,
  ArrowDownRight,
  CircleDollarSign,
  Clock3,
  Gauge,
  MapPin,
  PackageSearch,
  Recycle,
  Snowflake,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  Warehouse,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

type LogisticsOpsType =
  | "port"
  | "entrepot"
  | "transport"
  | "expedition"
  | "froid"
  | "multi"

type LogisticsCostViewProps = {
  opsType?: LogisticsOpsType
}

type ExposureLine = {
  id: string
  elapsedBase: number
  impact: "Fort" | "Modéré" | "Faible"
  description: string
}

type CostConfig = {
  icon: React.ElementType
  opsLabel: string
  itemLabel: string
  clockLabel: string
  unit: "h" | "min"
  threshold: number
  maxValue: number
  ratePerUnitOverThreshold: number
  currency: "€"
  lines: ExposureLine[]
  actionTitle: string
  actionBody: string
}

const OPS_ICON: Record<LogisticsOpsType, React.ElementType> = {
  port: Anchor,
  entrepot: Warehouse,
  transport: Truck,
  expedition: PackageSearch,
  froid: Snowflake,
  multi: Recycle,
}

const OPS_TYPE_LABEL: Record<LogisticsOpsType, string> = {
  port: "Port & conteneurs",
  entrepot: "Entrepôt & manutention",
  transport: "Transport & distribution",
  expedition: "Expédition",
  froid: "Chaîne du froid",
  multi: "Opérations logistiques",
}

const COST_CONFIG: Record<LogisticsOpsType, CostConfig> = {
  port: {
    icon: Anchor,
    opsLabel: OPS_TYPE_LABEL.port,
    itemLabel: "Conteneur",
    clockLabel: "Franchise avant surestarie",
    unit: "h",
    threshold: 72,
    maxValue: 100,
    ratePerUnitOverThreshold: 22,
    currency: "€",
    lines: [
      {
        id: "CNT-0417",
        elapsedBase: 91,
        impact: "Fort",
        description: "Document douanier manquant depuis 3 jours",
      },
      {
        id: "CNT-0392",
        elapsedBase: 76,
        impact: "Modéré",
        description: "Franchise dépassée de 4h, enlèvement prévu ce soir",
      },
      {
        id: "CNT-0511",
        elapsedBase: 58,
        impact: "Faible",
        description: "Dans la franchise, à surveiller avant le week-end",
      },
    ],
    actionTitle: "Prioriser le retrait du conteneur CNT-0417",
    actionBody:
      "Le document douanier bloque l'enlèvement depuis 3 jours. Chaque jour supplémentaire ajoute un palier de surestarie au tarif du terminal.",
  },
  entrepot: {
    icon: Warehouse,
    opsLabel: OPS_TYPE_LABEL.entrepot,
    itemLabel: "Palette",
    clockLabel: "Stockage au-delà de la franchise contractuelle",
    unit: "h",
    threshold: 48,
    maxValue: 72,
    ratePerUnitOverThreshold: 9,
    currency: "€",
    lines: [
      {
        id: "PAL-2280",
        elapsedBase: 63,
        impact: "Fort",
        description: "Zone tampon saturée, aucun mouvement depuis 2 jours",
      },
      {
        id: "PAL-2144",
        elapsedBase: 51,
        impact: "Modéré",
        description: "Franchise dépassée, expédition planifiée demain",
      },
      {
        id: "PAL-2299",
        elapsedBase: 34,
        impact: "Faible",
        description: "Rotation normale sur cette référence",
      },
    ],
    actionTitle: "Libérer la zone tampon avant la prochaine réception",
    actionBody:
      "La palette PAL-2280 immobilise une zone facturée au forfait. La déplacer maintenant évite qu'un deuxième forfait ne se déclenche.",
  },
  transport: {
    icon: Truck,
    opsLabel: OPS_TYPE_LABEL.transport,
    itemLabel: "Livraison",
    clockLabel: "Retard vs fenêtre contractuelle",
    unit: "h",
    threshold: 2,
    maxValue: 6,
    ratePerUnitOverThreshold: 140,
    currency: "€",
    lines: [
      {
        id: "LIV-8823",
        elapsedBase: 4.5,
        impact: "Fort",
        description: "Client grand compte, pénalité contractuelle stricte",
      },
      {
        id: "LIV-8790",
        elapsedBase: 2.6,
        impact: "Modéré",
        description: "Léger retard, marge de négociation possible",
      },
      {
        id: "LIV-8901",
        elapsedBase: 1.1,
        impact: "Faible",
        description: "Dans la fenêtre contractuelle",
      },
    ],
    actionTitle: "Réaffecter un véhicule vers LIV-8823",
    actionBody:
      "La fenêtre de livraison est dépassée sur un compte à pénalité stricte. Un réaffectation maintenant limite l'ardoise avant la tranche horaire suivante.",
  },
  expedition: {
    icon: PackageSearch,
    opsLabel: OPS_TYPE_LABEL.expedition,
    itemLabel: "Commande",
    clockLabel: "Temps depuis le cutoff transporteur",
    unit: "h",
    threshold: 4,
    maxValue: 8,
    ratePerUnitOverThreshold: 60,
    currency: "€",
    lines: [
      {
        id: "CMD-5561",
        elapsedBase: 6.2,
        impact: "Fort",
        description: "Cutoff dépassé, expédition déjà basculée en express",
      },
      {
        id: "CMD-5498",
        elapsedBase: 4.4,
        impact: "Modéré",
        description: "Cutoff tout juste dépassé, groupage encore possible",
      },
      {
        id: "CMD-5602",
        elapsedBase: 2.1,
        impact: "Faible",
        description: "Dans les délais du prochain enlèvement",
      },
    ],
    actionTitle: "Grouper les commandes restantes avant la prochaine collecte",
    actionBody:
      "CMD-5561 a déjà basculé en envoi express. Regrouper les commandes encore dans les temps évite d'ajouter un deuxième surcoût au même client.",
  },
  froid: {
    icon: Snowflake,
    opsLabel: OPS_TYPE_LABEL.froid,
    itemLabel: "Lot",
    clockLabel: "Durée d'excursion thermique",
    unit: "min",
    threshold: 15,
    maxValue: 30,
    ratePerUnitOverThreshold: 340,
    currency: "€",
    lines: [
      {
        id: "LOT-3390",
        elapsedBase: 22,
        impact: "Fort",
        description: "Hors plage depuis 22 min, produit sensible",
      },
      {
        id: "LOT-3355",
        elapsedBase: 16,
        impact: "Modéré",
        description: "Excursion légère, à recontrôler",
      },
      {
        id: "LOT-3401",
        elapsedBase: 6,
        impact: "Faible",
        description: "Dans la plage de sécurité",
      },
    ],
    actionTitle: "Isoler le lot LOT-3390 avant tout envoi",
    actionBody:
      "L'excursion thermique dépasse le seuil de sécurité. Un contrôle qualité immédiat évite un rejet complet du lot à la livraison.",
  },
  multi: {
    icon: Recycle,
    opsLabel: OPS_TYPE_LABEL.multi,
    itemLabel: "Poste de coût",
    clockLabel: "Exposition consolidée, toutes activités",
    unit: "h",
    threshold: 24,
    maxValue: 40,
    ratePerUnitOverThreshold: 45,
    currency: "€",
    lines: [
      {
        id: "Surestarie port",
        elapsedBase: 30,
        impact: "Fort",
        description: "Conteneur CNT-0417, terminal principal",
      },
      {
        id: "Pénalités transport",
        elapsedBase: 26,
        impact: "Modéré",
        description: "Livraison LIV-8823, compte grand client",
      },
      {
        id: "Immobilisation entrepôt",
        elapsedBase: 14,
        impact: "Faible",
        description: "Palette PAL-2280, zone tampon",
      },
    ],
    actionTitle: "Traiter la surestarie port en priorité",
    actionBody:
      "C'est le poste qui accumule le plus vite. Le résoudre limite l'exposition totale plus efficacement que de répartir l'effort sur les trois fronts.",
  },
}

const TICK_OFFSETS = [0, 2.4, -1.2, 3.1]

function formatEuros(value: number) {
  return Math.round(value).toLocaleString("fr-FR")
}

export function LogisticsCostView({ opsType }: LogisticsCostViewProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((value) => value + 1)
    }, 4000)

    return () => window.clearInterval(interval)
  }, [])

  const resolvedOpsType: LogisticsOpsType = opsType ?? "multi"
  const config = COST_CONFIG[resolvedOpsType]
  const Icon = config.icon

  const offset = TICK_OFFSETS[tick % TICK_OFFSETS.length]

  const worstLine = useMemo(
    () => [...config.lines].sort((a, b) => b.elapsedBase - a.elapsedBase)[0],
    [config]
  )

  const elapsed = Math.min(
    Math.max(worstLine.elapsedBase + offset, config.threshold * 0.4),
    config.maxValue
  )

  const triggered = elapsed > config.threshold
  const overrun = triggered
    ? Math.round((elapsed - config.threshold) * 10) / 10
    : 0
  const currentExposure = overrun * config.ratePerUnitOverThreshold
  const predictedExposure = currentExposure * 0.32
  const reduction = currentExposure - predictedExposure
  const reductionPercent = currentExposure > 0
    ? Math.round((reduction / currentExposure) * 100)
    : 0

  const actionWindow = Math.max(1, Math.round(config.maxValue - elapsed))

  const linesAtRisk = config.lines.filter(
    (line) => line.elapsedBase > config.threshold * 0.7
  ).length

  const budgetConsumedPercent = Math.min(
    96,
    Math.round((elapsed / config.maxValue) * 100)
  )

  const exposureTone =
    linesAtRisk >= 2 ? "Élevée" : linesAtRisk === 1 ? "Modérée" : "Faible"

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                <CircleDollarSign className="h-3.5 w-3.5" />
                Réduire les coûts imprévus
              </div>

              <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight md:text-3xl">
                Voir la facture avant qu&apos;elle n&apos;arrive.
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                SentrIA relie chaque situation à la clause qui la facture
                réellement — franchise, pénalité, cutoff — et chiffre
                l&apos;exposition en direct, avant l&apos;émission de la
                facture.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Analyse en temps réel
              </div>

              <span className="text-[11px] text-muted-foreground">
                {config.opsLabel}
              </span>
            </div>
          </div>

          {/* KPI GRID */}
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Exposition en cours
                </span>

                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums">
                  {formatEuros(currentExposure)}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">
                  {config.currency}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {worstLine.id}
              </p>
            </div>

            <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-accent-foreground">
                  Coût évité si action immédiate
                </span>

                <TrendingDown className="h-4 w-4 text-accent-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums text-accent-foreground">
                  {formatEuros(predictedExposure)}
                </span>

                <span className="mb-1 text-xs text-accent-foreground/70">
                  {config.currency}
                </span>
              </div>

              <p className="mt-1 text-xs text-accent-foreground/80">
                -{formatEuros(reduction)} {config.currency} estimés
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Temps pour agir
                </span>

                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums">
                  {actionWindow}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">
                  {config.unit}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Avant le prochain palier tarifaire
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Lignes à risque
                </span>

                <Timer className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums">
                  {linesAtRisk}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">
                  / {config.lines.length}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {config.itemLabel}s surveillé(e)s
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN OPERATIONAL GRID */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* COST CLOCK */}
        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-accent-foreground" />

                <h3 className="font-heading text-lg font-bold">
                  Horloge de coût
                </h3>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {config.clockLabel}
              </p>
            </div>

            <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {config.opsLabel}
            </span>
          </div>

          <div className="mt-7 rounded-2xl border border-border bg-background p-6">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-mono text-foreground">
                {worstLine.id}
              </span>

              <span className="font-mono text-foreground">
                {Math.round(elapsed * 10) / 10}
                {config.unit} / {config.threshold}
                {config.unit}
              </span>
            </div>

            <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  triggered ? "bg-destructive" : "bg-amber-500"
                )}
                style={{
                  width: `${Math.min((elapsed / config.maxValue) * 100, 100)}%`,
                }}
              />

              <div
                className="absolute top-0 h-full w-px bg-foreground/30"
                style={{
                  left: `${(config.threshold / config.maxValue) * 100}%`,
                }}
              />
            </div>

            <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Dans la franchise
              </span>

              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Franchise atteinte
              </span>

              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                Facturé
              </span>
            </div>

            <div
              className={cn(
                "mt-4 flex items-center justify-between rounded-xl border border-l-2 bg-card px-3.5 py-3 transition-all duration-500",
                triggered
                  ? "border-border border-l-destructive translate-y-0 opacity-100"
                  : "border-border border-l-amber-500 translate-y-1 opacity-0"
              )}
            >
              <span className="flex items-center gap-2 text-xs text-foreground">
                {triggered && (
                  <TriangleAlert className="h-3.5 w-3.5 text-destructive" />
                )}
                Dépassement de {overrun}
                {config.unit} au-delà de la franchise
              </span>

              <span className="font-heading text-sm font-bold text-destructive">
                {formatEuros(currentExposure)} {config.currency}
              </span>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="text-[11px] text-muted-foreground">
                Budget consommé
              </p>

              <p className="mt-1 text-lg font-bold">
                {budgetConsumedPercent}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  %
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="text-[11px] text-muted-foreground">
                Exposition
              </p>

              <p className="mt-1 text-lg font-bold">{exposureTone}</p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="text-[11px] text-muted-foreground">
                Réduction potentielle
              </p>

              <p className="mt-1 text-lg font-bold text-accent-foreground">
                -{reductionPercent}%
              </p>
            </div>
          </div>
        </div>

        {/* RECOMMENDATION */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent-foreground" />

            <h3 className="font-heading text-lg font-bold">
              Recommandation SentrIA
            </h3>
          </div>

          <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/10 p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Zap className="h-3.5 w-3.5" />
              </span>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                  Action prioritaire
                </span>

                <span className="text-[11px] text-accent-foreground/70">
                  À effectuer maintenant
                </span>
              </div>
            </div>

            <p className="mt-4 text-sm font-semibold leading-5">
              {config.actionTitle}
            </p>

            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {config.actionBody}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Exposition
              </span>

              <span className="text-xs font-bold text-amber-600">
                {exposureTone}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Tendance
              </span>

              <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-foreground">
                <TrendingDown className="h-3 w-3" />
                Maîtrisable
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Gain estimé
              </span>

              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                -{formatEuros(reduction)} {config.currency}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* EXPOSURE LINES */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-accent-foreground" />

              <h3 className="font-heading text-lg font-bold">
                Lignes d&apos;exposition détectées
              </h3>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Classées selon le temps écoulé au-delà de la franchise
              applicable.
            </p>
          </div>

          <span className="rounded-full bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent-foreground">
            {config.lines.length} {config.itemLabel.toLowerCase()}s
            surveillé(e)s
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {config.lines.map((line, index) => {
            const lineElapsed = Math.min(
              Math.max(line.elapsedBase + offset * 0.3, 0),
              config.maxValue
            )
            const lineCapacity = Math.round(
              (lineElapsed / config.maxValue) * 100
            )
            const lineTriggered = lineElapsed > config.threshold
            const lineCost = lineTriggered
              ? (lineElapsed - config.threshold) *
                config.ratePerUnitOverThreshold
              : 0

            return (
              <div
                key={line.id}
                className={cn(
                  "rounded-2xl border bg-background p-4",
                  index === 0
                    ? "border-accent/40 ring-1 ring-accent/20"
                    : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{line.id}</p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {line.description}
                    </p>
                  </div>

                  <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <span className="font-heading text-2xl font-bold">
                      {formatEuros(lineCost)}
                    </span>

                    <span className="ml-1 text-xs text-muted-foreground">
                      {config.currency}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      line.impact === "Fort"
                        ? "bg-destructive/10 text-destructive"
                        : line.impact === "Modéré"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-accent/15 text-accent-foreground"
                    )}
                  >
                    {line.impact}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {config.clockLabel}
                    </span>

                    <span className="text-[10px] font-semibold">
                      {lineCapacity}%
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        lineCapacity >= 80
                          ? "bg-destructive"
                          : lineCapacity >= 55
                            ? "bg-amber-500"
                            : "bg-accent"
                      )}
                      style={{ width: `${lineCapacity}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* OPERATIONAL DETAILS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />

            <span className="text-sm font-semibold">
              Budget mensuel consommé
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <span className="font-heading text-3xl font-bold">
              {budgetConsumedPercent}%
            </span>

            <span className="text-xs text-muted-foreground">
              sur ce poste
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                budgetConsumedPercent >= 80 ? "bg-destructive" : "bg-accent"
              )}
              style={{ width: `${budgetConsumedPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-accent-foreground" />

            <span className="text-sm font-semibold">Gain potentiel</span>
          </div>

          <div className="mt-4 flex items-end gap-1">
            <span className="font-heading text-3xl font-bold">
              {formatEuros(reduction)}
            </span>

            <span className="mb-1 text-xs text-muted-foreground">
              {config.currency}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Réduction estimée avec l&apos;action recommandée
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />

            <span className="text-sm font-semibold">
              État de l&apos;exposition
            </span>
          </div>

          <div className="mt-4">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold",
                triggered
                  ? "bg-destructive/10 text-destructive"
                  : "bg-accent/15 text-accent-foreground"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  triggered ? "bg-destructive" : "bg-accent"
                )}
              />
              {triggered ? "Facturation en cours" : "Sous contrôle"}
            </span>
          </div>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {config.lines.length - linesAtRisk} {config.itemLabel.toLowerCase()}
            (s) restent dans leur franchise contractuelle.
          </p>
        </div>
      </div>

      {/* DATA STATUS */}
      <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-3">
        <p className="text-[11px] leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Mode démonstration :
          </span>{" "}
          les indicateurs de cette vue sont simulés pour représenter
          l&apos;expérience de réduction des coûts imprévus. Les montants
          réels utiliseront vos tarifs et vos données opérationnelles.
        </p>
      </div>
    </div>
  )
}