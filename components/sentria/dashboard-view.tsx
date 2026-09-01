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
  Wrench,
  Fuel,
  Clock3,
  Package,
  Radar,
} from "lucide-react"
import { AreaChart, BarChart, Sparkline } from "./charts"
import { cn } from "@/lib/utils"

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

// Matches the `category` field set in pipeline/action_map.py
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
        value: String(
          a.filter((x) => x.severity === "CRITICAL").length
        ),
        delta:
          a.filter((x) => x.severity === "CRITICAL").length > 0
            ? "À traiter"
            : "OK",
        up:
          a.filter((x) => x.severity === "CRITICAL").length === 0,
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

export function DashboardView({
  search = "",
}: {
  search?: string
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [uploadSector, setUploadSector] = useState("industry")
  const [filterSector, setFilterSector] = useState("all")
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")

  const [activeSectors, setActiveSectors] = useState<string[]>(
    () => {
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
    }
  )

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
    }

    window.addEventListener(
      "sentria_sectors_updated",
      refreshSectors
    )

    return () => {
      window.removeEventListener(
        "sentria_sectors_updated",
        refreshSectors
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
        setRecommendations(Array.isArray(d?.recommendations) ? d.recommendations : [])
      })
      .catch((err) => {
        console.error("Failed to load recommendations:", err)
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
        `${API}/upload?sector=${uploadSector}&lang=fr`,
        {
          method: "POST",
          body: form,
        }
      )

      if (!res.ok) {
        throw new Error("Upload failed")
      }

      const data = await res.json()

      setUploadMsg(
        data.message ?? "Fichier traité."
      )

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
      setUploadMsg(
        "Erreur lors de l'upload."
      )
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
          alertDate.getFullYear() ===
            d.getFullYear() &&
          alertDate.getMonth() ===
            d.getMonth() &&
          alertDate.getDate() ===
            d.getDate()
        )
      }).length
    }
  )

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

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
            SentrIA surveille vos alertes en temps réel ·
            machines, stocks, flottes, équipements · partout
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

      {/* RECOMMENDATIONS */}
      {filteredRecommendations.length > 0 ? (() => {
        const [top, ...rest] = filteredRecommendations
        const TopIcon = CATEGORY_ICON[top.action_category] ?? Sparkles
        const topCritical = top.severity === "CRITICAL"
        const topRiskPct =
          typeof top.risk_score === "number"
            ? Math.round(top.risk_score > 1 ? Math.min(top.risk_score, 100) : top.risk_score * 100)
            : null

        return (
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6">
            {/* soft ambient glow, purely decorative */}
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
                    {filteredRecommendations.length} situations classées par urgence, avec une action concrète pour chacune.
                  </p>
                </div>
              </div>

              {rest.length > 0 && (
                <span className="hidden shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
                  Faites défiler pour voir la suite
                </span>
              )}
            </div>

            <div className="relative mt-6 flex flex-col gap-4 lg:flex-row">
              {/* spotlight: the single most urgent item */}
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

              {/* queue: the remaining priorities, scrollable so the panel stays compact */}
              {rest.length > 0 && (
                <div className="scrollbar-hide -mx-1 flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
                  {rest.map((rec, idx) => {
                    const rank = idx + 2
                    const Icon = CATEGORY_ICON[rec.action_category] ?? Sparkles
                    const isCritical = rec.severity === "CRITICAL"

                    return (
                      <div
                        key={`${rec.equipment}-${rec.alert_key}-${idx}`}
                        className="group flex w-64 shrink-0 snap-start flex-col rounded-2xl border border-border bg-background p-4 transition-all duration-300 ease-out animate-in fade-in slide-in-from-right-2 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
                        style={{ animationDelay: `${idx * 70}ms`, animationFillMode: "backwards" }}
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
                              {SECTORS.find((s) => s.key === rec.sector)?.label ?? rec.sector}
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
      })() : recommendations.length > 0 ? (
        <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 shrink-0" />
          Aucune priorité urgente pour ce secteur pour le moment. Tout est sous contrôle ici.
        </div>
      ) : null}

      {/* SECTOR FILTER */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterSector("all")}
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
            onClick={() =>
              setFilterSector(s.key)
            }
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
                k.up
                  ? "text-accent"
                  : "text-destructive"
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
                onClick={() =>
                  setUploadSector(s.key)
                }
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

            {uploading
              ? "Traitement…"
              : "Importer CSV"}

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
              </tr>
            </thead>

            <tbody>
              {filteredAlerts
                .slice(0, 20)
                .map((alert, i) => (
                  <tr
                    key={`${alert.equipment}-${alert.date}-${i}`}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/50"
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
                          alert.severity ===
                            "CRITICAL"
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
                  </tr>
                ))}

              {filteredAlerts.length === 0 && (
                <tr>
                  <td
                    className="px-6 py-8 text-muted-foreground"
                    colSpan={5}
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
    </div>
  )
}