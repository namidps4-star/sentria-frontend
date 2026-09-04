"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  FileWarning,
  Sparkles,
  Truck,
} from "lucide-react"
import { cn } from "@/lib/utils"

type StatusLevel = "ok" | "watch" | "blocked"

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

type SecondaryRupture = {
  id: string
  label: string
  sub: string
  pct: number
  level: "watch" | "blocked"
  detail: string
  icon: React.ElementType
}

type TimelineStep = {
  t: string
  d: string
  level: StatusLevel
}

const GRID_SIZE = 48
const WATCH_INDEXES = [3, 9, 14, 22, 31, 37, 41]
const BLOCKED_INDEX = 19

const SECONDARY_RUPTURES: SecondaryRupture[] = [
  {
    id: "stock",
    label: "Stock",
    sub: "Stock de sécurité atteint",
    pct: 42,
    level: "watch",
    detail:
      "41h restantes avant rupture sur 8 commandes. La consommation a dépassé le seuil de réapprovisionnement automatique hier soir.",
    icon: Boxes,
  },
  {
    id: "douane",
    label: "Douane",
    sub: "Documents incomplets",
    pct: 31,
    level: "watch",
    detail:
      "3 expéditions concernées par des formulaires de dédouanement manquants. Sans régularisation d'ici demain, un retard de 24 à 36h est probable.",
    icon: FileWarning,
  },
]

const TIMELINE: TimelineStep[] = [
  { t: "Maintenant", d: "Flux sous tension, sans impact client", level: "ok" },
  { t: "+12h", d: "Situation stable", level: "ok" },
  { t: "+24h", d: "Surcharge du transporteur", level: "watch" },
  { t: "+36h", d: "Premiers retards confirmés", level: "blocked" },
  { t: "+48h", d: "17 commandes impactées", level: "blocked" },
]

const STATUS_STYLES: Record<StatusLevel, { dot: string; cell: string; label: string }> = {
  ok: {
    dot: "bg-emerald-500",
    cell: "border-emerald-500/25 bg-emerald-500/[0.06]",
    label: "Normal",
  },
  watch: {
    dot: "bg-amber-500",
    cell: "border-amber-500/60 bg-amber-500/[0.12]",
    label: "À surveiller",
  },
  blocked: {
    dot: "bg-red-500",
    cell: "border-red-500 bg-red-500/[0.15]",
    label: "Bloqué",
  },
}

function OperationsGrid({ onSettled }: { onSettled?: () => void }) {
  const [statuses, setStatuses] = useState<StatusLevel[]>(() =>
    Array(GRID_SIZE).fill("ok")
  )

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(
      setTimeout(() => {
        setStatuses((current) => {
          const next = [...current]
          WATCH_INDEXES.forEach((i) => (next[i] = "watch"))
          return next
        })
      }, 400)
    )

    timers.push(
      setTimeout(() => {
        setStatuses((current) => {
          const next = [...current]
          next[BLOCKED_INDEX] = "watch"
          return next
        })
      }, 900)
    )

    timers.push(
      setTimeout(() => {
        setStatuses((current) => {
          const next = [...current]
          next[BLOCKED_INDEX] = "blocked"
          return next
        })
        onSettled?.()
      }, 1700)
    )

    return () => timers.forEach(clearTimeout)
  }, [onSettled])

  const counts = useMemo(() => {
    return statuses.reduce(
      (acc, s) => {
        acc[s] += 1
        return acc
      },
      { ok: 0, watch: 0, blocked: 0 } as Record<StatusLevel, number>
    )
  }, [statuses])

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Vos opérations en cours
          </p>
          <p className="text-[11px] text-muted-foreground">
            {GRID_SIZE} commandes suivies en temps réel
          </p>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {(["ok", "watch", "blocked"] as StatusLevel[]).map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5">
              <span
                className={cn("h-1.5 w-1.5 rounded-full", STATUS_STYLES[level].dot)}
              />
              {STATUS_STYLES[level].label} · {counts[level]}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1.5 p-4 md:grid-cols-12">
        {statuses.map((status, i) => (
          <div
            key={i}
            className={cn(
              "aspect-[7/5] rounded-md border transition-colors duration-300",
              STATUS_STYLES[status].cell
            )}
          />
        ))}
      </div>
    </div>
  )
}

