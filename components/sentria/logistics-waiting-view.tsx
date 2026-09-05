"use client"

import { useEffect, useState } from "react"
import {
  Clock3,
  Package,
  Sparkles,
  Timer,
  TrendingDown,
  Zap,
  ArrowDownRight,
  Activity,
  MapPin,
  Gauge,
} from "lucide-react"
import { cn } from "@/lib/utils"

type LogisticsOpsType =
  | "port"
  | "entrepot"
  | "transport"
  | "expedition"
  | "froid"
  | "multi"

type LogisticsWaitingViewProps = {
  opsType?: LogisticsOpsType
}

const OPS_TYPE_LABEL: Record<LogisticsOpsType, string> = {
  port: "Port & conteneurs",
  entrepot: "Entrepôt & manutention",
  transport: "Transport & distribution",
  expedition: "Expédition",
  froid: "Chaîne du froid",
  multi: "Opérations logistiques",
}

const SCENARIOS = [
  {
    waiting: 18,
    predicted: 11,
    actionWindow: 7,
    queue: 8,
    flow: 64,
  },
  {
    waiting: 20,
    predicted: 12,
    actionWindow: 8,
    queue: 9,
    flow: 68,
  },
  {
    waiting: 17,
    predicted: 10,
    actionWindow: 6,
    queue: 7,
    flow: 61,
  },
  {
    waiting: 19,
    predicted: 11,
    actionWindow: 7,
    queue: 8,
    flow: 66,
  },
]

const WAITING_ZONES = [
  {
    name: "Zone quai principal",
    wait: 18,
    capacity: 82,
    impact: "Fort",
    description: "Concentration d'arrivées sur le prochain créneau",
  },
  {
    name: "Contrôle entrée",
    wait: 9,
    capacity: 61,
    impact: "Modéré",
    description: "Flux régulier avec ralentissement ponctuel",
  },
  {
    name: "Zone chargement",
    wait: 6,
    capacity: 43,
    impact: "Faible",
    description: "Capacité disponible suffisante",
  },
]

const VEHICLES = [
  {
    id: "V-204",
    position: 17,
    status: "En approche",
    eta: "5 min",
  },
  {
    id: "V-118",
    position: 39,
    status: "En attente",
    eta: "8 min",
  },
  {
    id: "V-073",
    position: 61,
    status: "Prioritaire",
    eta: "3 min",
  },
  {
    id: "V-311",
    position: 29,
    status: "En approche",
    eta: "11 min",
  },
]

