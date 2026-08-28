"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Factory,
  HeartPulse,
  Wheat,
  Truck,
  Ship,
  Zap,
  Thermometer,
  Package,
  PackageX,
  Gauge,
  Cog,
  Droplets,
  Fuel,
  CircleAlert,
  Warehouse,
  Container,
  BatteryCharging,
  Activity,
  Boxes,
  Snowflake,
  CalendarClock,
  Radio,
  ShieldCheck,
  Database,
  Upload,
  Wifi,
  Clock3,
  CircleDollarSign,
  Radar,
  Sparkles,
  Anchor,
  PackageSearch,
  Recycle,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Sector =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"

type Equipment = {
  id: string
  label: string
  description: string
  icon: React.ElementType
}

type SectorConfig = {
  id: Sector
  label: string
  description: string
  icon: React.ElementType
}

type DataSource = {
  id: "erp" | "iot" | "csv"
  label: string
  description: string
  detail: string
  icon: React.ElementType
}

type OpsType = {
  id: "port" | "entrepot" | "transport" | "expedition" | "froid" | "multi"
  label: string
  icon: React.ElementType
}

const SECTORS: SectorConfig[] = [
  {
    id: "industry",
    label: "Industrie",
    description: "Machines, production et maintenance",
    icon: Factory,
  },
  {
    id: "health",
    label: "Santé",
    description: "Stocks, chaîne du froid et produits",
    icon: HeartPulse,
  },
  {
    id: "agriculture",
    label: "Agriculture",
    description: "Récoltes, stockage et transport",
    icon: Wheat,
  },
  {
    id: "transportation",
    label: "Transport",
    description: "Flotte, moteurs et maintenance",
    icon: Truck,
  },
  {
    id: "logistics",
    label: "Logistique",
    description: "Port, équipements et flux",
    icon: Ship,
  },
  {
    id: "energy",
    label: "Énergie",
    description: "Générateurs, carburant et température",
    icon: Zap,
  },
]

/*
 * IMPORTANT:
 *
 * Step 2 no longer asks "which parameters do you want to monitor".
 * It asks "what outcome matters to your business", per sector.
 *
 * SentrIA's differentiation is in Detect -> Predict -> Explain ->
 * Prioritize -> Recommend, not in raw visibility. Framing step 2
 * around outcomes keeps that promise visible from the first click,
 * instead of asking the user to already know which technical
 * parameter maps to which business risk.
 */

