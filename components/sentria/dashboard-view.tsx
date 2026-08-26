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
  Check,
  ChevronRight,
  Database,
  ShieldCheck,
  Building2,
} from "lucide-react"
import { AreaChart, BarChart, Sparkline } from "./charts"
import { cn } from "@/lib/utils"

const API = "https://sentria-production.up.railway.app"

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

const ONBOARDING_STEPS = [
  {
    title: "Votre secteur",
    description:
      "Choisissez les activités que SentrIA doit surveiller.",
    icon: Building2,
  },
  {
    title: "Votre espace",
    description:
      "Configurez les secteurs pertinents pour votre organisation.",
    icon: Database,
  },
  {
    title: "Vos données",
    description:
      "Importez un premier fichier CSV pour lancer l'analyse.",
    icon: Upload,
  },
  {
    title: "Analyse",
    description:
      "SentrIA vérifie vos données et prépare votre surveillance.",
    icon: ShieldCheck,
  },
  {
    title: "C'est prêt",
    description:
      "Votre dashboard opérationnel est maintenant disponible.",
    icon: Zap,
  },
]

export function DashboardView({
  search = "",
}: {
  search?: string
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [uploadSector, setUploadSector] = useState("industry")
  const [filterSector, setFilterSector] = useState("all")
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")

  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    if (typeof window === "undefined") return false

    return (
      localStorage.getItem(
        "sentria_onboarding_complete"
      ) === "true"
    )
  })

  const [onboardingStep, setOnboardingStep] = useState(() => {
    if (typeof window === "undefined") return 0

    const value = Number(
      localStorage.getItem(
        "sentria_onboarding_step"
      ) || "0"
    )

    return Number.isFinite(value) ? value : 0
  })

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

  function updateOnboardingStep(step: number) {
    setOnboardingStep(step)

    localStorage.setItem(
      "sentria_onboarding_step",
      String(step)
    )
  }

  function completeOnboarding() {
    localStorage.setItem(
      "sentria_onboarding_complete",
      "true"
    )

    localStorage.setItem(
      "sentria_onboarding_step",
      "5"
    )

    setOnboardingComplete(true)
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

      setFilterSector(uploadSector)

      if (!onboardingComplete) {
        updateOnboardingStep(3)
      }
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
   * ONBOARDING
   * ============================================================
   */

  if (!onboardingComplete) {
    const currentStep =
      ONBOARDING_STEPS[onboardingStep] ??
      ONBOARDING_STEPS[0]

    const StepIcon = currentStep.icon

    return (
      <div className="space-y-6">
        {/* HERO */}
        <div className="rounded-3xl bg-foreground p-6 text-background md:p-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Zap className="h-3.5 w-3.5" />
              Bienvenue sur SentrIA
            </span>

            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight md:text-5xl">
              Configurez votre surveillance
              opérationnelle.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-background/70 md:text-base">
              Quelques étapes suffisent pour connecter
              vos données, configurer vos secteurs et
              commencer à détecter les situations critiques.
            </p>
          </div>
        </div>

        {/* PROGRESS */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">
                Configuration
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Étape {onboardingStep + 1} sur{" "}
                {ONBOARDING_STEPS.length}
              </p>
            </div>

            <span className="font-semibold">
              {Math.round(
                ((onboardingStep + 1) /
                  ONBOARDING_STEPS.length) *
                  100
              )}
              %
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{
                width: `${
                  ((onboardingStep + 1) /
                    ONBOARDING_STEPS.length) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        {/* STEP CARDS */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {ONBOARDING_STEPS.map(
            (step, index) => {
              const Icon = step.icon
              const completed =
                index < onboardingStep
              const active =
                index === onboardingStep

              return (
                <button
                  key={step.title}
                  onClick={() =>
                    index <= onboardingStep &&
                    updateOnboardingStep(index)
                  }
                  className={cn(
                    "rounded-3xl border p-5 text-left transition-all",
                    active
                      ? "border-foreground bg-card shadow-sm"
                      : completed
                      ? "border-accent/40 bg-card"
                      : "border-border bg-card/50"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-2xl",
                      completed
                        ? "bg-accent text-accent-foreground"
                        : active
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {completed ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>

                  <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Étape {index + 1}
                  </p>

                  <p className="mt-1 font-heading text-sm font-bold">
                    {step.title}
                  </p>
                </button>
              )
            }
          )}
        </div>

        {/* CURRENT STEP */}
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="flex flex-col gap-8">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground">
                <StepIcon className="h-7 w-7" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Étape {onboardingStep + 1}
                </p>

                <h2 className="mt-1 font-heading text-2xl font-bold">
                  {currentStep.title}
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {currentStep.description}
                </p>
              </div>
            </div>

            {/* STEP 0 — SECTOR */}
            {onboardingStep === 0 && (
              <div>
                <p className="mb-3 text-sm font-semibold">
                  Quels secteurs souhaitez-vous
                  surveiller ?
                </p>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {SECTORS.filter(
                    (s) => s.key !== "all"
                  ).map((sector) => {
                    const selected =
                      activeSectors.includes(
                        sector.key
                      )

                    return (
                      <button
                        key={sector.key}
                        onClick={() => {
                          const next = selected
                            ? activeSectors.filter(
                                (x) =>
                                  x !== sector.key
                              )
                            : [
                                ...activeSectors,
                                sector.key,
                              ]

                          if (next.length === 0) return

                          setActiveSectors(next)

                          localStorage.setItem(
                            "sentria_sectors",
                            JSON.stringify(next)
                          )

                          window.dispatchEvent(
                            new Event(
                              "sentria_sectors_updated"
                            )
                          )
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-2xl border p-4 text-left transition-all",
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <span className="text-sm font-semibold">
                          {sector.label}
                        </span>

                        {selected && (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 1 — SPACE */}
            {onboardingStep === 1 && (
              <div className="rounded-2xl bg-muted/50 p-6">
                <div className="flex items-start gap-4">
                  <Database className="mt-0.5 h-6 w-6 shrink-0" />

                  <div>
                    <h3 className="font-heading font-bold">
                      Votre espace est prêt
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      SentrIA va utiliser les secteurs
                      sélectionnés pour adapter les
                      indicateurs, alertes et analyses
                      de votre dashboard.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeSectors.map((sector) => (
                        <span
                          key={sector}
                          className="rounded-full bg-background px-3 py-1.5 text-xs font-semibold"
                        >
                          {
                            SECTORS.find(
                              (s) =>
                                s.key === sector
                            )?.label
                          }
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 — UPLOAD */}
            {onboardingStep === 2 && (
              <div className="rounded-2xl border border-dashed border-border p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-heading text-lg font-bold">
                      Importez votre premier CSV
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Les données seront analysées
                      automatiquement.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {SECTORS.filter(
                        (s) =>
                          s.key !== "all" &&
                          activeSectors.includes(
                            s.key
                          )
                      ).map((sector) => (
                        <button
                          key={sector.key}
                          onClick={() =>
                            setUploadSector(
                              sector.key
                            )
                          }
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                            uploadSector ===
                              sector.key
                              ? "border-foreground bg-foreground text-background"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          {sector.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
                    <Upload className="h-4 w-4" />

                    {uploading
                      ? "Analyse…"
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
                  <div className="mt-4 rounded-2xl bg-green-500/10 p-4 text-sm font-medium text-green-600">
                    {uploadMsg}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 — ANALYSIS */}
            {onboardingStep === 3 && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-muted/50 p-5">
                  <Database className="h-5 w-5" />

                  <p className="mt-4 text-2xl font-bold">
                    {alerts.length}
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Alertes détectées
                  </p>
                </div>

                <div className="rounded-2xl bg-muted/50 p-5">
                  <Cpu className="h-5 w-5" />

                  <p className="mt-4 text-2xl font-bold">
                    {
                      new Set(
                        alerts.map(
                          (x) => x.equipment
                        )
                      ).size
                    }
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Actifs identifiés
                  </p>
                </div>

                <div className="rounded-2xl bg-muted/50 p-5">
                  <ShieldCheck className="h-5 w-5" />

                  <p className="mt-4 text-2xl font-bold">
                    {
                      alerts.filter(
                        (x) =>
                          x.severity ===
                          "CRITICAL"
                      ).length
                    }
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Alertes critiques
                  </p>
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {onboardingStep === 4 && (
              <div className="rounded-2xl bg-accent/10 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
                    <Check className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-heading text-xl font-bold">
                      Votre surveillance est prête.
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Vous pouvez maintenant accéder
                      au dashboard et suivre vos alertes,
                      actifs et indicateurs opérationnels
                      en temps réel.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                {onboardingStep > 0 && (
                  <button
                    onClick={() =>
                      updateOnboardingStep(
                        onboardingStep - 1
                      )
                    }
                    className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    Retour
                  </button>
                )}
              </div>

              {onboardingStep < 4 ? (
                <button
                  onClick={() =>
                    updateOnboardingStep(
                      onboardingStep + 1
                    )
                  }
                  disabled={
                    onboardingStep === 0 &&
                    activeSectors.length === 0
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuer
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={completeOnboarding}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground"
                >
                  Ouvrir mon dashboard
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

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
                      {alert.sector ?? "—"}
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