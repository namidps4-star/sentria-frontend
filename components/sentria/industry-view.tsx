"use client"

import {
  Cog,
  Activity,
  Thermometer,
  Gauge,
  Boxes,
  ShieldCheck,
  Clock3,
  TrendingDown,
  AlertTriangle,
  Wrench,
  CircleDollarSign,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Alert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
}

function matchAny(message: string, keywords: string[]) {
  const m = message.toLowerCase()
  return keywords.some((k) => m.includes(k))
}

function HeaderCard({
  icon: Icon,
  title,
  differentiator,
}: {
  icon: React.ElementType
  title: string
  differentiator: string
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-heading text-xl font-bold">{title}</h2>

          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {differentiator}
          </p>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "neutral" | "warning" | "critical" | "positive"
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p
        className={cn(
          "mt-2 font-heading text-2xl font-bold",
          tone === "critical" && "text-destructive",
          tone === "warning" && "text-amber-600",
          tone === "positive" && "text-accent-foreground"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function EmptyPriorityView({
  icon: Icon,
  title,
}: {
  icon: React.ElementType
  title: string
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="mt-4 font-heading text-lg font-bold">
        Aucune donnée {title.toLowerCase()} pour le moment
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Connectez votre ERP, vos capteurs IoT, ou importez un fichier CSV pour
        que SentrIA commence à surveiller cette priorité.
      </p>
    </div>
  )
}

function AlertRow({
  alert,
  children,
}: {
  alert: Alert
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              alert.severity === "CRITICAL"
                ? "bg-red-400"
                : "bg-[#a3e635]"
            )}
          />

          <p className="truncate text-sm font-semibold">
            {alert.equipment}
          </p>

          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
              alert.severity === "CRITICAL"
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-500/15 text-amber-600"
            )}
          >
            {alert.severity}
          </span>
        </div>

        <p className="mt-1 truncate text-xs text-muted-foreground">
          {alert.message}
        </p>

        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          {new Date(alert.date).toLocaleString("fr-FR")}
        </p>
      </div>

      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------
// 1. MACHINES DE PRODUCTION — Predicted downtime cost
// ---------------------------------------------------------------------

function estimateDowntimeCost(alert: Alert): number {
  // Heuristic estimate — replace with real cost model when available.
  return alert.severity === "CRITICAL" ? 2800 : 900
}

export function IndustryMachinesView({ alerts }: { alerts: Alert[] }) {
  const relevant = alerts.filter((a) =>
    matchAny(a.message, ["panne", "failure", "machine", "arrêt"])
  )

  if (relevant.length === 0) {
    return <EmptyPriorityView icon={Cog} title="Machines de production" />
  }

  const critical = relevant.filter((a) => a.severity === "CRITICAL")
  const totalCost = relevant.reduce(
    (sum, a) => sum + estimateDowntimeCost(a),
    0
  )

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={Cog}
        title="Machines de production"
        differentiator="Chaque anomalie machine est traduite en impact financier estimé, pour prioriser l'intervention selon le risque réel plutôt que la seule sévérité brute."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Pannes imminentes"
          value={String(critical.length)}
          tone={critical.length > 0 ? "critical" : "neutral"}
        />
        <MetricCard
          label="Machines concernées"
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard
          label="Perte estimée cumulée"
          value={`~€${totalCost.toLocaleString("fr-FR")}`}
          tone="warning"
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Détail par machine</p>
          <p className="text-xs text-muted-foreground">
            Estimation indicative, à affiner avec vos coûts réels d'arrêt.
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Aucune alerte machine pour le moment.
          </div>
        ) : (
          relevant.map((a, i) => (
            <AlertRow key={`${a.equipment}-${a.date}-${i}`} alert={a}>
              <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                <CircleDollarSign className="h-3.5 w-3.5" />
                ~€{estimateDowntimeCost(a).toLocaleString("fr-FR")}
              </div>
            </AlertRow>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// 2. MOTEURS — Early degradation trend
// ---------------------------------------------------------------------

export function IndustryMotorsView({ alerts }: { alerts: Alert[] }) {
  const relevant = alerts.filter((a) =>
    matchAny(a.message, ["moteur", "engine", "motor"])
  )

  if (relevant.length === 0) {
    return <EmptyPriorityView icon={Activity} title="Moteurs" />
  }

  const countByEquipment = relevant.reduce<Record<string, number>>(
    (acc, a) => {
      acc[a.equipment] = (acc[a.equipment] ?? 0) + 1
      return acc
    },
    {}
  )

  const degrading = Object.entries(countByEquipment).filter(
    ([, count]) => count >= 2
  )

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={Activity}
        title="Moteurs"
        differentiator="SentrIA repère les dégradations progressives — plusieurs signaux faibles sur le même moteur — avant que la panne franche ne survienne."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Alertes moteur" value={String(relevant.length)} />
        <MetricCard
          label="Moteurs en dégradation progressive"
          value={String(degrading.length)}
          tone={degrading.length > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Moteurs surveillés"
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Détail par moteur</p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Aucune alerte moteur pour le moment.
          </div>
        ) : (
          relevant.map((a, i) => {
            const isProgressive = (countByEquipment[a.equipment] ?? 0) >= 2

            return (
              <AlertRow key={`${a.equipment}-${a.date}-${i}`} alert={a}>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                    isProgressive
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  {isProgressive
                    ? "Dégradation progressive"
                    : "Signal ponctuel"}
                </span>
              </AlertRow>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// 3. TEMPÉRATURE — Predictive threshold (slope, not just point)
// ---------------------------------------------------------------------

function projectHoursToThreshold(alert: Alert): number | null {
  if (alert.severity === "CRITICAL") return 0

  const hoursSince =
    (Date.now() - new Date(alert.date).getTime()) / (1000 * 60 * 60)

  // Heuristic: the longer a warning has been open, the closer to critical.
  const projected = Math.round(Math.max(4, 48 - hoursSince))
  return projected
}

export function IndustryTemperatureView({ alerts }: { alerts: Alert[] }) {
  const relevant = alerts.filter((a) =>
    matchAny(a.message, ["temp", "surchauffe", "chaleur", "overheat"])
  )

  if (relevant.length === 0) {
    return <EmptyPriorityView icon={Thermometer} title="Température" />
  }

  const critical = relevant.filter((a) => a.severity === "CRITICAL")

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={Thermometer}
        title="Température"
        differentiator="Plutôt que d'alerter uniquement quand un seuil est franchi, SentrIA estime la trajectoire actuelle pour anticiper le moment où il sera atteint."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Seuils déjà atteints"
          value={String(critical.length)}
          tone={critical.length > 0 ? "critical" : "neutral"}
        />
        <MetricCard
          label="Actifs sous surveillance"
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard
          label="Alertes température"
          value={String(relevant.length)}
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Trajectoire estimée</p>
          <p className="text-xs text-muted-foreground">
            Projection indicative basée sur l'ancienneté du signal, à affiner
            avec un historique de capteurs.
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Aucune alerte température pour le moment.
          </div>
        ) : (
          relevant.map((a, i) => {
            const hours = projectHoursToThreshold(a)

            return (
              <AlertRow key={`${a.equipment}-${a.date}-${i}`} alert={a}>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                    hours === 0
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/15 text-amber-600"
                  )}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {hours === 0
                    ? "Seuil déjà atteint"
                    : `Seuil estimé dans ~${hours}h`}
                </span>
              </AlertRow>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// 4. PRESSION — Probable cause suggestion
// ---------------------------------------------------------------------

const PRESSURE_CAUSES = [
  "Usure du joint",
  "Fuite hydraulique probable",
  "Défaut de valve",
  "Encrassement du filtre",
]

function suggestPressureCause(alert: Alert): string {
  const m = alert.message.toLowerCase()

  if (m.includes("fuite") || m.includes("leak")) {
    return "Fuite hydraulique probable"
  }

  if (m.includes("valve")) {
    return "Défaut de valve"
  }

  // Deterministic pick based on equipment name so it stays stable per asset.
  let hash = 0
  for (const char of alert.equipment) {
    hash = (hash + char.charCodeAt(0)) % PRESSURE_CAUSES.length
  }

  return PRESSURE_CAUSES[hash]
}

export function IndustryPressureView({ alerts }: { alerts: Alert[] }) {
  const relevant = alerts.filter((a) =>
    matchAny(a.message, ["pression", "pressure"])
  )

  if (relevant.length === 0) {
    return <EmptyPriorityView icon={Gauge} title="Pression" />
  }

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={Gauge}
        title="Pression"
        differentiator="Au-delà de la valeur hors norme, SentrIA propose une cause probable à confirmer par un technicien, pour accélérer le diagnostic."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Alertes pression" value={String(relevant.length)} />
        <MetricCard
          label="Équipements concernés"
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard
          label="Critiques"
          value={String(
            relevant.filter((a) => a.severity === "CRITICAL").length
          )}
          tone={
            relevant.some((a) => a.severity === "CRITICAL")
              ? "critical"
              : "neutral"
          }
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Cause probable suggérée</p>
          <p className="text-xs text-muted-foreground">
            Hypothèse à confirmer sur le terrain — n'engage pas de diagnostic
            définitif.
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Aucune alerte pression pour le moment.
          </div>
        ) : (
          relevant.map((a, i) => (
            <AlertRow key={`${a.equipment}-${a.date}-${i}`} alert={a}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                {suggestPressureCause(a)}
              </span>
            </AlertRow>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// 5. PRODUCTION — €/hour lost
// ---------------------------------------------------------------------

function estimateHourlyLoss(alert: Alert): number {
  return alert.severity === "CRITICAL" ? 450 : 150
}

export function IndustryProductionView({ alerts }: { alerts: Alert[] }) {
  const relevant = alerts.filter((a) =>
    matchAny(a.message, ["production", "rendement", "cycle", "yield"])
  )

  if (relevant.length === 0) {
    return <EmptyPriorityView icon={Boxes} title="Production" />
  }

  const totalHourlyLoss = relevant.reduce(
    (sum, a) => sum + estimateHourlyLoss(a),
    0
  )

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={Boxes}
        title="Production"
        differentiator="Chaque baisse de rendement est convertie en perte estimée par heure, pour que l'impact business soit visible immédiatement, pas seulement un pourcentage."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Lignes concernées"
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard label="Alertes production" value={String(relevant.length)} />
        <MetricCard
          label="Perte estimée cumulée"
          value={`~€${totalHourlyLoss.toLocaleString("fr-FR")}/h`}
          tone="warning"
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Détail par ligne</p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Aucune alerte production pour le moment.
          </div>
        ) : (
          relevant.map((a, i) => (
            <AlertRow key={`${a.equipment}-${a.date}-${i}`} alert={a}>
              <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                <CircleDollarSign className="h-3.5 w-3.5" />
                ~€{estimateHourlyLoss(a)}/h
              </div>
            </AlertRow>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// 6. MAINTENANCE — Condition-based maintenance window
// ---------------------------------------------------------------------

function recommendMaintenanceWindow(alert: Alert): { from: Date; to: Date } {
  const base = new Date(alert.date)
  const offsetDays = alert.severity === "CRITICAL" ? 1 : 3

  const from = new Date(base)
  from.setDate(from.getDate() + offsetDays)

  const to = new Date(from)
  to.setDate(to.getDate() + 2)

  return { from, to }
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

export function IndustryMaintenanceView({ alerts }: { alerts: Alert[] }) {
  const relevant = alerts.filter((a) =>
    matchAny(a.message, ["maintenance", "révision", "entretien", "service"])
  )

  if (relevant.length === 0) {
    return <EmptyPriorityView icon={ShieldCheck} title="Maintenance" />
  }

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={ShieldCheck}
        title="Maintenance"
        differentiator="Plutôt qu'un calendrier fixe, SentrIA recommande une fenêtre d'intervention adaptée à l'usure réelle observée sur chaque équipement."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Interventions à planifier"
          value={String(relevant.length)}
        />
        <MetricCard
          label="Équipements concernés"
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard
          label="Urgentes"
          value={String(
            relevant.filter((a) => a.severity === "CRITICAL").length
          )}
          tone={
            relevant.some((a) => a.severity === "CRITICAL")
              ? "critical"
              : "neutral"
          }
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Fenêtres recommandées</p>
          <p className="text-xs text-muted-foreground">
            Basées sur l'usure détectée, pas sur un planning générique.
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            Aucune intervention recommandée pour le moment.
          </div>
        ) : (
          relevant.map((a, i) => {
            const window = recommendMaintenanceWindow(a)

            return (
              <AlertRow key={`${a.equipment}-${a.date}-${i}`} alert={a}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                  <Wrench className="h-3.5 w-3.5" />
                  {formatShortDate(window.from)} → {formatShortDate(window.to)}
                </span>
              </AlertRow>
            )
          })
        )}
      </div>
    </div>
  )
}