const EQUIPMENT_BY_SECTOR: Record<Sector, Equipment[]> = {
  industry: [
    {
      id: "machines",
      label: "Machines de production",
      description: "Usure, vibrations et pannes",
      icon: Cog,
    },
    {
      id: "motors",
      label: "Moteurs",
      description: "Performance et anomalies",
      icon: Activity,
    },
    {
      id: "temperature",
      label: "Température",
      description: "Surchauffe et dérives thermiques",
      icon: Thermometer,
    },
    {
      id: "pressure",
      label: "Pression",
      description: "Pression hydraulique et pneumatique",
      icon: Gauge,
    },
    {
      id: "production",
      label: "Production",
      description: "Cycles, rendement et arrêts",
      icon: Boxes,
    },
    {
      id: "maintenance",
      label: "Maintenance",
      description: "Révisions et interventions",
      icon: ShieldCheck,
    },
  ],

  health: [
    {
      id: "stocks",
      label: "Stocks",
      description: "Niveaux bas et risques de rupture",
      icon: Package,
    },
    {
      id: "cold-chain",
      label: "Chaîne du froid",
      description: "Température et conservation",
      icon: Snowflake,
    },
    {
      id: "temperature",
      label: "Température",
      description: "Surveillance des conditions de stockage",
      icon: Thermometer,
    },
    {
      id: "expiry",
      label: "Péremption",
      description: "Produits proches de l'expiration",
      icon: CalendarClock,
    },
    {
      id: "medications",
      label: "Médicaments",
      description: "Disponibilité et risque de rupture",
      icon: HeartPulse,
    },
    {
      id: "storage",
      label: "Stockage",
      description: "Conditions et capacité",
      icon: Warehouse,
    },
  ],

  agriculture: [
    {
      id: "crops",
      label: "Récoltes",
      description: "Pertes et risques de production",
      icon: Wheat,
    },
    {
      id: "storage",
      label: "Stockage",
      description: "Conditions et conservation",
      icon: Warehouse,
    },
    {
      id: "temperature",
      label: "Température",
      description: "Conditions de conservation",
      icon: Thermometer,
    },
    {
      id: "transport",
      label: "Transport",
      description: "Retards et livraisons",
      icon: Truck,
    },
    {
      id: "stocks",
      label: "Stocks",
      description: "Disponibilité des produits",
      icon: Package,
    },
    {
      id: "irrigation",
      label: "Irrigation",
      description: "Eau et fonctionnement des systèmes",
      icon: Droplets,
    },
  ],

  transportation: [
    {
      id: "vehicles",
      label: "Véhicules",
      description: "État général de la flotte",
      icon: Truck,
    },
    {
      id: "engine",
      label: "Moteurs",
      description: "Performance et anomalies",
      icon: Activity,
    },
    {
      id: "oil",
      label: "Huile",
      description: "Niveaux et maintenance",
      icon: Droplets,
    },
    {
      id: "fuel",
      label: "Carburant",
      description: "Niveau et consommation",
      icon: Fuel,
    },
    {
      id: "tires",
      label: "Pneus",
      description: "Usure et pression",
      icon: Gauge,
    },
    {
      id: "maintenance",
      label: "Maintenance",
      description: "Révisions et interventions",
      icon: ShieldCheck,
    },
  ],

  logistics: [
    {
      id: "blockages",
      label: "Éviter les blocages",
      description: "Identifier les opérations susceptibles de se retrouver bloquées avant qu'elles ne perturbent le flux",
      icon: PackageX,
    },
    {
      id: "wait",
      label: "Réduire les temps d'attente",
      description: "Détecter les files, retards et goulots d'étranglement qui ralentissent vos opérations",
      icon: Clock3,
    },
    {
      id: "cost",
      label: "Réduire les coûts imprévus",
      description: "Identifier les situations pouvant entraîner surcoûts, immobilisations ou pénalités",
      icon: CircleDollarSign,
    },
    {
      id: "anticipate",
      label: "Anticiper les perturbations",
      description: "Détecter les signaux faibles avant qu'un problème opérationnel ne devienne critique",
      icon: Radar,
    },
    {
      id: "resources",
      label: "Optimiser les ressources",
      description: "Identifier les équipements, équipes ou capacités qui risquent de devenir un point de blocage",
      icon: Cog,
    },
    {
      id: "recommend",
      label: "Obtenir des recommandations",
      description: "Comprendre ce qui se passe et savoir quelle action prioriser",
      icon: Sparkles,
    },
  ],

  energy: [
    {
      id: "generators",
      label: "Générateurs",
      description: "Performance et disponibilité",
      icon: Zap,
    },
    {
      id: "fuel",
      label: "Carburant",
      description: "Niveau et réapprovisionnement",
      icon: Fuel,
    },
    {
      id: "temperature",
      label: "Température",
      description: "Surchauffe et conditions thermiques",
      icon: Thermometer,
    },
    {
      id: "oil",
      label: "Huile",
      description: "Niveau et maintenance",
      icon: Droplets,
    },
    {
      id: "load",
      label: "Charge",
      description: "Surcharge et capacité",
      icon: BatteryCharging,
    },
    {
      id: "sensors",
      label: "Capteurs",
      description: "Données et connectivité",
      icon: Radio,
    },
  ],
}

const OPS_TYPES: OpsType[] = [
  { id: "port", label: "Port & conteneurs", icon: Anchor },
  { id: "entrepot", label: "Entrepôt & manutention", icon: Warehouse },
  { id: "transport", label: "Transport & distribution", icon: Truck },
  { id: "expedition", label: "Préparation & expédition", icon: PackageSearch },
  { id: "froid", label: "Chaîne du froid", icon: Snowflake },
  { id: "multi", label: "Plusieurs activités", icon: Recycle },
]

const DATA_SOURCES: DataSource[] = [
  {
    id: "erp",
    label: "ERP",
    description: "Odoo, SAP ou autre logiciel de gestion",
    detail: "Stocks, achats, production, maintenance...",
    icon: Database,
  },
  {
    id: "iot",
    label: "IoT / Capteurs",
    description: "Données provenant de vos équipements",
    detail: "Température, pression, vibrations, consommation...",
    icon: Wifi,
  },
  {
    id: "csv",
    label: "CSV / Excel",
    description: "Importez vos données existantes",
    detail: "Une solution simple pour commencer sans connexion",
    icon: Upload,
  },
]

