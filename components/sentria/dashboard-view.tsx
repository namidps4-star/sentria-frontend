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
  X,
} from "lucide-react"
import { AreaChart, BarChart, Sparkline } from "./charts"
import { cn } from "@/lib/utils"
import { LogisticsBlockagesView } from "./logistics-blockages-view"
import { LogisticsWaitingView } from "./logistics-waiting-view"
import { LogisticsCostView } from "./logistics-cost-view"
import { LogisticsAnticipateView } from "./logistics-anticipate-view"
import { RecommendationsPanel } from "./recommendations-panel"
import { RecommendationsBoard } from "./recommendations-board-view"

const API = "https://sentria-8btn.onrender.com"

const SECTORS = [
  { key: "all", label: "Tous" },
  { key: "industry", label: "Industrie" },
  { key: "health", label: "Santé" },
  { key: "agriculture", label: "Agriculture" },
  { key: "transportation", label: "Transport" },
  { key: "logistics", label: "Logistique" },
  { key: "energy", label: "Énergie" },
]

type Alert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
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
  recommended_action: string
  action_category: string
}

type LogisticsPriority =
  | "blockages"
  | "wait"
  | "cost"
  | "anticipate"
  | "recommend"
  | "resources"

const LOGISTICS_PRIORITY_LABELS: Record<
  LogisticsPriority,
  string
> = {
  blockages: "Blocages",
  wait: "Temps d'attente",
  cost: "Coûts",
  anticipate: "Anticipation",
  recommend: "Recommandations",
  resources: "Ressources",
}

const LOGISTICS_PRIORITY_DESCRIPTIONS: Record<
  LogisticsPriority,
  string
> = {
  blockages:
    "Identifiez les équipements, flux ou opérations actuellement bloqués.",
  wait:
    "Surveillez les files d'attente et les temps d'immobilisation.",
  cost:
    "Analysez les postes qui génèrent les coûts logistiques les plus importants.",
  anticipate:
    "Anticipez les risques et les perturbations à venir.",
  recommend:
    "Consultez les recommandations générées par SentrIA.",
  resources:
    "Suivez l'utilisation et la disponibilité de vos ressources.",
}

const SECTOR_META: Record<
  string,
  {
    kpis: (alerts: Alert[]) => {
      label: string
      value: string
      delta: string
      up: boolean
      spark: number[]
    }[]
    chartTitle: string
    barLabels: string[]
    barData: (alerts: Alert[]) => number[]
  }
