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
  Sparkles,
  Shield,
  Search,
  X,
  ChevronRight,
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

const SECTOR_META: Record<
  string,
  {
    kpis: (
      alerts: Alert[]
    ) => {
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
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta:
          a.filter((x) => x.severity === "CRITICAL").length > 0
            ? "À traiter"
            : "OK",
        up: a.filter((x) => x.severity === "CRITICAL").length === 0,
        spark: [9, 8, 7, 8, 6, 5, 4],
      },
      {
        label: "Warnings",
        value: String(a.filter((x) => x.severity === "WARNING").length),
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
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta: "Arrêt immédiat",
        up: false,
        spark: [2, 4, 3, 6, 5, 8, 7],
      },
      {
        label: "Usure élevée",
        value: String(a.filter((x) => x.severity === "WARNING").length),
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
      a.filter((x) => x.message.toLowerCase().includes("torque")).length,
    ],
  },

  health: {
    kpis: (a) => [
      {
        label: "Ruptures critiques",
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta: "Commander maintenant",
        up: false,
        spark: [3, 2, 4, 5, 3, 4, 6],
      },
      {
        label: "Stocks bas",
        value: String(a.filter((x) => x.severity === "WARNING").length),
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
      a.filter((x) => x.message.toLowerCase().includes("expir")).length,
    ],
  },

  agriculture: {
    kpis: (a) => [
      {
        label: "Pertes probables",
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
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
          a.filter((x) => x.message.toLowerCase().includes("temp")).length
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
      a.filter((x) => x.message.toLowerCase().includes("temp")).length,
      a.filter((x) => x.message.toLowerCase().includes("stock")).length,
    ],
  },

  transportation: {
    kpis: (a) => [
      {
        label: "Camions critiques",
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
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
    barLabels: ["Moteur", "Huile", "Carburant", "Pneus"],
    barData: (a) => [
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("moteur") ||
          x.message.toLowerCase().includes("engine")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("huile") ||
          x.message.toLowerCase().includes("oil")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("carburant") ||
          x.message.toLowerCase().includes("fuel")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("pneu") ||
          x.message.toLowerCase().includes("tire")
      ).length,
    ],
  },

  logistics: {
    kpis: (a) => [
      {
        label: "Équipements bloqués",
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta: "Arrêt immédiat",
        up: false,
        spark: [1, 2, 2, 3, 3, 4, 5],
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
        spark: [2, 3, 3, 4, 4, 5, 6],
      },
      {
        label: "Équipements actifs",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Port",
        up: true,
        spark: [4, 5, 5, 6, 6, 7, 8],
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
        spark: [0, 1, 1, 1, 2, 2, 3],
      },
    ],
    chartTitle: "Alertes port · 7 jours",
    barLabels: ["Cycles", "Attente", "Pression", "Carburant"],
    barData: (a) => [
      a.filter((x) => x.message.toLowerCase().includes("cycle")).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("attente") ||
          x.message.toLowerCase().includes("wait")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("pression") ||
          x.message.toLowerCase().includes("pressure")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("carburant") ||
          x.message.toLowerCase().includes("fuel")
      ).length,
    ],
  },

  energy: {
    kpis: (a) => [
      {
        label: "Générateurs critiques",
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta: "Intervenir",
        up: false,
        spark: [1, 2, 2, 3, 3, 4, 5],
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
        spark: [2, 2, 3, 3, 4, 4, 5],
      },
      {
        label: "Générateurs surveillés",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Actifs",
        up: true,
        spark: [3, 4, 4, 5, 5, 6, 7],
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
        spark: [0, 0, 1, 1, 2, 2, 3],
      },
    ],
    chartTitle: "Alertes énergie · 7 jours",
    barLabels: ["Carburant", "Surchauffe", "Huile", "Surcharge"],
    barData: (a) => [
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("carburant") ||
          x.message.toLowerCase().includes("fuel")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("surchauffe") ||
          x.message.toLowerCase().includes("overheat")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("huile") ||
          x.message.toLowerCase().includes("oil")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("surcharge") ||
          x.message.toLowerCase().includes("overload")
      ).length,
    ],
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
  port: {
    kpis: (a) => [
      {
        label: "Conteneurs bloqués",
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta: "Arrêt immédiat",
        up: false,
        spark: [1, 2, 2, 3, 3, 4, 5],
      },
      {
        label: "Attente au quai",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("attente") ||
              x.message.toLowerCase().includes("quai") ||
              x.message.toLowerCase().includes("wait")
          ).length
        ),
        delta: "File conteneurs",
        up: false,
        spark: [2, 3, 3, 4, 4, 5, 6],
      },
      {
        label: "Grues & engins actifs",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Terminal",
        up: true,
        spark: [4, 5, 5, 6, 6, 7, 8],
      },
      {
        label: "Alertes hydrauliques",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("pression") ||
              x.message.toLowerCase().includes("hydraulique") ||
              x.message.toLowerCase().includes("pressure")
          ).length
        ),
        delta: "Grues",
        up: false,
        spark: [0, 1, 1, 1, 2, 2, 3],
      },
    ],
    chartTitle: "Activité quai et conteneurs · 7 jours",
    barLabels: ["Cycles grue", "Attente quai", "Pression", "Carburant"],
    barData: (a) => [
      a.filter((x) => x.message.toLowerCase().includes("cycle")).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("attente") ||
          x.message.toLowerCase().includes("quai") ||
          x.message.toLowerCase().includes("wait")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("pression") ||
          x.message.toLowerCase().includes("pressure")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("carburant") ||
          x.message.toLowerCase().includes("fuel")
      ).length,
    ],
  },

  entrepot: {
    kpis: (a) => [
      {
        label: "Zones bloquées",
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta: "Arrêt immédiat",
        up: false,
        spark: [1, 2, 2, 3, 3, 4, 5],
      },
      {
        label: "Commandes en retard",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("retard") ||
              x.message.toLowerCase().includes("delay")
          ).length
        ),
        delta: "Préparation",
        up: false,
        spark: [2, 3, 3, 4, 4, 5, 6],
      },
      {
        label: "Chariots actifs",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Entrepôt",
        up: true,
        spark: [4, 5, 5, 6, 6, 7, 8],
      },
      {
        label: "Alertes capacité",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("capacite") ||
              x.message.toLowerCase().includes("capacity") ||
              x.message.toLowerCase().includes("surcharge")
          ).length
        ),
        delta: "Stockage",
        up: false,
        spark: [0, 1, 1, 1, 2, 2, 3],
      },
    ],
    chartTitle: "Activité entrepôt · 7 jours",
    barLabels: ["Cycles", "Retards", "Capacité", "Carburant"],
    barData: (a) => [
      a.filter((x) => x.message.toLowerCase().includes("cycle")).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("retard") ||
          x.message.toLowerCase().includes("delay")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("capacite") ||
          x.message.toLowerCase().includes("capacity")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("carburant") ||
          x.message.toLowerCase().includes("fuel")
      ).length,
    ],
  },

  transport: {
    kpis: (a) => [
      {
        label: "Véhicules bloqués",
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta: "Arrêt immédiat",
        up: false,
        spark: [1, 2, 2, 3, 3, 4, 5],
      },
      {
        label: "Entretien en retard",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("révision") ||
              x.message.toLowerCase().includes("service")
          ).length
        ),
        delta: "Maintenance",
        up: false,
        spark: [2, 3, 3, 4, 4, 5, 6],
      },
      {
        label: "Véhicules actifs",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Flotte",
        up: true,
        spark: [4, 5, 5, 6, 6, 7, 8],
      },
      {
        label: "Alertes carburant",
        value: String(
          a.filter(
            (x) =>
              x.message.toLowerCase().includes("carburant") ||
              x.message.toLowerCase().includes("fuel")
          ).length
        ),
        delta: "Flotte",
        up: false,
        spark: [0, 1, 1, 1, 2, 2, 3],
      },
    ],
    chartTitle: "Activité flotte · 7 jours",
    barLabels: ["Surchauffe", "Huile", "Pneus", "Carburant"],
    barData: (a) => [
      a.filter((x) => x.message.toLowerCase().includes("surchauffe")).length,
      a.filter((x) => x.message.toLowerCase().includes("huile")).length,
      a.filter((x) => x.message.toLowerCase().includes("pneus")).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("carburant") ||
          x.message.toLowerCase().includes("fuel")
      ).length,
    ],
  },

  froid: {
    kpis: (a) => [
      {
        label: "Ruptures chaîne du froid",
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta: "Arrêt immédiat",
        up: false,
        spark: [1, 2, 2, 3, 3, 4, 5],
      },
      {
        label: "Alertes température",
        value: String(
          a.filter((x) => x.message.toLowerCase().includes("temp")).length
        ),
        delta: "Seuil dépassé",
        up: false,
        spark: [2, 3, 3, 4, 4, 5, 6],
      },
      {
        label: "Équipements actifs",
        value: String(new Set(a.map((x) => x.equipment)).size),
        delta: "Froid",
        up: true,
        spark: [4, 5, 5, 6, 6, 7, 8],
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
        delta: "Groupe froid",
        up: false,
        spark: [0, 1, 1, 1, 2, 2, 3],
      },
    ],
    chartTitle: "Activité chaîne du froid · 7 jours",
    barLabels: ["Cycles", "Temp. hors seuil", "Pression", "Carburant"],
    barData: (a) => [
      a.filter((x) => x.message.toLowerCase().includes("cycle")).length,
      a.filter((x) => x.message.toLowerCase().includes("temp")).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("pression") ||
          x.message.toLowerCase().includes("pressure")
      ).length,
      a.filter(
        (x) =>
          x.message.toLowerCase().includes("carburant") ||
          x.message.toLowerCase().includes("fuel")
      ).length,
    ],
  },
}

