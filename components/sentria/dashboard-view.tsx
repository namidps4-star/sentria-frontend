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
  Check,
  Calendar,
  Download,
  Filter,
} from "lucide-react"
import { AreaChart, BarChart } from "./charts"
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

  // --- État additionnel pour le panneau liste + détail du tableau de bord ---
  // N'affecte aucune donnée existante : purement présentationnel.
  const [listTab, setListTab] = useState<"all" | "critical" | "warning">(
    "all"
  )
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [filterSector, listTab])

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

  // --- Données dérivées pour le panneau liste + détail (présentationnel) ---
  const listFilteredAlerts = filteredAlerts.filter((a) => {
    if (listTab === "all") return true
    if (listTab === "critical") return a.severity === "CRITICAL"
    return a.severity === "WARNING"
  })

  const selectedAlert =
    listFilteredAlerts[selectedIndex] ?? listFilteredAlerts[0] ?? null

  const matchedRecommendation = selectedAlert
    ? recommendations.find(
        (r) =>
          r.equipment === selectedAlert.equipment &&
          r.date === selectedAlert.date
      ) ??
      recommendations.find((r) => r.equipment === selectedAlert.equipment) ??
      null
    : null

  const resolutionSteps = [
    {
      label: "Détectée",
      done: !!selectedAlert,
      caption: selectedAlert
        ? new Date(selectedAlert.date).toLocaleDateString("fr-FR")
        : "",
    },
    {
      label: "Analysée",
      done: !!matchedRecommendation,
      caption: matchedRecommendation
        ? new Date(matchedRecommendation.date).toLocaleDateString("fr-FR")
        : "En attente",
    },
    {
      label: "Recommandation générée",
      done: !!matchedRecommendation?.recommended_action,
      caption: matchedRecommendation?.action_category ?? "En attente",
    },
    {
      label: "Action à traiter",
      done: false,
      caption: "À vous de jouer",
    },
  ]

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
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
            <Zap className="h-3 w-3" />
            Temps réel
          </span>

          <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-foreground">
            Vue d&apos;ensemble
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Toutes vos alertes critiques, en un coup d&apos;œil.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
            <Download className="h-4 w-4" />
            Exporter
          </button>

          <button
            onClick={() =>
              document
                .getElementById("alerts-panel")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
          >
            Voir les alertes
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* RECOMMENDATIONS */}
      <RecommendationsPanel
        recommendations={filteredRecommendations}
        totalRecommendationsCount={recommendations.length}
        alerts={alerts}
      />

      {/* SECTOR FILTER */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filtrer
        </span>

        <button
          onClick={() => {
            setFilterSector("all")
            localStorage.setItem("sentria_sector", "all")
          }}
          className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
            filterSector === "all"
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card hover:bg-muted"
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
                : "border-border bg-card hover:bg-muted"
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
        {kpis.map((k) => {
          const maxSpark = Math.max(...k.spark, 1)
          const pct = Math.min(
            100,
            Math.round((k.spark[k.spark.length - 1] / maxSpark) * 100)
          )

          return (
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

              <p className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground">
                {k.value}
              </p>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    k.up ? "bg-accent" : "bg-destructive"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* ALERTES RÉCENTES + DÉTAIL */}
      <div
        id="alerts-panel"
        className="rounded-3xl border border-border bg-card p-4 sm:p-6"
      >
        <div className="grid gap-4 lg:grid-cols-[380px_1fr] lg:gap-6">
          {/* LISTE */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-foreground">
                Alertes récentes
              </h3>
            </div>

            <div className="mt-3 flex items-center gap-1.5">
              <button
                onClick={() => setListTab("all")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  listTab === "all"
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Toutes {filteredAlerts.length}
              </button>
              <button
                onClick={() => setListTab("critical")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  listTab === "critical"
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Critiques{" "}
                {
                  filteredAlerts.filter((a) => a.severity === "CRITICAL")
                    .length
                }
              </button>
              <button
                onClick={() => setListTab("warning")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  listTab === "warning"
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Warnings{" "}
                {
                  filteredAlerts.filter((a) => a.severity === "WARNING")
                    .length
                }
              </button>
            </div>

            <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {listFilteredAlerts.slice(0, 12).map((alert, i) => {
                const isSelected = selectedAlert === alert

                return (
                  <button
                    key={`${alert.equipment}-${alert.date}-${i}`}
                    onClick={() => setSelectedIndex(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-transparent hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
                        isSelected
                          ? "bg-background/10 text-background"
                          : alert.severity === "CRITICAL"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/15 text-amber-600"
                      )}
                    >
                      {alert.equipment.slice(0, 2)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm font-semibold",
                          isSelected ? "text-background" : "text-foreground"
                        )}
                      >
                        {alert.equipment}
                      </span>
                      <span
                        className={cn(
                          "block truncate text-xs",
                          isSelected
                            ? "text-background/60"
                            : "text-muted-foreground"
                        )}
                      >
                        {new Date(alert.date).toLocaleDateString("fr-FR")}
                      </span>
                    </span>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
                        isSelected
                          ? "bg-accent text-accent-foreground"
                          : alert.severity === "CRITICAL"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/15 text-amber-600"
                      )}
                    >
                      {alert.severity}
                    </span>
                  </button>
                )
              })}

              {listFilteredAlerts.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucune alerte pour ce filtre.
                </p>
              )}
            </div>
          </div>

          {/* DÉTAIL */}
          <div className="rounded-2xl bg-foreground p-6 text-background">
            {selectedAlert ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-background/50">
                      Détail de l&apos;alerte
                    </p>
                    <h4 className="mt-1 font-heading text-xl font-bold">
                      {selectedAlert.equipment}
                    </h4>
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      selectedAlert.severity === "CRITICAL"
                        ? "bg-destructive/20 text-destructive"
                        : "bg-amber-500/20 text-amber-400"
                    )}
                  >
                    {selectedAlert.severity}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-background/5 p-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-background/50">
                      <Shield className="h-3 w-3" />
                      Secteur
                    </span>
                    <p className="mt-1 text-sm font-semibold capitalize">
                      {selectedAlert.sector ?? "N/A"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/5 p-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-background/50">
                      <Cpu className="h-3 w-3" />
                      Score de risque
                    </span>
                    <p className="mt-1 text-sm font-semibold">
                      {matchedRecommendation?.risk_score ?? "N/A"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/5 p-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-background/50">
                      <Calendar className="h-3 w-3" />
                      Date
                    </span>
                    <p className="mt-1 text-sm font-semibold">
                      {new Date(selectedAlert.date).toLocaleDateString(
                        "fr-FR"
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs text-background/50">
                    Suivi de résolution
                  </p>

                  <div className="mt-3 flex items-center">
                    {resolutionSteps.map((step, i) => (
                      <div
                        key={step.label}
                        className="flex flex-1 items-center last:flex-none"
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                              step.done
                                ? "bg-accent text-accent-foreground"
                                : "bg-background/10 text-background/40"
                            )}
                          >
                            {step.done ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              i + 1
                            )}
                          </span>
                          <span className="max-w-[80px] text-center text-[10px] leading-tight text-background/60">
                            {step.label}
                          </span>
                        </div>

                        {i < resolutionSteps.length - 1 && (
                          <span
                            className={cn(
                              "mx-1.5 h-px flex-1",
                              step.done ? "bg-accent" : "bg-background/10"
                            )}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-xl bg-background/5 p-4">
                  <p className="text-xs text-background/50">Message</p>
                  <p className="mt-1 text-sm text-background/90">
                    {selectedAlert.message}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-background/5 p-4">
                  <div className="min-w-0">
                    <p className="text-xs text-background/50">
                      Recommandation
                    </p>
                    <p className="mt-1 truncate text-sm font-medium">
                      {matchedRecommendation?.recommended_action ??
                        "Analyse en cours"}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      document
                        .getElementById("alerts-panel")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-foreground transition-transform hover:scale-[1.02]"
                  >
                    Voir la recommandation
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-sm text-background/60">
                Sélectionnez une alerte pour voir le détail.
              </p>
            )}
          </div>
        </div>
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
    </div>
  )
}