"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Building2,
  Globe2,
  Languages,
  Layers,
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
import { localized, useTx, type Localized, type Tx } from "@/lib/i18n"
import { API_BASE } from "@/lib/api"
import {
  detectTimezoneId,
  TIMEZONES,
  writeCompanyName,
  writeTimezoneId,
} from "@/lib/company"
import {
  COUNTRIES,
  LANGUAGES,
  countryFor,
  detectLanguage,
  languagePromise,
  writeCountryCode,
  writeLanguage,
} from "@/lib/locale"
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
  label: Localized
  description: Localized
  icon: React.ElementType
  recommended?: boolean
  /* A key, not the badge text. Storing the French words here meant the
     badge could only ever be French, and comparing against them meant
     the comparison broke the moment one was translated. */
  maturity?: "pilot" | "early"
}

/** The badge wording for a maturity key. */
function maturityLabel(maturity: "pilot" | "early", tx: Tx): string {
  return maturity === "pilot"
    ? tx("Pilote recommandé", "Recommended pilot")
    : tx("Accès anticipé", "Early access")
}

type DataSource = {
  id: "erp" | "iot" | "csv"
  label: Localized
  description: Localized
  detail: Localized
  icon: React.ElementType
}

/* -------------------------------------------------------------------------- */
/* SECTORS                                                                    */
/* -------------------------------------------------------------------------- */

const SECTORS: SectorConfig[] = [
  {
    id: "logistics",
    label: localized("Logistique", "Logistics"),
    description: localized(
      "Port, entrepôt, transport et flux",
      "Port, warehouse, transport and flows"
    ),
    icon: Ship,
    recommended: true,
    maturity: "pilot",
  },
  {
    id: "industry",
    label: localized("Industrie", "Industry"),
    description: localized(
      "Machines, production et maintenance",
      "Machines, production and maintenance"
    ),
    icon: Factory,
    maturity: "early",
  },
  {
    id: "health",
    label: localized("Santé", "Health"),
    description: localized(
      "Stocks, chaîne du froid et produits",
      "Stock, cold chain and products"
    ),
    icon: HeartPulse,
    maturity: "early",
  },
  {
    id: "agriculture",
    label: localized("Agriculture", "Agriculture"),
    description: localized(
      "Récoltes, stockage et transport",
      "Harvests, storage and transport"
    ),
    icon: Wheat,
    maturity: "early",
  },
  {
    id: "transportation",
    label: localized("Transport", "Transport"),
    description: localized(
      "Flotte, moteurs et maintenance",
      "Fleet, engines and maintenance"
    ),
    icon: Truck,
    maturity: "early",
  },
  {
    id: "energy",
    label: localized("Énergie", "Energy"),
    description: localized(
      "Générateurs, carburant et température",
      "Generators, fuel and temperature"
    ),
    icon: Zap,
    maturity: "early",
  },
  {
    id: "commerce",
    label: localized("Commerce", "Retail"),
    description: localized(
      "Stocks, rayons et approvisionnement",
      "Stock, shelves and replenishment"
    ),
    icon: Store,
    maturity: "early",
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
    label: localized("ERP", "ERP"),
    description: localized(
      "Odoo, SAP ou autre logiciel de gestion",
      "Odoo, SAP or another management system"
    ),
    detail: localized(
      "Stocks, achats, production, maintenance...",
      "Stock, purchasing, production, maintenance..."
    ),
    icon: Database,
  },
  {
    id: "iot",
    label: localized("IoT / Capteurs", "IoT / Sensors"),
    description: localized(
      "Données provenant de vos équipements",
      "Readings coming from your equipment"
    ),
    detail: localized(
      "Température, pression, vibrations, consommation...",
      "Temperature, pressure, vibration, consumption..."
    ),
    icon: Wifi,
  },
  {
    id: "csv",
    label: localized("CSV / Excel", "CSV / Excel"),
    description: localized(
      "Importez vos données existantes",
      "Import the data you already have"
    ),
    detail: localized(
      "Une solution simple pour commencer sans connexion",
      "The simple way to start, with nothing to connect"
    ),
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
 *  Keyed by business_type first, then sector as the fallback.
 *
 *  These are the header names the customer's own file must carry, not
 *  copy: translating "Torque [Nm]" would stop the column matching.
 *
 *  i18n-ignore-start: CSV header names, matched against the file */
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
/* i18n-ignore-end */

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
  const tx = useTx()

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{count}</span>
        {tx(" sur ", " of ")}
        {total} {noun}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={allSelected}
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {tx("Tout sélectionner", "Select all")}
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={count === 0}
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {tx("Tout désélectionner", "Clear all")}
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
  const tx = useTx()

  const chain = chainFor(opsType, selected)

  if (chain.length === 0) return null

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-semibold text-foreground">
          {tx(
            "La chaîne que SentrIA va suivre",
            "The chain SentrIA will follow"
          )}
        </p>

        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {chain.length}{" "}
          {chain.length > 1 ? tx("étapes", "stages") : tx("étape", "stage")}.{" "}
          {tx(
            "Chacune s'allume dès qu'un de vos relevés la concerne.",
            "Each one lights up as soon as one of your readings touches it."
          )}
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

/* --------------------------------------------------------------------------
 * The choice card.
 *
 * Every question in the identity steps is a small, closed set, so they are
 * cards rather than a <select>. A native select on a phone is a system
 * sheet: it hides the options until tapped, shows no consequence next to
 * them, and makes four questions feel like a tax form. A card can carry
 * what the answer means, which is the point on the language step (what
 * SentrIA will answer in) and the country step (which currency).
 *
 * Defined once so the four steps cannot drift apart.
 * -------------------------------------------------------------------------- */

const CHOICE_CARD = [
  "group relative w-full rounded-2xl border border-border bg-background p-4 text-left",
  "transition-all duration-200 hover:-translate-y-0.5 hover:border-ring hover:shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
].join(" ")

/* Selection is carried by the fill AND by aria-pressed AND by the tick,
   never by colour alone. */
const CHOICE_ACTIVE = "border-foreground bg-foreground text-background shadow-sm"

function CardTick() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  )
}

