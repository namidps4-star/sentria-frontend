"use client"

import { useEffect, useState } from "react"
import {
  Activity,
  Cpu,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  MoreHorizontal,
  Zap,
  Upload,
  Shield,
  ChevronRight,
  Search,
  X,
  Gauge,
  Check,
} from "lucide-react"
import { AreaChart, BarChart, Sparkline } from "./charts"
import { cn } from "@/lib/utils"
import { computeConfidence, confidenceWord } from "@/lib/confidence"
import { LogisticsBlockagesView } from "./logistics-blockages-view"
import { LogisticsWaitingView } from "./logistics-waiting-view"
import { LogisticsCostView } from "./logistics-cost-view"
import { LogisticsAnticipateView } from "./logistics-anticipate-view"
import { RecommendationsPanel } from "./recommendations-panel"
import { RecommendationsBoard } from "./recommendations-board-view"
import {
  IndustryMachinesView,
  IndustryMotorsView,
  IndustryTemperatureView,
  IndustryPressureView,
  IndustryProductionView,
  IndustryMaintenanceView,
} from "./industry-view"

import { API_BASE as API } from "@/lib/api"
import {
  PriorityCards,
  PriorityHeading,
  PriorityPills,
  priorityCount,
} from "./priority-nav"
import { orderPriorities, prioritiesFor } from "@/lib/priorities"



const SECTORS = [
  { key: "all", label: "Tous" },
  { key: "industry", label: "Industrie" },
  { key: "health", label: "Santé" },
  { key: "agriculture", label: "Agriculture" },
  { key: "transportation", label: "Transport" },
  { key: "logistics", label: "Logistique" },
  { key: "energy", label: "Énergie" },
  { key: "commerce", label: "Commerce" },
  { key: "eac", label: "EAC" },
]

type Alert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
  /** Set by the backend once it records which activity produced the row. */
  business_type?: string | null
  /** Namespaced key such as "lab.tests_remaining.critical". Used to infer
   *  the activity for rows written before business_type was recorded. */
  alert_key?: string | null
}

type Recommendation = {
  id: string
  equipment: string
  sector?: string | null
  severity: "WARNING" | "CRITICAL" | string
  date: string
  message: string
  risk_score?: number | null
  alert_key?: string | null
  business_type?: string | null
  recommended_action: string
  action_category: string
  /**
   * The backend doesn't send these yet. Once it does, this type already
   * has room for them and the UI will use the real value automatically
   * (see estimateConfidence / reasoningFor below).
   */
  confidence?: number | null
  reasoning?: string | null
}

type ActionStatus = "pending" | "done" | "dismissed"

type ActionRecord = {
  status: ActionStatus
  at: string
}

type LogisticsPriority =
  | "blockages"
  | "wait"
  | "cost"
  | "anticipate"
  | "recommend"
  | "resources"

type IndustryPriority =
  | "machines"
  | "motors"
  | "temperature"
  | "pressure"
  | "production"
  | "maintenance"

/** Count alerts per day over the last `days` days, oldest first.
 *
 *  Every sparkline and the area chart read from this, so a card's trend
 *  line and its number always describe the same alerts. Replaces the
 *  invented arrays that used to be drawn as if they were history. */
function dailySeries(
  alerts: Alert[],
  days = 7,
  match?: (alert: Alert) => boolean
): number[] {
  const scoped = match ? alerts.filter(match) : alerts

  return Array.from({ length: days }, (_, i) => {
    const day = new Date()

    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - (days - 1 - i))

    return scoped.filter((a) => {
      const at = new Date(a.date)

      return (
        at.getFullYear() === day.getFullYear() &&
        at.getMonth() === day.getMonth() &&
        at.getDate() === day.getDate()
      )
    }).length
  })
}

/** Human label for each onboarded subtype, shown on the dashboard so the
 *  user can see which business the numbers describe. */
const BUSINESS_TYPE_LABELS: Record<string, string> = {
  // Industry
  "usine-production": "Usine de production",
  "atelier-soustraitance": "Atelier / sous-traitance",
  "usine-agroalimentaire": "Usine agroalimentaire",
  // Health
  "pharmacie": "Pharmacie",
  "grossiste-pharma": "Grossiste-répartiteur pharmaceutique",
  "clinique-hopital": "Clinique / Hôpital",
  "laboratoire": "Laboratoire",
  // Agriculture
  "exploitation-agricole": "Exploitation agricole",
  "cooperative-agricole": "Coopérative agricole",
  "silo-stockage": "Silo / stockage de récolte",
  // Transportation
  "transporteur-routier": "Transporteur routier",
  "flotte-entreprise": "Flotte d'entreprise",
  "location-vehicules": "Location de véhicules",
  // Logistics
  "port-conteneurs": "Port & conteneurs",
  "entrepot-manutention": "Entrepôt & manutention",
  "transport-distribution": "Transport & distribution",
  "preparation-expedition": "Préparation & expédition",
  "chaine-froid": "Chaîne du froid",
  "plusieurs-activites": "Plusieurs activités",
  // Energy
  "centrale-production": "Centrale de production",
  "generateurs-secours": "Générateurs de secours",
  "distribution-energetique": "Distribution énergétique",
  // Commerce
  "grossiste-distributeur": "Grossiste / distributeur",
  "supermarche-hypermarche": "Supermarché / hypermarché",
  "chaine-magasins": "Chaîne de magasins",
  "epicerie-proximite": "Épicerie / commerce de proximité",
}

/** Per-subtype label overrides, keyed by business_type.
 *
 *  Only the wording changes. A laboratory counts tests and reagents, a
 *  hospital counts unsubstitutable supplies, a wholesaler counts client
 *  pharmacies. Showing all three "Medicaments concernes" made the
 *  dashboard look like it was built for a pharmacy no matter what was
 *  onboarded. */
const SUBTYPE_KPI_LABELS: Record<string, string[]> = {
  "laboratoire": [
    "Analyses bloquées",
    "Réactifs à commander",
    "Réactifs concernés",
    "Alertes péremption",
  ],
  "clinique-hopital": [
    "Stocks critiques sans alternative",
    "Stocks à surveiller",
    "Articles concernés",
    "Alertes chaîne froid",
  ],
  "grossiste-pharma": [
    "Ruptures réseau",
    "Rééquilibrages suggérés",
    "Produits concernés",
    "Invendus réseau",
  ],
  "usine-agroalimentaire": [
    "Arrêts sanitaires imminents",
    "Écarts de température",
    "Lignes surveillées",
    "Total alertes",
  ],
}

const SUBTYPE_CHART_TITLES: Record<string, string> = {
  "laboratoire": "Alertes réactifs · 7 jours",
  "clinique-hopital": "Alertes stocks critiques · 7 jours",
  "grossiste-pharma": "Alertes réseau · 7 jours",
  "usine-agroalimentaire": "Alertes sanitaires · 7 jours",
}

/** Which activity produced this alert.
 *
 *  Prefers the recorded business_type. Falls back to the alert_key
 *  namespace, since those keys are written per activity and already exist
 *  on rows saved before business_type was stored. Returns null when
 *  neither can say, and a null is never filtered out: hiding a real alert
 *  because we cannot classify it would be worse than showing it. */
function activityOf(row: {
  business_type?: string | null
  alert_key?: string | null
}): string | null {
  if (row.business_type) return row.business_type

  const key = row.alert_key ?? ""

  if (key.startsWith("lab.")) return "laboratoire"
  if (key.startsWith("hospital.")) return "clinique-hopital"
  if (key.startsWith("wholesaler.")) return "grossiste-pharma"

  return null
}

/** Label for each alert_key family, the middle segment of a key such as
 *  the "cold_chain" in "health.cold_chain.broken". Extracted from every
 *  key the backend fires, so the breakdown covers all of them.
 *
 *  An unlisted family still charts, under its own raw name, which is how
 *  a family added to the backend later shows up without a frontend
 *  release. That was the flaw in the old approach: the three new health
 *  activities were invisible because nobody updated a hardcoded list. */
const KEY_FAMILY_LABELS: Record<string, string> = {
  // health
  stock: "Stock", reorder: "Réappro", cold_chain: "Chaîne du froid",
  expiry: "Péremption", slow_mover: "Rotation faible",
  deadstock: "Invendus",
  // lab
  tests_remaining: "Analyses", reagent: "Réactifs",
  // hospital
  critical_supply: "Sans alternative",
  // wholesaler
  rebalance: "Transferts",
  // industry
  torque: "Couple", wear: "Usure", failure: "Panne", motor: "Moteurs",
  temperature: "Température", pressure: "Pression",
  production: "Production", maintenance: "Maintenance",
  food_temp: "Température alim.", hygiene: "Hygiène",
  // logistics
  cycles: "Cycles", wait: "Attente", service: "Entretien", risk: "Risque",
  // transport
  engine: "Moteur", oil: "Huile", fuel: "Carburant",
  fuel_low: "Carburant bas", tires: "Pneus",
  // energy
  coolant: "Refroidissement", load: "Charge", output: "Production",
  // agri
  storage: "Stockage", temp: "Température",
  // retail
  pos: "Caisse", sales: "Ventes", shrinkage: "Démarque",
  staffing: "Personnel",
  // supplier
  delivery: "Livraisons", lead_time: "Délais",
  fill_rate: "Taux de service", reliability: "Fiabilité",
}