/*
 * =============================================================
 * CONTAINER YARD PREVIEW
 *
 * Shown only when sector = logistics and opsType = port.
 * Purely illustrative: demonstrates Detect -> Recommend live,
 * instead of asking the user to imagine it.
 * =============================================================
 */

function ContainerYardPreview() {
  const total = 32
  const amberIndexes = useMemo(() => [5, 18, 26], [])
  const redIndex = 11

  const [statuses, setStatuses] = useState<("ok" | "watch" | "blocked")[]>(
    () => Array(total).fill("ok")
  )
  const [showRecommendation, setShowRecommendation] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(
      setTimeout(() => {
        setStatuses((current) => {
          const next = [...current]
          amberIndexes.forEach((i) => (next[i] = "watch"))
          return next
        })
      }, 450)
    )

    timers.push(
      setTimeout(() => {
        setStatuses((current) => {
          const next = [...current]
          next[redIndex] = "watch"
          return next
        })
      }, 950)
    )

    timers.push(
      setTimeout(() => {
        setStatuses((current) => {
          const next = [...current]
          next[redIndex] = "blocked"
          return next
        })
      }, 1750)
    )

    timers.push(
      setTimeout(() => {
        setShowRecommendation(true)
      }, 2100)
    )

    return () => timers.forEach(clearTimeout)
  }, [amberIndexes])

  return (
    <div className="mx-auto mt-6 max-w-4xl overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Aperçu — Terminal conteneurs
          </p>
          <p className="text-[11px] text-muted-foreground">
            Exemple avec vos futures données
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Normal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            À surveiller
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Bloqué
          </span>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1.5 p-4 sm:grid-cols-8">
        {statuses.map((status, i) => (
          <div
            key={i}
            className={cn(
              "aspect-[7/5] rounded-md border transition-colors duration-300",
              status === "ok" && "border-emerald-500/25 bg-emerald-500/[0.06]",
              status === "watch" && "border-amber-500/60 bg-amber-500/[0.12]",
              status === "blocked" &&
                "border-red-500 bg-red-500/[0.15] shadow-[0_0_0_2px_rgba(239,68,68,0.15)]"
            )}
          />
        ))}
      </div>

      <div
        className={cn(
          "mx-4 mb-4 flex items-start gap-3 rounded-xl border border-l-2 border-border border-l-red-500 bg-card px-3.5 py-3 transition-all duration-500",
          showRecommendation
            ? "translate-y-0 opacity-100"
            : "translate-y-1 opacity-0"
        )}
      >
        <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
          CNT-0417
        </span>
        <p className="text-xs leading-5 text-foreground">
          Immobile depuis <span className="font-semibold text-amber-600">18h</span>,
          contre 4h en moyenne. Vérifier le document douanier avant qu&apos;il
          ne déclenche des frais de stockage.
        </p>
      </div>
    </div>
  )
}

