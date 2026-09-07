"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  Anchor,
  ArrowDownRight,
  Gauge,
  MapPin,
  PackageSearch,
  Radar,
  Recycle,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
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

type LogisticsAnticipateViewProps = {
  opsType?: LogisticsOpsType
}

type AnticipateItem = {
  id: string
  detectionLeadHours: number
  hoursUntilThresholdBase: number
  impact: "Fort" | "Modéré" | "Faible"
  description: string
}

type AnticipateConfig = {
  icon: React.ElementType
  opsLabel: string
  itemLabel: string
  thresholdLabel: string
  baselineLabel: string
  baselineCheckIntervalHours: number
  detectionRatePercent: number
  items: AnticipateItem[]
  actionTitle: string
  actionBody: string
}

const OPS_TYPE_LABEL: Record<LogisticsOpsType, string> = {
  port: "Port & conteneurs",
  entrepot: "Entrepôt & manutention",
  transport: "Transport & distribution",
  expedition: "Expédition",
  froid: "Chaîne du froid",
  multi: "Opérations logistiques",
}

const ANTICIPATE_CONFIG: Record<LogisticsOpsType, AnticipateConfig> = {
  port: {
    icon: Anchor,
    opsLabel: OPS_TYPE_LABEL.port,
    itemLabel: "Conteneur",
    thresholdLabel: "Franchise douanière avant surestarie",
    baselineLabel: "Contrôle manuel, une fois par équipe",
    baselineCheckIntervalHours: 24,
    detectionRatePercent: 93,
    items: [
      {
        id: "CNT-0417",
        detectionLeadHours: 14,
        hoursUntilThresholdBase: -2,
        impact: "Fort",
        description: "Document douanier manquant, franchise déjà dépassée",
      },
      {
        id: "CNT-0388",
        detectionLeadHours: 9,
        hoursUntilThresholdBase: 3,
        impact: "Modéré",
        description: "Franchise atteinte dans 3h sans intervention",
      },
      {
        id: "CNT-0455",
        detectionLeadHours: 6,
        hoursUntilThresholdBase: 11,
        impact: "Faible",
        description: "Marge confortable, à surveiller",
      },
    ],
    actionTitle: "Traiter CNT-0417 avant la prochaine tranche tarifaire",
    actionBody:
      "SentrIA l'a signalé 14h avant la franchise. Une ronde manuelle ne l'aurait remonté qu'au contrôle suivant, déjà après le seuil.",
  },
  entrepot: {
    icon: Warehouse,
    opsLabel: OPS_TYPE_LABEL.entrepot,
    itemLabel: "Zone",
    thresholdLabel: "Saturation de la zone tampon",
    baselineLabel: "Inventaire hebdomadaire",
    baselineCheckIntervalHours: 168,
    detectionRatePercent: 89,
    items: [
      {
        id: "ZON-B4",
        detectionLeadHours: 20,
        hoursUntilThresholdBase: -4,
        impact: "Fort",
        description: "Occupation au-delà de la capacité déclarée",
      },
      {
        id: "ZON-C1",
        detectionLeadHours: 15,
        hoursUntilThresholdBase: 6,
        impact: "Modéré",
        description: "Saturation atteinte dans 6h au rythme actuel",
      },
      {
        id: "ZON-A2",
        detectionLeadHours: 10,
        hoursUntilThresholdBase: 18,
        impact: "Faible",
        description: "Rotation normale sur cette zone",
      },
    ],
    actionTitle: "Libérer la zone B4 avant la prochaine réception",
    actionBody:
      "20h d'avance sur la saturation. Sans SentrIA, seul l'inventaire hebdomadaire l'aurait révélé, bien après le blocage du quai de réception.",
  },
  transport: {
    icon: Truck,
    opsLabel: OPS_TYPE_LABEL.transport,
    itemLabel: "Livraison",
    thresholdLabel: "Fenêtre de livraison contractuelle",
    baselineLabel: "Appel client en cas de réclamation",
    baselineCheckIntervalHours: 12,
    detectionRatePercent: 91,
    items: [
      {
        id: "LIV-8823",
        detectionLeadHours: 5,
        hoursUntilThresholdBase: -1,
        impact: "Fort",
        description: "Fenêtre contractuelle dépassée, compte à pénalité stricte",
      },
      {
        id: "LIV-8790",
        detectionLeadHours: 3,
        hoursUntilThresholdBase: 1.5,
        impact: "Modéré",
        description: "Retard qui atteindra la fenêtre dans 1h30",
      },
      {
        id: "LIV-8901",
        detectionLeadHours: 2,
        hoursUntilThresholdBase: 4,
        impact: "Faible",
        description: "Dans les temps pour l'instant",
      },
    ],
    actionTitle: "Réaffecter un véhicule vers LIV-8823",
    actionBody:
      "Signalé 5h avant la fenêtre contractuelle. Sans alerte, le retard n'aurait été connu qu'à la réclamation du client, une fois la pénalité déjà due.",
  },
  expedition: {
    icon: PackageSearch,
    opsLabel: OPS_TYPE_LABEL.expedition,
    itemLabel: "Commande",
    thresholdLabel: "Cutoff transporteur",
    baselineLabel: "Vérification manuelle en fin de journée",
    baselineCheckIntervalHours: 24,
    detectionRatePercent: 90,
    items: [
      {
        id: "CMD-5561",
        detectionLeadHours: 7,
        hoursUntilThresholdBase: -1.5,
        impact: "Fort",
        description: "Cutoff dépassé, déjà basculé en envoi express",
      },
      {
        id: "CMD-5498",
        detectionLeadHours: 5,
        hoursUntilThresholdBase: 2,
        impact: "Modéré",
        description: "Cutoff dans 2h, groupage encore possible",
      },
      {
        id: "CMD-5602",
        detectionLeadHours: 3,
        hoursUntilThresholdBase: 6,
        impact: "Faible",
        description: "Dans les délais du prochain enlèvement",
      },
    ],
    actionTitle: "Grouper les commandes restantes avant le cutoff",
    actionBody:
      "Signalé 7h avant le cutoff transporteur. Une vérification de fin de journée l'aurait trouvé après la collecte, surcoût express déjà engagé.",
  },
  froid: {
    icon: Snowflake,
    opsLabel: OPS_TYPE_LABEL.froid,
    itemLabel: "Lot",
    thresholdLabel: "Seuil thermique de sécurité",
    baselineLabel: "Relevé manuel toutes les 4h",
    baselineCheckIntervalHours: 4,
    detectionRatePercent: 96,
    items: [
      {
        id: "LOT-3390",
        detectionLeadHours: 0.4,
        hoursUntilThresholdBase: -0.2,
        impact: "Fort",
        description: "Excursion déjà au-delà du seuil de sécurité",
      },
      {
        id: "LOT-3355",
        detectionLeadHours: 0.6,
        hoursUntilThresholdBase: 0.3,
        impact: "Modéré",
        description: "Seuil atteint dans environ 18 minutes",
      },
      {
        id: "LOT-3401",
        detectionLeadHours: 0.8,
        hoursUntilThresholdBase: 1.1,
        impact: "Faible",
        description: "Dans la plage de sécurité",
      },
    ],
    actionTitle: "Isoler le lot LOT-3390 immédiatement",
    actionBody:
      "Sur la chaîne du froid, chaque minute compte : un relevé manuel toutes les 4h aurait laissé le lot hors plage bien plus longtemps qu'ici.",
  },
  multi: {
    icon: Recycle,
    opsLabel: OPS_TYPE_LABEL.multi,
    itemLabel: "Échéance",
    thresholdLabel: "Échéances consolidées, toutes activités",
    baselineLabel: "Contrôles manuels dispersés par site",
    baselineCheckIntervalHours: 24,
    detectionRatePercent: 91,
    items: [
      {
        id: "Surestarie port",
        detectionLeadHours: 14,
        hoursUntilThresholdBase: -2,
        impact: "Fort",
        description: "Conteneur CNT-0417, terminal principal",
      },
      {
        id: "Fenêtre transport",
        detectionLeadHours: 5,
        hoursUntilThresholdBase: -1,
        impact: "Modéré",
        description: "Livraison LIV-8823, compte grand client",
      },
      {
        id: "Zone tampon entrepôt",
        detectionLeadHours: 20,
        hoursUntilThresholdBase: 6,
        impact: "Faible",
        description: "Zone B4, réception à venir",
      },
    ],
    actionTitle: "Traiter la surestarie port en priorité",
    actionBody:
      "C'est l'échéance la plus proche parmi les trois activités. La traiter en premier limite le risque global plus efficacement qu'un traitement uniforme.",
  },
}