export function LogisticsWaitingView({
  opsType,
}: LogisticsWaitingViewProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((value) => value + 1)
    }, 4000)

    return () => window.clearInterval(interval)
  }, [])

  const scenario = SCENARIOS[tick % SCENARIOS.length]

  const opsLabel = opsType
    ? OPS_TYPE_LABEL[opsType]
    : "Opérations logistiques"

  const reduction =
    scenario.waiting - scenario.predicted

  const reductionPercent = Math.round(
    (reduction / scenario.waiting) * 100
  )

  const congestion =
    scenario.queue >= 10
      ? "Élevée"
      : scenario.queue >= 7
        ? "Modérée"
        : "Faible"

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                <Timer className="h-3.5 w-3.5" />
                Réduire les temps d'attente
              </div>

              <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight md:text-3xl">
                Fluidifier les opérations avant que la file ne se forme.
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                SentrIA identifie les zones de congestion, estime l'évolution
                des files et met en évidence l'action à effectuer en priorité.
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
                {opsLabel}
              </span>
            </div>
          </div>

          {/* KPI GRID */}
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Attente actuelle
                </span>

                <Clock3 className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums">
                  {scenario.waiting}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">
                  min
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                File principale
              </p>
            </div>

            <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-accent-foreground">
                  Prévision après action
                </span>

                <TrendingDown className="h-4 w-4 text-accent-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums text-accent-foreground">
                  {scenario.predicted}
                </span>

                <span className="mb-1 text-xs text-accent-foreground/70">
                  min
                </span>
              </div>

              <p className="mt-1 text-xs text-accent-foreground/80">
                -{reduction} min estimées
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
                  {scenario.actionWindow}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">
                  min
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Avant aggravation estimée
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  File détectée
                </span>

                <Package className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="mt-2 flex items-end gap-1.5">
                <span className="font-heading text-3xl font-bold tabular-nums">
                  {scenario.queue}
                </span>

                <span className="mb-1 text-xs text-muted-foreground">
                  unités
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Flux entrant surveillé
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN OPERATIONAL GRID */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* FLOW */}
        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent-foreground" />

                <h3 className="font-heading text-lg font-bold">
                  Flux opérationnel
                </h3>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Équipements approchant de la zone d'attente.
              </p>
            </div>

            <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {opsLabel}
            </span>
          </div>

          <div className="mt-7">
            <div className="relative h-48 overflow-hidden rounded-2xl border border-border bg-background">
              <div className="absolute left-8 right-8 top-1/2 h-px -translate-y-1/2 bg-border" />

              <div className="absolute left-[76%] top-6 bottom-6 w-px bg-destructive/40" />

              <div className="absolute left-[76%] top-3 -translate-x-1/2 rounded-full bg-destructive/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-destructive">
                Zone d'attente
              </div>

              {VEHICLES.map((vehicle, index) => {
                const movement =
                  ((tick * (index + 1) * 2) % 9)

                const position = Math.min(
                  vehicle.position + movement,
                  73
                )

                return (
                  <div
                    key={vehicle.id}
                    className="absolute top-1/2 flex -translate-y-1/2 items-center gap-2 transition-all duration-1000 ease-out"
                    style={{
                      left: `${position}%`,
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm",
                        vehicle.status === "Prioritaire"
                          ? "border-accent/40 bg-accent/15 text-accent-foreground"
                          : "border-border bg-card text-foreground"
                      )}
                    >
                      <Package className="h-4 w-4" />
                    </div>

                    <div className="hidden min-w-24 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-sm sm:block">
                      <p className="text-[10px] font-bold">
                        {vehicle.id}
                      </p>

                      <p className="text-[9px] text-muted-foreground">
                        {vehicle.status}
                      </p>
                    </div>
                  </div>
                )
              })}

              <div className="absolute bottom-3 left-6 text-[9px] uppercase tracking-wider text-muted-foreground">
                Flux entrant
              </div>

              <div className="absolute bottom-3 left-[76%] -translate-x-1/2 text-[9px] uppercase tracking-wider text-muted-foreground">
                Seuil
              </div>

              <div className="absolute bottom-3 right-6 text-[9px] uppercase tracking-wider text-muted-foreground">
                Quai
              </div>
            </div>
          </div>

          {/* FLOW SUMMARY */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="text-[11px] text-muted-foreground">
                Débit estimé
              </p>

              <p className="mt-1 text-lg font-bold">
                {scenario.flow}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  %
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="text-[11px] text-muted-foreground">
                Congestion
              </p>

              <p className="mt-1 text-lg font-bold">
                {congestion}
              </p>
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
              Réaffecter temporairement l'équipement disponible vers la zone
              de traitement prioritaire.
            </p>

            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              SentrIA estime que cette action peut réduire le temps d'attente
              avant le prochain pic d'arrivée.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Congestion
              </span>

              <span className="text-xs font-bold text-amber-600">
                {congestion}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Tendance
              </span>

              <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-foreground">
                <TrendingDown className="h-3 w-3" />
                En baisse
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Gain estimé
              </span>

              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                -{reduction} min
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* WAITING ZONES */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-accent-foreground" />

              <h3 className="font-heading text-lg font-bold">
                Points d'attente détectés
              </h3>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Les zones sont classées selon leur temps d'attente et leur
              capacité opérationnelle.
            </p>
          </div>

          <span className="rounded-full bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent-foreground">
            3 zones surveillées
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {WAITING_ZONES.map((zone, index) => (
            <div
              key={zone.name}
              className={cn(
                "rounded-2xl border bg-background p-4",
                index === 0
                  ? "border-accent/40 ring-1 ring-accent/20"
                  : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {zone.name}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {zone.description}
                  </p>
                </div>

                <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>

              <div className="mt-5 flex items-end justify-between">
                <div>
                  <span className="font-heading text-2xl font-bold">
                    {zone.wait}
                  </span>

                  <span className="ml-1 text-xs text-muted-foreground">
                    min
                  </span>
                </div>

                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    zone.impact === "Fort"
                      ? "bg-destructive/10 text-destructive"
                      : zone.impact === "Modéré"
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-accent/15 text-accent-foreground"
                  )}
                >
                  {zone.impact}
                </span>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Utilisation
                  </span>

                  <span className="text-[10px] font-semibold">
                    {zone.capacity}%
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      zone.capacity >= 80
                        ? "bg-destructive"
                        : zone.capacity >= 60
                          ? "bg-amber-500"
                          : "bg-accent"
                    )}
                    style={{
                      width: `${zone.capacity}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OPERATIONAL DETAILS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />

            <span className="text-sm font-semibold">
              Capacité disponible
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <span className="font-heading text-3xl font-bold">
              34%
            </span>

            <span className="text-xs text-muted-foreground">
              marge restante
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: "34%" }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-accent-foreground" />

            <span className="text-sm font-semibold">
              Gain potentiel
            </span>
          </div>

          <div className="mt-4 flex items-end gap-1">
            <span className="font-heading text-3xl font-bold">
              {reduction}
            </span>

            <span className="mb-1 text-xs text-muted-foreground">
              min
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Réduction estimée avec l'action recommandée
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />

            <span className="text-sm font-semibold">
              État du flux
            </span>
          </div>

          <div className="mt-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent-foreground">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Flux maîtrisé
            </span>
          </div>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Le niveau de congestion reste sous surveillance sur la zone
            principale.
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
          l'expérience de réduction des temps d'attente. Les prédictions
          réelles utiliseront les données opérationnelles disponibles dans
          SentrIA.
        </p>
      </div>
    </div>
  )
}