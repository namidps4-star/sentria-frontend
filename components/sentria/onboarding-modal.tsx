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
  Activity,
  Database,
  Upload,
  Wifi,
  Clock3,
  Sparkles,
  Store,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { API_BASE } from "@/lib/api"
import { PRIORITIES_BY_SECTOR } from "@/lib/priorities"
import {
  ACTIVITIES_BY_SECTOR,
  normalizeOpsType,
  opsTypeFor,
  writeOpsTypes,
  type SingleOpsType,
} from "@/lib/activities"
import {
  chainFor,
  PRIMITIVE_NAMES,
  type OpsType,
} from "@/lib/logistics-signals"
import { STAGE_ICONS } from "./flow-track"

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

/** Class for a card in a two-column grid, so an odd count never leaves
 *  an orphan in a half-width slot.
 *
 *  Five of the seven sectors offer an odd number of activities, so the
 *  last card sat alone next to empty space. It spans both columns
 *  instead and its content spreads out, which reads as a deliberate
 *  closing row rather than a gap. */
function isWideCard(index: number, total: number) {
  return total % 2 === 1 && index === total - 1
}

function gridSpan(index: number, total: number) {
  return isWideCard(index, total) ? "md:col-span-2" : undefined
}

/** Bulk selection for a multi-select step. One component so the
 *  priorities step and the data-sources step offer the same control in
 *  the same place, with a live count. */
