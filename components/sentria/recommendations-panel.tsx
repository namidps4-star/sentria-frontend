"use client"

import { useState } from "react"
import {
  Shield,
  Sparkles,
  TrendingUp,
  Wrench,
  Fuel,
  Clock3,
  Package,
  Radar,
  Cpu,
  Gauge,
  Check,
  X,
  ShoppingCart,
  FlaskConical,
  HeartPulse,
  Truck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { computeConfidence, confidenceWord } from "@/lib/confidence"
import { localized, useTx, type Localized, type Tx, resolve } from "@/lib/i18n"

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
  /**
   * Sent by the backend (/recommendations computes these in
   * pipeline/confidence.py). If they're ever missing — e.g. the endpoint
   * errored and the frontend is showing stale data — the helpers below
   * fall back to a clearly-labelled local estimate rather than hiding
   * this step of the decision loop entirely.
   */
  confidence?: number | null
  reasoning?: string | null
}

type ActionStatus = "done" | "dismissed"

type ActionRecord = {
  status: ActionStatus
  at: string
}

type RecommendationsPanelProps = {
  recommendations: Recommendation[]
  totalRecommendationsCount: number
  alerts: Alert[]
  opsType?: string | null
}

const SECTOR_LABEL: Record<string, Localized> = {
  all: localized("Tous", "All"),
  industry: localized("Industrie", "Industry"),
  health: localized("Santé", "Health"),
  agriculture: localized("Agriculture", "Agriculture"),
  transportation: localized("Transport", "Transport"),
  logistics: localized("Logistique", "Logistics"),
  energy: localized("Énergie", "Energy"),
  retail: localized("Commerce", "Retail"),
}

const OPS_TYPE_LABEL: Record<string, Localized> = {
  port: localized("Port & conteneurs", "Port & containers"),
  entrepot: localized("Entrepôt & manutention", "Warehouse & handling"),
  transport: localized("Transport & distribution", "Transport & distribution"),
  expedition: localized("Expédition", "Dispatch"),
  froid: localized("Chaîne du froid", "Cold chain"),
  multi: localized("Opérations logistiques", "Logistics operations"),
}

const PANEL_FOCUS =
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

const CATEGORY_ICON: Record<string, typeof Wrench> = {
  maintenance: Wrench,
  fuel: Fuel,
  delay: Clock3,
  stock: Package,
  cold_chain: Package,
  expiry: Package,
  capacity: Cpu,
  predictive: Radar,
  storage: Package,
  sales: ShoppingCart,
  staffing: Sparkles,
  shrinkage: ShoppingCart,
  operations: Cpu,
  diagnostics: FlaskConical,
  critical_supply: HeartPulse,
  distribution: Truck,
  other: Sparkles,
}

const CATEGORY_LABEL: Record<string, Localized> = {
  maintenance: localized("Maintenance", "Maintenance"),
  fuel: localized("Carburant", "Fuel"),
  delay: localized("Retard", "Delay"),
  stock: localized("Stock", "Stock"),
  cold_chain: localized("Chaîne du froid", "Cold chain"),
  expiry: localized("Expiration", "Expiry"),
  capacity: localized("Capacité", "Capacity"),
  predictive: localized("Prédictif", "Predictive"),
  storage: localized("Stockage", "Storage"),
  sales: localized("Ventes", "Sales"),
  staffing: localized("Personnel", "Staffing"),
  shrinkage: localized("Démarque", "Shrinkage"),
  operations: localized("Opérations", "Operations"),
  diagnostics: localized("Diagnostic", "Diagnostics"),
  critical_supply: localized("Stock critique", "Critical stock"),
  distribution: localized("Répartition", "Distribution"),
  other: localized("Autre", "Other"),
}

