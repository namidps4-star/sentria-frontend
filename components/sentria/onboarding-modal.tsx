"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Building2,
  Factory,
  HeartPulse,
  Wheat,
  Truck,
  Ship,
  Zap,
  Gauge,
  Cog,
  Warehouse,
  BatteryCharging,
  Activity,
  Boxes,
  Snowflake,
  Radio,
  Database,
  Upload,
  Wifi,
  Clock3,
  Sparkles,
  Anchor,
  PackageSearch,
  Recycle,
  Store,
  ShoppingCart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { API_BASE } from "@/lib/api"
import { PRIORITIES_BY_SECTOR } from "@/lib/priorities"
import { ACTIVITIES_BY_SECTOR, normalizeOpsType } from "@/lib/activities"

type Sector =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"
  | "commerce"

type SectorConfig = {
  id: Sector
  label: string
  description: string
  icon: React.ElementType
  recommended?: boolean
  maturity?: "Pilote recommandé" | "Accès anticipé"
}

type DataSource = {
  id: "erp" | "iot" | "csv"
  label: string
  description: string
  detail: string
  icon: React.ElementType
}

/* -------------------------------------------------------------------------- */
/* SECTORS                                                                    */
/* -------------------------------------------------------------------------- */

const SECTORS: SectorConfig[] = [
  {
    id: "logistics",
    label: "Logistique",
    description: "Port, entrepôt, transport et flux",
    icon: Ship,
    recommended: true,
    maturity: "Pilote recommandé",
  },
  {
    id: "industry",
    label: "Industrie",
    description: "Machines, production et maintenance",
    icon: Factory,
    maturity: "Accès anticipé",
  },
  {
    id: "health",
    label: "Santé",
    description: "Stocks, chaîne du froid et produits",
    icon: HeartPulse,
    maturity: "Accès anticipé",
  },
  {
    id: "agriculture",
    label: "Agriculture",
    description: "Récoltes, stockage et transport",
    icon: Wheat,
    maturity: "Accès anticipé",
  },
  {
    id: "transportation",
    label: "Transport",
    description: "Flotte, moteurs et maintenance",
    icon: Truck,
    maturity: "Accès anticipé",
  },
  {
    id: "energy",
    label: "Énergie",
    description: "Générateurs, carburant et température",
    icon: Zap,
    maturity: "Accès anticipé",
  },
  {
    id: "commerce",
    label: "Commerce",
    description: "Stocks, rayons et approvisionnement",
    icon: Store,
    maturity: "Accès anticipé",
  },
]

/* -------------------------------------------------------------------------- */
/* BUSINESS TYPES                                                             */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* DATA SOURCES                                                               */
/* -------------------------------------------------------------------------- */

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

/** Columns each activity's CSV must carry.
 *
 *  A laboratory uploads reagents, a wholesaler uploads one row per
 *  (pharmacy, product), a hospital uploads categorised supplies. Telling
 *  the user which columns are expected is the difference between an
 *  upload that works and one that silently produces no alerts.
 *
 *  Keyed by business_type first, then sector as the fallback. */
const CSV_COLUMNS: Record<string, string[]> = {
  // Health
  "pharmacie": [
    "medicine_name", "stock_qty", "min_stock",
    "sales_last_30_days", "unit_cost", "expiry_date",
  ],
  "laboratoire": [
    "reagent_name", "stock_qty", "unit_cost", "expiry_date",
  ],
  "clinique-hopital": [
    "item_name", "category", "stock_qty", "min_stock",
    "unit_cost", "fridge_temp", "expiry_date",
  ],
  "grossiste-pharma": [
    "pharmacy_id", "pharmacy_name", "product_name",
    "qty_shipped_last_period", "qty_reordered_this_period",
    "days_since_last_shipment", "unit_cost",
  ],
  // Sector fallbacks
  "health": ["medicine_name", "stock_qty", "min_stock"],
  "industry": [
    "Product ID", "Torque [Nm]", "Tool wear [min]",
    "Rotational speed [rpm]",
  ],
  "logistics": ["equipment", "cycles", "hydraulic_pressure", "fuel_level"],
  "agriculture": ["batch_id", "days_stored", "storage_temp"],
  "transportation": ["vehicle_id", "km_since_service", "engine_temp"],
  "energy": ["generator_id", "fuel_level", "coolant_temp"],
  "commerce": ["product_name", "stock_qty", "min_stock", "shrinkage_rate"],
}