function BulkSelect({
  count,
  total,
  allSelected,
  onSelectAll,
  onClear,
  noun,
}: {
  count: number
  total: number
  allSelected: boolean
  onSelectAll: () => void
  onClear: () => void
  noun: string
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{count}</span>
        {" sur "}
        {total} {noun}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={allSelected}
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Tout sélectionner
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={count === 0}
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Tout désélectionner
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* ONBOARDING                                                                 */
/* -------------------------------------------------------------------------- */

/** What SentrIA will follow for the chosen activity.
 *
 *  This replaces an animated container yard: thirty two tiles that went
 *  amber then red on a timer, with a recommendation appearing at 2.1
 *  seconds. It showed a scripted incident rather than anything the
 *  customer's own data would produce, and it only existed for one of the
 *  six logistics activities.
 *
 *  What an operator actually wants to know before uploading is which
 *  stages will be watched, so this draws their real chain, in the same
 *  capsule the dashboard uses, in its empty state. Nothing is filled in,
 *  because nothing has been measured yet, and it says so. */
function ActivityFlowPreview({
  opsType,
  selected = [],
}: {
  opsType?: OpsType
  selected?: Exclude<OpsType, "multi">[]
}) {
  const chain = chainFor(opsType, selected)

  if (chain.length === 0) return null

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-semibold text-foreground">
          La chaîne que SentrIA va suivre
        </p>

        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {chain.length}{" "}
          {chain.length > 1 ? "étapes" : "étape"}. Chacune
          s&apos;allume dès qu&apos;un de vos relevés la concerne.
        </p>
      </div>

      <div className="overflow-x-auto p-4">
        <ol className="flex w-full min-w-max items-center rounded-full bg-track px-3 py-3">
          {chain.map((id, index) => {
            const Icon = STAGE_ICONS[id]

            return (
              <li
                key={id}
                className={cn(
                  "flex items-center",
                  index < chain.length - 1 && "flex-1"
                )}
              >
                <div className="flex w-14 shrink-0 flex-col items-center">
                  <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-track-muted text-track-muted-foreground">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>

                {index < chain.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="-mx-2 h-6 min-w-10 flex-1 bg-track-muted"
                  />
                )}
              </li>
            )
          })}
        </ol>

        <ol className="mt-2 flex w-full min-w-max items-start px-3">
          {chain.map((id, index) => (
            <li
              key={id}
              className={cn(
                "flex items-start",
                index < chain.length - 1 && "flex-1"
              )}
            >
              <p className="w-14 shrink-0 px-0.5 text-center text-[10px] font-semibold leading-tight">
                {PRIMITIVE_NAMES[id]}
              </p>

              {index < chain.length - 1 && (
                <span className="-mx-2 min-w-10 flex-1" />
              )}
            </li>
          ))}
        </ol>
      </div>

      <p className="border-t border-border px-4 py-2.5 text-[11px] leading-5 text-muted-foreground">
        {selected.length > 1 ? (
          <>
            Les étapes de vos {selected.length}{" "}activités, fusionnées :
            celles qu&apos;elles partagent n&apos;apparaissent
            qu&apos;une fois. En gris parce qu&apos;aucune donnée
            n&apos;a encore été importée.
          </>
        ) : (
          <>
            En gris parce qu&apos;aucune donnée n&apos;a encore été
            importée. SentrIA n&apos;invente rien avant votre premier
            fichier.
          </>
        )}
      </p>
    </div>
  )
}

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

  /** Every activity the customer runs. One entry for every sector except
   *  logistics, where it is the real set. */
  const [subTypes2, setSubTypes2] = useState<string[]>([])

  /* A second sector, for the rare group that really has one. Onboarding
     only ever stored [sector], so the dashboard's multi-sector support
     (the filter chips, the per-sector upload) was unreachable: you could
     not say you run a factory and a warehouse. It stays behind an
     opt-in, because one sector is the normal case and putting six
     checkboxes in front of everyone to serve the exception is how an
     onboarding gets abandoned. */
  const [multiSector, setMultiSector] = useState(false)

  const [extraSectors, setExtraSectors] = useState<Sector[]>([])

  const allSectors = useMemo(
    () => (sector ? [sector, ...extraSectors] : []),
    [sector, extraSectors]
  )

  function toggleExtraSector(id: Sector) {
    setExtraSectors((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }
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
    setSubTypes2([])
    setExtraSectors((current) => current.filter((item) => item !== id))
    setSelectedEquipment([])
  }

  /* Logistics is multi-select: a terminal handling reefers runs port
     and cold chain, a 3PL runs warehouse, transport and cold chain. The
     other sectors stay single-select, because a pharmacy is not also a
     laboratory. subType keeps holding the primary activity so the CSV
     column hints and the business_type parameter are unchanged. */
  function chooseSubType(id: string) {
    if (!isLogistics) {
      setSubType(id)
      setSubTypes2([id])
      return
    }

    setSubTypes2((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]

      setSubType(next[0] ?? null)

      return next
    })
  }

  /* "Plusieurs activités" was a single card that composed every chain
     at once. Ticking several real activities replaces it exactly. */
  const shownSubTypes = useMemo(
    () => subTypes.filter((item) => item.id !== "plusieurs-activites"),
    [subTypes]
  )

  const selectedOpsTypes = useMemo(
    () =>
      subTypes2
        .map((id) => normalizeOpsType(id))
        .filter(
          (t): t is SingleOpsType => !!t && t !== "multi"
        ),
    [subTypes2]
  )

  function toggleEquipment(id: string) {
    setSelectedEquipment((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  /* Bulk selection. The selectable set skips anything marked coming
     soon, so "tout sélectionner" never turns on a priority the product
     does not run yet. */
  const selectableEquipment = useMemo(
    () => equipment.filter((item) => !item.comingSoon).map((item) => item.id),
    [equipment]
  )

  const allEquipmentSelected =
    selectableEquipment.length > 0 &&
    selectableEquipment.every((id) => selectedEquipment.includes(id))

  function selectAllEquipment() {
    setSelectedEquipment(selectableEquipment)
  }

  function clearEquipment() {
    setSelectedEquipment([])
  }

  const allSourcesSelected =
    DATA_SOURCES.length > 0 &&
    DATA_SOURCES.every((source) => selectedSources.includes(source.id))

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

        /* Every sector the customer runs, primary first. This used to
           be hardcoded to [sector], so the dashboard's sector chips
           could never show more than one. */
        localStorage.setItem("sentria_sectors", JSON.stringify(allSectors))
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
      // port chain nor the port checks. writeOpsTypes stores the whole
      // set and keeps the single-value key in step.
      if (isLogistics && selectedOpsTypes.length > 0) {
        writeOpsTypes(selectedOpsTypes)
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
        ? subTypes2.length > 0
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
                  const secondary = extraSectors.includes(item.id)

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        multiSector && sector && sector !== item.id
                          ? toggleExtraSector(item.id)
                          : chooseSector(item.id)
                      }
                      aria-pressed={active || secondary}
                      className={cn(
                        "relative flex w-[calc(50%-6px)] flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all sm:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)]",
                        item.recommended &&
                          !active &&
                          !secondary &&
                          "border-accent/50 ring-1 ring-accent/30",
                        active
                          ? "border-foreground bg-foreground text-background"
                          : secondary
                            ? "border-foreground bg-muted"
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

                        {(active || secondary) && (
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

                      {secondary && (
                        <span className="mt-1.5 rounded-full bg-foreground px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background">
                          Secteur secondaire
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {step === 1 && (
              <div className="rounded-2xl border border-border bg-background p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={multiSector}
                    onChange={(event) => {
                      setMultiSector(event.target.checked)

                      if (!event.target.checked) setExtraSectors([])
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
                  />

                  <span>
                    <span className="block text-sm font-semibold">
                      Mon entreprise couvre plusieurs secteurs
                    </span>

                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      Par exemple une usine avec son propre entrepôt.
                      Le secteur choisi ci-dessus reste le principal,
                      et les autres s&apos;ajoutent au tableau de bord.
                    </span>
                  </span>
                </label>

                {multiSector && (
                  <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    {extraSectors.length > 0 ? (
                      <>
                        Secteurs :{" "}
                        <span className="font-semibold text-foreground">
                          {allSectors
                            .map(
                              (id) =>
                                SECTORS.find((x) => x.id === id)?.label ?? id
                            )
                            .join(", ")}
                        </span>
                      </>
                    ) : sector ? (
                      "Touchez un autre secteur pour l'ajouter. Le premier reste le principal."
                    ) : (
                      "Choisissez d'abord votre secteur principal."
                    )}
                  </p>
                )}
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

                {isLogistics && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    Sélectionnez toutes les activités que vous exploitez.
                    Un terminal qui manipule des conteneurs réfrigérés
                    fait du port et de la chaîne du froid : cochez les
                    deux et SentrIA suivra les étapes des deux, sans y
                    ajouter celles que vous n&apos;avez pas.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {shownSubTypes.map((item, index) => {
                    const Icon = item.icon
                    const active = subTypes2.includes(item.id)
                    const wide = isWideCard(index, shownSubTypes.length)

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => chooseSubType(item.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                          gridSpan(index, shownSubTypes.length),
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

                        <div
                          className={cn(
                            "min-w-0 flex-1",
                            wide &&
                              "md:flex md:items-center md:justify-between md:gap-6"
                          )}
                        >
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
                              wide && "md:mt-0 md:shrink-0 md:text-right",
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
                    {subTypes2.length > 0 ? (
                      <>
                        {subTypes2.length > 1
                          ? "Activités retenues : "
                          : "Activité retenue : "}

                        <span className="font-semibold text-foreground">
                          {subTypes2
                            .map(
                              (id) =>
                                subTypes.find((item) => item.id === id)
                                  ?.label ?? id
                            )
                            .join(", ")}
                        </span>
                      </>
                    ) : isLogistics ? (
                      "Cochez chaque activité que vous exploitez"
                    ) : (
                      "Sélectionnez l'activité la plus proche de la vôtre"
                    )}
                  </span>

                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Modifiable plus tard
                  </span>
                </div>

                {isLogistics && selectedOpsTypes.length > 0 && (
                  <ActivityFlowPreview
                    opsType={opsTypeFor(selectedOpsTypes)}
                    selected={selectedOpsTypes}
                  />
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

                <BulkSelect
                  count={selectedEquipment.length}
                  total={selectableEquipment.length}
                  allSelected={allEquipmentSelected}
                  onSelectAll={selectAllEquipment}
                  onClear={clearEquipment}
                  noun={
                    selectedEquipment.length > 1
                      ? "priorités sélectionnées"
                      : "priorité sélectionnée"
                  }
                />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {equipment.map((item, index) => {
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
                          gridSpan(index, equipment.length),
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

                <p className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Modifiable plus tard
                </p>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 4: DATA SOURCES                                             */}
            {/* ---------------------------------------------------------------- */}

            {step === sourcesStepNumber && (
              <div>
                <BulkSelect
                  count={selectedSources.length}
                  total={DATA_SOURCES.length}
                  allSelected={allSourcesSelected}
                  onSelectAll={() =>
                    setSelectedSources(DATA_SOURCES.map((s) => s.id))
                  }
                  onClear={() => setSelectedSources([])}
                  noun={
                    selectedSources.length > 1 ? "sources choisies" : "source choisie"
                  }
                />

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