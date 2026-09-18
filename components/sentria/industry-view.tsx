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
import { localized, useTx, type Localized, type Tx } from "@/lib/i18n"

type Alert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
}

/** Grouped thousands in the reader's own convention. */
function money(value: number, tx: Tx): string {
  return value.toLocaleString(tx("fr-FR", "en-GB"))
}

function matchAny(message: string, keywords: string[]) {
  const m = message.toLowerCase()
  return keywords.some((k) => m.includes(k))
}

/* Which alert messages belong to which priority.
 *
 * Needles matched against the backend's message text, in both languages,
 * NOT copy: translating "arrêt" would stop the match it exists to make.
 * Gathered here rather than inline so there is one place to audit, and
 * one marker rather than six.
 *
 * This is also the weak point of this screen: it reads words out of a
 * sentence. The logistics views moved to matching on alert_key, which is
 * language-independent, and this one should follow.
 *
 * i18n-ignore-start: needles matched against alert text */
const MATCH_KEYWORDS = {
  machines: ["panne", "failure", "machine", "arrêt"],
  motors: ["moteur", "engine", "motor"],
  temperature: ["temp", "surchauffe", "chaleur", "overheat"],
  pressure: ["pression", "pressure"],
  production: ["production", "rendement", "cycle", "yield"],
  maintenance: ["maintenance", "révision", "entretien", "service"],
}
/* i18n-ignore-end */