/* -------------------------------------------------------------------------- */
/* LOGISTICS PREVIEW                                                          */
/* -------------------------------------------------------------------------- */

function ContainerYardPreview() {
  const total = 32
  const amberIndexes = useMemo(() => [5, 18, 26], [])
  const redIndex = 11

  const [statuses, setStatuses] = useState<
    ("ok" | "watch" | "blocked")[]
  >(() => Array(total).fill("ok"))

  const [showRecommendation, setShowRecommendation] =
    useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(
      setTimeout(() => {
        setStatuses((current) => {
          const next = [...current]

          amberIndexes.forEach((i) => {
            next[i] = "watch"
          })

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
    <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Aperçu du terminal conteneurs
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

      <div className="grid grid-cols-8 gap-1.5 p-4">
        {statuses.map((status, i) => (
          <div
            key={i}
            className={cn(
              "aspect-[7/5] rounded-md border transition-colors duration-300",
              status === "ok" &&
                "border-emerald-500/25 bg-emerald-500/[0.06]",
              status === "watch" &&
                "border-amber-500/60 bg-amber-500/[0.12]",
              status === "blocked" &&
                "border-red-500 bg-red-500/[0.15]"
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
          Immobile depuis{" "}
          <span className="font-semibold text-amber-600">
            18h
          </span>
          , contre 4h en moyenne. Vérifier le document douanier
          avant qu&apos;il ne déclenche des frais de stockage.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* ONBOARDING                                                                 */
/* -------------------------------------------------------------------------- */

export function OnboardingView({
  onComplete,
}: {
  onComplete?: () => void
}) {
  useEffect(() => {
    const previous = document.body.style.overflow

    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const [step, setStep] = useState(1)
  const [sector, setSector] = useState<Sector | null>(null)
  const [subType, setSubType] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] =
    useState<string[]>([])
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvMsg, setCsvMsg] = useState("")
  const [csvFailed, setCsvFailed] = useState(false)
  const [csvDone, setCsvDone] = useState(false)

  const [selectedSources, setSelectedSources] = useState<
    DataSource["id"][]
  >([])
  const [configureLater, setConfigureLater] = useState(false)

  const equipment = useMemo(
    () => (sector ? PRIORITIES_BY_SECTOR[sector] : []),
    [sector]
  )

  const subTypes = useMemo(
    () => (sector ? ACTIVITIES_BY_SECTOR[sector] : []),
    [sector]
  )

  const selectedSector = useMemo(
    () => SECTORS.find((item) => item.id === sector),
    [sector]
  )

  const selectedSubType = useMemo(
    () => subTypes.find((item) => item.id === subType),
    [subTypes, subType]
  )

  const isLogistics = sector === "logistics"

  const totalSteps = 4
  const subTypeStepNumber = 2
  const equipmentStepNumber = 3
  const sourcesStepNumber = 4

  const STEP_META = [
    {
      title: "Votre secteur",
      description:
        "Choisissez le secteur que SentrIA doit surveiller.",
      icon: Building2,
    },
    {
      title: "Votre activité",
      description:
        "Précisez votre activité pour adapter les seuils d'alerte.",
      icon: Store,
    },
    {
      title: isLogistics
        ? "Vos priorités"
        : "Que voulez-vous surveiller ?",
      description:
        "Sélectionnez ce qui compte pour votre activité.",
      icon: Sparkles,
    },
    {
      title: "Vos données",
      description:
        "Connectez une source, ou configurez plus tard.",
      icon: Database,
    },
  ]

  const currentMeta = STEP_META[step - 1] ?? STEP_META[0]
  const CurrentStepIcon = currentMeta.icon

  function chooseSector(id: Sector) {
    setSector(id)

    // Important: changing sector invalidates both the
    // previously selected subtype and monitoring priorities.
    setSubType(null)
    setSelectedEquipment([])
  }

  function chooseSubType(id: string) {
    setSubType(id)
  }

  function toggleEquipment(id: string) {
    setSelectedEquipment((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  /** Columns expected for whatever was chosen in steps 1 and 2. */
  const csvColumns =
    (subType && CSV_COLUMNS[subType]) ||
    (sector && CSV_COLUMNS[sector]) ||
    []

  /** Upload straight from onboarding, using the sector and activity the
   *  user just chose, so the backend routes the file to the right checks
   *  instead of defaulting to the sector's primary activity. */
  async function handleOnboardingUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    if (!file || !sector) return

    setCsvUploading(true)
    setCsvFailed(false)
    setCsvDone(false)
    setCsvMsg("")

    const form = new FormData()
    form.append("file", file)

    const query =
      `?sector=${encodeURIComponent(sector)}&lang=fr` +
      (subType ? `&business_type=${encodeURIComponent(subType)}` : "")

    try {
      const res = await fetch(`${API_BASE}/upload${query}`, {
        method: "POST",
        body: form,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        console.error(
          `[SentrIA] onboarding upload -> HTTP ${res.status}`,
          body
        )
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()

      setCsvDone(true)
      setCsvMsg(
        data.message === "Processed successfully"
          ? `${file.name} importé. Les alertes apparaîtront sur le tableau de bord.`
          : data.message ?? `${file.name} importé.`
      )
    } catch (error) {
      console.error("[SentrIA] onboarding upload failed:", error)
      setCsvFailed(true)
      setCsvMsg(
        "Import impossible. Vérifiez la console du navigateur, puis réessayez."
      )
    } finally {
      setCsvUploading(false)
      e.target.value = ""
    }
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
      setStep((current) => current + 1)
    }
  }

  function previousStep() {
    if (step <= 1) return

    setStep((current) => Math.max(1, current - 1))
  }

  function goToStep(targetStep: number) {
    if (targetStep < 1 || targetStep > step) return

    setStep(targetStep)
  }

  function finish() {
    if (typeof window !== "undefined") {
      localStorage.setItem("sentria_onboarded", "true")

      if (sector) {
        localStorage.setItem("sentria_sector", sector)

        localStorage.setItem(
          "sentria_sectors",
          JSON.stringify([sector])
        )
      }

      if (subType) {
        localStorage.setItem(
          "sentria_business_type",
          subType
        )
      }

      localStorage.setItem(
        "sentria_equipment",
        JSON.stringify(selectedEquipment)
      )

      localStorage.setItem(
        "sentria_monitoring",
        JSON.stringify(selectedEquipment)
      )

      // The dashboard and the backend both branch on the short ops
      // type ("port"), not on this step's subtype id
      // ("port-conteneurs"), so normalize before storing. Writing the
      // raw id meant a real onboarded port operator got neither the
      // port chain nor the port checks.
      if (isLogistics && subType) {
        localStorage.setItem(
          "sentria_ops_type",
          normalizeOpsType(subType) ?? subType
        )
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

  const canContinue =
    step === 1
      ? Boolean(sector)
      : step === subTypeStepNumber
        ? Boolean(subType)
        : step === equipmentStepNumber
          ? selectedEquipment.length > 0
          : true

  return (
    <div className="fixed inset-0 z-[100] animate-in fade-in zoom-in-[0.98] overflow-y-auto bg-background duration-200 ease-out motion-reduce:animate-none">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8 md:py-12">

        {/* HERO */}
        <div className="rounded-3xl bg-foreground p-6 text-background md:p-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Zap className="h-3.5 w-3.5" />
              Bienvenue sur SentrIA
            </span>

            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight md:text-5xl">
              Configurez votre surveillance opérationnelle.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-background/70 md:text-base">
              Quelques étapes suffisent pour connecter vos données,
              configurer votre activité et commencer à détecter les
              situations critiques.
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
                Étape {step} sur {totalSteps}
              </p>
            </div>

            <span className="font-semibold">
              {Math.round((step / totalSteps) * 100)}%
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{
                width: `${(step / totalSteps) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* STEP PILLS */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {STEP_META.map((meta, index) => {
            const Icon = meta.icon
            const stepNumber = index + 1
            const completed = stepNumber < step
            const active = stepNumber === step

            return (
              <button
                key={meta.title}
                type="button"
                onClick={() => goToStep(stepNumber)}
                disabled={stepNumber > step}
                className={cn(
                  "rounded-3xl border p-5 text-left transition-all",
                  active
                    ? "border-foreground bg-card shadow-sm"
                    : completed
                      ? "border-accent/40 bg-card"
                      : "border-border bg-card/50",
                  stepNumber > step &&
                    "cursor-not-allowed opacity-60"
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
                  Étape {stepNumber}
                </p>

                <p className="mt-1 font-heading text-sm font-bold">
                  {meta.title}
                </p>
              </button>
            )
          })}
        </div>

        {/* CURRENT STEP */}
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="flex flex-col gap-8">

            {/* STEP HEADER */}
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground">
                <CurrentStepIcon className="h-7 w-7" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Étape {step}
                </p>

                <h2 className="mt-1 font-heading text-2xl font-bold">
                  {currentMeta.title}
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {currentMeta.description}
                </p>
              </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* STEP 1: SECTOR                                                   */}
            {/* ---------------------------------------------------------------- */}

            {step === 1 && (
              <div className="flex flex-wrap justify-center gap-3">
                {SECTORS.map((item) => {
                  const Icon = item.icon
                  const active = sector === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseSector(item.id)}
                      className={cn(
                        "relative flex w-[calc(50%-6px)] flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all sm:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)]",
                        item.recommended &&
                          !active &&
                          "border-accent/50 ring-1 ring-accent/30",
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:border-accent/60 hover:bg-accent/10"
                      )}
                    >
                      {item.maturity && (
                        <span
                          className={cn(
                            "absolute right-3 top-3 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                            item.recommended
                              ? active
                                ? "bg-accent text-accent-foreground"
                                : "bg-accent/20 text-accent-foreground"
                              : active
                                ? "bg-background/20 text-background/70"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {item.maturity}
                        </span>
                      )}

                      <div className="flex w-full items-center justify-between">
                        <Icon className="h-5 w-5" />

                        {active && (
                          <Check className="h-4 w-4" />
                        )}
                      </div>

                      <span className="mt-2 text-sm font-semibold">
                        {item.label}
                      </span>

                      <span
                        className={cn(
                          "text-xs leading-5",
                          active
                            ? "text-background/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {item.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 2: BUSINESS TYPE                                            */}
            {/* ---------------------------------------------------------------- */}

            {step === subTypeStepNumber && sector && (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {selectedSector?.label}
                  </div>

                  <p className="text-xs leading-5 text-muted-foreground">
                    Cette précision adapte les seuils d&apos;alerte
                    à votre métier
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {subTypes.map((item) => {
                    const Icon = item.icon
                    const active = subType === item.id

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => chooseSubType(item.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-accent/60 hover:bg-accent/10"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                            active
                              ? "bg-background/15"
                              : "bg-muted"
                          )}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-semibold">
                                {item.label}
                              </span>

                              {item.maturity && (
                                <span
                                  className={cn(
                                    "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                    item.maturity === "Pilote recommandé"
                                      ? active
                                        ? "bg-accent text-accent-foreground"
                                        : "bg-accent/20 text-accent-foreground"
                                      : active
                                        ? "bg-background/20 text-background/70"
                                        : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {item.maturity}
                                </span>
                              )}
                            </div>

                            {active && (
                              <Check className="h-4 w-4 shrink-0" />
                            )}
                          </div>

                          <span
                            className={cn(
                              "mt-0.5 block text-xs leading-5",
                              active
                                ? "text-background/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {item.description}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {subType ? (
                      <>
                        Activité retenue :{" "}
                        <span className="font-semibold text-foreground">
                          {
                            subTypes.find(
                              (item) => item.id === subType
                            )?.label
                          }
                        </span>
                      </>
                    ) : (
                      "Sélectionnez l'activité la plus proche de la vôtre"
                    )}
                  </span>

                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Modifiable plus tard
                  </span>
                </div>

                {/* Keep the original logistics-specific demonstration. */}
                {isLogistics &&
                  subType === "port-conteneurs" && (
                    <ContainerYardPreview />
                  )}
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 3: MONITORING PRIORITIES                                    */}
            {/* ---------------------------------------------------------------- */}

            {step === equipmentStepNumber && sector && (
              <div>
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {selectedSector?.label}
                  {subType && (
                    <>
                      <span className="text-muted-foreground/50">
                        /
                      </span>

                      {
                        subTypes.find(
                          (item) => item.id === subType
                        )?.label
                      }
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {equipment.map((item) => {
                    const Icon = item.icon
                    const active =
                      selectedEquipment.includes(item.id)
                    const disabled = Boolean(item.comingSoon)

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          !disabled &&
                          toggleEquipment(item.id)
                        }
                        disabled={disabled}
                        className={cn(
                          "relative flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all",
                          disabled
                            ? "cursor-not-allowed border-border bg-background opacity-60"
                            : active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border hover:border-accent/60 hover:bg-accent/10"
                        )}
                      >
                        {disabled && (
                          <span className="absolute right-4 top-4 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Bientôt disponible
                          </span>
                        )}

                        <div className="flex w-full items-center justify-between">
                          <Icon className="h-5 w-5" />

                          {!disabled && active && (
                            <Check className="h-4 w-4" />
                          )}
                        </div>

                        <span className="mt-2 text-sm font-semibold">
                          {item.label}
                        </span>

                        <span
                          className={cn(
                            "text-xs leading-5",
                            active && !disabled
                              ? "text-background/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {item.description}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {selectedEquipment.length}
                    </span>{" "}
                    {selectedEquipment.length > 1
                      ? "priorités sélectionnées"
                      : "priorité sélectionnée"}
                  </span>

                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Modifiable plus tard
                  </span>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 4: DATA SOURCES                                             */}
            {/* ---------------------------------------------------------------- */}

            {step === sourcesStepNumber && (
              <div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {DATA_SOURCES.map((source) => {
                    const Icon = source.icon
                    const active =
                      selectedSources.includes(source.id)

                    return (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => toggleSource(source.id)}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-accent/60 hover:bg-accent/10"
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <Icon className="h-5 w-5" />

                          {active && (
                            <Check className="h-4 w-4" />
                          )}
                        </div>

                        <span className="mt-2 text-sm font-semibold">
                          {source.label}
                        </span>

                        <span
                          className={cn(
                            "text-xs leading-5",
                            active
                              ? "text-background/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {source.description}
                        </span>

                        <span
                          className={cn(
                            "mt-1 text-[11px] leading-5",
                            active
                              ? "text-background/50"
                              : "text-muted-foreground/70"
                          )}
                        >
                          {source.detail}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {selectedSources.includes("csv") && (
                  <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/5 p-4">
                    <div className="flex items-start gap-3">
                      <Upload
                        className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground"
                        aria-hidden="true"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          Importez votre fichier maintenant
                        </p>

                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Chaque activité attend ses propres colonnes.
                          Pour{" "}
                          <span className="font-semibold text-foreground">
                            {selectedSubType?.label ??
                              selectedSector?.label}
                          </span>
                          , SentrIA lit :
                        </p>

                        {csvColumns.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {csvColumns.map((col) => (
                              <code
                                key={col}
                                className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                              >
                                {col}
                              </code>
                            ))}
                          </div>
                        )}

                        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                          Les colonnes manquantes sont simplement
                          ignorées, jamais une erreur.
                        </p>

                        <label
                          className={cn(
                            "mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity",
                            "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                            csvUploading
                              ? "bg-muted text-muted-foreground"
                              : "bg-foreground text-background hover:opacity-90"
                          )}
                        >
                          <Upload className="h-4 w-4" aria-hidden="true" />

                          {csvUploading
                            ? "Import en cours..."
                            : csvDone
                              ? "Importer un autre fichier"
                              : "Choisir un fichier CSV"}

                          <input
                            type="file"
                            accept=".csv"
                            className="sr-only"
                            onChange={handleOnboardingUpload}
                            disabled={csvUploading || !sector}
                            aria-label="Importer un fichier CSV"
                          />
                        </label>

                        {csvMsg && (
                          <p
                            role={csvFailed ? "alert" : "status"}
                            className={cn(
                              "mt-2 text-xs font-medium",
                              csvFailed
                                ? "text-destructive"
                                : "text-green-600"
                            )}
                          >
                            {csvMsg}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={selectConfigureLater}
                  className={cn(
                    "mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all",
                    configureLater
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:border-accent/60 hover:bg-accent/10"
                  )}
                >
                  <Clock3 className="h-4 w-4" />
                  Configurer plus tard

                  {configureLater && (
                    <Check className="h-4 w-4" />
                  )}
                </button>

                <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Aucune connexion n&apos;est requise maintenant
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        SentrIA pourra être configuré avec votre ERP,
                        vos capteurs ou vos fichiers CSV / Excel depuis
                        votre espace, à tout moment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                {step > 1 && (
                  <button
                    type="button"
                    onClick={previousStep}
                    className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    Retour
                  </button>
                )}
              </div>

              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!canContinue}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuer
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
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
    </div>
  )
}