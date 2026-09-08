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
  Filter,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Clock,
  MapPin,
  X,
  Search,
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
  id?: string
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
  location?: string
  trackerSteps?: {
    label: string
    date: string
    status: "completed" | "blocked" | "pending"
    location?: string
  }[]
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

const LOGISTICS_PRIORITY_LABELS: Record<LogisticsPriority, string> = {
  blockages: "Blocages",
  wait: "Temps d'attente",
  cost: "Coûts",
  anticipate: "Anticipation",
  recommend: "Recommandations",
  resources: "Ressources",
}

const LOGISTICS_PRIORITY_DESCRIPTIONS: Record<LogisticsPriority, string> = {
  blockages: "Identifiez les équipements, flux ou opérations actuellement bloqués.",
  wait: "Surveillez les files d'attente et les temps d'immobilisation.",
  cost: "Analysez les postes qui génèrent les coûts logistiques les plus importants.",
  anticipate: "Anticipez les risques et les perturbations à venir.",
  recommend: "Consultez les recommandations générées par SentrIA.",
  resources: "Suivez l'utilisation et la disponibilité de vos ressources.",
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
        value: String(a.filter((x) => x.severity === "CRITICAL").length),
        delta: a.filter((x) => x.severity === "CRITICAL").length > 0 ? "À traiter" : "OK",
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
        value: String(a.filter((x) => x.message.toLowerCase().includes("temp")).length),
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

const LOGISTICS_OPS_META: Record<string, (typeof SECTOR_META)["logistics"]> = {
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

    const valid = stored.filter((value): value is LogisticsPriority =>
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

// Generate default mock tracker details for alerts without full data
function getTrackerDetails(alert: Alert) {
  const isCritical = alert.severity === "CRITICAL"
  return alert.trackerSteps || [
    {
      label: "Enregistrement",
      date: alert.date || "2026-03-01 08:30",
      status: "completed" as const,
      location: "Centre d'inspection",
    },
    {
      label: "Diagnostic automatisé",
      date: alert.date || "2026-03-01 09:15",
      status: "completed" as const,
      location: "Système SentrIA",
    },
    {
      label: isCritical ? "Point de blocage détecté" : "Mise en attente",
      date: alert.date || "2026-03-01 10:00",
      status: isCritical ? ("blocked" as const) : ("completed" as const),
      location: alert.location || "Zone de Transit - Station 4",
    },
    {
      label: "Résolution & Action",
      date: "En attente",
      status: "pending" as const,
      location: "Équipe de maintenance",
    },
  ]
}

export function DashboardView({ search = "" }: { search?: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])

  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [dateFilter, setDateFilter] = useState<string>("ALL")

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
    useState<LogisticsPriority | null>(null)

  const [selectedLogisticsPriorities, setSelectedLogisticsPriorities] =
    useState<LogisticsPriority[]>(() => getSavedLogisticsPriorities())

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

      const priorities = getSavedLogisticsPriorities()
      setSelectedLogisticsPriorities(priorities)

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

    window.addEventListener("sentria_sectors_updated", refreshSectors)
    window.addEventListener("sentria_onboarding_completed", refreshSectors)
    window.addEventListener("storage", refreshPriority)

    return () => {
      window.removeEventListener("sentria_sectors_updated", refreshSectors)
      window.removeEventListener("sentria_onboarding_completed", refreshSectors)
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

        const normalized: Recommendation[] = d.recommendations.map(
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
              id = `${id}::${Math.random().toString(36).slice(2, 8)}`
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
        console.error("Failed to load recommendations:", err)
      })
  }

  useEffect(() => {
    refreshRecommendations()
  }, [])

  function returnToDashboard() {
    setLogisticsPriority(null)
    setFilterSector("all")
    localStorage.setItem("sentria_sector", "all")
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

  // Filter logic
  const filteredAlerts = alerts
    .filter(
      (a) => filterSector === "all" || a.sector === filterSector
    )
    .filter((a) => {
      if (statusFilter === "ALL") return true
      return a.severity.toUpperCase() === statusFilter.toUpperCase()
    })
    .filter((a) => {
      if (dateFilter === "ALL") return true
      const alertDate = new Date(a.date)
      const now = new Date()
      const diffDays = (now.getTime() - alertDate.getTime()) / (1000 * 3600 * 24)
      if (dateFilter === "7D") return diffDays <= 7
      if (dateFilter === "30D") return diffDays <= 30
      return true
    })
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

  const meta =
    filterSector === "logistics" && opsType
      ? LOGISTICS_OPS_META[opsType] ?? SECTOR_META[filterSector] ?? SECTOR_META.all
      : SECTOR_META[filterSector] ?? SECTOR_META.all

  const kpis = meta.kpis(filteredAlerts)

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>Tableau de Bord</span>
              <span className="text-xs bg-[#A3E635]/20 text-[#A3E635] px-2.5 py-0.5 rounded-full border border-[#A3E635]/30">
                SentrIA Live
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Surveillance et suivi intelligent des incidents et équipements
            </p>
          </div>

          {/* Sector selection */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {SECTORS.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setFilterSector(s.key)
                  localStorage.setItem("sentria_sector", s.key)
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border",
                  filterSector === s.key
                    ? "bg-[#A3E635] text-black border-[#A3E635] font-bold shadow-[0_0_12px_rgba(163,230,53,0.3)]"
                    : "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs Cards matching the background styling */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-slate-800/80 bg-[#121824] p-5 shadow-lg"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">{k.label}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
                    k.up
                      ? "bg-[#A3E635]/15 text-[#A3E635] border border-[#A3E635]/30"
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  )}
                >
                  {k.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {k.delta}
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-white">{k.value}</p>
              <Sparkline
                data={k.spark}
                className={cn(
                  "mt-3 h-8 w-full",
                  k.up ? "text-[#A3E635]" : "text-rose-500"
                )}
              />
            </div>
          ))}
        </div>

        {/* Filters Bar with Neon Green Highlights */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-[#121824] p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
              <Filter className="h-3.5 w-3.5 text-[#A3E635]" />
              Filtres
            </span>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0B0F17] text-white text-xs font-semibold rounded-xl px-3 py-2 border border-[#A3E635]/40 focus:outline-none focus:ring-2 focus:ring-[#A3E635] shadow-[0_0_10px_rgba(163,230,53,0.15)] cursor-pointer"
            >
              <option value="ALL">Tous les Statuts</option>
              <option value="CRITICAL">Critique seulement</option>
              <option value="WARNING">Avertissement (Warning)</option>
            </select>

            {/* Date Filter Dropdown */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-[#0B0F17] text-white text-xs font-semibold rounded-xl px-3 py-2 border border-[#A3E635]/40 focus:outline-none focus:ring-2 focus:ring-[#A3E635] shadow-[0_0_10px_rgba(163,230,53,0.15)] cursor-pointer"
            >
              <option value="ALL">Toutes les dates</option>
              <option value="7D">Derniers 7 jours</option>
              <option value="30D">Derniers 30 jours</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 bg-[#A3E635] text-black hover:bg-[#b4f248] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(163,230,53,0.25)]">
              <Upload className="h-3.5 w-3.5" />
              <span>{uploading ? "Chargement..." : "Importer Logs"}</span>
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Main Content Area: Alerts Table */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#121824] overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Alertes de Maintenance et Suivi</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                  {filteredAlerts.length}
                </span>
              </h2>
            </div>
            <span className="text-xs text-slate-400 italic">
              Cliquez sur une alerte pour ouvrir le tracker de statut
            </span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Aucune alerte ne correspond aux filtres choisis.
              </div>
            ) : (
              filteredAlerts.map((alert, idx) => {
                const isSelected = selectedAlert?.equipment === alert.equipment && selectedAlert?.date === alert.date
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedAlert(alert)}
                    className={cn(
                      "group flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer transition-all duration-200 border-l-4",
                      alert.severity === "CRITICAL"
                        ? "border-l-rose-500"
                        : "border-l-amber-400",
                      isSelected
                        ? "bg-black shadow-inner"
                        : "hover:bg-black/80 hover:scale-[0.998]"
                    )}
                  >
                    <div className="flex items-start md:items-center gap-3">
                      {/* Interactive Marker Indicator */}
                      <span className="mt-1 md:mt-0 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-[#A3E635] group-hover:bg-[#A3E635] group-hover:text-black transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white group-hover:text-[#A3E635] transition-colors">
                            {alert.equipment}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider",
                              alert.severity === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            )}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                          {alert.message}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 md:mt-0 flex items-center justify-between md:justify-end gap-6 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        <span>{alert.date}</span>
                      </div>

                      <span className="hidden md:inline-block text-[#A3E635] text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        Voir tracker →
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* POP-OUT BLACK BOX / TRACKER PANEL */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-black border-l border-slate-800 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              {/* Pop-out Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#A3E635] animate-pulse" />
                  <h3 className="font-bold text-lg text-white">Suivi de l'Alerte</h3>
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Alert Details Card */}
              <div className="rounded-xl bg-[#121824] p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {selectedAlert.equipment}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                      selectedAlert.severity === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    )}
                  >
                    {selectedAlert.severity}
                  </span>
                </div>
                <p className="text-sm font-medium text-white leading-relaxed">
                  {selectedAlert.message}
                </p>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                  <Calendar className="h-3.5 w-3.5 text-[#A3E635]" />
                  <span>Date d'enregistrement: {selectedAlert.date}</span>
                </div>
              </div>

              {/* Status Tracker Flow */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-[#A3E635]" />
                  Historique & Tracker d'État
                </h4>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {getTrackerDetails(selectedAlert).map((step, index) => (
                    <div key={index} className="relative flex items-start gap-3">
                      {/* Step Indicator Node */}
                      <span
                        className={cn(
                          "absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold border",
                          step.status === "completed"
                            ? "bg-[#A3E635] text-black border-[#A3E635]"
                            : step.status === "blocked"
                            ? "bg-rose-500 text-white border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                            : "bg-slate-900 text-slate-500 border-slate-800"
                        )}
                      >
                        {step.status === "completed" ? (
                          "✓"
                        ) : step.status === "blocked" ? (
                          "!"
                        ) : (
                          index + 1
                        )}
                      </span>

                      <div className="space-y-1">
                        <p className={cn(
                          "text-xs font-bold",
                          step.status === "blocked" ? "text-rose-400" : "text-slate-200"
                        )}>
                          {step.label}
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>{step.date}</span>
                          {step.location && (
                            <span className="flex items-center gap-0.5 text-slate-500">
                              • <MapPin className="h-3 w-3" /> {step.location}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Action Button */}
            <div className="pt-6 border-t border-slate-800">
              <button
                onClick={() => setSelectedAlert(null)}
                className="w-full py-2.5 bg-[#A3E635] hover:bg-[#b4f248] text-black text-xs font-extrabold rounded-xl transition-all shadow-[0_0_15px_rgba(163,230,53,0.2)]"
              >
                Fermer le Tracker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}