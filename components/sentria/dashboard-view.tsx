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
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
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
      a.filter((x) =>
        x.message.toLowerCase().includes("cycle")
      ).length,
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
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
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
  port: SECTOR_META.logistics,
  entrepot: SECTOR_META.logistics,
  transport: SECTOR_META.logistics,
  expedition: SECTOR_META.logistics,
  froid: SECTOR_META.logistics,
  multi: SECTOR_META.logistics,
}

function getSavedLogisticsPriorities(): LogisticsPriority[] {
  if (typeof window === "undefined") {
    return ["blockages"]
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem("sentria_equipment") || "[]"
    )

    if (!Array.isArray(stored)) {
      return ["blockages"]
    }

    const valid = stored.filter(
      (value): value is LogisticsPriority =>
        [
          "blockages",
          "wait",
          "cost",
          "anticipate",
          "recommend",
          "resources",
        ].includes(value)
    )

    return valid.length > 0 ? valid : ["blockages"]
  } catch {
    return ["blockages"]
  }
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

  const [logisticsPriority, setLogisticsPriority] =
    useState<LogisticsPriority | null>(null)

  const [selectedLogisticsPriorities, setSelectedLogisticsPriorities] =
    useState<LogisticsPriority[]>(() =>
      getSavedLogisticsPriorities()
    )

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

      setSelectedLogisticsPriorities(
        getSavedLogisticsPriorities()
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
  }, [logisticsPriority])

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

  function returnToDashboard() {
    setLogisticsPriority(null)
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

      await new Promise((r) => setTimeout(r, 1500))

      const r2 = await fetch(`${API}/alerts`)
      const d2 = await r2.json()

      setAlerts(Array.isArray(d2) ? d2 : [])

      refreshRecommendations()

      setFilterSector(uploadSector)
      localStorage.setItem("sentria_sector", uploadSector)
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

  const presetMs =
    periodPreset === "7"
      ? 7 * 24 * 60 * 60 * 1000
      : periodPreset === "30"
      ? 30 * 24 * 60 * 60 * 1000
      : periodPreset === "90"
      ? 90 * 24 * 60 * 60 * 1000
      : null

  const customFromTime = customFrom
    ? new Date(customFrom).getTime()
    : null

  const customToTime = customTo
    ? new Date(customTo).getTime() +
      24 * 60 * 60 * 1000 -
      1
    : null

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
      if (customFromTime && alertTime < customFromTime) return false
      if (customToTime && alertTime > customToTime) return false
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
                      {LOGISTICS_PRIORITY_DESCRIPTIONS[priority]}
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
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground hover:bg-accent hover:text-accent-foreground"
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
              : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
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
                : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
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
                    className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
                    : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
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
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <option value="all">Tous les statuts</option>
            <option value="critical">Critiques</option>
            <option value="warning">Warnings</option>
          </select>

          <select
            value={periodPreset}
            onChange={(e) =>
              setPeriodPreset(
                e.target.value as
                  | "all"
                  | "7"
                  | "30"
                  | "90"
                  | "custom"
              )
            }
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <option value="all">Toutes les dates</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
            <option value="custom">Dates personnalisées</option>
          </select>

          {periodPreset === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none"
              />

              <span className="text-xs text-muted-foreground">
                →
              </span>

              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none"
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
              className="w-52 rounded-full border border-border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-muted"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-6 py-2">
          <ChevronRight className="h-3.5 w-3.5 text-accent-foreground" />

          <p className="text-[11px] font-medium text-muted-foreground">
            Cliquez sur une alerte pour afficher les détails à droite.
          </p>
        </div>

        <div
          className={cn(
            "grid gap-4 p-4 transition-all duration-300 md:p-6",
            expandedAlert
              ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              : "grid-cols-1"
          )}
        >
          <div
            className={cn(
              "min-w-0 overflow-hidden rounded-3xl border border-border",
              expandedAlert && "lg:h-[600px]"
            )}
          >
            <div
              className={cn(
                "overflow-x-auto",
                expandedAlert && "h-full overflow-y-auto"
              )}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">
                      Actif
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Message
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Secteur
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Sévérité
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tableAlerts.slice(0, 20).map((alert, i) => {
                    const key = `${alert.equipment}-${alert.date}`
                    const isSelected = expandedAlertKey === key

                    return (
                      <tr
                        key={`${key}-${i}`}
                        onClick={() =>
                          setExpandedAlertKey(
                            isSelected ? null : key
                          )
                        }
                        title="Cliquez pour voir les détails"
                        className={cn(
                          "cursor-pointer border-b border-border transition-colors last:border-0",
                          isSelected
                            ? "bg-foreground text-background"
                            : "hover:bg-accent/15"
                        )}
                      >
                        <td className="px-4 py-4 font-semibold">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                alert.severity === "CRITICAL"
                                  ? "bg-red-400"
                                  : "bg-[#a3e635]"
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
                              : "text-muted-foreground"
                          )}
                        >
                          {alert.message}
                        </td>

                        <td
                          className={cn(
                            "px-4 py-4 capitalize",
                            isSelected
                              ? "text-background/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {alert.sector ?? "N/A"}
                        </td>

                        <td className="px-4 py-4">
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
                              ? "text-background/70"
                              : "text-muted-foreground"
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
                                  ? "rotate-90 text-[#a3e635]"
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
                        Aucune alerte pour ces filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {expandedAlert && (
            <div className="min-w-0 self-start rounded-3xl bg-black p-5 text-white ring-1 ring-[#a3e635]/30 shadow-[0_0_30px_rgba(163,230,53,0.10)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a3e635]">
                    Détails de l'alerte
                  </p>

                  <h4 className="mt-1.5 truncate font-heading text-xl font-bold tracking-tight">
                    {expandedAlert.equipment}
                  </h4>

                  <p className="mt-0.5 text-xs text-white/50">
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
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/60 ring-1 ring-white/10 transition-colors hover:bg-[#a3e635] hover:text-black hover:ring-transparent"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  Message
                </p>

                <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/90">
                  {expandedAlert.message}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/40">
                    Secteur
                  </p>

                  <p className="text-sm font-semibold capitalize">
                    {expandedAlert.sector ?? "N/A"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/40">
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
                  <p className="text-[10px] uppercase tracking-wide text-white/40">
                    Score de risque
                  </p>

                  <p className="text-sm font-semibold text-[#a3e635]">
                    {expandedRecommendation?.risk_score ?? "N/A"}
                  </p>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-white/40">
                    Catégorie
                  </p>

                  <p className="truncate text-sm font-semibold capitalize">
                    {expandedRecommendation?.action_category ?? "N/A"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-[#a3e635]/20 bg-[#a3e635]/5 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a3e635]">
                  Recommandation
                </p>

                <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-5 text-white/90">
                  {expandedRecommendation?.recommended_action ??
                    "Analyse en cours — recommandation bientôt disponible."}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-white/40">
                  Cliquez à nouveau pour refermer.
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#a3e635] px-4 py-2 text-xs font-bold text-[#1a2e05] transition-transform hover:scale-[1.02]"
                >
                  Voir la recommandation
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}