export function LogisticsBlockagesView({
  onBack,
  alerts = [],
  recommendations = [],
}: {
  onBack?: () => void
  alerts?: Alert[]
  recommendations?: Recommendation[]
}) {
  const [showRecommendation, setShowRecommendation] = useState(false)
  const [applied, setApplied] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Reserved for when real logistics alerts/recommendations feed this view
  // instead of the illustrative data below.
  void alerts
  void recommendations

  function toggleExpanded(id: string) {
    setExpanded((current) => (current === id ? null : id))
  }

  function applyRecommendation() {
    setApplied(true)
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => onBack?.()}
            disabled={!onBack}
            className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Retour
          </button>

          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            Éviter les blocages
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            SentrIA surveille votre flux en continu et vous prévient avant
            qu&apos;une opération ne se retrouve bloquée.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Risque global
            </p>
            <p className="font-heading text-2xl font-bold">
              {applied ? "19" : "34"}
              <span className="text-sm font-medium text-muted-foreground">
                /100
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* OPERATIONS GRID */}
      <OperationsGrid onSettled={() => setShowRecommendation(true)} />

      {/* PRIORITY BLOCKAGE */}
      <div
        className={cn(
          "rounded-3xl border border-border bg-card p-6 transition-all duration-500 md:p-8",
          showRecommendation
            ? "translate-y-0 opacity-100"
            : "translate-y-1 opacity-0"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              applied
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-red-500/10 text-red-600"
            )}
          >
            {applied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Recommandation appliquée
              </>
            ) : (
              "Point de rupture prioritaire"
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {applied ? "Risque ramené sous contrôle" : "Blocage probable dans 48h"}
          </span>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold">
              Transport — France → Espagne
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Transporteur X · 17 commandes concernées
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* WHY */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Pourquoi SentrIA s&apos;inquiète
            </p>

            <div className="mt-3 space-y-3">
              {[
                { label: "Retards transporteur", val: "+23%", fill: 78, tone: "bg-red-500" },
                { label: "Capacité disponible", val: "−14%", fill: 45, tone: "bg-amber-500" },
                { label: "Volume prévu demain", val: "+31%", fill: 85, tone: "bg-red-500" },
                { label: "Commandes prioritaires", val: "11", fill: 55, tone: "bg-amber-500" },
              ].map((signal) => (
                <div key={signal.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{signal.label}</span>
                    <span className="font-semibold text-foreground">{signal.val}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", signal.tone)}
                      style={{ width: `${signal.fill}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-l-2 border-border border-l-accent bg-background px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                SentrIA
              </p>
              <p className="mt-1.5 text-sm italic leading-6 text-foreground">
                Ces signaux convergent vers une surcharge probable demain
                matin. Je protégerais d&apos;abord les 6 expéditions
                critiques — le stock, lui, peut attendre.
              </p>
            </div>
          </div>

          {/* SCENARIO */}
          <div className="flex flex-col">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Scénario proposé
            </p>

            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-3 gap-px bg-border text-xs">
                <div className="bg-card px-3 py-2 font-semibold text-muted-foreground" />
                <div className="bg-card px-3 py-2 text-right font-semibold text-muted-foreground">
                  Sans action
                </div>
                <div className="bg-card px-3 py-2 text-right font-semibold text-accent-foreground">
                  Avec SentrIA
                </div>

                {[
                  ["Risque", "68%", "21%"],
                  ["Commandes exposées", "17", "3"],
                  ["Coût potentiel", "4 800 €", "900 €"],
                  ["Délai moyen", "+18h", "+4h"],
                ].map(([label, before, after]) => (
                  <div key={label} className="contents">
                    <div className="bg-card px-3 py-2.5 text-muted-foreground">
                      {label}
                    </div>
                    <div className="bg-card px-3 py-2.5 text-right text-muted-foreground">
                      {before}
                    </div>
                    <div className="bg-card px-3 py-2.5 text-right font-semibold text-emerald-600">
                      {after}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4 text-sm text-foreground">
              Réallouer <span className="font-semibold">6 expéditions</span>{" "}
              vers le transporteur B.
            </p>

            <div className="mt-auto flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={applyRecommendation}
                disabled={applied}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all disabled:cursor-default",
                  applied
                    ? "bg-muted text-muted-foreground"
                    : "bg-accent text-accent-foreground"
                )}
              >
                {applied ? "Appliquée" : "Éviter ce blocage"}
                {applied ? <Check className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECONDARY + TIMELINE */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="mb-1 font-heading text-sm font-bold">
            Autres points de rupture
          </p>

          <div className="mt-3 space-y-2">
            {SECONDARY_RUPTURES.map((item) => {
              const Icon = item.icon
              const isOpen = expanded === item.id

              return (
                <div key={item.id} className="rounded-2xl border border-border">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors",
                      isOpen
                        ? "bg-foreground text-background"
                        : "hover:bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        isOpen ? "bg-background/15" : "bg-muted"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p
                        className={cn(
                          "text-xs",
                          isOpen ? "text-background/70" : "text-muted-foreground"
                        )}
                      >
                        {item.sub}
                      </p>
                    </div>

                    <span className="text-sm font-semibold text-amber-500">
                      {item.pct}%
                    </span>

                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 text-xs leading-5 text-muted-foreground">
                      {item.detail}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="mb-4 font-heading text-sm font-bold">
            Si rien ne change
          </p>

          <div className="space-y-0">
            {TIMELINE.map((step, i) => (
              <div key={step.t} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      STATUS_STYLES[step.level].dot
                    )}
                  />
                  {i < TIMELINE.length - 1 && (
                    <span className="w-px flex-1 bg-border" />
                  )}
                </div>
                <div className="pb-5">
                  <p className="text-[11px] text-muted-foreground">{step.t}</p>
                  <p className="text-sm text-foreground">{step.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5" />
              Coût potentiel estimé
            </span>
            <span className="text-lg font-bold text-red-600">4 800 €</span>
          </div>
        </div>
      </div>

      {/* FOOTER NUDGE */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
        <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-5 text-muted-foreground">
          SentrIA revérifie ces signaux toutes les 15 minutes et vous
          préviendra dès qu&apos;un nouveau point de rupture apparaît.
        </p>
        <Clock3 className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
    </div>
  )
}