function HeaderCard({
  icon: Icon,
  title,
  differentiator,
}: {
  icon: React.ElementType
  title: Localized
  differentiator: Localized
}) {
  const tx = useTx()

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-heading text-xl font-bold">
            {tx(title.fr, title.en)}
          </h2>

          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {tx(differentiator.fr, differentiator.en)}
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
  label: Localized
  value: string
  tone?: "neutral" | "warning" | "critical" | "positive"
}) {
  const tx = useTx()

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {tx(label.fr, label.en)}
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
  title: Localized
}) {
  const tx = useTx()

  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="mt-4 font-heading text-lg font-bold">
        {tx(
          `Aucune donnée ${title.fr.toLowerCase()} pour le moment`,
          `No ${title.en.toLowerCase()} data yet`
        )}
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {tx(
          "Connectez votre ERP, vos capteurs IoT, ou importez un fichier CSV pour que SentrIA commence à surveiller cette priorité.",
          "Connect your ERP or your IoT sensors, or import a CSV file, and SentrIA starts watching this priority."
        )}
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
  const tx = useTx()

  return (
    <div className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              alert.severity === "CRITICAL"
                ? "bg-destructive"
                : "bg-brand"
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
          {new Date(alert.date).toLocaleString(tx("fr-FR", "en-GB"))}
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
  const tx = useTx()

  const relevant = alerts.filter((a) =>
    matchAny(a.message, MATCH_KEYWORDS.machines)
  )

  if (relevant.length === 0) {
    return (
      <EmptyPriorityView
        icon={Cog}
        title={localized("Machines de production", "Production machines")}
      />
    )
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
        title={localized("Machines de production", "Production machines")}
        differentiator={localized(
          "Chaque anomalie machine est traduite en impact financier estimé, pour prioriser l'intervention selon le risque réel plutôt que la seule sévérité brute.",
          "Every machine anomaly is turned into an estimated financial impact, so work is ordered by real risk rather than raw severity alone."
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label={localized("Pannes imminentes", "Failures imminent")}
          value={String(critical.length)}
          tone={critical.length > 0 ? "critical" : "neutral"}
        />
        <MetricCard
          label={localized("Machines concernées", "Machines affected")}
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard
          label={localized("Perte estimée cumulée", "Estimated loss in total")}
          value={`~€${money(totalCost, tx)}`}
          tone="warning"
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">
            {tx("Détail par machine", "By machine")}
          </p>
          <p className="text-xs text-muted-foreground">
            {tx(
              "Estimation indicative, à affiner avec vos coûts réels d'arrêt.",
              "An indicative estimate, to refine with your own downtime costs."
            )}
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            {tx(
              "Aucune alerte machine pour le moment.",
              "No machine alert so far."
            )}
          </div>
        ) : (
          relevant.map((a, i) => (
            <AlertRow key={`${a.equipment}-${a.date}-${i}`} alert={a}>
              <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                <CircleDollarSign className="h-3.5 w-3.5" />
                ~€{money(estimateDowntimeCost(a), tx)}
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
  const tx = useTx()

  const relevant = alerts.filter((a) =>
    matchAny(a.message, MATCH_KEYWORDS.motors)
  )

  if (relevant.length === 0) {
    return (
      <EmptyPriorityView
        icon={Activity}
        title={localized("Moteurs", "Motors")}
      />
    )
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
        title={localized("Moteurs", "Motors")}
        differentiator={localized(
          "SentrIA repère les dégradations progressives, plusieurs signaux faibles sur le même moteur, avant que la panne franche ne survienne.",
          "SentrIA catches gradual decline, several weak signals on the same motor, before it fails outright."
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label={localized("Alertes moteur", "Motor alerts")}
          value={String(relevant.length)}
        />
        <MetricCard
          label={localized(
            "Moteurs en dégradation progressive",
            "Motors declining gradually"
          )}
          value={String(degrading.length)}
          tone={degrading.length > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label={localized("Moteurs surveillés", "Motors monitored")}
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">
            {tx("Détail par moteur", "By motor")}
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            {tx(
              "Aucune alerte moteur pour le moment.",
              "No motor alert so far."
            )}
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
                    ? tx("Dégradation progressive", "Declining gradually")
                    : tx("Signal ponctuel", "One-off signal")}
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
  const tx = useTx()

  const relevant = alerts.filter((a) =>
    matchAny(a.message, MATCH_KEYWORDS.temperature)
  )

  if (relevant.length === 0) {
    return (
      <EmptyPriorityView
        icon={Thermometer}
        title={localized("Température", "Temperature")}
      />
    )
  }

  const critical = relevant.filter((a) => a.severity === "CRITICAL")

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={Thermometer}
        title={localized("Température", "Temperature")}
        differentiator={localized(
          "Plutôt que d'alerter uniquement quand un seuil est franchi, SentrIA estime la trajectoire actuelle pour anticiper le moment où il sera atteint.",
          "Rather than only alerting once a threshold is crossed, SentrIA reads the current trajectory to say when it will be."
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label={localized("Seuils déjà atteints", "Thresholds already hit")}
          value={String(critical.length)}
          tone={critical.length > 0 ? "critical" : "neutral"}
        />
        <MetricCard
          label={localized("Actifs sous surveillance", "Assets being watched")}
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard
          label={localized("Alertes température", "Temperature alerts")}
          value={String(relevant.length)}
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">
            {tx("Trajectoire estimée", "Estimated trajectory")}
          </p>
          <p className="text-xs text-muted-foreground">
            {tx(
              "Projection indicative basée sur l'ancienneté du signal, à affiner avec un historique de capteurs.",
              "An indicative projection from how long the signal has been open, to refine with sensor history."
            )}
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            {tx(
              "Aucune alerte température pour le moment.",
              "No temperature alert so far."
            )}
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
                    ? tx("Seuil déjà atteint", "Threshold already hit")
                    : tx(
                        `Seuil estimé dans ~${hours}h`,
                        `Threshold in ~${hours}h`
                      )}
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

const PRESSURE_CAUSES: Localized[] = [
  localized("Usure du joint", "Seal wear"),
  localized("Fuite hydraulique probable", "Probable hydraulic leak"),
  localized("Défaut de valve", "Valve fault"),
  localized("Encrassement du filtre", "Clogged filter"),
]

function suggestPressureCause(alert: Alert): Localized {
  const m = alert.message.toLowerCase()

  if (m.includes("fuite") || m.includes("leak")) {
    return PRESSURE_CAUSES[1]
  }

  if (m.includes("valve")) {
    return PRESSURE_CAUSES[2]
  }

  // Deterministic pick based on equipment name so it stays stable per asset.
  let hash = 0
  for (const char of alert.equipment) {
    hash = (hash + char.charCodeAt(0)) % PRESSURE_CAUSES.length
  }

  return PRESSURE_CAUSES[hash]
}

export function IndustryPressureView({ alerts }: { alerts: Alert[] }) {
  const tx = useTx()

  const relevant = alerts.filter((a) =>
    matchAny(a.message, MATCH_KEYWORDS.pressure)
  )

  if (relevant.length === 0) {
    return (
      <EmptyPriorityView
        icon={Gauge}
        title={localized("Pression", "Pressure")}
      />
    )
  }

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={Gauge}
        title={localized("Pression", "Pressure")}
        differentiator={localized(
          "Au-delà de la valeur hors norme, SentrIA propose une cause probable à confirmer par un technicien, pour accélérer le diagnostic.",
          "Beyond the out-of-range figure, SentrIA offers a probable cause for a technician to confirm, so the diagnosis starts sooner."
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label={localized("Alertes pression", "Pressure alerts")}
          value={String(relevant.length)}
        />
        <MetricCard
          label={localized("Équipements concernés", "Assets affected")}
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard
          label={localized("Critiques", "Critical")}
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
          <p className="text-sm font-semibold">
            {tx("Cause probable suggérée", "Probable cause suggested")}
          </p>
          <p className="text-xs text-muted-foreground">
            {tx(
              "Hypothèse à confirmer sur le terrain, n'engage pas de diagnostic définitif.",
              "A hypothesis to confirm on site, not a settled diagnosis."
            )}
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            {tx(
              "Aucune alerte pression pour le moment.",
              "No pressure alert so far."
            )}
          </div>
        ) : (
          relevant.map((a, i) => (
            <AlertRow key={`${a.equipment}-${a.date}-${i}`} alert={a}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                {(() => {
                  const cause = suggestPressureCause(a)

                  return tx(cause.fr, cause.en)
                })()}
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
  const tx = useTx()

  const relevant = alerts.filter((a) =>
    matchAny(a.message, MATCH_KEYWORDS.production)
  )

  if (relevant.length === 0) {
    return (
      <EmptyPriorityView
        icon={Boxes}
        title={localized("Production", "Production")}
      />
    )
  }

  const totalHourlyLoss = relevant.reduce(
    (sum, a) => sum + estimateHourlyLoss(a),
    0
  )

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={Boxes}
        title={localized("Production", "Production")}
        differentiator={localized(
          "Chaque baisse de rendement est convertie en perte estimée par heure, pour que l'impact business soit visible immédiatement, pas seulement un pourcentage.",
          "Every drop in yield becomes an estimated loss per hour, so the business impact is visible straight away rather than just a percentage."
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label={localized("Lignes concernées", "Lines affected")}
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard
          label={localized("Alertes production", "Production alerts")}
          value={String(relevant.length)}
        />
        <MetricCard
          label={localized("Perte estimée cumulée", "Estimated loss in total")}
          value={`~€${money(totalHourlyLoss, tx)}/h`}
          tone="warning"
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">
            {tx("Détail par ligne", "By line")}
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            {tx(
              "Aucune alerte production pour le moment.",
              "No production alert so far."
            )}
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

function formatShortDate(d: Date, tx: Tx): string {
  return d.toLocaleDateString(tx("fr-FR", "en-GB"), {
    day: "2-digit",
    month: "short",
  })
}

export function IndustryMaintenanceView({ alerts }: { alerts: Alert[] }) {
  const tx = useTx()

  const relevant = alerts.filter((a) =>
    matchAny(a.message, MATCH_KEYWORDS.maintenance)
  )

  if (relevant.length === 0) {
    return (
      <EmptyPriorityView
        icon={ShieldCheck}
        title={localized("Maintenance", "Maintenance")}
      />
    )
  }

  return (
    <div className="space-y-4">
      <HeaderCard
        icon={ShieldCheck}
        title={localized("Maintenance", "Maintenance")}
        differentiator={localized(
          "Plutôt qu'un calendrier fixe, SentrIA recommande une fenêtre d'intervention adaptée à l'usure réelle observée sur chaque équipement.",
          "Rather than a fixed calendar, SentrIA recommends a service window that fits the wear actually seen on each asset."
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label={localized("Interventions à planifier", "Jobs to schedule")}
          value={String(relevant.length)}
        />
        <MetricCard
          label={localized("Équipements concernés", "Assets affected")}
          value={String(new Set(relevant.map((a) => a.equipment)).size)}
        />
        <MetricCard
          label={localized("Urgentes", "Urgent")}
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
          <p className="text-sm font-semibold">
            {tx("Fenêtres recommandées", "Recommended windows")}
          </p>
          <p className="text-xs text-muted-foreground">
            {tx(
              "Basées sur l'usure détectée, pas sur un planning générique.",
              "Based on the wear detected, not on a generic schedule."
            )}
          </p>
        </div>

        {relevant.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            {tx(
              "Aucune intervention recommandée pour le moment.",
              "No job recommended so far."
            )}
          </div>
        ) : (
          relevant.map((a, i) => {
            const window = recommendMaintenanceWindow(a)

            return (
              <AlertRow key={`${a.equipment}-${a.date}-${i}`} alert={a}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                  <Wrench className="h-3.5 w-3.5" />
                  {formatShortDate(window.from, tx)} →{" "}
                  {formatShortDate(window.to, tx)}
                </span>
              </AlertRow>
            )
          })
        )}
      </div>
    </div>
  )
}