> = {
  all: {
    kpis: (a) => [
      {
        label: "Actifs en alerte",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Live",
        up: true,
        spark: [4, 6, 5, 8, 7, 9, 11],
      },
      {
        label: "Alertes critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        delta:
          a.filter((x) => x.severity === "CRITICAL").length > 0
            ? "À traiter"
            : "OK",
        up:
          a.filter((x) => x.severity === "CRITICAL").length ===
          0,
        spark: [9, 8, 7, 8, 6, 5, 4],
      },
      {
        label: "Warnings",
        value: String(
          a.filter((x) => x.severity === "WARNING").length
        ),
        delta: "Surveillance",
        up: true,
        spark: [8, 7, 9, 6, 8, 10, 12],
      },
      {
        label: "Total alertes",
        value: String(a.length),
        delta: "Toutes sources",
        up: true,
        spark: [2, 3, 3, 4, 5, 5, 6],
      },
    ],
    chartTitle: "Évolution des alertes",
    barLabels: ["CRIT", "WARN", "INFO"],
    barData: (a) => [
      a.filter((x) => x.severity === "CRITICAL").length,
      a.filter((x) => x.severity === "WARNING").length,
      0,
    ],
  },

  industry: {
    kpis: (a) => [
      {
        label: "Machines en panne imminente",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        delta: "Arrêt immédiat",
        up: false,
        spark: [2, 4, 3, 6, 5, 8, 7],
      },
      {
        label: "Usure élevée",
        value: String(
          a.filter((x) => x.severity === "WARNING").length
        ),
        delta: "Surveiller",
        up: true,
        spark: [4, 5, 6, 5, 7, 8, 9],
      },
      {
        label: "Machines surveillées",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Live",
        up: true,
        spark: [5, 6, 5, 7, 6, 8, 9],
      },
      {
        label: "Total alertes",
        value: String(a.length),
        delta: "Session",
        up: true,
        spark: [2, 3, 3, 4, 5, 5, 6],
      },
    ],
    chartTitle: "Alertes machines · 7 jours",
    barLabels: ["Panne", "Usure", "Torque"],
    barData: (a) => [
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("failure") ||
          x.message.toLowerCase().includes("panne")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("wear") ||
          x.message.toLowerCase().includes("usure")
      ).length,
      a.filter((x) =>
        x.message.toLowerCase().includes("torque")
      ).length,
    ],
  },

  health: {
    kpis: (a) => [
      {
        label: "Ruptures critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        delta: "Commander maintenant",
        up: false,
        spark: [3, 2, 4, 5, 3, 4, 6],
      },
      {
        label: "Stocks bas",
        value: String(
          a.filter((x) => x.severity === "WARNING").length
        ),
        delta: "À surveiller",
        up: true,
        spark: [2, 3, 3, 4, 5, 4, 5],
      },
      {
        label: "Médicaments concernés",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Produits",
        up: true,
        spark: [1, 2, 2, 3, 3, 4, 4],
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
        spark: [0, 0, 1, 0, 1, 1, 2],
      },
    ],
    chartTitle: "Alertes stocks · 7 jours",
    barLabels: ["Rupture", "Stock bas", "Froid", "Expiry"],
    barData: (a) => [
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("rupture") ||
          x.message.toLowerCase().includes("reorder")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("bas") ||
          x.message.toLowerCase().includes("low")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("froid") ||
          x.message.toLowerCase().includes("cold")
      ).length,
      a.filter((x) =>
        x.message.toLowerCase().includes("expir")
      ).length,
    ],
  },

  agriculture: {
    kpis: (a) => [
      {
        label: "Pertes probables",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        delta: "Livraison urgente",
        up: false,
        spark: [1, 2, 2, 3, 4, 3, 5],
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
        spark: [0, 1, 1, 2, 2, 3, 3],
      },
      {
        label: "Produits en risque",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Actifs",
        up: true,
        spark: [2, 2, 3, 3, 4, 4, 5],
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
        spark: [0, 0, 1, 1, 1, 2, 2],
      },
    ],
    chartTitle: "Alertes récoltes · 7 jours",
    barLabels: ["Perte", "Retard", "Temp.", "Stock"],
    barData: (a) => [
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("perte") ||
          x.message.toLowerCase().includes("loss")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("retard") ||
          x.message.toLowerCase().includes("delay")
      ).length,
      a.filter((x) =>
        x.message.toLowerCase().includes("temp")
      ).length,
      a.filter((x) =>
        x.message.toLowerCase().includes("stock")
      ).length,
    ],
  },

  transportation: {
    kpis: (a) => [
      {
        label: "Camions critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        delta: "Immobiliser",
        up: false,
        spark: [1, 2, 1, 3, 2, 4, 3],
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
        spark: [2, 2, 3, 3, 4, 4, 5],
      },
      {
        label: "Camions surveillés",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Flotte",
        up: true,
        spark: [3, 4, 4, 5, 5, 6, 7],
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
        spark: [0, 0, 1, 1, 1, 2, 2],
      },
    ],
    chartTitle: "Alertes flotte · 7 jours",
    barLabels: ["Critique", "Service", "Moteur"],
    barData: (a) => [
      a.filter((x) => x.severity === "CRITICAL").length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("service") ||
          x.message.toLowerCase().includes("révision")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("moteur") ||
          x.message.toLowerCase().includes("engine")
      ).length,
    ],
  },

  logistics: {
    kpis: (a) => [
      {
        label: "Blocages critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        delta: "À débloquer",
        up: false,
        spark: [2, 3, 2, 4, 3, 5, 4],
      },
      {
        label: "Temps d'attente",
        value: String(
          a.filter((x) => x.severity === "WARNING").length
        ),
        delta: "Surveillance",
        up: true,
        spark: [2, 3, 4, 3, 5, 4, 6],
      },
      {
        label: "Opérations surveillées",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Live",
        up: true,
        spark: [3, 4, 5, 5, 6, 7, 8],
      },
      {
        label: "Total alertes",
        value: String(a.length),
        delta: "Logistique",
        up: true,
        spark: [2, 3, 4, 4, 5, 6, 7],
      },
    ],
    chartTitle: "Alertes logistiques · 7 jours",
    barLabels: ["Blocages", "Attente", "Retard"],
    barData: (a) => [
      a.filter(
        (x) =>
          x.severity === "CRITICAL" ||
          x.message.toLowerCase().includes("bloc")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("attente") ||
          x.message.toLowerCase().includes("wait")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("retard") ||
          x.message.toLowerCase().includes("delay")
      ).length,
    ],
  },

  energy: {
    kpis: (a) => [
      {
        label: "Incidents critiques",
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        delta: "Intervention",
        up: false,
        spark: [1, 2, 2, 3, 2, 4, 3],
      },
      {
        label: "Anomalies",
        value: String(
          a.filter((x) => x.severity === "WARNING").length
        ),
        delta: "Surveiller",
        up: true,
        spark: [3, 4, 3, 5, 4, 6, 5],
      },
      {
        label: "Équipements surveillés",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Réseau",
        up: true,
        spark: [4, 5, 5, 6, 7, 7, 8],
      },
      {
        label: "Total alertes",
        value: String(a.length),
        delta: "Énergie",
        up: true,
        spark: [2, 3, 3, 4, 5, 5, 6],
      },
    ],
    chartTitle: "Alertes énergie · 7 jours",
    barLabels: ["Critique", "Anomalie", "Réseau"],
    barData: (a) => [
      a.filter((x) => x.severity === "CRITICAL").length,
      a.filter((x) => x.severity === "WARNING").length,
      a.filter((x) =>
        x.message.toLowerCase().includes("réseau")
      ).length,
    ],
  },
}