const TICK_OFFSETS = [0, 0.6, -0.3, 0.9]

function formatHours(value: number) {
  const rounded = Math.round(value * 10) / 10
  return rounded
}

export function LogisticsAnticipateView({
  opsType,
}: LogisticsAnticipateViewProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((value) => value + 1)
    }, 4000)

    return () => window.clearInterval(interval)
  }, [])

  const resolvedOpsType: LogisticsOpsType = opsType ?? "multi"
  const config = ANTICIPATE_CONFIG[resolvedOpsType]
  const Icon = config.icon
  const offset = TICK_OFFSETS[tick % TICK_OFFSETS.length]

  const items = useMemo(
    () =>
      config.items.map((item) => ({
        ...item,
        hoursUntilThreshold: item.hoursUntilThresholdBase - offset,
      })),
    [config, offset]
  )

  const worstItem = useMemo(
    () => [...items].sort((a, b) => a.hoursUntilThreshold - b.hoursUntilThreshold)[0],
    [items]
  )

  const avgLeadHours = useMemo(
    () =>
      Math.round(
        (config.items.reduce((sum, item) => sum + item.detectionLeadHours, 0) /
          config.items.length) *
          10
      ) / 10,
    [config]
  )

  const overdueCount = items.filter((item) => item.hoursUntilThreshold < 0)
    .length

  const nextThresholdIn = formatHours(worstItem.hoursUntilThreshold)

  const manualDeltaHours = Math.round(
    config.baselineCheckIntervalHours - worstItem.detectionLeadHours
  )

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                <Radar className="h-3.5 w-3.5" />
                Être alerté à temps
              </div>

              <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight md:text-3xl">
                Le temps d&apos;avance, mesuré et prouvé.
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                SentrIA ne se contente pas d&apos;alerter : elle chiffre son
                avance sur chaque échéance, comparée à ce qu&apos;un contrôle
                manuel aurait détecté.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Radar en temps réel
              </div>

              <span className="text-[11px] text-muted-foreground">
                {config.opsLabel}
              </span>
            </div>
          </div>

          {/* KPI GRID */}
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-accent-foreground">
                  Avance moyenne
                </span>

                <TrendingUp className="h-4 w-4 text-accent-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums text-accent-foreground">
                  {avgLeadHours}
                </span>

                <span className="mb-1 text-xs text-accent-foreground/70">
                  h
                </span>
              </div>

              <p className="mt-1 text-xs text-accent-foreground/80">
                Avant l&apos;échéance critique
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Prochaine échéance
                </span>

                <Timer className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums">
                  {Math.abs(nextThresholdIn)}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">h</span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {nextThresholdIn < 0
                  ? `${worstItem.id} déjà en retard`
                  : `${worstItem.id} avant seuil`}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Fiabilité de détection
                </span>

                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums">
                  {config.detectionRatePercent}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">%</span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Détecté avant le seuil critique
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Échéances dépassées
                </span>

                <Gauge className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums">
                  {overdueCount}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">
                  / {items.length}
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
        {/* ANTICIPATION WINDOW */}
        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-accent-foreground" />

                <h3 className="font-heading text-lg font-bold">
                  Fenêtre d&apos;anticipation
                </h3>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {config.thresholdLabel}
              </p>
            </div>

            <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {config.opsLabel}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {items.map((item) => {
              const totalWindow = item.detectionLeadHours
              const elapsed = totalWindow - item.hoursUntilThreshold
              const consumedPercent = Math.min(
                Math.max((elapsed / totalWindow) * 100, 0),
                100
              )
              const overdue = item.hoursUntilThreshold < 0

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{item.id}</p>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        overdue
                          ? "bg-destructive/10 text-destructive"
                          : item.hoursUntilThreshold < totalWindow * 0.3
                            ? "bg-amber-500/15 text-amber-600"
                            : "bg-accent/15 text-accent-foreground"
                      )}
                    >
                      {overdue
                        ? `En retard de ${Math.abs(formatHours(item.hoursUntilThreshold))}h`
                        : `${formatHours(item.hoursUntilThreshold)}h restantes`}
                    </span>
                  </div>

                  <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        overdue ? "bg-destructive" : "bg-accent"
                      )}
                      style={{ width: `${consumedPercent}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      Détecté {item.detectionLeadHours}h avant le seuil
                    </span>
                    <span>Seuil</span>
                  </div>
                </div>
              )
            })}
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
                Avance sur seuil
              </span>

              <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-foreground">
                <TrendingUp className="h-3 w-3" />
                {worstItem.detectionLeadHours}h
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Méthode actuelle
              </span>

              <span className="text-xs font-bold text-amber-600">
                {config.baselineLabel}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Écart estimé
              </span>

              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                +{manualDeltaHours}h avec SentrIA
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* COMPARISON */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-accent-foreground" />

              <h3 className="font-heading text-lg font-bold">
                SentrIA vs méthode actuelle
              </h3>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Comparé à : {config.baselineLabel.toLowerCase()}.
            </p>
          </div>

          <span className="rounded-full bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent-foreground">
            {config.items.length} comparaisons
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {config.items.map((item, index) => {
            const wouldHaveBeenLate =
              config.baselineCheckIntervalHours > item.detectionLeadHours

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl border bg-background p-4",
                  index === 0
                    ? "border-accent/40 ring-1 ring-accent/20"
                    : "border-border"
                )}
              >
                <p className="text-sm font-semibold">{item.id}</p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 text-accent-foreground">
                      <Radar className="h-3 w-3" />
                      SentrIA
                    </span>

                    <span className="font-mono font-semibold text-accent-foreground">
                      {item.detectionLeadHours}h avant seuil
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {config.baselineLabel}
                    </span>

                    <span
                      className={cn(
                        "font-mono font-semibold",
                        wouldHaveBeenLate
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {wouldHaveBeenLate
                        ? `${config.baselineCheckIntervalHours - item.detectionLeadHours}h après seuil`
                        : `${item.detectionLeadHours}h avant seuil`}
                    </span>
                  </div>
                </div>

                <span
                  className={cn(
                    "mt-3 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    item.impact === "Fort"
                      ? "bg-destructive/10 text-destructive"
                      : item.impact === "Modéré"
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-accent/15 text-accent-foreground"
                  )}
                >
                  {item.impact}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* OPERATIONAL DETAILS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />

            <span className="text-sm font-semibold">
              Fiabilité de détection
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <span className="font-heading text-3xl font-bold">
              {config.detectionRatePercent}%
            </span>

            <span className="text-xs text-muted-foreground">
              avant seuil critique
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${config.detectionRatePercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-accent-foreground" />

            <span className="text-sm font-semibold">
              Temps gagné cette semaine
            </span>
          </div>

          <div className="mt-4 flex items-end gap-1">
            <span className="font-heading text-3xl font-bold">
              {config.items.reduce(
                (sum, item) => sum + item.detectionLeadHours,
                0
              )}
            </span>

            <span className="mb-1 text-xs text-muted-foreground">h</span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Cumulé sur les échéances surveillées
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />

            <span className="text-sm font-semibold">État du radar</span>
          </div>

          <div className="mt-4">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold",
                overdueCount > 0
                  ? "bg-destructive/10 text-destructive"
                  : "bg-accent/15 text-accent-foreground"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  overdueCount > 0 ? "bg-destructive" : "bg-accent"
                )}
              />
              {overdueCount > 0 ? "Échéance dépassée" : "Radar actif"}
            </span>
          </div>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {items.length - overdueCount} {config.itemLabel.toLowerCase()}(s)
            encore dans leur fenêtre d&apos;anticipation.
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
          l&apos;expérience du radar d&apos;anticipation. Les temps d&apos;avance
          réels seront calculés à partir de l&apos;horodatage de vos propres
          alertes.
        </p>
      </div>
    </div>
  )
}