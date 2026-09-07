"use client"

import { Shield, Sparkles, TrendingUp, Wrench, Fuel, Clock3, Package, Radar, Cpu } from "lucide-react"
import { cn } from "@/lib/utils"

type Alert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
}

type Recommendation = {
  equipment: string
  sector?: string | null
  severity: "WARNING" | "CRITICAL" | string
  date: string
  message: string
  risk_score?: number | null
  alert_key?: string | null
  recommended_action: string
  action_category: string
}

type RecommendationsPanelProps = {
  recommendations: Recommendation[]
  totalRecommendationsCount: number
  alerts: Alert[]
  opsType?: string | null
}

const SECTOR_LABEL: Record<string, string> = {
  all: "Tous",
  industry: "Industrie",
  health: "Santé",
  agriculture: "Agriculture",
  transportation: "Transport",
  logistics: "Logistique",
  energy: "Énergie",
}

const OPS_TYPE_LABEL: Record<string, string> = {
  port: "Port & conteneurs",
  entrepot: "Entrepôt & manutention",
  transport: "Transport & distribution",
  expedition: "Expédition",
  froid: "Chaîne du froid",
  multi: "Opérations logistiques",
}

const CATEGORY_ICON: Record<string, typeof Wrench> = {
  maintenance: Wrench,
  fuel: Fuel,
  delay: Clock3,
  stock: Package,
  cold_chain: Package,
  expiry: Package,
  capacity: Cpu,
  predictive: Radar,
  other: Sparkles,
}

const CATEGORY_LABEL: Record<string, string> = {
  maintenance: "Maintenance",
  fuel: "Carburant",
  delay: "Retard",
  stock: "Stock",
  cold_chain: "Chaine du froid",
  expiry: "Expiration",
  capacity: "Capacite",
  predictive: "Predictif",
  other: "Autre",
}

const IMPACT_HINT: Record<string, string> = {
  maintenance: "Évite un arrêt non planifié de plusieurs heures",
  fuel: "Évite une immobilisation faute de carburant",
  delay: "Limite un retard qui peut s'aggraver rapidement",
  stock: "Évite une rupture de stock imminente",
  cold_chain: "Évite une perte de produits par rupture du froid",
  expiry: "Évite une perte liée à des produits périmés",
  capacity: "Évite une saturation qui bloque le flux",
  predictive: "Anticipe une panne avant qu'elle ne survienne",
  other: "Évite une perturbation opérationnelle",
}

export function RecommendationsPanel({
  recommendations,
  totalRecommendationsCount,
  alerts,
  opsType,
}: RecommendationsPanelProps) {
  if (recommendations.length === 0) {
    if (totalRecommendationsCount > 0) {
      return (
        <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 shrink-0" />
          Aucune priorité urgente pour ce secteur pour le moment. Tout est
          sous contrôle ici.
        </div>
      )
    }

    return null
  }

  const [top, ...rest] = recommendations

  const TopIcon = CATEGORY_ICON[top.action_category] ?? Sparkles
  const topCritical = top.severity === "CRITICAL"

  const topRiskPct =
    typeof top.risk_score === "number"
      ? Math.round(
          top.risk_score > 1
            ? Math.min(top.risk_score, 100)
            : top.risk_score * 100
        )
      : null

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)

  const recurrenceOf = (equipment: string) =>
    alerts.filter((a) => a.equipment === equipment && new Date(a.date) >= cutoff)
      .length

  const topRecurrence = recurrenceOf(top.equipment)
  const opsLabel = opsType ? OPS_TYPE_LABEL[opsType] : undefined

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" />
          </div>

          <div>
            <h3 className="font-heading text-lg font-bold">
              Priorités du moment
            </h3>

            <p className="mt-0.5 text-sm text-muted-foreground">
              {recommendations.length} situations classées par urgence, avec
              une action concrète pour chacune.
            </p>

            {opsLabel && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                <Shield className="h-3 w-3" />
                Vue adaptée : {opsLabel}
              </span>
            )}
          </div>
        </div>

        {rest.length > 0 && (
          <span className="hidden shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
            Faites défiler pour voir la suite
          </span>
        )}
      </div>

      <div className="relative mt-6 flex flex-col gap-4 lg:flex-row">
        <div className="flex w-full shrink-0 flex-col justify-between rounded-2xl border border-transparent bg-gradient-to-br from-accent/20 via-card to-card p-5 ring-1 ring-accent/40 lg:w-72">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                <Sparkles className="h-3 w-3" />
                Priorité n°1
              </span>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
                <TopIcon className="h-4 w-4" />
              </div>
            </div>

            <p className="mt-4 font-heading text-base font-bold leading-snug">
              {top.equipment}
            </p>

            <p className="mt-2 text-sm leading-5 text-foreground/90">
              {top.recommended_action}
            </p>

            <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
              <Shield className="mt-0.5 h-3 w-3 shrink-0 text-accent-foreground" />

              <p className="text-[11px] leading-4 text-muted-foreground">
                {IMPACT_HINT[top.action_category] ?? IMPACT_HINT.other}
              </p>
            </div>

            {topRecurrence > 1 && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                <TrendingUp className="h-3 w-3" />
                Réapparu {topRecurrence} fois cette semaine
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  topCritical
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/15 text-amber-600"
                )}
              >
                {top.severity}
              </span>

              <span className="text-[10px] text-muted-foreground">
                {CATEGORY_LABEL[top.action_category] ?? "Autre"}
              </span>
            </div>

            {topRiskPct !== null && (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/70">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      topCritical ? "bg-destructive" : "bg-amber-500"
                    )}
                    style={{ width: `${topRiskPct}%` }}
                  />
                </div>

                <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                  {topRiskPct}%
                </span>
              </div>
            )}
          </div>
        </div>

        {rest.length > 0 && (
          <div className="scrollbar-hide -mx-1 flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
            {rest.map((rec, idx) => {
              const rank = idx + 2
              const Icon = CATEGORY_ICON[rec.action_category] ?? Sparkles
              const isCritical = rec.severity === "CRITICAL"
              const recurrence = recurrenceOf(rec.equipment)

              return (
                <div
                  key={`${rec.equipment}-${rec.alert_key}-${idx}`}
                  className="group flex w-64 shrink-0 snap-start flex-col rounded-2xl border border-border bg-background p-4 transition-all duration-300 ease-out animate-in fade-in slide-in-from-right-2 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
                  style={{
                    animationDelay: `${idx * 70}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                        isCritical
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/15 text-amber-600"
                      )}
                    >
                      {String(rank).padStart(2, "0")}
                    </span>

                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <p className="mt-3 truncate text-sm font-semibold">
                    {rec.equipment}
                  </p>

                  <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                    {rec.recommended_action}
                  </p>

                  {recurrence > 1 && (
                    <div className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold text-destructive">
                      <TrendingUp className="h-2.5 w-2.5" />
                      {recurrence}x cette semaine
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                        isCritical
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/15 text-amber-600"
                      )}
                    >
                      {rec.severity}
                    </span>

                    {rec.sector && (
                      <span className="truncate text-[9px] uppercase tracking-wider text-muted-foreground">
                        {SECTOR_LABEL[rec.sector] ?? rec.sector}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}