/** Breakdown of alerts by what they are about, grouped on the alert_key
 *  family rather than by searching the message text.
 *
 *  The previous version matched French words such as "rupture" and
 *  "froid" inside the message. That failed three ways at once: a
 *  laboratory and a wholesaler use none of those words, so their chart
 *  was always empty; a hospital matched only some; and in English almost
 *  nothing matched for anybody, because the words being searched for only
 *  exist in the French translations. The key is language-independent.
 *
 *  Rows with no alert_key fall back to a severity split, so legacy data
 *  still charts as something rather than nothing. */
function alertBreakdown(
  alerts: Alert[]
): { labels: string[]; values: number[] } {
  const counts = new Map<string, number>()

  for (const a of alerts) {
    const parts = (a.alert_key ?? "").split(".")

    if (parts.length < 2 || !parts[1]) continue

    const family = parts[1]
    counts.set(family, (counts.get(family) ?? 0) + 1)
  }

  if (counts.size === 0) {
    const critical = alerts.filter((a) => a.severity === "CRITICAL").length
    const warning = alerts.filter((a) => a.severity === "WARNING").length

    if (critical === 0 && warning === 0) {
      return { labels: [], values: [] }
    }

    return {
      labels: ["Critiques", "Warnings"],
      values: [critical, warning],
    }
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return {
    labels: top.map(
      ([family]) => KEY_FAMILY_LABELS[family] ?? family.replace(/_/g, " ")
    ),
    values: top.map(([, count]) => count),
  }
}

const SECTOR_META: Record<
  string,
  {
    kpis: (alerts: Alert[]) => {
      label: string
      value: string
      delta: string
      up: boolean
      /** Optional subset this card counts, so its sparkline tracks the
       *  same alerts as its number. Omitted means every alert in view. */
      match?: (alert: Alert) => boolean
    }[]
    chartTitle: string
  }
> = {
  all: {
    kpis: (a) => [
      {
        label: "Actifs en alerte",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Live",
        up: true,
      },
      {
        label: "Alertes critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        match: (x) => x.severity === "CRITICAL",
        delta:
          a.filter((x) => x.severity === "CRITICAL").length > 0
            ? "À traiter"
            : "OK",
        up:
          a.filter((x) => x.severity === "CRITICAL").length === 0,
      },
      {
        label: "Warnings",
        value: String(
          a.filter((x) => x.severity === "WARNING").length
        ),
        match: (x) => x.severity === "WARNING",
        delta: "Surveillance",
        up: true,
      },
      {
        label: "Total alertes",
        value: String(a.length),
        delta: "Toutes sources",
        up: true,
      },
    ],
    chartTitle: "Évolution des alertes",
  },

  industry: {
    kpis: (a) => [
      {
        label: "Machines en panne imminente",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        match: (x) => x.severity === "CRITICAL",
        delta: "Arrêt immédiat",
        up: false,
      },
      {
        label: "Usure élevée",
        value: String(
          a.filter((x) => x.severity === "WARNING").length
        ),
        match: (x) => x.severity === "WARNING",
        delta: "Surveiller",
        up: true,
      },
      {
        label: "Machines surveillées",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Live",
        up: true,
      },
      {
        label: "Total alertes",
        value: String(a.length),
        delta: "Session",
        up: true,
      },
    ],
    chartTitle: "Alertes machines · 7 jours",
  },

  health: {
    kpis: (a) => [
      {
        label: "Ruptures critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        match: (x) => x.severity === "CRITICAL",
        delta: "Commander maintenant",
        up: false,
      },
      {
        label: "Stocks bas",
        value: String(
          a.filter((x) => x.severity === "WARNING").length
        ),
        match: (x) => x.severity === "WARNING",
        delta: "À surveiller",
        up: true,
      },
      {
        label: "Médicaments concernés",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Produits",
        up: true,
      },
      {
        label: "Alertes chaîne froid",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("froid") ||
              x.message.toLowerCase().includes("cold")
          ).length
        ),
        delta: "Urgence",
        up: false,
      },
    ],
    chartTitle: "Alertes stocks · 7 jours",
  },

  agriculture: {
    kpis: (a) => [
      {
        label: "Pertes probables",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        match: (x) => x.severity === "CRITICAL",
        delta: "Livraison urgente",
        up: false,
      },
      {
        label: "Retards détectés",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("retard") ||
              x.message.toLowerCase().includes("delay")
          ).length
        ),
        delta: "Camions",
        up: false,
      },
      {
        label: "Produits en risque",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Actifs",
        up: true,
      },
      {
        label: "Alertes temp.",
        value: String(
          a.filter((x) =>
            x.message.toLowerCase().includes("temp")
          ).length
        ),
        delta: "Stockage",
        up: false,
      },
    ],
    chartTitle: "Alertes récoltes · 7 jours",
  },

  transportation: {
    kpis: (a) => [
      {
        label: "Camions critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        match: (x) => x.severity === "CRITICAL",
        delta: "Immobiliser",
        up: false,
      },
      {
        label: "Révisions dues",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("service") ||
              x.message.toLowerCase().includes("révision")
          ).length
        ),
        delta: "Planifier",
        up: false,
      },
      {
        label: "Camions surveillés",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Flotte",
        up: true,
      },
      {
        label: "Alertes moteur",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("moteur") ||
              x.message.toLowerCase().includes("engine")
          ).length
        ),
        delta: "Urgence",
        up: false,
      },
    ],
    chartTitle: "Alertes flotte · 7 jours",
  },

  logistics: {
    kpis: (a) => [
      {
        label: "Équipements bloqués",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        match: (x) => x.severity === "CRITICAL",
        delta: "Arrêt immédiat",
        up: false,
      },
      {
        label: "Files d'attente",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("attente") ||
              x.message.toLowerCase().includes("wait")
          ).length
        ),
        delta: "Conteneurs",
        up: false,
      },
      {
        label: "Équipements actifs",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Port",
        up: true,
      },
      {
        label: "Alertes pression",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("pression") ||
              x.message.toLowerCase().includes("pressure")
          ).length
        ),
        delta: "Hydraulique",
        up: false,
      },
    ],
    chartTitle: "Alertes port · 7 jours",
  },

  energy: {
    kpis: (a) => [
      {
        label: "Générateurs critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        match: (x) => x.severity === "CRITICAL",
        delta: "Intervenir",
        up: false,
      },
      {
        label: "Carburant bas",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("carburant") ||
              x.message.toLowerCase().includes("fuel")
          ).length
        ),
        delta: "Réapprovisionner",
        up: false,
      },
      {
        label: "Générateurs surveillés",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Actifs",
        up: true,
      },
      {
        label: "Alertes surchauffe",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("surchauffe") ||
              x.message.toLowerCase().includes("overheat")
          ).length
        ),
        delta: "Température",
        up: false,
      },
    ],
    chartTitle: "Alertes énergie · 7 jours",
  },

  commerce: {
    kpis: (a) => [
      {
        label: "Ruptures en rayon",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        match: (x) => x.severity === "CRITICAL",
        delta: "Réassort urgent",
        up: false,
      },
      {
        label: "Stocks bas",
        value: String(
          a.filter((x) => x.severity === "WARNING").length
        ),
        match: (x) => x.severity === "WARNING",
        delta: "À surveiller",
        up: true,
      },
      {
        label: "Références concernées",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Produits",
        up: true,
      },
      {
        label: "Total alertes",
        value: String(a.length),
        delta: "Sur la période",
        up: a.length === 0,
      },
    ],
    chartTitle: "Alertes stocks · 7 jours",
  },

  eac: {
    kpis: (a) => [
      {
        label: "Alertes corridor EAC",
        value: String(a.length),
        delta: "Régional",
        up: a.length === 0,
      },
      {
        label: "Risques critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        match: (x) => x.severity === "CRITICAL",
        delta:
          a.filter((x) => x.severity === "CRITICAL").length > 0
            ? "À traiter"
            : "OK",
        up:
          a.filter((x) => x.severity === "CRITICAL").length === 0,
      },
      {
        label: "Flux surveillés",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Corridors",
        up: true,
      },
      {
        label: "Alertes conformité",
        value: String(
          a.filter((x) => {
            const message = x.message.toLowerCase()
            return (
              message.includes("douane") ||
              message.includes("custom") ||
              message.includes("document") ||
              message.includes("compliance") ||
              message.includes("certificat")
            )
          }).length
        ),
        delta: "Documents",
        up: false,
      },
    ],
    chartTitle: "Alertes corridors EAC · 7 jours",
  },
}

const OPS_TYPE_LABEL: Record<string, string> = {
  port: "Port & conteneurs",
  entrepot: "Entrepôt & manutention",
  transport: "Transport & distribution",
  expedition: "Expédition",
  froid: "Chaîne du froid",
  multi: "Opérations logistiques",
}

