"use client"

import { SeverityTag } from "./status-tag"
import { WholesalerAdvice } from "./wholesaler-advice"
import type { AlertParams } from "@/lib/value-at-risk"
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
  ArrowRight,
  Check,
  X,
  ShoppingCart,
  FlaskConical,
  HeartPulse,
  Truck,
  Wallet,
} from "@/lib/icons"
import { cn } from "@/lib/utils"
import { sendAlertFeedback } from "@/lib/feedback"
import { computeConfidence, confidenceWord } from "@/lib/confidence"
import { localized, useTx, type Localized, type Tx, resolve } from "@/lib/i18n"

type Alert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
  alert_key?: string | null
  params?: AlertParams
}

type Recommendation = {
  equipment: string
  sector?: string | null
  severity: "WARNING" | "CRITICAL" | string
  date: string
  message: string
  risk_score?: number | null
  alert_key?: string | null
  /** The department that raised it (the API sends it). */
  business_type?: string | null
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
  /** The alerts did not load, or the data behind them is old (L4): an empty
   *  list is then not "all under control". */
  unmeasured?: boolean
  /** Opens the Tracking page: the "See all" link shows only when set. */
  onOpenTracking?: () => void
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
  deadstock: Package,
  credit: Wallet,
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
  deadstock: localized("Stock dormant", "Dead stock"),
  credit: localized("Crédit client", "Customer credit"),
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
  deadstock: localized(
    "Libère la trésorerie bloquée dans des invendus",
    "Frees up cash tied up in unsold stock"
  ),
  credit: localized(
    "Évite une créance qui ne sera jamais payée",
    "Avoids a debt that will never be paid"
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
     through rather than re-derived. */
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
  unmeasured = false,
  onOpenTracking,
}: RecommendationsPanelProps) {
  const tx = useTx()

  /** The params of the alert a recommendation came from: what the delivery
   *  advice reads (days of stock left). */
  const paramsOf = (rec: Recommendation) =>
    (
      alerts.find((a) => a.equipment === rec.equipment && a.date === rec.date) ??
      alerts.find((a) => a.equipment === rec.equipment && a.alert_key === rec.alert_key)
    )?.params

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

  function recordAction(
    key: string,
    status: ActionStatus,
    rec?: Recommendation
  ) {
    // F-SUPPRESS: the server keeps the log per company, so an alert
    // dismissed again and again can be lowered. The local log below
    // still drives this panel.
    if (rec) {
      sendAlertFeedback(rec.alert_key, rec.equipment, status === "done" ? "acted" : "dismissed")
    }

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
          {unmeasured
            ? tx(
                "Aucune priorité urgente pour ce secteur dans les données dont nous disposons. Elles ne sont pas à jour : cela ne dit pas que tout va bien.",
                "No urgent priority for this sector in the data we hold. It is not up to date, so this does not say all is well."
              )
            : tx(
                "Aucune priorité urgente pour ce secteur pour le moment. Tout est sous contrôle ici.",
                "No urgent priority for this sector right now. Everything here is under control."
              )}
        </div>
      )
    }

    return null
  }

  const [top, ...rest] = recommendations

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

  /* A priority's number: big, light, with the lime line under it, like the
     Tracking board and the Alert detail card. */
  const numeral = (n: number, size: string, tone: string) => (
    <span
      className={cn("relative inline-block pb-2.5 font-heading font-light leading-none tracking-tight tabular-nums", size, tone)}
      aria-hidden="true"
    >
      {String(n).padStart(2, "0")}
      <span className="absolute bottom-0 left-0.5 h-1 w-[26px] rounded-full bg-accent" />
    </span>
  )

  const statusBox = (action: ActionRecord) => (
    <div
      role="status"
      className={cn(
        "rounded-2xl px-3.5 py-3",
        action.status === "done" ? "bg-emerald-500/15 ring-1 ring-emerald-500/30" : "bg-white/10"
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-sidebar-foreground/60">
        <Check className="h-3 w-3" />
        {tx("Résultat", "Outcome")}
      </div>

      <p className="mt-1 text-xs leading-5 text-sidebar-foreground/85">
        {action.status === "done"
          ? tx(
              `Traité à ${action.at}. SentrIA continue de surveiller cet actif pour confirmer l'effet.`,
              `Handled at ${action.at}. SentrIA keeps watching this asset to confirm the effect.`
            )
          : tx(
              `Écarté à ${action.at}. Réapparaîtra si le signal s'aggrave.`,
              `Dismissed at ${action.at}. It will come back if the signal worsens.`
            )}
      </p>
    </div>
  )

  return (
    <div data-testid="top5" className="squircle rounded-[34px] border border-border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pb-3.5 pt-2">
        <h3 className="font-heading text-xl font-bold tracking-tight">
          {tx(`Top ${recommendations.length} priorités`, `Top ${recommendations.length} priorities`)}
        </h3>

        <p className="text-[13px] text-muted-foreground">
          {tx("classées par urgence, chacune avec son action", "ranked by urgency, each with its action")}
        </p>

        {opsLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
            <Shield className="h-3 w-3" />
            {tx("Vue adaptée :", "Tailored view:")} {opsLabel}
          </span>
        )}

        {onOpenTracking && (
          <button
            type="button"
            onClick={onOpenTracking}
            className={"ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full bg-muted px-4 text-[13px] font-bold transition-colors hover:bg-muted/70" + PANEL_FOCUS}
          >
            {tx("Tout voir dans le suivi", "See all in Tracking")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <div data-testid="top5-lead" className="squircle flex flex-col justify-between rounded-[28px] bg-sidebar p-5 text-sidebar-foreground">
          <div>
            <div className="flex items-start gap-2.5">
              {numeral(1, "text-[52px]", "text-sidebar-foreground/60")}

              <span className="ml-auto mt-2 shrink-0">
                <SeverityTag severity={top.severity} tx={tx} size="sm" />
              </span>
            </div>

            <p className="mt-2 font-heading text-[22px] font-bold leading-tight tracking-tight">{top.equipment}</p>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-sidebar-foreground/60">
              <span>{px(CATEGORY_LABEL[top.action_category] ?? CATEGORY_LABEL.other)}</span>

              {topRecurrence > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-sidebar-foreground">
                  <TrendingUp className="h-3 w-3" />
                  {tx(`${topRecurrence}x cette semaine`, `${topRecurrence}x this week`)}
                </span>
              )}
            </div>

            <div className="squircle mt-3.5 rounded-3xl bg-accent px-4 py-3.5 text-accent-foreground">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] opacity-75">
                {tx("À faire maintenant", "Do this now")}
              </p>
              <p className="mt-1 text-[16.5px] font-extrabold leading-snug">{top.recommended_action}</p>
            </div>

            <div className="mt-4 flex gap-6 px-1">
              <div
                title={tx(
                  "Gravité du problème lui-même, calculée à partir des mesures brutes",
                  "How severe the problem itself is, computed from the raw measurements"
                )}
              >
                <div
                  className={cn(
                    "relative pb-2.5 font-heading text-[30px] font-light leading-none tracking-tight tabular-nums",
                    topRiskPct === null && "text-sidebar-foreground/40"
                  )}
                >
                  {topRiskPct === null ? "—" : topRiskPct}
                  {topRiskPct !== null && <span className="ml-0.5 text-[13px] font-semibold opacity-50">/100</span>}
                  <span className={cn("absolute bottom-0 left-0.5 h-1 w-[22px] rounded-full", topRiskPct === null ? "bg-white/20" : "bg-accent")} />
                </div>
                <p className="mt-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-sidebar-foreground/55">
                  {tx("Risque", "Risk")}
                </p>
              </div>

              <div title={tx("À quel point SentrIA est sûr de cette analyse", "How sure SentrIA is of this analysis")}>
                <div className="relative pb-2.5 font-heading text-[30px] font-light leading-none tracking-tight tabular-nums">
                  {topConfidence}
                  <span className="ml-0.5 text-[13px] font-semibold opacity-50">%</span>
                  <span className="absolute bottom-0 left-0.5 h-1 w-[22px] rounded-full bg-accent" />
                </div>
                <p className="mt-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-sidebar-foreground/55">
                  {tx("Confiance", "Confidence")} · {confidenceWord(topConfidence, tx)}
                </p>
              </div>
            </div>

            <p className="mt-3.5 text-[13px] leading-relaxed text-sidebar-foreground/70">{topReasoning}</p>

            <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug text-sidebar-foreground/55">
              <Shield className="mt-0.5 h-3 w-3 shrink-0" />
              {px(IMPACT_HINT[top.action_category] ?? IMPACT_HINT.other)}
            </p>

            <WholesalerAdvice
              alertKey={top.alert_key}
              params={paramsOf(top)}
              department={top.business_type}
              className="mt-3"
            />
          </div>

          <div className="mt-4">
            {!topAction ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => recordAction(topKey, "done", top)}
                  className={"inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-bold text-accent-foreground transition-opacity hover:opacity-90" + PANEL_FOCUS}
                >
                  <Check className="h-3.5 w-3.5" />
                  {tx("Marquer traité", "Mark handled")}
                </button>

                <button
                  type="button"
                  onClick={() => recordAction(topKey, "dismissed", top)}
                  aria-label={tx("Ignorer", "Dismiss")}
                  title={tx("Ignorer", "Dismiss")}
                  className={"inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-sidebar-foreground/70 transition-colors hover:bg-white/20" + PANEL_FOCUS}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              statusBox(topAction)
            )}
          </div>
        </div>

        {rest.length > 0 && (
          <div className="flex min-w-0 flex-col gap-2">
            {rest.map((rec, idx) => {
              const rank = idx + 2
              const Icon = CATEGORY_ICON[rec.action_category] ?? Sparkles
              const recurrence = recurrenceOf(rec.equipment)
              const key = actionKeyFor(rec)
              const action = actionsLog[key]

              return (
                <div
                  key={`${rec.equipment}-${rec.alert_key}-${idx}`}
                  data-testid="top5-row"
                  className="squircle grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 rounded-3xl bg-muted px-4 py-3.5 animate-in fade-in slide-in-from-right-2 sm:grid-cols-[3.75rem_minmax(0,1fr)_auto]"
                  style={{ animationDelay: `${idx * 70}ms`, animationFillMode: "backwards" }}
                >
                  {numeral(rank, "text-4xl", "text-muted-foreground")}

                  <div className="min-w-0">
                    <p className="truncate text-[16.5px] font-bold leading-tight tracking-tight">{rec.equipment}</p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <SeverityTag severity={rec.severity} tx={tx} size="xs" />

                      <span className="text-[12px] text-muted-foreground">
                        {px(CATEGORY_LABEL[rec.action_category] ?? CATEGORY_LABEL.other)}
                      </span>

                      {recurrence > 1 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold">
                          <TrendingUp className="h-3 w-3" />
                          {tx(`${recurrence}x cette semaine`, `${recurrence}x this week`)}
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-snug text-muted-foreground" title={rec.recommended_action}>
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{rec.recommended_action}</span>
                    </p>

                    <WholesalerAdvice
                      tone="light"
                      alertKey={rec.alert_key}
                      params={paramsOf(rec)}
                      department={rec.business_type}
                      className="mt-2"
                    />
                  </div>

                  <div className="col-span-2 flex shrink-0 items-center gap-1.5 sm:col-span-1">
                    {!action ? (
                      <>
                        <button
                          type="button"
                          onClick={() => recordAction(key, "done", rec)}
                          className={"inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-[13px] font-bold text-background transition-opacity hover:opacity-90 sm:flex-none" + PANEL_FOCUS}
                        >
                          <Check className="h-3.5 w-3.5" />
                          {tx("Traité", "Handled")}
                        </button>

                        <button
                          type="button"
                          onClick={() => recordAction(key, "dismissed", rec)}
                          aria-label={tx("Ignorer", "Dismiss")}
                          title={tx("Ignorer", "Dismiss")}
                          className={"inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground transition-colors hover:text-foreground" + PANEL_FOCUS}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span
                        role="status"
                        className={cn(
                          "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-bold",
                          action.status === "done"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-card text-muted-foreground"
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {action.status === "done"
                          ? tx(`Traité à ${action.at}`, `Handled at ${action.at}`)
                          : tx(`Écarté à ${action.at}`, `Dismissed at ${action.at}`)}
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