export function OnboardingView({
  onComplete,
}: {
  onComplete?: () => void
}) {
  /* The language the wizard itself is written in. It follows the choice
     made on step 1: picking English on the first screen and then reading
     French for the next seven was the whole of the complaint. */
  const tx = useTx()

  /** Resolve a module-level fr/en pair. The sector, priority and source
   *  catalogues are built outside React, so they hold pairs. */
  const px = (text: Localized) => tx(text.fr, text.en)

  /** A sector's display name, falling back to its id so a stale id saved
   *  by an older build still renders as something. */
  const sectorName = (id: string) => {
    const found = SECTORS.find((item) => item.id === id)

    return found ? px(found.label) : id
  }

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
  /* Asked here because the product consumes both: the name goes in
     reports and in what Ask SentrIA calls the customer, and the zone is
     what every hour-based threshold is read against. A free-text
     description is deliberately not asked: the sector, the activities
     and the priorities already say that in a form the pipeline reads. */
  const [companyName, setCompanyName] = useState("")

  const [timezoneId, setTimezoneId] = useState(TIMEZONES[0].id)

  /* Country and language are two axes, not one. A Cotonou operator may
     want French, a Lagos one English, and the country is what says
     whether a figure is F CFA or naira. Deriving either from the other
     would be wrong for most of this map. */
  const [countryCode, setCountryCode] = useState("")

  const [language, setLanguage] = useState("fr")

  useEffect(() => {
    setTimezoneId(detectTimezoneId())
    setLanguage(detectLanguage())
  }, [])

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

  /* Language, country, timezone and company name used to sit in one
     grid on the sector step, four questions deep before the operator
     had answered anything. They are four steps now, in the order each
     one informs the next: the language the screen is read in, then the
     country, which fills the currency and the clock, then the clock
     itself to confirm, then the name.

     Asking one thing at a time is the whole point. A form that opens
     with four unrelated fields reads as paperwork; a form that asks one
     question reads as a conversation. */
  const langStepNumber = 1
  const countryStepNumber = 2
  const zoneStepNumber = 3
  const companyStepNumber = 4
  const sectorStepNumber = 5
  const subTypeStepNumber = 6
  const equipmentStepNumber = 7
  const sourcesStepNumber = 8

  const totalSteps = 8

  const STEP_META = [
    {
      title: tx("Votre langue", "Your language"),
      description: tx(
        "SentrIA vous répond dans la langue que vous choisissez.",
        "SentrIA answers you in the language you choose."
      ),
      icon: Languages,
    },
    {
      title: tx("Votre pays", "Your country"),
      description: tx(
        "Il détermine la devise de vos montants et votre fuseau.",
        "It sets the currency your amounts are in, and your time zone."
      ),
      icon: Globe2,
    },
    {
      title: tx("Votre fuseau horaire", "Your time zone"),
      description: tx(
        "Vos seuils sont en heures : ils doivent suivre votre journée.",
        "Your thresholds are in hours, so they have to follow your day."
      ),
      icon: Clock3,
    },
    {
      title: tx("Votre entreprise", "Your company"),
      description: tx(
        "Le nom qui apparaît dans vos rapports et dans Ask SentrIA.",
        "The name that appears in your reports and in Ask SentrIA."
      ),
      icon: Building2,
    },
    {
      title: tx("Votre secteur", "Your sector"),
      description: tx(
        "Choisissez le secteur que SentrIA doit surveiller.",
        "Choose the sector SentrIA should monitor."
      ),
      icon: Layers,
    },
    {
      title: tx("Votre activité", "Your activity"),
      description: tx(
        "Précisez votre activité pour adapter les seuils d'alerte.",
        "Say which activity it is, so the alert thresholds fit it."
      ),
      icon: Store,
    },
    {
      title: isLogistics
        ? tx("Vos priorités", "Your priorities")
        : tx("Que voulez-vous surveiller ?", "What do you want to monitor?"),
      description: tx(
        "Sélectionnez ce qui compte pour votre activité.",
        "Select what matters for your activity."
      ),
      icon: Sparkles,
    },
    {
      title: tx("Vos données", "Your data"),
      description: tx(
        "Connectez une source, ou configurez plus tard.",
        "Connect a source, or set this up later."
      ),
      icon: Database,
    },
  ]

  const currentMeta = STEP_META[step - 1] ?? STEP_META[0]
  const CurrentStepIcon = currentMeta.icon

  /* A wizard that changes its whole panel and leaves focus on the button
     the operator just pressed strands a keyboard or screen reader user
     at the bottom of a screen they cannot see. Focus moves to the new
     question; the counter announces itself politely alongside, so the
     change is heard as well as seen. Not on first paint: stealing focus
     before anybody has interacted is its own annoyance. */
  const headingRef = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }

    headingRef.current?.focus()
  }, [step])

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
        /* The backend's own success sentinel, not copy: it is compared
           against, so it must not be translated. */
        data.message === "Processed successfully"
          ? tx(
              `${file.name} importé. Les alertes apparaîtront sur le tableau de bord.`,
              `${file.name} imported. The alerts will appear on the dashboard.`
            )
          : data.message ??
            tx(`${file.name} importé.`, `${file.name} imported.`)
      )
    } catch (error) {
      console.error("[SentrIA] onboarding upload failed:", error)
      setCsvFailed(true)
      setCsvMsg(
        tx(
          "Import impossible. Vérifiez la console du navigateur, puis réessayez.",
          "The import failed. Check the browser console, then try again."
        )
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

      writeCompanyName(companyName)
      writeTimezoneId(timezoneId)
      writeCountryCode(countryCode)
      writeLanguage(language)

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

  /* The country list carries an explicit "Autre pays (euro)", so there
     is always a truthful answer and requiring one costs nobody an exit.
     The language and the zone are pre-selected, so their steps are
     already satisfied. */
  const canContinue =
    step === countryStepNumber
      ? Boolean(countryCode)
      : step === companyStepNumber
        ? companyName.trim().length > 0
        : step === sectorStepNumber
          ? Boolean(sector)
          : step === subTypeStepNumber
            ? subTypes2.length > 0
            : step === equipmentStepNumber
              ? selectedEquipment.length > 0
              : true

  return (
    <div className="fixed inset-0 z-[100] animate-in fade-in zoom-in-[0.98] overflow-y-auto bg-background duration-200 ease-out motion-reduce:animate-none">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8 md:py-12">

        {/* HERO
            Shown once. Repeating a 200px welcome banner above every one
            of eight questions pushes the actual question below the fold
            and makes the flow feel like a brochure. After step one it
            collapses to a single line. */}
        {step === 1 ? (
        <div className="rounded-3xl bg-foreground p-6 text-background md:p-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Zap className="h-3.5 w-3.5" />
              {tx("Bienvenue sur SentrIA", "Welcome to SentrIA")}
            </span>

            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight md:text-5xl">
              {tx(
                "Configurez votre surveillance opérationnelle.",
                "Set up your operational monitoring."
              )}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-background/70 md:text-base">
              {tx(
                "Quelques étapes suffisent pour connecter vos données, configurer votre activité et commencer à détecter les situations critiques.",
                "A few steps connect your data, describe your operation, and start catching the situations that matter."
              )}
            </p>
          </div>
        </div>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent"
              aria-hidden="true"
            >
              <Zap className="h-3.5 w-3.5 text-accent-foreground" />
            </span>

            <span className="text-sm font-bold tracking-tight">SentrIA</span>

            <span className="text-sm text-muted-foreground">
              Configuration
            </span>
          </div>
        )}

        {/* PROGRESS
            One segment per step rather than eight pill cards: at four
            steps the cards read as a map, at eight they read as a wall,
            and the operator only needs to know where they are and how
            much is left. The completed segments stay clickable, which
            is what the cards were for. */}
        <div className="rounded-3xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Étape {step} sur {totalSteps}
              </p>

              <p className="mt-1 truncate font-heading text-lg font-bold tracking-tight">
                {currentMeta.title}
              </p>
            </div>

            <p className="shrink-0 font-heading text-2xl font-bold tabular-nums">
              {Math.round((step / totalSteps) * 100)}
              <span className="text-sm">%</span>
            </p>
          </div>

          <ol className="mt-4 flex items-center gap-1.5">
            {STEP_META.map((meta, index) => {
              const stepNumber = index + 1
              const done = stepNumber < step
              const active = stepNumber === step
              const reachable = stepNumber <= step

              return (
                <li key={meta.title} className="flex-1">
                  <button
                    type="button"
                    onClick={() => goToStep(stepNumber)}
                    disabled={!reachable}
                    aria-current={active ? "step" : undefined}
                    aria-label={`Étape ${stepNumber}, ${meta.title}`}
                    className={cn(
                      "block h-1.5 w-full rounded-full transition-colors duration-300",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      done && "bg-accent",
                      active && "bg-foreground",
                      !done && !active && "bg-muted",
                      reachable ? "cursor-pointer" : "cursor-not-allowed"
                    )}
                  />
                </li>
              )
            })}
          </ol>

          {/* Heard as well as seen. Polite, and separate from the
              heading, so it does not fight the focus move. */}
          <p className="sr-only" role="status" aria-live="polite">
            Étape {step} sur {totalSteps} : {currentMeta.title}
          </p>
        </div>

        {/* CURRENT STEP */}
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="flex flex-col gap-8">

            {/* STEP HEADER
                The question itself, and the one element that moves when
                the step changes. One or two animated things per view,
                not every card: a panel that slides while twelve cards
                stagger is noise, and it is the first thing to look
                cheap on a slow device. */}
            <div
              key={step}
              className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground">
                <CurrentStepIcon className="h-7 w-7" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Étape {step}
                </p>

                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-1 max-w-[24ch] text-balance font-heading text-2xl font-bold tracking-tight outline-none md:text-3xl"
                >
                  {currentMeta.title}
                </h2>

                <p className="mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">
                  {currentMeta.description}
                </p>
              </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* STEP 1: LANGUAGE                                                 */}
            {/* ---------------------------------------------------------------- */}

            {step === langStepNumber && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {LANGUAGES.map((item) => {
                  const active = language === item.code

                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setLanguage(item.code)}
                      aria-pressed={active}
                      className={cn(CHOICE_CARD, active && CHOICE_ACTIVE)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-heading text-lg font-bold tracking-tight">
                            {item.label}
                          </p>

                          <p
                            className={cn(
                              "mt-0.5 text-xs",
                              active
                                ? "text-background/60"
                                : "text-muted-foreground"
                            )}
                          >
                            {item.region}
                          </p>
                        </div>

                        {active && <CardTick />}
                      </div>

                      {/* What this choice actually delivers, on the card
                          and before it is made. Six languages are offered
                          and they do not mean the same thing. */}
                      <p
                        className={cn(
                          "mt-4 text-[11px] leading-4",
                          active ? "text-background/70" : "text-muted-foreground"
                        )}
                      >
                        {languagePromise(item)}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 2: COUNTRY                                                  */}
            {/* ---------------------------------------------------------------- */}

            {step === countryStepNumber && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {COUNTRIES.map((item) => {
                  const active = countryCode === item.code

                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        setCountryCode(item.code)

                        /* The clock usually follows the country, so it
                           arrives pre-answered on the next step rather
                           than as a fifth question. */
                        setTimezoneId(item.timezoneId)
                      }}
                      aria-pressed={active}
                      className={cn(CHOICE_CARD, active && CHOICE_ACTIVE)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 font-heading text-sm font-bold leading-snug">
                          {item.name}
                        </p>

                        {active && <CardTick />}
                      </div>

                      <p
                        className={cn(
                          "mt-3 font-heading text-xl font-bold tracking-tight",
                          active ? "text-accent" : "text-foreground"
                        )}
                      >
                        {item.currency.symbol}
                      </p>

                      <p
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          active ? "text-background/60" : "text-muted-foreground"
                        )}
                      >
                        {item.currency.code}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}

            {step === countryStepNumber && (
              <p className="rounded-2xl border border-dashed border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
                La devise sert à étiqueter vos propres montants, ceux que vous
                saisissez dans la vue Coûts.{" "}
                <span className="font-semibold text-foreground">
                  Aucune conversion n&apos;est faite.
                </span>
              </p>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 3: TIMEZONE                                                 */}
            {/* ---------------------------------------------------------------- */}

            {step === zoneStepNumber && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TIMEZONES.map((zone) => {
                  const active = timezoneId === zone.id
                  const suggested =
                    countryFor(countryCode)?.timezoneId === zone.id

                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setTimezoneId(zone.id)}
                      aria-pressed={active}
                      className={cn(CHOICE_CARD, active && CHOICE_ACTIVE)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-heading text-base font-bold leading-snug">
                          {zone.label}
                        </p>

                        {active && <CardTick />}
                      </div>

                      {/* Says why it is already selected. A field that
                          fills itself without explaining looks like a bug
                          the first time you see it. */}
                      {suggested && (
                        <p
                          className={cn(
                            "mt-3 text-[10px] font-semibold uppercase tracking-wider",
                            active ? "text-accent" : "text-muted-foreground"
                          )}
                        >
                          {tx("Déduit de votre pays", "From your country")}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 4: COMPANY                                                  */}
            {/* ---------------------------------------------------------------- */}

            {step === companyStepNumber && (
              <div className="max-w-xl">
                <label className="block">
                  <span className="text-sm font-medium">
                    {tx("Nom de votre entreprise", "Your company name")}
                  </span>

                  <input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    onKeyDown={(event) => {
                      /* Enter is what anyone types after filling one
                         field. Without this it does nothing, which reads
                         as the form being stuck. */
                      if (event.key === "Enter" && companyName.trim()) {
                        event.preventDefault()
                        nextStep()
                      }
                    }}
                    placeholder={tx(
                      "Ex. Terminal Atlantique SA",
                      "e.g. Atlantic Terminal Ltd"
                    )}
                    autoComplete="organization"
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-4 font-heading text-xl font-bold tracking-tight outline-none transition-colors focus:border-ring md:text-2xl"
                  />
                </label>

                {/* The consequence of the answer, as it is typed. An
                    operator sees where the name ends up instead of being
                    told. */}
                <div className="mt-5 rounded-2xl border border-border bg-background p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {tx("Ce que SentrIA dira", "What SentrIA will say")}
                  </p>

                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">
                      {tx("Bonjour ", "Hello ")}
                    </span>
                    <span className="font-bold">
                      {companyName.trim() || "…"}
                    </span>
                    <span className="text-muted-foreground">
                      {tx(". Je suis SentrIA.", ". I am SentrIA.")}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 5: SECTOR                                                   */}
            {/* ---------------------------------------------------------------- */}

            {step === sectorStepNumber && (
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
                          {maturityLabel(item.maturity, tx)}
                        </span>
                      )}

                      <div className="flex w-full items-center justify-between">
                        <Icon className="h-5 w-5" />

                        {(active || secondary) && (
                          <Check className="h-4 w-4" />
                        )}
                      </div>

                      <span className="mt-2 text-sm font-semibold">
                        {px(item.label)}
                      </span>

                      <span
                        className={cn(
                          "text-xs leading-5",
                          active
                            ? "text-background/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {px(item.description)}
                      </span>

                      {secondary && (
                        <span className="mt-1.5 rounded-full bg-foreground px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background">
                          {tx("Secteur secondaire", "Secondary sector")}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {step === sectorStepNumber && (
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
                      {tx(
                        "Mon entreprise couvre plusieurs secteurs",
                        "My company covers more than one sector"
                      )}
                    </span>

                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {tx(
                        "Par exemple une usine avec son propre entrepôt. Le secteur choisi ci-dessus reste le principal, et les autres s'ajoutent au tableau de bord.",
                        "A factory with its own warehouse, for instance. The sector chosen above stays the main one, and the others are added to the dashboard."
                      )}
                    </span>
                  </span>
                </label>

                {multiSector && (
                  <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    {extraSectors.length > 0 ? (
                      <>
                        {tx("Secteurs :", "Sectors:")}{" "}
                        <span className="font-semibold text-foreground">
                          {allSectors
                            .map(
                              (id) =>
                                sectorName(id)
                            )
                            .join(", ")}
                        </span>
                      </>
                    ) : sector ? (
                      tx(
                        "Touchez un autre secteur pour l'ajouter. Le premier reste le principal.",
                        "Tap another sector to add it. The first stays the main one."
                      )
                    ) : (
                      tx(
                        "Choisissez d'abord votre secteur principal.",
                        "Choose your main sector first."
                      )
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
                    {selectedSector ? px(selectedSector.label) : null}
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
                                {px(item.label)}
                              </span>

                              {item.maturity && (
                                <span
                                  className={cn(
                                    "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                    item.maturity === "pilot"
                                      ? active
                                        ? "bg-accent text-accent-foreground"
                                        : "bg-accent/20 text-accent-foreground"
                                      : active
                                        ? "bg-background/20 text-background/70"
                                        : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {maturityLabel(item.maturity, tx)}
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
                            {px(item.description)}
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
                          ? tx("Activités retenues : ", "Activities chosen: ")
                          : tx("Activité retenue : ", "Activity chosen: ")}

                        <span className="font-semibold text-foreground">
                          {subTypes2
                            .map((id) => {
                              const found = subTypes.find(
                                (item) => item.id === id
                              )

                              return found ? px(found.label) : id
                            })
                            .join(", ")}
                        </span>
                      </>
                    ) : isLogistics ? (
                      tx(
                        "Cochez chaque activité que vous exploitez",
                        "Tick every activity you run"
                      )
                    ) : (
                      tx(
                        "Sélectionnez l'activité la plus proche de la vôtre",
                        "Pick the activity closest to yours"
                      )
                    )}
                  </span>

                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {tx("Modifiable plus tard", "Changeable later")}
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
                  {selectedSector ? px(selectedSector.label) : null}
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
                      ? tx("priorités sélectionnées", "priorities selected")
                      : tx("priorité sélectionnée", "priority selected")
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
                            {tx("Bientôt disponible", "Coming soon")}
                          </span>
                        )}

                        <div className="flex w-full items-center justify-between">
                          <Icon className="h-5 w-5" />

                          {!disabled && active && (
                            <Check className="h-4 w-4" />
                          )}
                        </div>

                        <span className="mt-2 text-sm font-semibold">
                          {px(item.label)}
                        </span>

                        <span
                          className={cn(
                            "text-xs leading-5",
                            active && !disabled
                              ? "text-background/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {px(item.description)}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <p className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {tx("Modifiable plus tard", "Changeable later")}
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
                    selectedSources.length > 1
                      ? tx("sources choisies", "sources chosen")
                      : tx("source choisie", "source chosen")
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
                          {px(source.label)}
                        </span>

                        <span
                          className={cn(
                            "text-xs leading-5",
                            active
                              ? "text-background/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {px(source.description)}
                        </span>

                        <span
                          className={cn(
                            "mt-1 text-[11px] leading-5",
                            active
                              ? "text-background/50"
                              : "text-muted-foreground/70"
                          )}
                        >
                          {px(source.detail)}
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
                          {tx(
                            "Importez votre fichier maintenant",
                            "Import your file now"
                          )}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {tx(
                            "Chaque activité attend ses propres colonnes. Pour",
                            "Each activity expects its own columns. For"
                          )}{" "}
                          <span className="font-semibold text-foreground">
                            {selectedSubType
                              ? px(selectedSubType.label)
                              : selectedSector
                                ? px(selectedSector.label)
                                : null}
                          </span>
                          {tx(", SentrIA lit :", ", SentrIA reads:")}
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
                          {tx(
                            "Les colonnes manquantes sont simplement ignorées, jamais une erreur.",
                            "Missing columns are simply skipped, never an error."
                          )}
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
                            ? tx("Import en cours...", "Importing...")
                            : csvDone
                              ? tx(
                                  "Importer un autre fichier",
                                  "Import another file"
                                )
                              : tx(
                                  "Choisir un fichier CSV",
                                  "Choose a CSV file"
                                )}

                          <input
                            type="file"
                            accept=".csv"
                            className="sr-only"
                            onChange={handleOnboardingUpload}
                            disabled={csvUploading || !sector}
                            aria-label={tx(
                              "Importer un fichier CSV",
                              "Import a CSV file"
                            )}
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
                  {tx("Ouvrir mon dashboard", "Open my dashboard")}
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