const LOGISTICS_OPS_META: Record<
  string,
  (typeof SECTOR_META)["logistics"]
> = {
  port: SECTOR_META.logistics,
  entrepot: SECTOR_META.logistics,
  transport: SECTOR_META.logistics,
  expedition: SECTOR_META.logistics,
  froid: SECTOR_META.logistics,
  multi: SECTOR_META.logistics,
}

/** Read the priorities picked during onboarding, for any sector.
 *
 *  All sectors write to the same `sentria_equipment` key, so one reader
 *  serves all of them. Ids are returned in catalog order rather than
 *  click order, and anything the catalog no longer knows about is
 *  dropped, so a stale id from an older build cannot render as a chip
 *  with no label. */
function getSavedPriorities(sector: string): string[] {
  if (typeof window === "undefined") return []

  if (prioritiesFor(sector).length === 0) return []

  try {
    const stored = JSON.parse(
      localStorage.getItem("sentria_equipment") || "[]"
    )

    if (!Array.isArray(stored)) return []

    /* No default priority. The readers used to fall back to the first
       entry in the sector's catalog, which meant a pharmacist who never
       configured industry still saw "Priorités industrie : Machines de
       production" on their dashboard. An empty list renders the real
       empty state instead. */
    return orderPriorities(
      sector,
      stored.filter((value): value is string => typeof value === "string")
    )
  } catch {
    return []
  }
}

function getSavedLogisticsPriorities(): LogisticsPriority[] {
  return getSavedPriorities("logistics") as LogisticsPriority[]
}

function getSavedIndustryPriorities(): IndustryPriority[] {
  return getSavedPriorities("industry") as IndustryPriority[]
}

function getSectorLabel(sector?: string | null) {
  if (!sector) return "Non défini"

  return (
    SECTORS.find((item) => item.key === sector)?.label ??
    sector
  )
}

function getRecommendationContext(
  recommendation: Recommendation
) {
  const sector = recommendation.sector ?? "all"

  const contexts: Record<string, string> = {
    industry:
      "Priorité industrielle : limiter les arrêts de production et intervenir avant la panne.",
    health:
      "Priorité santé : sécuriser les stocks, les médicaments et la chaîne du froid.",
    agriculture:
      "Priorité agricole : réduire les pertes, les retards et les risques sur les produits.",
    transportation:
      "Priorité transport : éviter les immobilisations et sécuriser la disponibilité de la flotte.",
    logistics:
      "Priorité logistique : fluidifier les opérations, réduire les blocages et maîtriser les coûts.",
    energy:
      "Priorité énergie : maintenir la disponibilité des générateurs et prévenir les arrêts.",
    eac:
      "Contexte EAC : sécuriser les flux régionaux, les passages transfrontaliers, la conformité documentaire et la disponibilité des marchandises.",
    all:
      "Recommandation opérationnelle générée à partir des alertes actuellement surveillées.",
  }

  return contexts[sector] ?? contexts.all
}

/*
 * SentrIA should behave like a decision system, not a dashboard: every
 * priority a human sees should answer six questions, in this order —
 * what did we see (evidence), how sure are we (confidence), what does
 * it cost (impact — see getRecommendationContext above), why do we think
 * this (reasoning), what should be done (recommended_action, already
 * shown), and what happened after someone acted (outcome — see
 * ActionRecord + recordAction in the component below).
 *
 * Confidence is computed by the shared, documented formula in
 * lib/confidence.ts — not invented ad hoc per screen. The backend
 * doesn't send a real confidence value yet, so this stays a labelled
 * estimate; the moment it does, this wrapper uses that instead.
 */
function estimateConfidence(
  rec: Recommendation,
  recurrence: number,
  trackRecord?: { done: number; dismissed: number }
): number {
  if (typeof rec.confidence === "number") {
    return Math.round(Math.max(0, Math.min(100, rec.confidence)))
  }

  return computeConfidence({
    riskScore: rec.risk_score,
    severity: rec.severity,
    recurrence,
    trackRecord,
  })
}

/**
 * The confidence formula's most SentrIA-specific ingredient: has this
 * deployment's own team historically acted on this category of alert,
 * or dismissed it? That's the part a generic dashboard-plus-AI can't
 * copy — it only exists because SentrIA closes the loop with real
 * human decisions (see actionsLog / recordAction below).
 */
function trackRecordForCategory(
  category: string,
  recs: Recommendation[],
  log: Record<string, ActionRecord>
): { done: number; dismissed: number } {
  let done = 0
  let dismissed = 0

  for (const rec of recs) {
    if (rec.action_category !== category) continue

    const key = `${rec.equipment}-${rec.alert_key ?? rec.id}`
    const action = log[key]

    if (action?.status === "done") done += 1
    else if (action?.status === "dismissed") dismissed += 1
  }

  return { done, dismissed }
}

function reasoningFor(
  rec: Recommendation,
  recurrence: number
): string {
  if (rec.reasoning) return rec.reasoning

  const parts: string[] = []

  parts.push(
    rec.severity === "CRITICAL"
      ? "Classé critique car le signal dépasse le seuil de sécurité attendu pour cet actif."
      : "Classé en surveillance car le signal s'écarte du comportement habituel de cet actif."
  )

  if (recurrence > 1) {
    parts.push(
      `Ce n'est pas un cas isolé : ${recurrence} alertes similaires enregistrées pour cet actif.`
    )
  }

  return parts.join(" ")
}

/** How many times this equipment already triggered an alert. */
function recurrenceOf(equipment: string, alerts: Alert[]): number {
  return alerts.filter((a) => a.equipment === equipment).length
}