const OPS_TYPE_LABEL: Record<string, string> = {
  port: "Port",
  entrepot: "Entrepôt",
  transport: "Transport",
  expedition: "Expédition",
  froid: "Chaîne du froid",
  multi: "Multi-opérations",
}

const LOGISTICS_OPS_META: Record<
  string,
  {
    label: string
  }
> = {
  port: {
    label: "Port",
  },
  entrepot: {
    label: "Entrepôt",
  },
  transport: {
    label: "Transport",
  },
  expedition: {
    label: "Expédition",
  },
  froid: {
    label: "Chaîne du froid",
  },
  multi: {
    label: "Multi-opérations",
  },
}

function normalizeSector(value: unknown) {
  if (typeof value !== "string") return null

  const normalized = value.trim().toLowerCase()

  if (!normalized) return null

  if (
    normalized === "industry" ||
    normalized === "industrie"
  ) {
    return "industry"
  }

  if (
    normalized === "health" ||
    normalized === "santé" ||
    normalized === "sante"
  ) {
    return "health"
  }

  if (
    normalized === "agriculture" ||
    normalized === "agri"
  ) {
    return "agriculture"
  }

  if (
    normalized === "transportation" ||
    normalized === "transport"
  ) {
    return "transportation"
  }

  if (
    normalized === "logistics" ||
    normalized === "logistique"
  ) {
    return "logistics"
  }

  if (
    normalized === "energy" ||
    normalized === "énergie" ||
    normalized === "energie"
  ) {
    return "energy"
  }

  return normalized
}

function normalizeAlert(raw: any): Alert {
  return {
    equipment:
      raw?.equipment ??
      raw?.asset ??
      raw?.machine ??
      raw?.name ??
      "Actif inconnu",
    message:
      raw?.message ??
      raw?.alert ??
      raw?.description ??
      "Aucune description",
    severity:
      raw?.severity ??
      raw?.level ??
      raw?.status ??
      "WARNING",
    date:
      raw?.date ??
      raw?.timestamp ??
      raw?.created_at ??
      new Date().toISOString(),
    sector:
      normalizeSector(
        raw?.sector ??
          raw?.secteur ??
          raw?.category
      ),
  }
}