export function OnboardingView({
  onComplete,
}: {
  onComplete?: () => void
}) {
  const [step, setStep] = useState(1)

  const [sector, setSector] = useState<Sector | null>(null)

  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])

  const [opsType, setOpsType] = useState<OpsType["id"] | null>(null)

  const [selectedSources, setSelectedSources] = useState<
    DataSource["id"][]
  >([])

  const [configureLater, setConfigureLater] = useState(false)

  const equipment = useMemo(
    () => (sector ? EQUIPMENT_BY_SECTOR[sector] : []),
    [sector]
  )

  const selectedSector = useMemo(
    () => SECTORS.find((item) => item.id === sector),
    [sector]
  )

  // Logistics gets one extra step: "which kind of operations do you run".
  // Everyone else goes straight from outcomes to data sources.
  const hasOpsStep = sector === "logistics"
  const totalSteps = hasOpsStep ? 4 : 3
  const opsStepNumber = 3
  const sourcesStepNumber = hasOpsStep ? 4 : 3

  function chooseSector(id: Sector) {
    setSector(id)
    setSelectedEquipment([])
    setOpsType(null)
  }

  function toggleEquipment(id: string) {
    setSelectedEquipment((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  function chooseOpsType(id: OpsType["id"]) {
    setOpsType(id)
  }

  function toggleSource(id: DataSource["id"]) {
    setConfigureLater(false)

    setSelectedSources((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  function selectConfigureLater() {
    setSelectedSources([])
    setConfigureLater(true)
  }

  function nextStep() {
    if (step < totalSteps) {
      setStep(step + 1)
    }
  }

  function previousStep() {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  function finish() {
    if (typeof window !== "undefined") {
      localStorage.setItem("sentria_onboarded", "true")

      if (sector) {
        localStorage.setItem("sentria_sector", sector)
      }

      localStorage.setItem(
        "sentria_equipment",
        JSON.stringify(selectedEquipment)
      )

      localStorage.setItem(
        "sentria_sectors",
        JSON.stringify(sector ? [sector] : [])
      )

      localStorage.setItem(
        "sentria_monitoring",
        JSON.stringify(selectedEquipment)
      )

      if (opsType) {
        localStorage.setItem("sentria_ops_type", opsType)
      }

      localStorage.setItem(
        "sentria_data_sources",
        JSON.stringify(selectedSources)
      )

      localStorage.setItem(
        "sentria_configure_later",
        JSON.stringify(configureLater)
      )

      window.dispatchEvent(
        new Event("sentria_sectors_updated")
      )

      window.dispatchEvent(
        new Event("sentria_onboarding_completed")
      )
    }

    onComplete?.()
  }

  /*
   * IMPORTANT:
   *
   * The data sources step does NOT require a source.
   *
   * The administrator can:
   * - select ERP
   * - select IoT
   * - select CSV
   * - select multiple sources
   * - or choose "Configurer plus tard"
   *
   * This means onboarding never blocks the user
   * because their ERP is not connected yet.
   */

  const canContinue =
    step === 1
      ? Boolean(sector)
      : step === 2
        ? selectedEquipment.length > 0
        : step === opsStepNumber && hasOpsStep
          ? Boolean(opsType)
          : true

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">

      {/* =========================================================
          BACKGROUND ATMOSPHERE
      ========================================================= */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">

        <div className="absolute left-1/2 top-[-280px] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-accent/[0.045] blur-3xl" />

        <div className="absolute bottom-[-280px] right-[-180px] h-[600px] w-[600px] rounded-full bg-accent/[0.025] blur-3xl" />

        <div className="absolute bottom-[15%] left-[-260px] h-[500px] w-[500px] rounded-full bg-accent/[0.018] blur-3xl" />

        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        <div className="absolute left-[5%] top-[18%] h-1.5 w-1.5 rounded-full bg-accent/40 shadow-[0_0_12px_currentColor]" />

        <div className="absolute right-[7%] top-[28%] h-1 w-1 rounded-full bg-accent/30 shadow-[0_0_10px_currentColor]" />

        <div className="absolute bottom-[18%] left-[8%] h-1 w-1 rounded-full bg-accent/30" />

        <div className="absolute bottom-[12%] right-[12%] h-1.5 w-1.5 rounded-full bg-accent/30 shadow-[0_0_12px_currentColor]" />

      </div>

      <div className="relative flex min-h-screen items-center justify-center p-3 sm:p-6 lg:p-8">

        <div className="relative w-full max-w-6xl">

          {/* =====================================================
              DECORATIVE FRAME
          ===================================================== */}

          <div className="pointer-events-none absolute -inset-3 rounded-[34px] bg-accent/[0.025] blur-2xl" />

          <div className="pointer-events-none absolute -left-3 -top-3 hidden h-20 w-20 sm:block">
            <div className="absolute left-0 top-0 h-px w-14 bg-accent/40" />
            <div className="absolute left-0 top-0 h-14 w-px bg-accent/40" />
            <div className="absolute left-3 top-3 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_currentColor]" />
          </div>

          <div className="pointer-events-none absolute -right-3 -top-3 hidden h-20 w-20 sm:block">
            <div className="absolute right-0 top-0 h-px w-14 bg-accent/20" />
            <div className="absolute right-0 top-0 h-14 w-px bg-accent/20" />
            <div className="absolute right-3 top-3 h-1 w-1 rounded-full bg-accent/30" />
          </div>

          <div className="pointer-events-none absolute -bottom-3 -left-3 hidden h-20 w-20 sm:block">
            <div className="absolute bottom-0 left-0 h-px w-14 bg-accent/20" />
            <div className="absolute bottom-0 left-0 h-14 w-px bg-accent/20" />
          </div>

          <div className="pointer-events-none absolute -bottom-3 -right-3 hidden h-20 w-20 sm:block">
            <div className="absolute bottom-0 right-0 h-px w-14 bg-accent/40" />
            <div className="absolute bottom-0 right-0 h-14 w-px bg-accent/40" />
            <div className="absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_currentColor]" />
          </div>

          {/* =====================================================
              MAIN CARD
          ===================================================== */}

          <div className="relative flex min-h-[calc(100vh-24px)] w-full flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl sm:min-h-[calc(100vh-48px)] lg:min-h-[calc(100vh-64px)]">

            <div className="absolute left-[10%] right-[10%] top-0 h-px bg-accent shadow-[0_0_18px_currentColor]" />

            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-accent/[0.025] blur-3xl" />

            {/* ===================================================
                HEADER
            =================================================== */}

            <header className="relative flex items-center justify-between border-b border-border bg-background/40 px-5 py-4 backdrop-blur-xl sm:px-7">

              <div className="flex items-center gap-3">

                <div className="flex h-10 items-center rounded-xl border border-border bg-card px-3 shadow-sm">
                  <img
                    src="/sentria logo.png"
                    alt="SentrIA"
                    className="h-7 w-auto object-contain"
                  />
                </div>

                <div className="hidden h-5 w-px bg-border sm:block" />

                <div className="hidden sm:block">

                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-foreground">
                    Configuration
                  </p>

                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Configurez votre espace SentrIA
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-2">

                <span className="hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:block">
                  Étape
                </span>

                <div className="flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold">

                  <span className="text-accent-foreground">
                    {step}
                  </span>

                  <span className="mx-1.5 text-muted-foreground">
                    /
                  </span>

                  <span>{totalSteps}</span>

                </div>

              </div>

            </header>

            {/* ===================================================
                PROGRESS
            =================================================== */}

            <div className="relative px-5 pt-5 sm:px-7">

              <div className="flex gap-1.5">

                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((item) => (
                  <div
                    key={item}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-all duration-500",
                      item <= step
                        ? "bg-accent shadow-[0_0_12px_currentColor]"
                        : "bg-muted"
                    )}
                  />
                ))}

              </div>

            </div>

            {/* ===================================================
                MAIN
            =================================================== */}

            <main className="relative flex flex-1 items-center px-5 py-8 sm:px-7 sm:py-10 lg:px-12">

              <div className="w-full">

                {/* =================================================
                    STEP 1 — SECTOR
                ================================================= */}

                {step === 1 && (
                  <section>

                    <div className="mx-auto max-w-2xl text-center">

                      <div className="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent-foreground shadow-[0_0_25px_-10px_currentColor]">

                        <div className="absolute inset-0 rounded-2xl bg-accent/5 blur-md" />

                        <Activity className="relative h-5 w-5" />

                      </div>

                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent-foreground">
                        Bienvenue dans SentrIA
                      </p>

                      <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        Quel type d&apos;opérations voulez-vous surveiller ?
                      </h1>

                      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                        SentrIA adapte votre espace, vos alertes et vos analyses
                        à votre activité.
                      </p>

                    </div>

                    <div className="mx-auto mt-9 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

                      {SECTORS.map((item) => {

                        const Icon = item.icon
                        const active = sector === item.id

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => chooseSector(item.id)}
                            className={cn(
                              "group relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl border p-5 text-left",
                              "transition-all duration-200 hover:-translate-y-0.5",
                              active
                                ? "border-accent bg-accent/[0.07] shadow-[0_0_0_1px_hsl(var(--accent)/0.25),0_15px_35px_-25px_hsl(var(--accent)/0.8)]"
                                : "border-border bg-background hover:border-foreground/20 hover:shadow-lg"
                            )}
                          >

                            {active && (
                              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
                            )}

                            {active && (
                              <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_0_12px_-4px_currentColor]">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            )}

                            <div
                              className={cn(
                                "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                                active
                                  ? "border-accent/50 bg-accent/10 text-accent-foreground"
                                  : "border-border bg-card text-muted-foreground group-hover:border-foreground/20 group-hover:text-foreground"
                              )}
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </div>

                            <h3 className="relative mt-4 text-sm font-semibold text-foreground">
                              {item.label}
                            </h3>

                            <p className="relative mt-1 text-xs leading-5 text-muted-foreground">
                              {item.description}
                            </p>

                          </button>
                        )
                      })}

                    </div>

                  </section>
                )}

                {/* =================================================
                    STEP 2 — OUTCOMES
                ================================================= */}

                {step === 2 && sector && (
                  <section>

                    <div className="mx-auto max-w-2xl text-center">

                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-foreground">

                        <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />

                        {selectedSector?.label}

                      </div>

                      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        {hasOpsStep
                          ? "Comment SentrIA peut vous aider ?"
                          : "Que voulez-vous surveiller ?"}
                      </h1>

                      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                        {hasOpsStep
                          ? "Sélectionnez les problématiques qui comptent pour votre activité. Vous pourrez modifier vos choix plus tard."
                          : "Sélectionnez uniquement les domaines qui comptent pour votre activité. Vous pourrez les modifier plus tard."}
                      </p>

                    </div>

                    <div className="mx-auto mt-9 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

                      {equipment.map((item) => {

                        const Icon = item.icon
                        const active = selectedEquipment.includes(item.id)

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleEquipment(item.id)}
                            className={cn(
                              "group relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl border p-5 text-left",
                              "transition-all duration-200 hover:-translate-y-0.5",
                              active
                                ? "border-accent bg-accent/[0.07] shadow-[0_0_0_1px_hsl(var(--accent)/0.25),0_15px_35px_-25px_hsl(var(--accent)/0.8)]"
                                : "border-border bg-background hover:border-foreground/20 hover:shadow-lg"
                            )}
                          >

                            {active && (
                              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
                            )}

                            {active && (
                              <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_0_12px_-4px_currentColor]">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            )}

                            <div
                              className={cn(
                                "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
                                active
                                  ? "border-accent/50 bg-accent/10 text-accent-foreground"
                                  : "border-border bg-card text-muted-foreground group-hover:border-foreground/20 group-hover:text-foreground"
                              )}
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </div>

                            <h3 className="relative mt-4 text-sm font-semibold text-foreground">
                              {item.label}
                            </h3>

                            <p className="relative mt-1 text-xs leading-5 text-muted-foreground">
                              {item.description}
                            </p>

                          </button>
                        )
                      })}

                    </div>

                    <div className="mx-auto mt-5 flex max-w-4xl items-center justify-between rounded-xl border border-border bg-background px-4 py-3">

                      <span className="text-xs text-muted-foreground">

                        <span className="font-semibold text-foreground">
                          {selectedEquipment.length}
                        </span>{" "}

                        {hasOpsStep
                          ? selectedEquipment.length > 1
                            ? "priorités sélectionnées"
                            : "priorité sélectionnée"
                          : selectedEquipment.length > 1
                            ? "domaines sélectionnés"
                            : "domaine sélectionné"}

                      </span>

                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Modifiable plus tard
                      </span>

                    </div>

                  </section>
                )}

                {/* =================================================
                    STEP 3 (logistics only) — OPERATIONS TYPE
                ================================================= */}

                {step === opsStepNumber && hasOpsStep && (
                  <section>

                    <div className="mx-auto max-w-2xl text-center">

                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-foreground">

                        <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />

                        Précisez votre activité

                      </div>

                      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        Quel type d&apos;opérations gérez-vous ?
                      </h1>

                      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                        SentrIA adapte ce qu&apos;elle surveille selon votre
                        activité logistique.
                      </p>

                    </div>

                    <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-2">

                      {OPS_TYPES.map((item) => {

                        const Icon = item.icon
                        const active = opsType === item.id

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => chooseOpsType(item.id)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
                              active
                                ? "border-accent bg-accent/[0.08] text-accent-foreground"
                                : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                            {active && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </button>
                        )
                      })}

                    </div>

                    {opsType === "port" && <ContainerYardPreview />}

                  </section>
                )}

                {/* =================================================
                    STEP — DATA SOURCES
                ================================================= */}

                {step === sourcesStepNumber && (
                  <section>

                    <div className="mx-auto max-w-2xl text-center">

                      <div className="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent-foreground shadow-[0_0_25px_-10px_currentColor]">

                        <div className="absolute inset-0 rounded-2xl bg-accent/5 blur-md" />

                        <Database className="relative h-5 w-5" />

                      </div>

                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent-foreground">
                        Sources de données
                      </p>

                      <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        Comment souhaitez-vous alimenter SentrIA ?
                      </h1>

                      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                        Sélectionnez vos sources de données. Vous pourrez les
                        connecter ou les modifier plus tard depuis votre espace.
                      </p>

                    </div>

                    <div className="mx-auto mt-9 grid max-w-4xl grid-cols-1 gap-3 lg:grid-cols-3">

                      {DATA_SOURCES.map((source) => {

                        const Icon = source.icon
                        const active = selectedSources.includes(source.id)

                        return (
                          <button
                            key={source.id}
                            type="button"
                            onClick={() => toggleSource(source.id)}
                            className={cn(
                              "group relative flex min-h-[190px] flex-col overflow-hidden rounded-2xl border p-5 text-left",
                              "transition-all duration-200 hover:-translate-y-0.5",
                              active
                                ? "border-accent bg-accent/[0.07] shadow-[0_0_0_1px_hsl(var(--accent)/0.25),0_15px_35px_-25px_hsl(var(--accent)/0.8)]"
                                : "border-border bg-background hover:border-foreground/20 hover:shadow-lg"
                            )}
                          >

                            {active && (
                              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
                            )}

                            {active && (
                              <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_0_12px_-4px_currentColor]">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            )}

                            <div
                              className={cn(
                                "relative flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
                                active
                                  ? "border-accent/50 bg-accent/10 text-accent-foreground"
                                  : "border-border bg-card text-muted-foreground group-hover:border-foreground/20 group-hover:text-foreground"
                              )}
                            >
                              <Icon className="h-[19px] w-[19px]" />
                            </div>

                            <h3 className="relative mt-5 text-sm font-semibold text-foreground">
                              {source.label}
                            </h3>

                            <p className="relative mt-1.5 text-xs leading-5 text-muted-foreground">
                              {source.description}
                            </p>

                            <p className="relative mt-3 text-[11px] leading-5 text-muted-foreground/70">
                              {source.detail}
                            </p>

                          </button>
                        )
                      })}

                    </div>

                    {/* =================================================
                        CONFIGURE LATER
                    ================================================= */}

                    <div className="mx-auto mt-4 max-w-4xl">

                      <button
                        type="button"
                        onClick={selectConfigureLater}
                        className={cn(
                          "group flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all",
                          configureLater
                            ? "border-accent bg-accent/[0.07] text-accent-foreground shadow-[0_0_0_1px_hsl(var(--accent)/0.2)]"
                            : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:bg-muted hover:text-foreground"
                        )}
                      >

                        <Clock3 className="h-4 w-4" />

                        Configurer plus tard

                        {configureLater && (
                          <Check className="h-4 w-4" />
                        )}

                      </button>

                    </div>

                    {/* =================================================
                        INFO
                    ================================================= */}

                    <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-border bg-background px-4 py-3">

                      <div className="flex items-start gap-3">

                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-foreground">

                          <Activity className="h-3.5 w-3.5" />

                        </div>

                        <div>

                          <p className="text-xs font-semibold text-foreground">
                            Aucune connexion n&apos;est requise maintenant
                          </p>

                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                            SentrIA pourra être configuré avec votre ERP,
                            vos capteurs ou vos fichiers CSV / Excel depuis
                            votre espace. Vous pourrez également ajouter ou
                            modifier vos sources plus tard.
                          </p>

                        </div>

                      </div>

                    </div>

                  </section>
                )}

              </div>

            </main>

            {/* =====================================================
                FOOTER
            ===================================================== */}

            <footer className="relative flex items-center justify-between border-t border-border bg-background/30 px-5 py-5 sm:px-7">

              <button
                type="button"
                onClick={previousStep}
                disabled={step === 1}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                  step === 1
                    ? "pointer-events-none opacity-0"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >

                <ArrowLeft className="h-4 w-4" />

                Retour

              </button>

              {step < totalSteps ? (

                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!canContinue}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                    canContinue
                      ? "bg-accent text-accent-foreground shadow-md hover:opacity-90"
                      : "cursor-not-allowed bg-muted text-muted-foreground"
                  )}
                >

                  Continuer

                  <ArrowRight className="h-4 w-4" />

                </button>

              ) : (

                <button
                  type="button"
                  onClick={finish}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition-all hover:opacity-90"
                >

                  Accéder à SentrIA

                  <ArrowRight className="h-4 w-4" />

                </button>

              )}

            </footer>

          </div>
        </div>
      </div>
    </div>
  )
}