export function DashboardView({
  search = "",
}: {
  search?: string
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<
    Recommendation[]
  >([])

  const [uploadSector, setUploadSector] = useState("industry")

  const [filterSector, setFilterSector] = useState(() => {
    if (typeof window === "undefined") {
      return "all"
    }

    const saved = localStorage.getItem("sentria_sector")

    return saved === "logistics" ? "all" : saved || "all"
  })

  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")
  const [uploadFailed, setUploadFailed] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)

  const [activeSectors, setActiveSectors] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return ["industry"]
    }

    try {
      const stored = JSON.parse(
        localStorage.getItem("sentria_sectors") ||
          '["industry"]'
      )

      return Array.isArray(stored) && stored.length > 0
        ? stored
        : ["industry"]
    } catch {
      return ["industry"]
    }
  })

  const [opsType, setOpsType] = useState<string | null>(() => {
    if (typeof window === "undefined") return null

    return localStorage.getItem("sentria_ops_type")
  })

  const [businessType, setBusinessType] = useState<string | null>(() => {
    if (typeof window === "undefined") return null

    return localStorage.getItem("sentria_business_type")
  })

  const [logisticsPriority, setLogisticsPriority] =
    useState<LogisticsPriority | null>(null)

  const [selectedLogisticsPriorities, setSelectedLogisticsPriorities] =
    useState<LogisticsPriority[]>(() =>
      getSavedLogisticsPriorities()
    )

  const [industryPriority, setIndustryPriority] =
    useState<IndustryPriority | null>(null)

  const [selectedIndustryPriorities, setSelectedIndustryPriorities] =
    useState<IndustryPriority[]>(() =>
      getSavedIndustryPriorities()
    )

  /* Health, commerce, agriculture and the rest pick priorities during
     onboarding too, but have no per-priority screens yet. They still get
     to see what they configured, as static chips. */
  const [selectedSectorPriorities, setSelectedSectorPriorities] = useState<
    string[]
  >([])

  useEffect(() => {
    setSelectedSectorPriorities(getSavedPriorities(filterSector))
  }, [filterSector])

  const [statusFilter, setStatusFilter] = useState<
    "all" | "critical" | "warning"
  >("all")

  const [periodPreset, setPeriodPreset] = useState<
    "all" | "7" | "30" | "90" | "custom"
  >("all")

  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const [expandedAlertKey, setExpandedAlertKey] = useState<string | null>(
    null
  )

  const [alertSearch, setAlertSearch] = useState("")

  const [selectedRecommendation, setSelectedRecommendation] =
    useState<Recommendation | null>(null)

  /*
   * Closing the decision loop: once someone acts on a priority (marks it
   * handled or dismisses it), SentrIA remembers that and shows it back —
   * otherwise every session starts from zero and nobody can tell what
   * the system has actually helped with.
   */
  const [actionsLog, setActionsLog] = useState<
    Record<string, ActionRecord>
  >(() => {
    if (typeof window === "undefined") return {}

    try {
      return JSON.parse(
        localStorage.getItem("sentria_actions_log") || "{}"
      )
    } catch {
      return {}
    }
  })

  function recordAction(key: string, status: ActionStatus) {
    setActionsLog((current) => {
      const next = {
        ...current,
        [key]: {
          status,
          at: new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "sentria_actions_log",
          JSON.stringify(next)
        )
      }

      return next
    })
  }

  useEffect(() => {
    const refreshSectors = () => {
      try {
        const stored = JSON.parse(
          localStorage.getItem("sentria_sectors") ||
            '["industry"]'
        )

        setActiveSectors(
          Array.isArray(stored) && stored.length > 0
            ? stored
            : ["industry"]
        )
      } catch {
        setActiveSectors(["industry"])
      }

      setOpsType(localStorage.getItem("sentria_ops_type"))

      setBusinessType(localStorage.getItem("sentria_business_type"))

      setSelectedLogisticsPriorities(
        getSavedLogisticsPriorities()
      )

      setSelectedIndustryPriorities(
        getSavedIndustryPriorities()
      )

      const savedSector = localStorage.getItem("sentria_sector")

      if (savedSector && savedSector !== "logistics") {
        setFilterSector(savedSector)
      }
    }

    const refreshPriority = () => {
      const priorities = getSavedLogisticsPriorities()

      setSelectedLogisticsPriorities(priorities)

      if (
        logisticsPriority &&
        !priorities.includes(logisticsPriority)
      ) {
        setLogisticsPriority(null)
      }

      const industryPriorities = getSavedIndustryPriorities()

      setSelectedIndustryPriorities(industryPriorities)

      if (
        industryPriority &&
        !industryPriorities.includes(industryPriority)
      ) {
        setIndustryPriority(null)
      }
    }

    window.addEventListener(
      "sentria_sectors_updated",
      refreshSectors
    )

    window.addEventListener(
      "sentria_onboarding_completed",
      refreshSectors
    )

    window.addEventListener("storage", refreshPriority)

    return () => {
      window.removeEventListener(
        "sentria_sectors_updated",
        refreshSectors
      )

      window.removeEventListener(
        "sentria_onboarding_completed",
        refreshSectors
      )

      window.removeEventListener("storage", refreshPriority)
    }
  }, [logisticsPriority, industryPriority])

  useEffect(() => {
    if (
      activeSectors.length > 0 &&
      !activeSectors.includes(uploadSector)
    ) {
      setUploadSector(activeSectors[0])
    }

    if (
      filterSector !== "all" &&
      filterSector !== "logistics" &&
      !activeSectors.includes(filterSector)
    ) {
      setFilterSector("all")
      localStorage.setItem("sentria_sector", "all")
    }
  }, [activeSectors, uploadSector, filterSector])

  useEffect(() => {
    fetch(`${API}/alerts`)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`)
        }
        return r.json()
      })
      .then((d) => {
        setAlerts(Array.isArray(d) ? d : [])
        setAlertsError(null)
      })
      .catch((err) => {
        console.error("Failed to load alerts:", err)
        setAlertsError(
          err instanceof Error ? err.message : "réseau"
        )
      })
  }, [])

  function refreshRecommendations() {
    fetch(`${API}/recommendations?limit=20&lang=fr`)
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d?.recommendations)) {
          setRecommendations([])
          return
        }

        const usedIds = new Set<string>()

        const normalized: Recommendation[] =
          d.recommendations.map(
            (
              rec: Omit<Recommendation, "id"> & {
                id?: string | null
              },
              index: number
            ) => {
              const baseId =
                rec.id ??
                [
                  rec.alert_key ?? "",
                  rec.equipment,
                  rec.date,
                  rec.action_category,
                  rec.recommended_action,
                ].join("::")

              let id = String(baseId)

              if (usedIds.has(id)) {
                id = `${id}::${index}`
              }

              while (usedIds.has(id)) {
                id = `${id}::${Math.random()
                  .toString(36)
                  .slice(2, 8)}`
              }

              usedIds.add(id)

              return {
                ...rec,
                id,
              }
            }
          )

        setRecommendations(normalized)
      })
      .catch((err) => {
        console.error(
          "Failed to load recommendations:",
          err
        )
      })
  }

  useEffect(() => {
    refreshRecommendations()
  }, [])

  function openLogisticsOverview() {
    setFilterSector("logistics")
    setLogisticsPriority(null)
    localStorage.removeItem("sentria_sector")
  }

  function openLogisticsPriority(priority: LogisticsPriority) {
    setLogisticsPriority(priority)
    setFilterSector("logistics")
    localStorage.removeItem("sentria_sector")
  }

  function openIndustryOverview() {
    setFilterSector("industry")
    setIndustryPriority(null)
    localStorage.setItem("sentria_sector", "industry")
  }

  function openIndustryPriority(priority: IndustryPriority) {
    setIndustryPriority(priority)
    setFilterSector("industry")
    localStorage.setItem("sentria_sector", "industry")
  }

  function returnToDashboard() {
    setLogisticsPriority(null)
    setIndustryPriority(null)
    setFilterSector("all")
    localStorage.setItem("sentria_sector", "all")
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]

    if (!file) return

    setUploading(true)
    setUploadMsg("")
    setUploadFailed(false)

    const form = new FormData()
    form.append("file", file)

    try {
      const res = await fetch(
        `${API}/upload?sector=${uploadSector}&lang=fr` +
          (uploadSector === "logistics" && opsType
            ? `&ops_type=${opsType}`
            : "") +
          // Sent for every sector. check_industry and check_health branch
          // on it, and every sector needs it recorded on the alert so the
          // dashboard can separate activities. A value that does not
          // belong to the chosen sector is ignored safely by the backend.
          (businessType
            ? `&business_type=${encodeURIComponent(businessType)}`
            : ""),
        {
          method: "POST",
          body: form,
        }
      )

      if (!res.ok) {
        throw new Error("Upload failed")
      }

      const data = await res.json()

      setUploadMsg(data.message ?? "Fichier traité.")

      await new Promise((r) => setTimeout(r, 1500))

      const r2 = await fetch(`${API}/alerts`)
      const d2 = await r2.json()

      setAlerts(Array.isArray(d2) ? d2 : [])

      refreshRecommendations()

      setFilterSector(uploadSector)
      localStorage.setItem("sentria_sector", uploadSector)
    } catch (error) {
      console.error(error)
      setUploadFailed(true)
      setUploadMsg(
        "Erreur lors de l'upload. Vérifiez la console du navigateur."
      )
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  // Separate the activities inside a sector, not just the sectors. A
  // laboratory and a pharmacy both write sector "health", so this is what
  // stops one activity's alerts appearing under another.
  //
  // This has to hold in the "Tous" view too. An account is onboarded for
  // one activity, so another activity's rows are never its own, and
  // exempting "Tous" was what made the separation look like it had never
  // happened: the view the dashboard opens on mixed every activity back
  // together.
  //
  // Which sectors have labelled rows, so an unlabelled row is judged
  // against its own sector rather than against the whole table.
  const sectorsWithRecordedActivity = new Set(
    alerts
      .filter((a) => Boolean(a.business_type))
      .map((a) => a.sector ?? "")
  )

  const matchesActivity = (a: {
    sector?: string | null
    business_type?: string | null
    alert_key?: string | null
  }) => {
    if (!businessType) return true

    const activity = activityOf(a)

    if (activity !== null) return activity === businessType

    // Unclassifiable. Exclude it only when its own sector has labelled
    // rows to compare against, otherwise show it rather than blank the
    // view.
    return !sectorsWithRecordedActivity.has(a.sector ?? "")
  }

  const filteredAlerts = alerts
    .filter(
      (a) =>
        filterSector === "all" ||
        a.sector === filterSector
    )
    .filter(matchesActivity)
    .filter((a) => {
      if (!search.trim()) return true

      const q = search.toLowerCase()

      return (
        a.equipment.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        (a.sector ?? "").toLowerCase().includes(q) ||
        a.severity.toLowerCase().includes(q)
      )
    })

  const filteredRecommendations = recommendations
    .filter(
      (r) =>
        filterSector === "all" ||
        r.sector === filterSector
    )
    .filter(matchesActivity)
    .slice(0, 5)

  const presetMs =
    periodPreset === "7"
      ? 7 * 24 * 60 * 60 * 1000
      : periodPreset === "30"
      ? 30 * 24 * 60 * 60 * 1000
      : periodPreset === "90"
      ? 90 * 24 * 60 * 60 * 1000
      : null

  const customFromTime = customFrom
    ? new Date(`${customFrom}T00:00:00`).getTime()
    : null

  const customToTime = customTo
    ? new Date(`${customTo}T23:59:59.999`).getTime()
    : null

  const invalidCustomRange =
    periodPreset === "custom" &&
    customFromTime !== null &&
    customToTime !== null &&
    customFromTime > customToTime

  const tableAlerts = filteredAlerts.filter((a) => {
    if (statusFilter === "critical" && a.severity !== "CRITICAL") {
      return false
    }

    if (statusFilter === "warning" && a.severity !== "WARNING") {
      return false
    }

    const alertTime = new Date(a.date).getTime()

    if (presetMs && Date.now() - alertTime > presetMs) {
      return false
    }

    if (periodPreset === "custom") {
      if (invalidCustomRange) return false

      if (
        customFromTime !== null &&
        alertTime < customFromTime
      ) {
        return false
      }

      if (
        customToTime !== null &&
        alertTime > customToTime
      ) {
        return false
      }
    }

    if (alertSearch.trim()) {
      const q = alertSearch.toLowerCase()

      const matches =
        a.equipment.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        (a.sector ?? "").toLowerCase().includes(q) ||
        a.severity.toLowerCase().includes(q)

      if (!matches) return false
    }

    return true
  })

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (periodPreset !== "all" ? 1 : 0) +
    (alertSearch.trim() ? 1 : 0)

  function clearAlertFilters() {
    setStatusFilter("all")
    setPeriodPreset("all")
    setCustomFrom("")
    setCustomTo("")
    setAlertSearch("")
  }

  const expandedAlert =
    tableAlerts.find(
      (a) => `${a.equipment}-${a.date}` === expandedAlertKey
    ) ?? null

  const expandedRecommendation = expandedAlert
    ? recommendations.find(
        (r) =>
          r.equipment === expandedAlert.equipment &&
          r.date === expandedAlert.date
      ) ??
      recommendations.find(
        (r) => r.equipment === expandedAlert.equipment
      ) ??
      null
    : null

  const meta =
    filterSector === "logistics" && opsType
      ? LOGISTICS_OPS_META[opsType] ??
        SECTOR_META[filterSector] ??
        SECTOR_META.all
      : SECTOR_META[filterSector] ?? SECTOR_META.all

  // The onboarded subtype relabels the cards so the dashboard describes
  // the business that was actually set up, not whichever one the sector
  // defaults to. Sector views only: the "Tous" cards count across
  // sectors, and a laboratory wording on a cross-sector count would be a
  // claim the number does not support.
  const subtypeLabels =
    businessType && filterSector !== "all"
      ? SUBTYPE_KPI_LABELS[businessType]
      : undefined

  // The activity this account was onboarded for. Taken from the saved
  // onboarding choice rather than from the current filter, so it is
  // stated in every view including "Tous". Tying it to the filter meant
  // the view the dashboard opens on named no activity at all.
  const subtypeName = businessType
    ? BUSINESS_TYPE_LABELS[businessType]
    : undefined

  // The sector that goes with it. In a sector view that is the filter;
  // in "Tous" it is the onboarded sector, which is a single one because
  // onboarding saves exactly one.
  const onboardedSectorKey =
    filterSector !== "all"
      ? filterSector
      : activeSectors.length === 1
        ? activeSectors[0]
        : null

  const onboardedSectorLabel =
    SECTORS.find((x) => x.key === onboardedSectorKey)?.label ?? null

  // "Santé · Laboratoire". Null only when nothing was onboarded, in
  // which case there is no activity to name.
  const departmentLabel =
    [onboardedSectorLabel, subtypeName].filter(Boolean).join(" · ") ||
    null

  // Can the activity filter actually separate anything yet? Only once a
  // row in this sector carries an activity, by recorded business_type or
  // by alert_key namespace. Until then every unclassified row stays
  // visible, so saying the view is limited to one activity would be a
  // claim the data does not support.
  const activitySeparationActive =
    Boolean(businessType) &&
    alerts.some(
      (a) =>
        (onboardedSectorKey === null ||
          a.sector === onboardedSectorKey) &&
        activityOf(a) !== null
    )

  const kpis = meta
    .kpis(filteredAlerts)
    .map((k, i) => ({
      ...k,
      label: subtypeLabels?.[i] ?? k.label,
    }))

  const breakdown = alertBreakdown(filteredAlerts)

  const chartTitle =
    (businessType && SUBTYPE_CHART_TITLES[businessType]) ||
    meta.chartTitle

  // No rows for this sector means nothing has been uploaded for it yet.
  // Showing four zeroes and a flat line reads as "all clear", which is a
  // very different claim from "we have no data", so the cards and charts
  // are replaced by a panel that says which is true.
  const hasNoDataForSector =
    filteredAlerts.length === 0 && !alertsError

  const chartData = dailySeries(filteredAlerts, 7)

  if (filterSector === "industry") {
    const industryAlerts = alerts.filter(
      (a) => a.sector === "industry"
    )

    if (industryPriority === null) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={returnToDashboard}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Retour au tableau de bord
            </button>
          </div>

          <div className="rounded-3xl bg-sidebar p-6 text-sidebar-foreground md:p-8">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                <Shield className="h-3.5 w-3.5" />
                Industrie
              </span>

              <h2 className="mt-4 font-heading text-2xl font-bold leading-tight md:text-3xl">
                Vue d'ensemble de votre production.
              </h2>

              <p className="mt-2 text-sm leading-6 text-sidebar-foreground/70">
                Retrouvez ici les priorités que vous avez
                sélectionnées pendant la configuration de SentrIA.
                Choisissez une priorité pour accéder directement
                à son espace de pilotage.
              </p>
            </div>
          </div>

          <div>
            <PriorityHeading
              count={selectedIndustryPriorities.length}
              total={priorityCount("industry")}
            />

            <PriorityCards
              sector="industry"
              ids={selectedIndustryPriorities}
              onOpen={(id) =>
                openIndustryPriority(id as IndustryPriority)
              }
              emptyLabel="Aucune priorité industrielle n'a été sélectionnée."
            />
          </div>

          {industryAlerts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Upload
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>

              <h3 className="mt-4 font-heading text-lg font-bold">
                Aucune donnée industrielle
                {subtypeName ? ` · ${subtypeName}` : ""}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Les priorités ci-dessus sont bien enregistrées, mais
                aucun fichier n&apos;a encore été importé pour cette
                activité. Les indicateurs restent vides jusque-là.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-3xl border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {k.label}
                  </span>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      k.up
                        ? "bg-accent/25 text-accent-foreground"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {k.up ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}

                    {k.delta}
                  </span>
                </div>

                <p className="mt-3 font-heading text-3xl font-bold tracking-tight">
                  {k.value}
                </p>

                <Sparkline
                  data={dailySeries(filteredAlerts, 7, k.match)}
                  className={cn(
                    "mt-2 h-9 w-full",
                    k.up ? "text-accent" : "text-destructive"
                  )}
                />
              </div>
            ))}
          </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setIndustryPriority(null)
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Retour à l'industrie
          </button>
        </div>

        <PriorityPills
          sector="industry"
          ids={selectedIndustryPriorities}
          activeId={industryPriority}
          onOpen={(id) => openIndustryPriority(id as IndustryPriority)}
        />

        {industryPriority === "machines" ? (
          <IndustryMachinesView alerts={industryAlerts} />
        ) : industryPriority === "motors" ? (
          <IndustryMotorsView alerts={industryAlerts} />
        ) : industryPriority === "temperature" ? (
          <IndustryTemperatureView alerts={industryAlerts} />
        ) : industryPriority === "pressure" ? (
          <IndustryPressureView alerts={industryAlerts} />
        ) : industryPriority === "production" ? (
          <IndustryProductionView alerts={industryAlerts} />
        ) : (
          <IndustryMaintenanceView alerts={industryAlerts} />
        )}
      </div>
    )
  }

  if (filterSector === "logistics") {
    const normalizedOpsType =
      opsType &&
      [
        "port",
        "entrepot",
        "transport",
        "expedition",
        "froid",
        "multi",
      ].includes(opsType)
        ? (opsType as
            | "port"
            | "entrepot"
            | "transport"
            | "expedition"
            | "froid"
            | "multi")
        : undefined

    if (logisticsPriority === null) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={returnToDashboard}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Retour au tableau de bord
            </button>
          </div>

          <div className="rounded-3xl bg-sidebar p-6 text-sidebar-foreground md:p-8">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                <Shield className="h-3.5 w-3.5" />
                Logistique
              </span>

              <h2 className="mt-4 font-heading text-2xl font-bold leading-tight md:text-3xl">
                Vue d'ensemble de votre logistique.
              </h2>

              <p className="mt-2 text-sm leading-6 text-sidebar-foreground/70">
                Retrouvez ici les priorités que vous avez
                sélectionnées pendant la configuration de SentrIA.
                Choisissez une priorité pour accéder directement
                à son espace de pilotage.
              </p>

              {normalizedOpsType &&
                OPS_TYPE_LABEL[normalizedOpsType] && (
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-white/10 px-3 py-1 text-[11px] font-medium text-sidebar-foreground/80">
                    <Shield className="h-3 w-3" />
                    {OPS_TYPE_LABEL[normalizedOpsType]}
                  </div>
                )}
            </div>
          </div>

          <div>
            <PriorityHeading
              count={selectedLogisticsPriorities.length}
              total={priorityCount("logistics")}
            />

            <PriorityCards
              sector="logistics"
              ids={selectedLogisticsPriorities}
              onOpen={(id) =>
                openLogisticsPriority(id as LogisticsPriority)
              }
              emptyLabel="Aucune priorité logistique n'a été sélectionnée."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-3xl border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {k.label}
                  </span>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      k.up
                        ? "bg-accent/25 text-accent-foreground"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {k.up ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}

                    {k.delta}
                  </span>
                </div>

                <p className="mt-3 font-heading text-3xl font-bold tracking-tight">
                  {k.value}
                </p>

                <Sparkline
                  data={dailySeries(filteredAlerts, 7, k.match)}
                  className={cn(
                    "mt-2 h-9 w-full",
                    k.up ? "text-accent" : "text-destructive"
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setLogisticsPriority(null)
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Retour à la logistique
          </button>
        </div>

        <PriorityPills
          sector="logistics"
          ids={selectedLogisticsPriorities}
          activeId={logisticsPriority}
          onOpen={(id) => openLogisticsPriority(id as LogisticsPriority)}
        />

        {normalizedOpsType &&
          OPS_TYPE_LABEL[normalizedOpsType] && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <Shield className="h-3 w-3" />
              {OPS_TYPE_LABEL[normalizedOpsType]}
            </div>
          )}

        {logisticsPriority === "recommend" ? (
          <RecommendationsBoard
            recommendations={filteredRecommendations}
            opsType={normalizedOpsType}
          />
        ) : logisticsPriority === "wait" ? (
          <LogisticsWaitingView opsType={normalizedOpsType} />
        ) : logisticsPriority === "cost" ? (
          <LogisticsCostView opsType={normalizedOpsType} />
        ) : logisticsPriority === "anticipate" ? (
          <LogisticsAnticipateView
            opsType={normalizedOpsType}
          />
        ) : logisticsPriority === "resources" ? (
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-foreground">
                <Activity className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-heading text-xl font-bold">
                  Ressources
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Suivez la disponibilité et l'utilisation de
                  vos ressources logistiques depuis cet espace.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Équipements
                </p>

                <p className="mt-2 font-heading text-2xl font-bold">
                  {new Set(
                    alerts
                      .filter(
                        (a) => a.sector === "logistics"
                      )
                      .map((a) => a.equipment)
                  ).size}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Alertes actives
                </p>

                <p className="mt-2 font-heading text-2xl font-bold">
                  {
                    alerts.filter(
                      (a) => a.sector === "logistics"
                    ).length
                  }
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Opération
                </p>

                <p className="mt-2 font-heading text-lg font-bold">
                  {normalizedOpsType &&
                  OPS_TYPE_LABEL[normalizedOpsType]
                    ? OPS_TYPE_LABEL[normalizedOpsType]
                    : "Logistique"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <LogisticsBlockagesView
            opsType={normalizedOpsType}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl bg-sidebar p-6 text-sidebar-foreground md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Zap className="h-3.5 w-3.5" />
              Temps réel
            </span>

            {/* Which business this dashboard is for. Stated here, in
                every view, because the department was the one thing the
                dashboard never said out loud. */}
            {departmentLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-foreground/25 bg-sidebar-foreground/10 px-3 py-1 text-xs font-semibold text-sidebar-foreground">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                {departmentLabel}
              </span>
            )}
          </div>

          <h2 className="mt-3 text-balance font-heading text-2xl font-bold leading-tight md:text-3xl">
            Qu&apos;est-ce qui a besoin de votre attention maintenant ?
          </h2>

          <p className="mt-2 text-pretty text-sm text-sidebar-foreground/70">
            SentrIA ne se contente pas d&apos;alerter : chaque priorité
            montre sa preuve, sa confiance et son impact — puis garde en
            mémoire ce que vous en avez fait.
          </p>

          {subtypeName && (
            <p className="mt-3 text-xs leading-5 text-sidebar-foreground/60">
              {activitySeparationActive ? (
                <>
                  Vue limitée à votre activité :{" "}
                  <span className="font-bold text-sidebar-foreground">
                    {subtypeName}
                  </span>
                  . Les alertes des autres activités ne sont pas
                  affichées.
                </>
              ) : (
                <>
                  Activité configurée :{" "}
                  <span className="font-bold text-sidebar-foreground">
                    {subtypeName}
                  </span>
                  . Aucune alerte importée ne porte encore d&apos;activité,
                  elles sont donc toutes affichées.
                </>
              )}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            document
              .getElementById("alerts-table")
              ?.scrollIntoView({
                behavior: "smooth",
              })
          }
          className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
        >
          Voir les alertes
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <RecommendationsPanel
        recommendations={filteredRecommendations}
        totalRecommendationsCount={recommendations.length}
        alerts={alerts}
        opsType={opsType}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={returnToDashboard}
          className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
            filterSector === "all"
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
          )}
        >
          Tous

          <span className="ml-1.5 text-[10px] opacity-60">
            {alerts.filter(matchesActivity).length}
          </span>
        </button>

        {SECTORS.filter(
          (s) =>
            s.key !== "all" &&
            activeSectors.includes(s.key)
        ).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              if (s.key === "logistics") {
                openLogisticsOverview()
                return
              }

              if (s.key === "industry") {
                openIndustryOverview()
                return
              }

              setLogisticsPriority(null)
              setIndustryPriority(null)
              setFilterSector(s.key)
              localStorage.setItem(
                "sentria_sector",
                s.key
              )
            }}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
              filterSector === s.key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {s.label}

            <span className="ml-1.5 text-[10px] opacity-60">
              {
                alerts
                  .filter((a) => a.sector === s.key)
                  .filter(matchesActivity).length
              }
            </span>
          </button>
        ))}

      </div>

      {/* The same chip row as inside a priority, rather than the bespoke
          capsule that used to hang off the filter row and only ever showed
          logistics. On a single sector with no per-priority screens the
          chips are static: the user sees their configuration without
          anything pretending to be a link. */}
      {filterSector === "all" ? (
        <>
          {activeSectors.includes("logistics") && (
            <PriorityPills
              sector="logistics"
              ids={selectedLogisticsPriorities}
              label="Priorités logistique"
              onOpen={(id) =>
                openLogisticsPriority(id as LogisticsPriority)
              }
            />
          )}

          {activeSectors.includes("industry") && (
            <PriorityPills
              sector="industry"
              ids={selectedIndustryPriorities}
              label="Priorités industrie"
              onOpen={(id) =>
                openIndustryPriority(id as IndustryPriority)
              }
            />
          )}
        </>
      ) : (
        <PriorityPills
          sector={filterSector}
          ids={selectedSectorPriorities}
          label="Vos priorités"
        />
      )}

      {filterSector === "logistics" &&
        opsType &&
        LOGISTICS_OPS_META[opsType] && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <Shield className="h-3 w-3" aria-hidden="true" />
            {OPS_TYPE_LABEL[opsType]}
          </div>
        )}

      {hasNoDataForSector ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>

          <h3 className="mt-4 font-heading text-lg font-bold">
            Aucune donnée pour{" "}
            {departmentLabel ??
              SECTORS.find((x) => x.key === filterSector)?.label ??
              "cette activité"}
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Rien n&apos;a encore été importé pour cette activité. Les
            indicateurs restent vides jusqu&apos;au premier fichier :
            afficher des zéros donnerait l&apos;impression que tout va
            bien, ce qui n&apos;est pas la même chose.
          </p>

          <p className="mt-3 text-xs text-muted-foreground">
            Chaque activité attend ses propres colonnes. Importez le CSV
            correspondant à{" "}
            <span className="font-semibold text-foreground">
              {subtypeName ??
                SECTORS.find((x) => x.key === filterSector)?.label ??
                "votre activité"}
            </span>{" "}
            via le bouton Importer CSV ci-dessus.
          </p>
        </div>
      ) : (
        <>
      {/* Context for the priorities above — not the headline */}
      <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
        Contexte général
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-3xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {k.label}
              </span>

              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                  k.up
                    ? "bg-accent/25 text-accent-foreground"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {k.up ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}

                {k.delta}
              </span>
            </div>

            <p className="mt-3 font-heading text-3xl font-bold tracking-tight">
              {k.value}
            </p>

            <Sparkline
              data={dailySeries(filteredAlerts, 7, k.match)}
              className={cn(
                "mt-2 h-9 w-full",
                k.up ? "text-accent" : "text-destructive"
              )}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold">
                {chartTitle}
              </h3>

              <p className="text-sm text-muted-foreground">
                7 derniers jours
              </p>
            </div>

            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label="Options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>

          <AreaChart
            data={chartData}
            className="mt-6 h-52 w-full"
          />
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent-foreground" />

            <h3 className="font-heading text-lg font-bold">
              Répartition
            </h3>
          </div>

          {breakdown.labels.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {breakdown.labels.join(" · ")}
              </p>

              <BarChart
                data={breakdown.values}
                labels={breakdown.labels}
                className="mt-6"
                height={180}
              />
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Rien à répartir pour cette activité sur la période
              sélectionnée.
            </p>
          )}
        </div>
      </div>
        </>
      )}

      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-heading text-lg font-bold">
          Importer des données
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez un secteur puis importez votre CSV.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {SECTORS.filter(
              (s) =>
                s.key !== "all" &&
                activeSectors.includes(s.key)
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setUploadSector(s.key)}
                aria-pressed={uploadSector === s.key}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  uploadSector === s.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Upload className="h-4 w-4" aria-hidden="true" />

            {uploading ? "Traitement..." : "Importer CSV"}

            <input
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
              aria-label="Importer un fichier CSV"
            />
          </label>
        </div>

        {uploadMsg && (
          <p
            role={uploadFailed ? "alert" : "status"}
            className={cn(
              "mt-3 text-sm font-medium",
              uploadFailed ? "text-destructive" : "text-green-600"
            )}
          >
            {uploadMsg}
          </p>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Secteur :{" "}
          <span className="font-semibold text-foreground">
            {
              SECTORS.find(
                (s) => s.key === uploadSector
              )?.label
            }
          </span>
        </p>
      </div>

      <div
        id="alerts-table"
        className="rounded-3xl border border-border bg-card"
      >
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />

            <h3 className="font-heading text-lg font-bold">
              Alertes ·{" "}
              {
                SECTORS.find(
                  (s) => s.key === filterSector
                )?.label
              }
            </h3>

            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              {tableAlerts.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setExpandedAlertKey(null)
              clearAlertFilters()
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Tout voir
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-3">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as
                  | "all"
                  | "critical"
                  | "warning"
              )
            }
            className={cn(
              "rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              statusFilter !== "all"
                ? "border-foreground ring-1 ring-foreground/20"
                : "border-border"
            )}
          >
            <option value="all">Tous les statuts</option>
            <option value="critical">Critiques</option>
            <option value="warning">Warnings</option>
          </select>

          <select
            value={periodPreset}
            onChange={(e) => {
              const value = e.target.value as
                | "all"
                | "7"
                | "30"
                | "90"
                | "custom"

              setPeriodPreset(value)

              if (value !== "custom") {
                setCustomFrom("")
                setCustomTo("")
              }
            }}
            className={cn(
              "rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              periodPreset !== "all"
                ? "border-foreground ring-1 ring-foreground/20"
                : "border-border"
            )}
          >
            <option value="all">Toutes les dates</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
            <option value="custom">Dates personnalisées</option>
          </select>

          {periodPreset === "custom" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={cn(
                  "rounded-full border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring",
                  invalidCustomRange
                    ? "border-destructive"
                    : "border-border"
                )}
              />

              <span className="text-xs text-muted-foreground">
                →
              </span>

              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className={cn(
                  "rounded-full border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring",
                  invalidCustomRange
                    ? "border-destructive"
                    : "border-border"
                )}
              />
            </div>
          )}

          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

            <input
              type="text"
              value={alertSearch}
              onChange={(e) => setAlertSearch(e.target.value)}
              placeholder="Rechercher une alerte..."
              className={cn(
                "w-52 rounded-full border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors hover:bg-accent focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                alertSearch.trim()
                  ? "border-foreground ring-1 ring-foreground/20"
                  : "border-border"
              )}
            />
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAlertFilters}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
            >
              <X className="h-3 w-3" />
              Effacer les filtres

              <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
                {activeFilterCount}
              </span>
            </button>
          )}
        </div>

        {periodPreset === "custom" && invalidCustomRange && (
          <div className="border-t border-border px-6 py-2">
            <p className="text-xs font-medium text-destructive">
              La date de début doit être antérieure ou égale à la date de fin.
            </p>
          </div>
        )}

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Filtres actifs
            </span>

            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {statusFilter === "critical"
                  ? "Critiques"
                  : "Warnings"}
              </span>
            )}

            {periodPreset !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {periodPreset === "7"
                  ? "7 derniers jours"
                  : periodPreset === "30"
                  ? "30 derniers jours"
                  : periodPreset === "90"
                  ? "90 derniers jours"
                  : `${customFrom || "Début"} → ${
                      customTo || "Fin"
                    }`}
              </span>
            )}

            {alertSearch.trim() && (
              <span className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                Recherche : {alertSearch}
              </span>
            )}

            <span className="ml-auto text-[11px] font-medium text-muted-foreground">
              {tableAlerts.length} alerte
              {tableAlerts.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div
          className={cn(
            "grid gap-4 p-4 md:p-6",
            expandedAlert
              ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]"
              : "grid-cols-1"
          )}
        >
          <div className="min-w-0 overflow-hidden rounded-3xl border border-border">
            <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="border-b border-border px-4 py-3 font-medium">
                      Actif
                    </th>

                    <th className="border-b border-border px-4 py-3 font-medium">
                      Message
                    </th>

                    <th className="border-b border-border px-4 py-3 font-medium">
                      Secteur
                    </th>

                    <th className="border-b border-border px-4 py-3 font-medium">
                      Sévérité
                    </th>

                    <th className="border-b border-border px-4 py-3 font-medium">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tableAlerts.map((alert, i) => {
                    const key = `${alert.equipment}-${alert.date}`
                    const isSelected =
                      expandedAlertKey === key

                    return (
                      <tr
                        key={`${key}-${i}`}
                        onClick={() =>
                          setExpandedAlertKey(
                            isSelected ? null : key
                          )
                        }
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected
                            ? "bg-foreground text-background"
                            : "hover:bg-accent/15"
                        )}
                      >
                        <td
                          className={cn(
                            "px-4 py-4 font-semibold",
                            isSelected
                              ? "rounded-l-2xl"
                              : "border-b border-border"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                alert.severity === "CRITICAL"
                                  ? "bg-destructive"
                                  : "bg-brand"
                              )}
                            />

                            {alert.equipment}
                          </div>
                        </td>

                        <td
                          className={cn(
                            "max-w-[280px] truncate px-4 py-4",
                            isSelected
                              ? "text-background/70"
                              : "border-b border-border text-muted-foreground"
                          )}
                        >
                          {alert.message}
                        </td>

                        <td
                          className={cn(
                            "px-4 py-4 capitalize",
                            isSelected
                              ? "text-background/70"
                              : "border-b border-border text-muted-foreground"
                          )}
                        >
                          {getSectorLabel(alert.sector)}
                        </td>

                        <td
                          className={cn(
                            "px-4 py-4",
                            !isSelected &&
                              "border-b border-border"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                              alert.severity === "CRITICAL"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-500/15 text-amber-600"
                            )}
                          >
                            {alert.severity}
                          </span>
                        </td>

                        <td
                          className={cn(
                            "px-4 py-4",
                            isSelected
                              ? "rounded-r-2xl text-background/70"
                              : "border-b border-border text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            {new Date(
                              alert.date
                            ).toLocaleString("fr-FR")}

                            <ChevronRight
                              className={cn(
                                "h-4 w-4 shrink-0 transition-all",
                                isSelected
                                  ? "rotate-90 text-brand"
                                  : "text-muted-foreground"
                              )}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {tableAlerts.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-8 text-muted-foreground"
                        colSpan={5}
                      >
                        {alertsError ? (
                          <span
                            role="alert"
                            className="text-destructive"
                          >
                            Impossible de charger les alertes
                            ({alertsError}). L&apos;API est peut-être
                            hors service : rechargez la page ou
                            vérifiez la console du navigateur.
                          </span>
                        ) : (
                          "Aucune alerte pour ces filtres. Importez un CSV ou élargissez la période."
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {expandedAlert && (
            <div className="min-w-0 self-start rounded-3xl bg-sidebar p-5 text-sidebar-foreground shadow-lg ring-1 ring-sidebar-border lg:sticky lg:top-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                    Détails de l'alerte
                  </p>

                  <h4 className="mt-1.5 truncate font-heading text-xl font-bold tracking-tight">
                    {expandedAlert.equipment}
                  </h4>

                  <p className="mt-0.5 text-xs text-sidebar-foreground/50">
                    {new Date(
                      expandedAlert.date
                    ).toLocaleString("fr-FR")}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                      expandedAlert.severity === "CRITICAL"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/15 text-amber-600"
                    )}
                  >
                    {expandedAlert.severity}
                  </span>

                  <button
                    type="button"
                    onClick={() => setExpandedAlertKey(null)}
                    aria-label="Fermer les détails"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-sidebar-foreground/60 ring-1 ring-white/10 transition-colors hover:bg-accent hover:text-accent-foreground hover:ring-transparent"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/40">
                  Message
                </p>

                <p className="mt-1 text-sm leading-5 text-sidebar-foreground/90">
                  {expandedAlert.message}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/40">
                    Secteur
                  </p>

                  <p className="mt-1 text-sm font-semibold capitalize">
                    {getSectorLabel(expandedAlert.sector)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/40">
                    Statut
                  </p>

                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                      expandedAlert.severity === "CRITICAL"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/15 text-amber-600"
                    )}
                  >
                    {expandedAlert.severity}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/40">
                    Score de risque
                  </p>

                  <p
                    className={cn(
                      "mt-1 text-sm font-semibold",
                      typeof expandedRecommendation?.risk_score === "number"
                        ? "text-accent"
                        : "text-sidebar-foreground/40"
                    )}
                    title={
                      typeof expandedRecommendation?.risk_score === "number"
                        ? "Gravité du problème lui-même, calculée à partir des mesures brutes"
                        : "Ce secteur ne calcule pas encore de score de risque pour cette alerte"
                    }
                  >
                    {typeof expandedRecommendation?.risk_score === "number"
                      ? `${expandedRecommendation.risk_score} / 100`
                      : "Non calculé"}
                  </p>
                </div>

                {/*
                  Confidence is a SEPARATE measure from risk and gets its own
                  labelled cell: risk = "how bad is this problem", confidence =
                  "how sure are we this deserves attention". Sharing one label
                  made them read as a single number.
                */}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/40">
                    Confiance
                  </p>

                  {expandedRecommendation ? (
                    <p
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold"
                      title="À quel point SentrIA est sûr que cette alerte mérite votre attention"
                    >
                      <Gauge className="h-3 w-3 shrink-0 text-sidebar-foreground/50" />
                      {estimateConfidence(
                        expandedRecommendation,
                        recurrenceOf(
                          expandedRecommendation.equipment,
                          alerts
                        ),
                        trackRecordForCategory(
                          expandedRecommendation.action_category,
                          recommendations,
                          actionsLog
                        )
                      )}
                      %
                    </p>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-sidebar-foreground/40">
                      —
                    </p>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/40">
                    Catégorie
                  </p>

                  <p className="mt-1 truncate text-sm font-semibold capitalize">
                    {expandedRecommendation?.action_category ?? "N/A"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                  Recommandation
                </p>

                <p className="mt-1.5 text-sm font-medium leading-5 text-sidebar-foreground/90">
                  {expandedRecommendation?.recommended_action ??
                    "Analyse en cours — recommandation bientôt disponible."}
                </p>
              </div>

              {expandedRecommendation && (
                <div className="mt-3 rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                    Pourquoi
                  </p>

                  <p className="mt-1.5 text-xs leading-5 text-sidebar-foreground/70">
                    {reasoningFor(
                      expandedRecommendation,
                      recurrenceOf(
                        expandedRecommendation.equipment,
                        alerts
                      )
                    )}
                  </p>
                </div>
              )}

              <div className="mt-3 rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                  Contexte sectoriel
                </p>

                <p className="mt-1.5 text-xs leading-5 text-sidebar-foreground/70">
                  {expandedRecommendation
                    ? getRecommendationContext(
                        expandedRecommendation
                      )
                    : "SentrIA analyse cette alerte afin d'identifier l'action opérationnelle la plus pertinente."}
                </p>
              </div>

              {expandedRecommendation &&
                (() => {
                  const actionKey = `${expandedRecommendation.equipment}-${
                    expandedRecommendation.alert_key ??
                    expandedRecommendation.id
                  }`
                  const action = actionsLog[actionKey]

                  return !action || action.status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          recordAction(actionKey, "done")
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Marquer traité
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          recordAction(actionKey, "dismissed")
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-sidebar-foreground/70 transition-colors hover:bg-white/5"
                      >
                        <X className="h-3.5 w-3.5" />
                        Ignorer
                      </button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "mt-3 rounded-xl px-3 py-2.5 ring-1",
                        action.status === "done"
                          ? "bg-emerald-500/10 ring-emerald-500/30"
                          : "bg-white/5 ring-white/10"
                      )}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-sidebar-foreground/60">
                        Résultat
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/80">
                        {action.status === "done"
                          ? `Traité à ${action.at}. SentrIA continue de surveiller cet actif pour confirmer l'effet.`
                          : `Écarté à ${action.at}. Réapparaîtra si le signal s'aggrave.`}
                      </p>
                    </div>
                  )
                })()}

              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  disabled={!expandedRecommendation}
                  onClick={(e) => {
                    e.stopPropagation()

                    if (expandedRecommendation) {
                      setSelectedRecommendation(
                        expandedRecommendation
                      )
                    }
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-transform",
                    expandedRecommendation
                      ? "bg-accent text-accent-foreground hover:scale-[1.02]"
                      : "cursor-not-allowed bg-white/10 text-sidebar-foreground/40"
                  )}
                >
                  Voir la recommandation
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedRecommendation && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedRecommendation(null)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recommendation-dialog-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-card shadow-2xl ring-1 ring-border"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Recommandation SentrIA
                </p>

                <h2
                  id="recommendation-dialog-title"
                  className="mt-2 font-heading text-2xl font-bold tracking-tight"
                >
                  {selectedRecommendation.equipment}
                </h2>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold">
                    {getSectorLabel(
                      selectedRecommendation.sector
                    )}
                  </span>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                      selectedRecommendation.severity ===
                        "CRITICAL"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/15 text-amber-600"
                    )}
                  >
                    {selectedRecommendation.severity}
                  </span>

                  {selectedRecommendation.risk_score !==
                    null &&
                    selectedRecommendation.risk_score !==
                      undefined && (
                      <span
                        className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold text-accent-foreground"
                        title="Gravité du problème lui-même, calculée à partir des mesures brutes"
                      >
                        Risque :{" "}
                        {selectedRecommendation.risk_score} / 100
                      </span>
                    )}

                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"
                    title="À quel point SentrIA est sûr de cette analyse"
                  >
                    <Gauge className="h-3 w-3" />
                    {(() => {
                      const pct = estimateConfidence(
                        selectedRecommendation,
                        recurrenceOf(
                          selectedRecommendation.equipment,
                          alerts
                        ),
                        trackRecordForCategory(
                          selectedRecommendation.action_category,
                          recommendations,
                          actionsLog
                        )
                      )
                      return (
                        <>
                          Confiance {confidenceWord(pct)} · {pct}%
                        </>
                      )
                    })()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRecommendation(null)
                }
                aria-label="Fermer la recommandation"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Alerte détectée
                </p>

                <p className="mt-2 text-sm leading-6 text-foreground">
                  {selectedRecommendation.message}
                </p>
              </div>

              <div className="rounded-2xl border border-accent/30 bg-accent/10 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-accent-foreground">
                  Action recommandée
                </p>

                <p className="mt-2 text-base font-semibold leading-7 text-foreground">
                  {selectedRecommendation.recommended_action}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Catégorie
                  </p>

                  <p className="mt-1.5 text-sm font-semibold capitalize">
                    {selectedRecommendation.action_category ||
                      "Opérationnelle"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Date de détection
                  </p>

                  <p className="mt-1.5 text-sm font-semibold">
                    {new Date(
                      selectedRecommendation.date
                    ).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Pourquoi
                </p>

                <p className="mt-1.5 text-sm leading-6 text-foreground/80">
                  {reasoningFor(
                    selectedRecommendation,
                    recurrenceOf(
                      selectedRecommendation.equipment,
                      alerts
                    )
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-sidebar p-5 text-sidebar-foreground">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Shield className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                      Impact si personne n&apos;agit
                    </p>

                    <p className="mt-1.5 text-sm leading-6 text-sidebar-foreground/75">
                      {getRecommendationContext(
                        selectedRecommendation
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {selectedRecommendation.sector === "eac" && (
                <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-accent-foreground">
                    Contexte EAC
                  </p>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Cette recommandation doit être interprétée
                    dans le contexte des flux régionaux de
                    l'Afrique de l'Est : transit transfrontalier,
                    formalités douanières, disponibilité des
                    marchandises, coordination portuaire et
                    continuité des corridors.
                  </p>
                </div>
              )}

              {(() => {
                const actionKey = `${selectedRecommendation.equipment}-${
                  selectedRecommendation.alert_key ??
                  selectedRecommendation.id
                }`
                const action = actionsLog[actionKey]

                if (!action || action.status === "pending") {
                  return null
                }

                return (
                  <div
                    className={cn(
                      "rounded-2xl border p-4",
                      action.status === "done"
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-border bg-muted/30"
                    )}
                  >
                    <p
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-widest",
                        action.status === "done"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-muted-foreground"
                      )}
                    >
                      Résultat
                    </p>

                    <p className="mt-1.5 text-sm leading-6 text-foreground/80">
                      {action.status === "done"
                        ? `Marqué traité à ${action.at}. SentrIA continue de surveiller cet actif pour confirmer l'effet.`
                        : `Écarté à ${action.at}. Réapparaîtra si le signal s'aggrave.`}
                    </p>
                  </div>
                )
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border p-6">
              <button
                type="button"
                onClick={() =>
                  setSelectedRecommendation(null)
                }
                className="rounded-full border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Fermer
              </button>

              <button
                type="button"
                onClick={() => {
                  const actionKey = `${selectedRecommendation.equipment}-${
                    selectedRecommendation.alert_key ??
                    selectedRecommendation.id
                  }`
                  recordAction(actionKey, "dismissed")
                  setSelectedRecommendation(null)
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Ignorer
              </button>

              <button
                type="button"
                onClick={() => {
                  const actionKey = `${selectedRecommendation.equipment}-${
                    selectedRecommendation.alert_key ??
                    selectedRecommendation.id
                  }`
                  recordAction(actionKey, "done")
                  setSelectedRecommendation(null)
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground transition-transform hover:scale-[1.02]"
              >
                <Check className="h-3.5 w-3.5" />
                Marquer traité
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}