function normalizeRecommendation(raw: any): Recommendation {
  return {
    id: String(
      raw?.id ??
        raw?.recommendation_id ??
        raw?.alert_key ??
        `${raw?.equipment ?? "equipment"}-${raw?.date ?? "date"}`
    ),
    equipment:
      raw?.equipment ??
      raw?.asset ??
      raw?.machine ??
      "Actif inconnu",
    sector:
      normalizeSector(
        raw?.sector ??
          raw?.secteur ??
          raw?.category
      ),
    severity:
      raw?.severity ??
      raw?.level ??
      "WARNING",
    date:
      raw?.date ??
      raw?.timestamp ??
      raw?.created_at ??
      new Date().toISOString(),
    message:
      raw?.message ??
      raw?.alert ??
      raw?.description ??
      "",
    risk_score:
      raw?.risk_score ??
      raw?.riskScore ??
      raw?.score ??
      null,
    alert_key:
      raw?.alert_key ??
      raw?.alertKey ??
      null,
    recommended_action:
      raw?.recommended_action ??
      raw?.recommendedAction ??
      raw?.action ??
      raw?.recommendation ??
      "Aucune action recommandée.",
    action_category:
      raw?.action_category ??
      raw?.actionCategory ??
      raw?.category ??
      "Général",
  }
}

function getStoredPriorities(): LogisticsPriority[] {
  if (typeof window === "undefined") return []

  try {
    const raw =
      localStorage.getItem("sentria_equipment")

    if (!raw) return []

    const parsed = JSON.parse(raw)

    if (Array.isArray(parsed)) {
      const priorities = parsed
        .map((item) => {
          if (typeof item === "string") {
            return item
          }

          return (
            item?.priority ??
            item?.key ??
            item?.type ??
            item?.equipment ??
            null
          )
        })
        .filter(Boolean)
        .map((value) =>
          String(value).toLowerCase()
        )

      return priorities.filter((value): value is LogisticsPriority =>
        [
          "blockages",
          "wait",
          "cost",
          "anticipate",
          "recommend",
          "resources",
        ].includes(value)
      )
    }

    if (
      parsed &&
      typeof parsed === "object"
    ) {
      const priorities = [
        ...(Array.isArray(parsed.priorities)
          ? parsed.priorities
          : []),
        ...(Array.isArray(parsed.logisticsPriorities)
          ? parsed.logisticsPriorities
          : []),
      ]

      return priorities
        .map((value) =>
          typeof value === "string"
            ? value
            : value?.priority ??
              value?.key ??
              null
        )
        .filter(Boolean)
        .map((value) =>
          String(value).toLowerCase()
        )
        .filter((value): value is LogisticsPriority =>
          [
            "blockages",
            "wait",
            "cost",
            "anticipate",
            "recommend",
            "resources",
          ].includes(value)
        )
    }
  } catch {
    return []
  }

  return []
}