function getSavedLogisticsPriority(): LogisticsPriority {
  if (typeof window === "undefined") {
    return "blockages"
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem("sentria_equipment") || "[]"
    )

    if (!Array.isArray(stored)) {
      return "blockages"
    }

    if (stored.includes("wait")) {
      return "wait"
    }

    if (stored.includes("blockages")) {
      return "blockages"
    }

    if (stored.includes("cost")) {
      return "cost"
    }

    if (stored.includes("anticipate")) {
      return "anticipate"
    }

    if (stored.includes("recommend")) {
      return "recommend"
    }

    if (stored.includes("resources")) {
      return "resources"
    }
  } catch {
    return "blockages"
  }

  return "blockages"
}

export function DashboardView({
  search = "",
}: {
  search?: string
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [uploadSector, setUploadSector] = useState("industry")

  const [filterSector, setFilterSector] = useState(() => {
    if (typeof window === "undefined") {
      return "all"
    }

    const savedSector = localStorage.getItem("sentria_sector")

    return savedSector || "all"
  })

  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")

  const [activeSectors, setActiveSectors] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return ["industry"]
    }

    try {
      const stored = JSON.parse(
        localStorage.getItem("sentria_sectors") || '["industry"]'
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

  const [logisticsPriority, setLogisticsPriority] =
    useState<LogisticsPriority>(() => getSavedLogisticsPriority())

  // --- Alerts table filter bar + detail panel state (additive, doesn't touch business logic above) ---
  const [statusFilter, setStatusFilter] = useState<
    "all" | "CRITICAL" | "WARNING"
  >("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [tableSearch, setTableSearch] = useState("")
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)

  useEffect(() => {
    const refreshSectors = () => {
      try {
        const stored = JSON.parse(
          localStorage.getItem("sentria_sectors") || '["industry"]'
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
      setLogisticsPriority(getSavedLogisticsPriority())

      const savedSector = localStorage.getItem("sentria_sector")

      if (savedSector) {
        setFilterSector(savedSector)
      }
    }

    const refreshPriority = () => {
      setLogisticsPriority(getSavedLogisticsPriority())
    }

    window.addEventListener(
      "sentria_sectors_updated",
      refreshSectors
    )

    window.addEventListener(
      "sentria_onboarding_completed",
      refreshSectors
    )

    window.addEventListener(
      "storage",
      refreshPriority
    )

    return () => {
      window.removeEventListener(
        "sentria_sectors_updated",
        refreshSectors
      )

      window.removeEventListener(
        "sentria_onboarding_completed",
        refreshSectors
      )

      window.removeEventListener(
        "storage",
        refreshPriority
      )
    }
  }, [])

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
    }
  }, [activeSectors, uploadSector, filterSector])

  useEffect(() => {
    fetch(`${API}/alerts`)
      .then((r) => r.json())
      .then((d) => {
        setAlerts(Array.isArray(d) ? d : [])
      })
      .catch((err) => {
        console.error("Failed to load alerts:", err)
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
                rec.alert_key ??
                `${rec.equipment}-${rec.date}-${index}`

              let id = String(baseId)

              if (usedIds.has(id)) {
                id = `${id}-${index}`
              }

              while (usedIds.has(id)) {
                id = `${id}-${Math.random()
                  .toString(36)
                  .slice(2, 7)}`
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

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]

    if (!file) return

    setUploading(true)
    setUploadMsg("")

    const form = new FormData()
    form.append("file", file)

    try {
      const res = await fetch(
        `${API}/upload?sector=${uploadSector}&lang=fr` +
          (uploadSector === "logistics" && opsType
            ? `&ops_type=${opsType}`
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

      await new Promise((r) =>
        setTimeout(r, 1500)
      )

      const r2 = await fetch(`${API}/alerts`)
      const d2 = await r2.json()

      setAlerts(Array.isArray(d2) ? d2 : [])
      refreshRecommendations()

      setFilterSector(uploadSector)
    } catch (error) {
      console.error(error)
      setUploadMsg("Erreur lors de l'upload.")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const filteredAlerts = alerts
    .filter(
      (a) =>
        filterSector === "all" ||
        a.sector === filterSector
    )
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

  // Extra layer applied only to the alerts table below (KPIs/charts above keep
  // using `filteredAlerts` untouched, per the "don't touch existing logic" rule).
  const tableAlerts = filteredAlerts.filter((a) => {
    if (statusFilter !== "all" && a.severity !== statusFilter) {
      return false
    }

    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)

      if (new Date(a.date) < from) return false
    }

    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)

      if (new Date(a.date) > to) return false
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()

      if (
        !a.equipment.toLowerCase().includes(q) &&
        !a.message.toLowerCase().includes(q) &&
        !(a.sector ?? "").toLowerCase().includes(q)
      ) {
        return false
      }
    }

    return true
  })

  const tableFiltersActive =
    statusFilter !== "all" || !!dateFrom || !!dateTo || !!tableSearch

  const filteredRecommendations = recommendations
    .filter(
      (r) =>
        filterSector === "all" ||
        r.sector === filterSector
    )
    .slice(0, 5)

  const meta =
    (filterSector === "logistics" && opsType
      ? LOGISTICS_OPS_META[opsType]
      : undefined) ??
    SECTOR_META[filterSector] ??
    SECTOR_META.all

  const kpis = meta.kpis(filteredAlerts)
  const barData = meta.barData(filteredAlerts)

  const chartData = Array.from(
    { length: 7 },
    (_, i) => {
      const d = new Date()

      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - (6 - i))

      return filteredAlerts.filter((a) => {
        const alertDate = new Date(a.date)

        return (
          alertDate.getFullYear() === d.getFullYear() &&
          alertDate.getMonth() === d.getMonth() &&
          alertDate.getDate() === d.getDate()
        )
      }).length
    }
  )

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

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setFilterSector("all")
            localStorage.setItem("sentria_sector", "all")
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Retour au tableau de bord
        </button>

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
      {/* HERO */}
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
            SentrIA surveille vos alertes en temps réel, machines, stocks,
            flottes, équipements, partout dans le monde.
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

      {/* RECOMMENDATIONS */}
      <RecommendationsPanel
        recommendations={filteredRecommendations}
        totalRecommendationsCount={recommendations.length}
        alerts={alerts}
      />

      {/* SECTOR FILTER */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setFilterSector("all")
            localStorage.setItem("sentria_sector", "all")
          }}
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
      </div>

      {filterSector === "logistics" &&
        opsType &&
        LOGISTICS_OPS_META[opsType] && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent-foreground">
            <Shield className="h-3 w-3" />
            Vue adaptée : {OPS_TYPE_LABEL[opsType]}
          </div>
        )}

      {/* KPIs */}
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

      {/* CHARTS */}
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

      {/* UPLOAD */}
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

      {/* ALERTS */}
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

        {/* Detail panel — same dark surface as the hero, only appears on row click */}
        {selectedAlert && (
          <div className="mx-6 mb-4 flex flex-col gap-4 rounded-3xl bg-foreground p-5 text-background sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    selectedAlert.severity === "CRITICAL"
                      ? "bg-destructive/20 text-destructive"
                      : "bg-accent/25 text-accent-foreground"
                  )}
                >
                  {selectedAlert.severity}
                </span>

                <span className="text-xs capitalize text-background/60">
                  {selectedAlert.sector ?? "N/A"}
                </span>

                <span className="text-xs text-background/40">
                  {new Date(selectedAlert.date).toLocaleString("fr-FR")}
                </span>
              </div>

              <h4 className="mt-2 font-heading text-xl font-bold">
                {selectedAlert.equipment}
              </h4>

              <p className="mt-1 max-w-xl text-sm text-background/70">
                {selectedAlert.message}
              </p>
            </div>

            <button
              onClick={() => setSelectedAlert(null)}
              className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
            >
              <X className="h-3.5 w-3.5" />
              Fermer
            </button>
          </div>
        )}

        {/* Filter bar: status, date range (du / au), search */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 pb-4">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "CRITICAL" | "WARNING"
              )
            }
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="all">Tous statuts</option>
            <option value="CRITICAL">Critique</option>
            <option value="WARNING">Warning</option>
          </select>

          <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:border-accent">
            <span className="text-muted-foreground">Du</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:border-accent">
            <span className="text-muted-foreground">Au</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 transition-colors hover:border-accent focus-within:border-accent sm:ml-auto">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Rechercher un actif, un message..."
              className="w-40 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none sm:w-56"
            />
          </div>

          {tableFiltersActive && (
            <button
              onClick={() => {
                setStatusFilter("all")
                setDateFrom("")
                setDateTo("")
                setTableSearch("")
              }}
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Réinitialiser
            </button>
          )}
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

                <th className="px-6 py-3 font-medium" aria-hidden />
              </tr>
            </thead>

            <tbody>
              {tableAlerts
                .slice(0, 20)
                .map((alert, i) => (
                  <tr
                    key={`${alert.equipment}-${alert.date}-${i}`}
                    onClick={() => setSelectedAlert(alert)}
                    className={cn(
                      "group cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-accent/10",
                      selectedAlert === alert && "bg-accent/10"
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

                    <td className="px-6 py-4">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-accent-foreground" />
                    </td>
                  </tr>
                ))}

              {tableAlerts.length === 0 && (
                <tr>
                  <td
                    className="px-6 py-8 text-muted-foreground"
                    colSpan={6}
                  >
                    {alerts.length === 0
                      ? "Aucune alerte pour ce secteur. Importez un CSV."
                      : "Aucune alerte ne correspond à ces filtres."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}