const IMPACT_HINT: Record<string, Localized> = {
  maintenance: localized(
    "Évite un arrêt non planifié de plusieurs heures",
    "Avoids an unplanned stoppage of several hours"
  ),
  fuel: localized(
    "Évite une immobilisation faute de carburant",
    "Avoids a vehicle standing still for want of fuel"
  ),
  delay: localized(
    "Limite un retard qui peut s'aggraver rapidement",
    "Contains a delay that can get worse quickly"
  ),
  stock: localized(
    "Évite une rupture de stock imminente",
    "Avoids a stockout that is about to happen"
  ),
  cold_chain: localized(
    "Évite une perte de produits par rupture du froid",
    "Avoids losing product to a break in the cold chain"
  ),
  expiry: localized(
    "Évite une perte liée à des produits périmés",
    "Avoids a loss to expired product"
  ),
  capacity: localized(
    "Évite une saturation qui bloque le flux",
    "Avoids a bottleneck that stops the flow"
  ),
  predictive: localized(
    "Anticipe une panne avant qu'elle ne survienne",
    "Gets ahead of a breakdown before it happens"
  ),
  storage: localized(
    "Évite une perte liée à une durée de stockage trop longue",
    "Avoids a loss to goods sitting in storage too long"
  ),
  sales: localized(
    "Limite une perte de chiffre d'affaires qui s'installe",
    "Contains a revenue loss that is setting in"
  ),
  staffing: localized(
    "Évite des files d'attente et des ventes perdues",
    "Avoids queues and lost sales"
  ),
  shrinkage: localized(
    "Limite une perte de marchandise non expliquée",
    "Contains unexplained loss of goods"
  ),
  operations: localized(
    "Débloque une opération qui empêche de vendre",
    "Unblocks an operation that is stopping you selling"
  ),
  other: localized(
    "Évite une perturbation opérationnelle",
    "Avoids an operational disruption"
  ),
}

/**
 * The backend sends a real confidence score. This wrapper only falls back
 * to a local estimate when that field is missing, so the "how sure are we?"
 * step of the decision loop is never silently dropped.
 */
function confidenceOf(rec: Recommendation, recurrence: number): number {
  if (typeof rec.confidence === "number") {
    return Math.round(Math.max(0, Math.min(100, rec.confidence)))
  }

  return computeConfidence({
    riskScore: rec.risk_score,
    severity: rec.severity,
    recurrence,
  })
}

function reasoningOf(
  rec: Recommendation,
  recurrence: number,
  tx: Tx
): string {
  /* Written by the backend in the language it fired in, so it is passed
     through rather than re-derived. See PASSATION.md. */
  if (rec.reasoning) return rec.reasoning

  const parts: string[] = []

  parts.push(
    rec.severity === "CRITICAL"
      ? tx(
          "Classé critique car le signal dépasse le seuil de sécurité attendu pour cet actif.",
          "Rated critical because the signal is past the safety threshold expected for this asset."
        )
      : tx(
          "Classé en surveillance car le signal s'écarte du comportement habituel de cet actif.",
          "Rated watch because the signal is drifting from this asset's usual behaviour."
        )
  )

  if (recurrence > 1) {
    parts.push(
      tx(
        `Ce n'est pas un cas isolé : ${recurrence} alertes similaires cette semaine.`,
        `This is not a one-off: ${recurrence} similar alerts this week.`
      )
    )
  }

  return parts.join(" ")
}

function actionKeyFor(rec: Recommendation): string {
  return `${rec.equipment}-${rec.alert_key ?? rec.message}`
}