export function DashboardView({
  search = "",
}: {
  search?: string
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] =
    useState<Recommendation[]>([])
  const [filterSector, setFilterSector] =
    useState("all")
  const [uploadSector, setUploadSector] =
    useState("industry")
  const [uploading, setUploading] =
    useState(false)
  const [uploadMsg, setUploadMsg] =
    useState("")
  const [selectedAlertKey, setSelectedAlertKey] =
    useState<string | null>(null)
  const [logisticsPriority, setLogisticsPriority] =
    useState<LogisticsPriority | null>(null)
  const [selectedLogisticsPriorities, setSelectedLogisticsPriorities] =
    useState<LogisticsPriority[]>([])
  const [opsType, setOpsType] =
    useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const alertsResponse = await fetch(
          `${API}/alerts`
        )

        if (alertsResponse.ok) {
          const data = await alertsResponse.json()

          const normalized = Array.isArray(data)
            ? data.map(normalizeAlert)
            : Array.isArray(data?.alerts)
            ? data.alerts.map(normalizeAlert)
            : []

          setAlerts(normalized)
        }
      } catch {
        setAlerts([])
      }

      try {
        const recommendationsResponse =
          await fetch(
            `${API}/recommendations`
          )

        if (recommendationsResponse.ok) {
          const data =
            await recommendationsResponse.json()

          const normalized = Array.isArray(data)
            ? data.map(normalizeRecommendation)
            : Array.isArray(data?.recommendations)
            ? data.recommendations.map(
                normalizeRecommendation
              )
            : []

          setRecommendations(normalized)
        }
      } catch {
        setRecommendations([])
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    setSelectedLogisticsPriorities(
      getStoredPriorities()
    )

    if (typeof window !== "undefined") {
      const storedOpsType =
        localStorage.getItem(
          "sentria_ops_type"
        )

      if (storedOpsType) {
        setOpsType(
          storedOpsType.toLowerCase()
        )
      }
    }
  }, [])

  const activeSectors = Array.from(
    new Set(
      alerts
        .map((alert) => alert.sector)
        .filter(
          (sector): sector is string =>
            Boolean(sector)
        )
    )
  )

  const visibleSectors =
    activeSectors.length > 0
      ? activeSectors
      : [
          "industry",
          "health",
          "agriculture",
          "transportation",
          "logistics",
          "energy",
        ]

  const filteredAlerts = alerts.filter(
    (alert) =>
      filterSector === "all" ||
      alert.sector === filterSector
  )

  const filteredRecommendations =
    recommendations.filter(
      (recommendation) =>
        filterSector === "all" ||
        recommendation.sector === filterSector
    )

  const selectedAlert =
    selectedAlertKey
      ? alerts.find(
          (alert) =>
            `${alert.equipment}-${alert.date}` ===
            selectedAlertKey
        ) ?? null
      : null

  const matchedRecommendation =
    selectedAlert
      ? recommendations.find(
          (recommendation) => {
            const sameEquipment =
              recommendation.equipment ===
              selectedAlert.equipment

            const sameSector =
              !selectedAlert.sector ||
              !recommendation.sector ||
              recommendation.sector ===
                selectedAlert.sector

            const sameAlertKey =
              recommendation.alert_key ===
              `${selectedAlert.equipment}-${selectedAlert.date}`

            return (
              sameAlertKey ||
              (sameEquipment && sameSector)
            )
          }
        ) ?? null
      : null

  const meta =
    SECTOR_META[filterSector] ??
    SECTOR_META.all

  const kpis = meta.kpis(
    filteredAlerts
  )

  const chartData = Array.from(
    { length: 7 },
    (_, index) =>
      filteredAlerts.filter(() => true)
        .length +
      index
  )

  const barData =
    meta.barData(filteredAlerts)

  const openLogisticsOverview = () => {
    setLogisticsPriority(null)
    setFilterSector("logistics")

    if (typeof window !== "undefined") {
      const storedOpsType =
        localStorage.getItem(
          "sentria_ops_type"
        )

      if (storedOpsType) {
        setOpsType(
          storedOpsType.toLowerCase()
        )
      }

      localStorage.setItem(
        "sentria_sector",
        "logistics"
      )
    }
  }

  const openLogisticsPriority = (
    priority: LogisticsPriority
  ) => {
    setFilterSector("logistics")
    setLogisticsPriority(priority)

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "sentria_sector",
        "logistics"
      )
    }
  }

  const returnToDashboard = () => {
    setLogisticsPriority(null)
    setFilterSector("all")
    setSelectedAlertKey(null)

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "sentria_sector",
        "all"
      )
    }
  }

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0]

    if (!file) return

    setUploading(true)
    setUploadMsg("")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append(
        "sector",
        uploadSector
      )

      const response = await fetch(
        `${API}/upload`,
        {
          method: "POST",
          body: formData,
        }
      )

      if (!response.ok) {
        throw new Error(
          "Upload failed"
        )
      }

      const data =
        await response.json()

      setUploadMsg(
        data?.message ??
          "Import terminé avec succès."
      )

      const alertsResponse =
        await fetch(`${API}/alerts`)

      if (alertsResponse.ok) {
        const alertsData =
          await alertsResponse.json()

        const normalized =
          Array.isArray(alertsData)
            ? alertsData.map(normalizeAlert)
            : Array.isArray(
                alertsData?.alerts
              )
            ? alertsData.alerts.map(
                normalizeAlert
              )
            : []

        setAlerts(normalized)
      }
    } catch {
      setUploadMsg(
        "Erreur lors de l'import du fichier."
      )
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  const renderLogisticsView = () => {
    const normalizedOpsType =
      opsType &&
      LOGISTICS_OPS_META[opsType]
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

          <div className="rounded-3xl bg-foreground p-6 text-background md:p-8">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                <Shield className="h-3.5 w-3.5" />
                Logistique
              </span>

              <h2 className="mt-4 font-heading text-2xl font-bold leading-tight md:text-3xl">
                Vue d'ensemble de votre logistique.
              </h2>

              <p className="mt-2 text-sm leading-6 text-background/70">
                Retrouvez ici les priorités que vous avez
                sélectionnées pendant la configuration de SentrIA.
                Choisissez une priorité pour accéder directement
                à son espace de pilotage.
              </p>

              {normalizedOpsType &&
                OPS_TYPE_LABEL[normalizedOpsType] && (
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-background/20 bg-background/10 px-3 py-1 text-[11px] font-medium text-background/80">
                    <Shield className="h-3 w-3" />
                    {OPS_TYPE_LABEL[normalizedOpsType]}
                  </div>
                )}
            </div>
          </div>

          <div>
            <div className="mb-4">
              <h3 className="font-heading text-lg font-bold">
                Vos priorités
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Sélectionnées lors de votre onboarding.
              </p>
            </div>

            {selectedLogisticsPriorities.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {selectedLogisticsPriorities.map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() =>
                      openLogisticsPriority(priority)
                    }
                    className="group rounded-3xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="inline-flex rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                          Priorité
                        </span>

                        <h4 className="mt-3 font-heading text-lg font-bold">
                          {LOGISTICS_PRIORITY_LABELS[priority]}
                        </h4>
                      </div>

                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-5 text-muted-foreground">
                      {LOGISTICS_PRIORITY_DESCRIPTIONS[
                        priority
                      ]}
                    </p>

                    <div className="mt-5 text-xs font-semibold text-foreground">
                      Ouvrir la priorité →
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Aucune priorité logistique n'a été sélectionnée.
              </div>
            )}
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
                  data={k.spark}
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

        {selectedLogisticsPriorities.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">
                Priorités
              </span>

              {selectedLogisticsPriorities.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() =>
                    openLogisticsPriority(priority)
                  }
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    priority === logisticsPriority
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  )}
                >
                  {LOGISTICS_PRIORITY_LABELS[priority]}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <LogisticsWaitingView
            opsType={normalizedOpsType}
          />
        ) : logisticsPriority === "cost" ? (
          <LogisticsCostView
            opsType={normalizedOpsType}
          />
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

  if (
    filterSector === "logistics" &&
    logisticsPriority !== null
  ) {
    return renderLogisticsView()
  }

  if (
    filterSector === "logistics" &&
    logisticsPriority === null
  ) {
    return renderLogisticsView()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl bg-foreground p-6 text-background md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Zap className="h-3.5 w-3.5" />
            Temps réel
          </span>

          <h2 className="mt-3 text-balance font-heading text-2xl font-bold leading-tight md:text-3xl">
            Vue globale de vos opérations critiques.
          </h2>

          <p className="mt-2 text-pretty text-sm text-background/70">
            SentrIA surveille vos alertes en temps réel,
            machines, stocks, flottes, équipements, partout
            dans le monde.
          </p>
        </div>

        <button
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
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={returnToDashboard}
          className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
            filterSector === "all"
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:bg-muted"
          )}
        >
          Tous

          <span className="ml-1.5 text-[10px] opacity-60">
            {alerts.length}
          </span>
        </button>

        {SECTORS.filter(
          (s) =>
            s.key !== "all" &&
            activeSectors.includes(s.key)
        ).map((s) => (
          <button
            key={s.key}
            onClick={() => {
              if (s.key === "logistics") {
                openLogisticsOverview()
                return
              }

              setLogisticsPriority(null)
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
                : "border-border bg-background hover:bg-muted"
            )}
          >
            {s.label}

            <span className="ml-1.5 text-[10px] opacity-60">
              {
                alerts.filter(
                  (a) => a.sector === s.key
                ).length
              }
            </span>
          </button>
        ))}

        {filterSector === "all" &&
          selectedLogisticsPriorities.length > 0 && (
            <div className="ml-1 flex flex-wrap items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-2 py-1">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Priorités
              </span>

              {selectedLogisticsPriorities.map(
                (priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() =>
                      openLogisticsPriority(priority)
                    }
                    className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition-colors hover:bg-accent/25"
                  >
                    {LOGISTICS_PRIORITY_LABELS[priority]}
                  </button>
                )
              )}
            </div>
          )}
      </div>

      {filterSector === "logistics" &&
        opsType &&
        LOGISTICS_OPS_META[opsType] && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <Shield className="h-3 w-3" />
            {OPS_TYPE_LABEL[opsType]}
          </div>
        )}

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
              data={k.spark}
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
                {meta.chartTitle}
              </h3>

              <p className="text-sm text-muted-foreground">
                7 derniers jours
              </p>
            </div>

            <button
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

          <p className="text-sm text-muted-foreground">
            {meta.barLabels.join(" · ")}
          </p>

          <BarChart
            data={barData}
            labels={meta.barLabels}
            className="mt-6"
            height={180}
          />
        </div>
      </div>

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
                onClick={() => setUploadSector(s.key)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                  uploadSector === s.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-muted"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
            <Upload className="h-4 w-4" />

            {uploading ? "Traitement..." : "Importer CSV"}

            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {uploadMsg && (
          <p className="mt-3 text-sm font-medium text-green-600">
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

      {/* ALERTS + DETAIL */}
      <div
        className={cn(
          "grid gap-4",
          selectedAlert
            ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"
            : "grid-cols-1"
        )}
      >
        {/* ALERT LIST */}
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
            </div>

            <button className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90">
              Tout voir
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-medium">
                    Actif
                  </th>

                  <th className="px-6 py-3 font-medium">
                    Message
                  </th>

                  <th className="px-6 py-3 font-medium">
                    Secteur
                  </th>

                  <th className="px-6 py-3 font-medium">
                    Sévérité
                  </th>

                  <th className="px-6 py-3 font-medium">
                    Date
                  </th>

                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>

              <tbody>
                {filteredAlerts
                  .slice(0, 20)
                  .map((alert, i) => {
                    const alertKey = `${alert.equipment}-${alert.date}`
                    const isSelected =
                      selectedAlertKey === alertKey

                    return (
                      <tr
                        key={`${alert.equipment}-${alert.date}-${i}`}
                        onClick={() =>
                          setSelectedAlertKey(
                            isSelected ? null : alertKey
                          )
                        }
                        className={cn(
                          "cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/50",
                          isSelected && "bg-muted/50"
                        )}
                      >
                        <td className="px-6 py-4 font-semibold">
                          {alert.equipment}
                        </td>

                        <td className="px-6 py-4 text-muted-foreground">
                          {alert.message}
                        </td>

                        <td className="px-6 py-4 capitalize text-muted-foreground">
                          {alert.sector ?? "N/A"}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-semibold",
                              alert.severity === "CRITICAL"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-500/15 text-amber-600"
                            )}
                          >
                            {alert.severity}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(
                            alert.date
                          ).toLocaleString("fr-FR")}
                        </td>

                        {/* CLICKABLE INDICATOR */}
                        <td className="px-3 py-4 text-muted-foreground">
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isSelected && "rotate-90"
                            )}
                          />
                        </td>
                      </tr>
                    )
                  })}

                {filteredAlerts.length === 0 && (
                  <tr>
                    <td
                      className="px-6 py-8 text-muted-foreground"
                      colSpan={6}
                    >
                      Aucune alerte pour ce secteur.
                      Importez un CSV.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* BLACK ALERT DETAIL — ONLY VISIBLE AFTER CLICK */}
        {selectedAlert && (
          <div className="h-fit rounded-3xl bg-foreground p-6 text-background">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-background/50">
                  Détail de l'alerte
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h4 className="font-heading text-xl font-bold">
                    {selectedAlert.equipment}
                  </h4>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      selectedAlert.severity === "CRITICAL"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-amber-500 text-black"
                    )}
                  >
                    {selectedAlert.severity}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAlertKey(null)}
                className="rounded-full p-2 text-background/60 transition-colors hover:bg-background/10 hover:text-background"
                aria-label="Fermer le détail"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-background/50">
                  Secteur
                </p>

                <p className="mt-1 text-sm font-medium capitalize">
                  {selectedAlert.sector ?? "N/A"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-background/50">
                  Date
                </p>

                <p className="mt-1 text-sm font-medium">
                  {new Date(
                    selectedAlert.date
                  ).toLocaleString("fr-FR")}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-background/50">
                  Niveau de risque
                </p>

                <p className="mt-1 text-sm font-medium">
                  {matchedRecommendation?.risk_score != null
                    ? `${matchedRecommendation.risk_score}/100`
                    : selectedAlert.severity === "CRITICAL"
                    ? "Critique"
                    : "À surveiller"}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-background/50">
                Message
              </p>

              <p className="mt-2 text-sm leading-6 text-background/80">
                {selectedAlert.message}
              </p>
            </div>

            {matchedRecommendation && (
              <div className="mt-6 border-t border-background/10 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-background/50">
                  Recommandation
                </p>

                <p className="mt-2 text-sm leading-6 text-background/80">
                  {matchedRecommendation.recommended_action}
                </p>

                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-90"
                >
                  Voir la recommandation
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}