export function RecommendationsPanel({
  recommendations,
  totalRecommendationsCount,
  alerts,
  opsType,
}: RecommendationsPanelProps) {
  const tx = useTx()

  /** Resolve a module-level pair. */
  const px = (text: Localized | undefined) => resolve(text, tx)

  /*
   * Closing the decision loop: once someone acts on a priority, SentrIA
   * remembers it and shows the result back. Without this, the panel is
   * just a smarter alert list — you could never tell what the system has
   * actually helped with.
   *
   * Stored in localStorage for now, which means it's per-browser: marking
   * something handled on a laptop won't show up on a phone. Moving this
   * to the backend is what makes the outcome trail real.
   */
  const [actionsLog, setActionsLog] = useState<Record<string, ActionRecord>>(
    () => {
      if (typeof window === "undefined") return {}

      try {
        return JSON.parse(
          localStorage.getItem("sentria_actions_log") || "{}"
        )
      } catch {
        return {}
      }
    }
  )

  function recordAction(key: string, status: ActionStatus) {
    setActionsLog((current) => {
      const next = {
        ...current,
        [key]: {
          status,
          at: new Date().toLocaleTimeString(tx("fr-FR", "en-GB"), {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("sentria_actions_log", JSON.stringify(next))
      }

      return next
    })
  }

  if (recommendations.length === 0) {
    if (totalRecommendationsCount > 0) {
      return (
        <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 shrink-0" />
          {tx(
            "Aucune priorité urgente pour ce secteur pour le moment. Tout est sous contrôle ici.",
            "No urgent priority for this sector right now. Everything here is under control."
          )}
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
  const topConfidence = confidenceOf(top, topRecurrence)
  const topReasoning = reasoningOf(top, topRecurrence, tx)
  const topKey = actionKeyFor(top)
  const topAction = actionsLog[topKey]

  const opsMeta = opsType ? OPS_TYPE_LABEL[opsType] : undefined
  const opsLabel = opsMeta ? px(opsMeta) : undefined

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
              {tx(
                "Qu'est-ce qui a besoin de votre attention maintenant ?",
                "What needs your attention right now?"
              )}
            </h3>

            <p className="mt-0.5 text-sm text-muted-foreground">
              {tx(
                `${recommendations.length} situations classées par urgence · preuve, confiance et action pour chacune.`,
                `${recommendations.length} situations ranked by urgency · evidence, confidence and an action for each.`
              )}
            </p>

            {opsLabel && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                <Shield className="h-3 w-3" />
                {tx("Vue adaptée :", "Tailored view:")} {opsLabel}
              </span>
            )}
          </div>
        </div>

        {rest.length > 0 && (
          <span className="hidden shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
            {tx(
              "Faites défiler pour voir la suite",
              "Scroll for the rest"
            )}
          </span>
        )}
      </div>

      <div className="relative mt-6 flex flex-col gap-4 lg:flex-row">
        <div className="flex w-full shrink-0 flex-col justify-between rounded-2xl border border-transparent bg-gradient-to-br from-accent/20 via-card to-card p-5 ring-1 ring-accent/40 lg:w-96">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                <Sparkles className="h-3 w-3" />
                {tx("Priorité n°1", "Priority no. 1")}
              </span>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
                <TopIcon className="h-4 w-4" />
              </div>
            </div>

            <p className="mt-4 font-heading text-base font-bold leading-snug">
              {top.equipment}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
                {px(CATEGORY_LABEL[top.action_category] ?? CATEGORY_LABEL.other)}
              </span>

              {topRecurrence > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  <TrendingUp className="h-3 w-3" />
                  {tx(
                    `${topRecurrence}x cette semaine`,
                    `${topRecurrence}x this week`
                  )}
                </span>
              )}
            </div>

            {/* 1 · EVIDENCE + CONFIDENCE */}
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                1 · Preuve &amp; confiance
              </p>

              {topRiskPct !== null ? (
                <div className="mt-1.5 flex items-center gap-2">
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
                    {tx(`${topRiskPct}% de risque`, `${topRiskPct}% risk`)}
                  </span>
                </div>
              ) : (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {tx(
                    "Score de risque non calculé pour ce secteur.",
                    "No risk score computed for this sector."
                  )}
                </p>
              )}

              <div
                className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                title={tx(
                  "À quel point SentrIA est sûr de cette analyse",
                  "How sure SentrIA is of this analysis"
                )}
              >
                <Gauge className="h-3 w-3" />
                {tx("Confiance", "Confidence")}{" "}
                {confidenceWord(topConfidence, tx)} · {topConfidence}%
              </div>
            </div>

            {/* 2 · REASONING */}
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                {tx("2 · Pourquoi", "2 · Why")}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {topReasoning}
              </p>
            </div>

            {/* 3 · IMPACT */}
            <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-background/60 px-2.5 py-2">
              <Shield className="mt-0.5 h-3 w-3 shrink-0 text-accent-foreground" />

              <p className="text-[11px] leading-4 text-muted-foreground">
                {px(IMPACT_HINT[top.action_category] ?? IMPACT_HINT.other)}
              </p>
            </div>

            {/* 4 · RECOMMENDATION */}
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                {tx("4 · Recommandation", "4 · Recommendation")}
              </p>
              <p className="mt-1 text-sm leading-5 text-foreground/90">
                {top.recommended_action}
              </p>
            </div>
          </div>

          {/* 5 · HUMAN ACTION → 6 · OUTCOME */}
          <div className="mt-4">
            {!topAction ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => recordAction(topKey, "done")}
                  className={"inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90" + PANEL_FOCUS}
                >
                  <Check className="h-3.5 w-3.5" />
                  {tx("Marquer traité", "Mark handled")}
                </button>

                <button
                  type="button"
                  onClick={() => recordAction(topKey, "dismissed")}
                  className={"inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted" + PANEL_FOCUS}
                >
                  <X className="h-3.5 w-3.5" />
                  {tx("Ignorer", "Dismiss")}
                </button>
              </div>
            ) : (
              <div
                role="status"
                className={cn(
                  "rounded-xl border px-3 py-2.5",
                  topAction.status === "done"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-border bg-background/60"
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em]",
                    topAction.status === "done"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  <Check className="h-3 w-3" />
                  {tx("6 · Résultat", "6 · Outcome")}
                </div>

                <p className="mt-1 text-[11px] leading-4 text-foreground/90">
                  {topAction.status === "done"
                    ? tx(
                        `Traité à ${topAction.at}. SentrIA continue de surveiller cet actif pour confirmer l'effet.`,
                        `Handled at ${topAction.at}. SentrIA keeps watching this asset to confirm the effect.`
                      )
                    : tx(
                        `Écarté à ${topAction.at}. Réapparaîtra si le signal s'aggrave.`,
                        `Dismissed at ${topAction.at}. It will come back if the signal worsens.`
                      )}
                </p>
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
              const confidence = confidenceOf(rec, recurrence)
              const key = actionKeyFor(rec)
              const action = actionsLog[key]

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
                      {tx(
                        `${recurrence}x cette semaine`,
                        `${recurrence}x this week`
                      )}
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

                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-medium text-muted-foreground"
                      title={tx(
                        "Confiance de SentrIA dans cette analyse",
                        "How confident SentrIA is in this analysis"
                      )}
                    >
                      <Gauge className="h-2.5 w-2.5" />
                      {confidence}%
                    </span>

                    {rec.sector && (
                      <span className="truncate text-[9px] uppercase tracking-wider text-muted-foreground">
                        {SECTOR_LABEL[rec.sector]
                          ? px(SECTOR_LABEL[rec.sector])
                          : rec.sector}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex gap-1.5">
                    {!action ? (
                      <>
                        <button
                          type="button"
                          onClick={() => recordAction(key, "done")}
                          className={"inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-foreground px-2 py-1.5 text-[10px] font-semibold text-background transition-opacity hover:opacity-90" + PANEL_FOCUS}
                        >
                          <Check className="h-3 w-3" />
                          {tx("Traité", "Handled")}
                        </button>

                        <button
                          type="button"
                          onClick={() => recordAction(key, "dismissed")}
                          className={"inline-flex items-center justify-center rounded-lg border border-border px-2 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted" + PANEL_FOCUS}
                          aria-label={tx("Ignorer", "Dismiss")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <span
                        role="status"
                        className={cn(
                          "inline-flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold",
                          action.status === "done"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Check className="h-3 w-3" />
                        {action.status === "done"
                          ? tx(
                              `Traité à ${action.at}`,
                              `Handled at ${action.at}`
                            )
                          : tx(
                              `Écarté à ${action.at}`,
                              `Dismissed at ${action.at}`
                            )}
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