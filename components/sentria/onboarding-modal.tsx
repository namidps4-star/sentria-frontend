"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
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
import { localized, useTx, type Localized, type Tx, resolve } from "@/lib/i18n"
import { API_BASE } from "@/lib/api"
import { toApiSector } from "@/lib/sector"
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
  image?: string
  recommended?: boolean
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
    image: "/logistics.png",
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
    image: "/industry.png",
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
    image: "/health.png",
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
    image: "/agriculture.png",
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
    image: "/transportation.png",
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
    image: "/energy.png",
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
    image: "/retail.png",
    maturity: "early",
  },
]

/* -------------------------------------------------------------------------- */
/* ACTIVITY (DEPARTMENT) IMAGES                                               */
/* -------------------------------------------------------------------------- */

const ACTIVITY_IMAGES: Record<string, string> = {
  // Logistics
  "port-conteneurs": "/port-conteneurs.png",
  "entrepot-manutention": "/entrepot-manutention.png",
  "transport-distribution": "/transport-distribution.png",
  "preparation-expedition": "/preparation-expedition.png",
  "chaine-froid": "/chaine-froid.png",

  // Industry
  "usine-production": "/usine-production.png",
  "atelier-soustraitance": "/atelier-soustraitance.png",
  "usine-agroalimentaire": "/usine-agroalimentaire.png",

  // Health
  "pharmacie": "/pharmacie.png",
  "laboratoire": "/laboratoire.png",
  "clinique-hopital": "/clinique-hopital.png",
  "grossiste-pharma": "/grossiste-pharma.png",

  // Agriculture
  "exploitation-agricole": "/exploitation-agricole.png",
  "cooperative-agricole": "/cooperative-agricole.png",
  "silo-stockage": "/silo-stockage.png",

  // Transportation
  "transporteur-routier": "/transporteur-routier.png",
  "flotte-entreprise": "/flotte-entreprise.png",
  "location-vehicules": "/location-vehicules.png",

  // Energy
  "centrale-production": "/centrale-production.png",
  "generateurs-secours": "/generateurs-secours.png",
  "distribution-energetique": "/distribution-energetique.png",

  // Retail
  "supermarche-hypermarche": "/supermarche-hypermarche.png",
  "epicerie-proximite": "/epicerie-proximite.png",
  "chaine-magasins": "/chaine-magasins.png",
  "grossiste-distributeur": "/grossiste-distributeur.png",
}

function imageForActivity(activityId: string | undefined): string | undefined {
  if (!activityId) return undefined
  return ACTIVITY_IMAGES[activityId]
}

/**
 * Activity grid layout using the same 12-column trick as sectors.
 * Ensures odd counts are centered.
 */
function activityColSpan(index: number, total: number): string {
  if (total === 3) return "lg:col-span-4"
  if (total === 4) return "lg:col-span-3"
  if (total === 5) {
    // All 5 cards must be the SAME size (lg:col-span-4). The first 3 fill
    // the top row (3 x 4 = 12). The last 2 are centered on the row below by
    // offsetting the first of the pair with col-start-3 (cols 3-6 and 7-10),
    // instead of stretching them to col-span-6, which made them bigger.
    if (index < 3) return "lg:col-span-4"
    if (index === 3) return "lg:col-span-4 lg:col-start-3"
    return "lg:col-span-4"
  }
  return "lg:col-span-3"
}

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

/** Columns each activity's CSV must carry. */
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
  /* Retail */
  "supermarche-hypermarche": [
    "product_name", "stock_qty", "min_stock",
    "unit_cost", "expiry_date", "last_sale_date",
    "sales_last_30_days",
  ],
  "epicerie-proximite": [
    "product_name", "stock_qty", "min_stock",
    "unit_cost", "last_sale_date", "sales_last_30_days",
  ],
  "chaine-magasins": [
    "product_name", "stock_qty", "min_stock",
    "sales_last_30_days", "sales_last_7_days", "sales_previous_7_days",
  ],
  "grossiste-distributeur": [
    "product_name", "stock_qty", "min_stock",
    "sales_last_30_days", "supplier_lead_days",
  ],
  "commerce": ["product_name", "stock_qty", "min_stock", "unit_cost"],
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function isWideCard(index: number, total: number) {
  return total % 2 === 1 && index === total - 1
}

function gridSpan(index: number, total: number) {
  return isWideCard(index, total) ? "md:col-span-2" : undefined
}

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
                {resolve(PRIMITIVE_NAMES[id], tx, id)}
              </p>

              {index < chain.length - 1 && (
                <span className="-mx-2 min-w-10 flex-1" />
              )}
            </li>
          ))}
        </ol>
      </div>

      <p className="border-t border-border px-4 py-2.5 text-[11px] leading-5 text-muted-foreground">
        {selected.length > 1
          ? tx(
              `Les étapes de vos ${selected.length} activités, fusionnées : celles qu'elles partagent n'apparaissent qu'une fois. En gris parce qu'aucune donnée n'a encore été importée.`,
              `The stages of your ${selected.length} activities, merged: the ones they share appear only once. Grey because no data has been imported yet.`
            )
          : tx(
              "En gris parce qu'aucune donnée n'a encore été importée. SentrIA n'invente rien avant votre premier fichier.",
              "Grey because no data has been imported yet. SentrIA invents nothing before your first file."
            )}
      </p>
    </div>
  )
}

const SAMPLE_ALERTS: Record<Sector, Localized> = {
  industry: localized(
    "Ligne 2 : 3 arrêts en 4 h, au-dessus de votre seuil.",
    "Line 2: 3 stoppages in 4 h, above your threshold."
  ),
  health: localized(
    "Bloc 1 : 2 h d'attente, au-dessus de votre seuil.",
    "Theatre 1: a 2 h wait, above your threshold."
  ),
  agriculture: localized(
    "Silo B : humidité à 16 %, au-dessus de votre seuil.",
    "Silo B: moisture at 16%, above your threshold."
  ),
  transportation: localized(
    "Tournée 14 : 90 min de retard cumulé.",
    "Route 14: 90 min behind in total."
  ),
  logistics: localized(
    "Quai 3 : 12 conteneurs en attente depuis 6 h.",
    "Dock 3: 12 containers waiting for 6 h."
  ),
  energy: localized(
    "Poste Nord : tension hors plage depuis 25 min.",
    "North substation: voltage out of range for 25 min."
  ),
  commerce: localized(
    "Rayon frais : rupture sur 7 références.",
    "Chilled aisle: 7 lines out of stock."
  ),
}

const CHOICE_CARD = [
  "group relative w-full rounded-2xl border border-border bg-background p-4 text-left",
  "transition-all duration-200 hover:-translate-y-0.5 hover:border-ring hover:shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
].join(" ")

const CHOICE_ACTIVE = "border-foreground bg-foreground text-background shadow-sm"

function CardTick() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  )
}

function AlertPreview({
  tx,
  company,
  sectorLabel,
  headline,
  className,
}: {
  tx: Tx
  company: string
  sectorLabel: string | null
  headline: string | null
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-background/15 bg-background/10 p-4 backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
        </span>

        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-background/70">
          {tx("Exemple d'alerte", "Sample alert")}
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold leading-snug text-background">
        {headline ??
          tx(
            "Choisissez un secteur pour voir une alerte.",
            "Pick a sector to see an alert."
          )}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-background/70">
        {company
          ? tx(
              `Envoyée à ${company}${sectorLabel ? `, ${sectorLabel}` : ""}.`,
              `Sent to ${company}${sectorLabel ? `, ${sectorLabel}` : ""}.`
            )
          : tx(
              "Votre nom d'entreprise apparaîtra ici.",
              "Your company name will appear here."
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
  const tx = useTx()
  const px = (text: Localized | undefined) => resolve(text, tx)

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
  const [subTypes2, setSubTypes2] = useState<string[]>([])
  const [companyName, setCompanyName] = useState("")
  const [timezoneId, setTimezoneId] = useState(TIMEZONES[0].id)
  const [countryCode, setCountryCode] = useState("")

  // Only French and English allowed
  const [language, setLanguage] = useState("fr")

  function chooseLanguage(code: string) {
    setLanguage(code)
    writeLanguage(code)
  }

  useEffect(() => {
    setTimezoneId(detectTimezoneId())
    const detected = detectLanguage()
    // Ensure we default to fr or en only
    const safeLang = detected === "en" ? "en" : "fr"
    setLanguage(safeLang)
    writeLanguage(safeLang)
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

  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvMsg, setCsvMsg] = useState("")
  const [csvFailed, setCsvFailed] = useState(false)
  const [csvDone, setCsvDone] = useState(false)

  const [selectedSources, setSelectedSources] = useState<DataSource["id"][]>([])
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

  const selectedCountry = useMemo(
    () => countryFor(countryCode),
    [countryCode]
  )

  const selectedSubType = useMemo(
    () => subTypes.find((item) => item.id === subType),
    [subTypes, subType]
  )

  const isLogistics = sector === "logistics"

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
    setSubType(null)
    setSubTypes2([])
    setExtraSectors((current) => current.filter((item) => item !== id))
    setSelectedEquipment([])
  }

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

  const csvColumns =
    (subType && CSV_COLUMNS[subType]) ||
    (sector && CSV_COLUMNS[sector]) ||
    []

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
      `?sector=${encodeURIComponent(toApiSector(sector))}&lang=${language}` +
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
        localStorage.setItem("sentria_sectors", JSON.stringify(allSectors))
      }

      if (subType) {
        localStorage.setItem("sentria_business_type", subType)
      }

      localStorage.setItem(
        "sentria_equipment",
        JSON.stringify(selectedEquipment)
      )

      localStorage.setItem(
        "sentria_monitoring",
        JSON.stringify(selectedEquipment)
      )

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

      window.dispatchEvent(new Event("sentria_sectors_updated"))
      window.dispatchEvent(new Event("sentria_onboarding_completed"))
    }

    onComplete?.()
  }

  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const node = dialogRef.current
      if (event.key !== "Tab" || !node) return

      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const outside = !node.contains(active)

      if (event.shiftKey ? active === first || outside : active === last || outside) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [])

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

  const alertHeadline = sector ? resolve(SAMPLE_ALERTS[sector], tx) : null

  const blockedReason = canContinue
    ? null
    : step === countryStepNumber
      ? tx("Choisissez un pays.", "Pick a country.")
      : step === companyStepNumber
        ? tx(
            "Entrez le nom de votre entreprise.",
            "Enter your company name."
          )
        : step === sectorStepNumber
          ? tx("Choisissez un secteur.", "Pick a sector.")
          : step === subTypeStepNumber
            ? tx(
                "Choisissez au moins une activité.",
                "Pick at least one activity."
              )
            : step === equipmentStepNumber
              ? tx(
                  "Sélectionnez au moins un élément.",
                  "Select at least one item."
                )
              : null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={tx("Configuration de SentrIA", "SentrIA setup")}
      className="fixed inset-0 z-[100] flex animate-in fade-in bg-background duration-200 ease-out motion-reduce:animate-none"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {/* HEADER */}
        <header className="shrink-0 border-b border-border bg-card/85 px-5 pb-4 pt-5 backdrop-blur-sm md:px-8 md:pt-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand"
                  aria-hidden="true"
                >
                  <Zap className="h-3.5 w-3.5 text-brand-foreground" />
                </span>

                <span className="font-heading text-sm font-bold tracking-tight">
                  SentrIA
                </span>

                <span className="truncate text-sm text-muted-foreground">
                  {tx("Configuration", "Setup")}
                </span>
              </div>

              <p className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                {tx(
                  `Étape ${step} sur ${totalSteps}`,
                  `Step ${step} of ${totalSteps}`
                )}
              </p>
            </div>

            <ol className="flex items-center gap-1.5">
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
                      aria-label={tx(
                        `Étape ${stepNumber}, ${meta.title}`,
                        `Step ${stepNumber}, ${meta.title}`
                      )}
                      className={cn(
                        "block h-1.5 w-full rounded-full transition-all duration-500",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        done && "bg-brand",
                        active && "bg-foreground",
                        !done && !active && "bg-muted",
                        reachable ? "cursor-pointer" : "cursor-not-allowed"
                      )}
                    />
                  </li>
                )
              })}
            </ol>

            <p className="sr-only" role="status" aria-live="polite">
              {tx(
                `Étape ${step} sur ${totalSteps} : ${currentMeta.title}`,
                `Step ${step} of ${totalSteps}: ${currentMeta.title}`
              )}
            </p>
          </div>
        </header>

        {/* THE QUESTION */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7 md:px-8 md:py-10">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
            <div
              key={step}
              className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20 text-foreground md:h-14 md:w-14">
                <CurrentStepIcon
                  className="h-6 w-6 md:h-7 md:w-7"
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {tx(`Étape ${step}`, `Step ${step}`)}
                </p>

                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-1.5 max-w-[24ch] text-balance font-heading text-2xl font-bold tracking-tight outline-none md:text-[2rem] md:leading-[1.15]"
                >
                  {currentMeta.title}
                </h2>

                <p className="mt-2.5 max-w-[52ch] text-sm leading-6 text-muted-foreground">
                  {currentMeta.description}
                </p>
              </div>
            </div>

            {/* STEP 1: LANGUAGE */}
            {step === langStepNumber && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/90 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
                  <div className="flex items-center justify-between border-b border-white/5 bg-black/20 px-6 py-4">
                    <span className="text-sm font-medium text-zinc-400">
                      {tx("Language", "Language")}
                    </span>
                    <Languages className="h-4 w-4 text-zinc-500" />
                  </div>

                  <div className="flex flex-col divide-y divide-white/5">
                    {LANGUAGES.filter(l => l.code === 'fr' || l.code === 'en').map((item) => {
                      const active = language === item.code
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => chooseLanguage(item.code)}
                          className={cn(
                            "group relative flex items-center justify-between px-6 py-5 text-left transition-all duration-300",
                            "hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/50 focus-visible:ring-inset"
                          )}
                        >
                          <div
                            className={cn(
                              "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                              active ? "bg-lime-500 shadow-[0_0_12px_rgba(132,204,22,0.6)]" : "bg-transparent"
                            )}
                          />

                          <div className="flex flex-col gap-1 pl-2">
                            <span
                              className={cn(
                                "text-lg font-medium tracking-wide transition-colors duration-300",
                                active ? "text-lime-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.3)]" : "text-zinc-300 group-hover:text-white"
                              )}
                            >
                              {item.label}
                            </span>
                            {!active && (
                              <span className="text-[10px] text-zinc-600">
                                {px(item.region)}
                              </span>
                            )}
                          </div>

                          {active && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-500/20 text-lime-400">
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-12 w-3/4 bg-lime-500/10 blur-2xl rounded-full" />
                </div>

                <p className="mt-6 text-center text-xs text-muted-foreground max-w-sm">
                  {tx(
                    "SentrIA s'adaptera à votre choix pour toutes les interactions futures.",
                    "SentrIA will adapt to your choice for all future interactions."
                  )}
                </p>
              </div>
            )}

            {/* STEP 2: COUNTRY */}
            {step === countryStepNumber && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/90 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
                  <div className="flex items-center justify-between border-b border-white/5 bg-black/20 px-6 py-4">
                    <span className="text-sm font-medium text-zinc-400">
                      {tx("Country & Currency", "Country & Currency")}
                    </span>
                    <Globe2 className="h-4 w-4 text-zinc-500" />
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    <div className="flex flex-col divide-y divide-white/5">
                      {COUNTRIES.map((item) => {
                        const active = countryCode === item.code
                        return (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => {
                              setCountryCode(item.code)
                              setTimezoneId(item.timezoneId)
                            }}
                            aria-pressed={active}
                            className={cn(
                              "group relative flex items-center justify-between px-6 py-4 text-left transition-all duration-300",
                              "hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/50 focus-visible:ring-inset"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                                active ? "bg-lime-500 shadow-[0_0_12px_rgba(132,204,22,0.6)]" : "bg-transparent"
                              )}
                            />

                            <div className="flex flex-col gap-0.5 pl-2">
                              <span
                                className={cn(
                                  "text-base font-medium transition-colors duration-300",
                                  active ? "text-lime-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.3)]" : "text-zinc-200 group-hover:text-white"
                                )}
                              >
                                {px(item.name)}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {item.currency.code}
                              </span>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={cn(
                                  "text-lg font-bold tabular-nums transition-colors duration-300",
                                  active ? "text-lime-400" : "text-zinc-400 group-hover:text-zinc-200"
                                )}
                              >
                                {item.currency.symbol}
                              </span>
                              {active && (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-lime-500/20 text-lime-400">
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-12 w-3/4 bg-lime-500/10 blur-2xl rounded-full" />
                </div>

                <p className="mt-6 text-center text-xs text-muted-foreground max-w-sm">
                  {tx(
                    "La devise sert à étiqueter vos propres montants. Aucune conversion n'est faite.",
                    "The currency labels your own figures. Nothing is converted."
                  )}
                </p>
              </div>
            )}

            {/* STEP 3: TIMEZONE */}
            {step === zoneStepNumber && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/90 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
                  <div className="flex items-center justify-between border-b border-white/5 bg-black/20 px-6 py-4">
                    <span className="text-sm font-medium text-zinc-400">
                      {tx("Time Zone", "Time Zone")}
                    </span>
                    <Clock3 className="h-4 w-4 text-zinc-500" />
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    <div className="flex flex-col divide-y divide-white/5">
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
                            className={cn(
                              "group relative flex items-center justify-between px-6 py-4 text-left transition-all duration-300",
                              "hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/50 focus-visible:ring-inset"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                                active ? "bg-lime-500 shadow-[0_0_12px_rgba(132,204,22,0.6)]" : "bg-transparent"
                              )}
                            />

                            <div className="flex flex-col gap-0.5 pl-2">
                              <span
                                className={cn(
                                  "text-base font-medium transition-colors duration-300",
                                  active ? "text-lime-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.3)]" : "text-zinc-200 group-hover:text-white"
                                )}
                              >
                                {zone.label}
                              </span>

                              {suggested && (
                                <span className="text-[10px] text-lime-500/80 font-medium">
                                  {tx("Déduit de votre pays", "From your country")}
                                </span>
                              )}
                            </div>

                            {active && (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-500/20 text-lime-400">
                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-12 w-3/4 bg-lime-500/10 blur-2xl rounded-full" />
                </div>

                <p className="mt-6 text-center text-xs text-muted-foreground max-w-sm">
                  {tx(
                    "Vos seuils sont en heures : ils doivent suivre votre journée locale.",
                    "Your thresholds are in hours, so they have to follow your local day."
                  )}
                </p>
              </div>
            )}

            {/* STEP 4: COMPANY - AGEEVA SPLIT BUTTON STYLE */}
            {step === companyStepNumber && (
              <div className="flex flex-col items-center justify-center py-8">
                
                {/* Split Button Container */}
                <div className="relative w-full max-w-xl group">
                  
                  {/* Decorative Stars (Optional aesthetic touch matching previous steps) */}
                  <Sparkles className="absolute -left-8 -top-8 h-6 w-6 text-lime-400 rotate-12 opacity-60 hidden sm:block" />
                  
                  <div className="flex w-full items-stretch rounded-[2rem] overflow-hidden shadow-xl transition-transform duration-300 hover:scale-[1.01]">
                    
                    {/* Left Side: Text Input (Dark Background) */}
                    <div className="flex-1 bg-zinc-900 px-6 py-5 flex items-center">
                      <label htmlFor="company-name" className="sr-only">
                        {tx("Nom de votre entreprise", "Your company name")}
                      </label>
                      <input
                        id="company-name"
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        onKeyDown={(event) => {
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
                        className="w-full bg-transparent text-lg font-bold text-white placeholder:text-zinc-500 outline-none md:text-xl"
                      />
                    </div>

                    {/* Right Side: Action Button (Lime Green) */}
                    <button
                      type="button"
                      onClick={nextStep}
                      disabled={!canContinue}
                      className={cn(
                        "flex w-20 shrink-0 items-center justify-center bg-lime-400 transition-colors duration-300",
                        "hover:bg-lime-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-inset",
                        !canContinue && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <ArrowRight className="h-8 w-8 text-zinc-900 stroke-[2.5]" />
                    </button>
                  </div>
                  
                  {/* Subtle Bottom Shadow for depth */}
                  <div className="absolute -bottom-4 left-4 right-4 -z-10 rounded-[2rem] bg-lime-400/20 blur-xl" />
                </div>

                {/* Helper Text */}
                <p className="mt-8 text-center text-xs text-muted-foreground max-w-sm">
                  {tx(
                    "Ce nom sera utilisé dans vos rapports et par l'assistant IA.",
                    "This name will be used in your reports and by the AI assistant."
                  )}
                </p>
              </div>
            )}

            {/* STEP 5: SECTOR (WHITE CARDS, DARK TEXT, 4 TOP / 3 CENTERED BELOW) */}
            {step === sectorStepNumber && (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-12">
                  {SECTORS.map((item, index) => {
                    const Icon = item.icon
                    const active = sector === item.id
                    const secondary = extraSectors.includes(item.id)
                    const isSelected = active || secondary

                    /* 4 cards on the top row (3 cols each), 3 cards on the
                       bottom row (4 cols each) so the bottom row is centered
                       under the top row. */
                    const isTopRow = index < 4
                    const colSpan = isTopRow
                      ? "lg:col-span-3"
                      : "lg:col-span-4"

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          multiSector && sector && sector !== item.id
                            ? toggleExtraSector(item.id)
                            : chooseSector(item.id)
                        }
                        aria-pressed={isSelected}
                        className={cn(
                          "group relative flex flex-col items-center justify-between rounded-3xl border p-6 text-center transition-all duration-300",
                          "min-h-[260px] w-full",
                          colSpan,
                          "border-neutral-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-lime-500 hover:shadow-md",
                          isSelected && "border-lime-500 bg-lime-50 shadow-md",
                          item.recommended && !isSelected && "border-lime-500 ring-1 ring-lime-500/30"
                        )}
                      >
                        {item.maturity && (
                          <span
                            className={cn(
                              "absolute right-4 top-4 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                              isSelected
                                ? "bg-lime-500 text-white"
                                : "bg-lime-100 text-lime-700 border border-lime-200"
                            )}
                          >
                            {maturityLabel(item.maturity, tx)}
                          </span>
                        )}

                        <div className="flex flex-1 flex-col items-center justify-center pt-5">
                          {item.image ? (
                            <div className="mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
                              <img
                                src={item.image}
                                alt=""
                                className={cn(
                                  "h-full w-full object-contain transition-transform duration-300",
                                  isSelected ? "scale-110" : "group-hover:scale-105"
                                )}
                              />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-300 mb-5",
                                isSelected
                                  ? "bg-lime-100 text-lime-700 scale-105"
                                  : "bg-neutral-100 text-neutral-500 group-hover:text-lime-600"
                              )}
                            >
                              <Icon className="h-10 w-10 stroke-[1.5]" />
                            </div>
                          )}

                          <span
                            className={cn(
                              "text-lg font-bold tracking-tight transition-colors duration-300",
                              isSelected ? "text-lime-700" : "text-neutral-900 group-hover:text-neutral-950"
                            )}
                          >
                            {px(item.label)}
                          </span>
                        </div>

                        <span
                          className={cn(
                            "mt-3 max-w-[22ch] text-xs leading-relaxed transition-colors duration-300",
                            isSelected
                              ? "text-lime-800/80"
                              : "text-neutral-500 group-hover:text-neutral-600"
                          )}
                        >
                          {px(item.description)}
                        </span>

                        {isSelected && (
                          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-lime-500 text-white ring-2 ring-white">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        )}

                        {secondary && !active && (
                          <span className="absolute bottom-4 rounded-full bg-neutral-200 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-600">
                            {tx("Secondaire", "Secondary")}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={multiSector}
                      onChange={(event) => {
                        setMultiSector(event.target.checked)
                        if (!event.target.checked) setExtraSectors([])
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-lime-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-neutral-900">
                        {tx(
                          "Mon entreprise couvre plusieurs secteurs",
                          "My company covers more than one sector"
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                        {tx(
                          "Par exemple une usine avec son propre entrepôt. Le secteur choisi ci-dessus reste le principal.",
                          "A factory with its own warehouse, for instance. The sector chosen above stays the main one."
                        )}
                      </span>
                    </span>
                  </label>

                  {multiSector && (
                    <p className="mt-4 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
                      {extraSectors.length > 0 ? (
                        <>
                          {tx("Secteurs :", "Sectors:")}{" "}
                          <span className="font-semibold text-lime-700">
                            {allSectors
                              .map((id) => sectorName(id))
                              .join(", ")}
                          </span>
                        </>
                      ) : sector ? (
                        tx(
                          "Touchez un autre secteur pour l'ajouter.",
                          "Tap another sector to add it."
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
              </>
            )}

            {/* STEP 6: BUSINESS TYPE (ACTIVITY) — UNO CARD STYLE RECTANGULAR */}
            {step === subTypeStepNumber && sector && (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {selectedSector ? px(selectedSector.label) : null}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {tx(
                      "Cette précision adapte les seuils d'alerte à votre métier",
                      "This detail tunes the alert thresholds to your trade"
                    )}
                  </p>
                </div>

                {isLogistics && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {tx(
                      "Sélectionnez toutes les activités que vous exploitez. Un terminal qui manipule des conteneurs réfrigérés fait du port et de la chaîne du froid : cochez les deux et SentrIA suivra les étapes des deux, sans y ajouter celles que vous n'avez pas.",
                      "Select every activity you run. A terminal handling refrigerated containers does both port work and cold chain: tick both and SentrIA follows the stages of both, without adding the ones you do not have."
                    )}
                  </p>
                )}

                {/* 
                  UNO CARD GRID:
                  - Uses 12-column layout for perfect centering of odd rows.
                  - Cards are vertical rectangles (aspect-ratio ~2/3).
                  - STANDARD SIZING FOR ALL SECTORS (Logistics, Health, Industry, etc.)
                */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-12">
                  {shownSubTypes.map((item, index) => {
                    const Icon = item.icon
                    const active = subTypes2.includes(item.id)
                    const img = imageForActivity(item.id)
                    const total = shownSubTypes.length

                    const colSpan = activityColSpan(index, total)

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => chooseSubType(item.id)}
                        aria-pressed={active}
                        className={cn(
                          "group relative flex flex-col items-center justify-between rounded-2xl border p-4 text-center transition-all duration-300",
                          // Aspect ratio control for "Uno card" feel - SAME FOR ALL SECTORS
                          "aspect-[2/3] w-full", 
                          colSpan,
                          "border-neutral-200 bg-white shadow-sm hover:-translate-y-1 hover:border-lime-500 hover:shadow-md",
                          active && "border-lime-500 bg-lime-50 shadow-md ring-1 ring-lime-500/20"
                        )}
                      >
                        {/* Maturity Badge */}
                        {item.maturity && (
                          <span
                            className={cn(
                              "absolute right-2 top-2 whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                              active
                                ? "bg-lime-500 text-white"
                                : "bg-lime-100 text-lime-700 border border-lime-200"
                            )}
                          >
                            {maturityLabel(item.maturity, tx)}
                          </span>
                        )}

                        {/* Image / Icon Area - STANDARD SIZE FOR ALL (enlarged) */}
                        <div className="flex flex-1 flex-col items-center justify-center w-full pt-2">
                          {img ? (
                            <div className="mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
                              <img
                                src={img}
                                alt=""
                                className={cn(
                                  "h-full w-full object-contain transition-transform duration-300",
                                  active ? "scale-110" : "group-hover:scale-105"
                                )}
                              />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "flex h-20 w-20 items-center justify-center rounded-xl transition-all duration-300 mb-3",
                                active
                                  ? "bg-lime-100 text-lime-700 scale-105"
                                  : "bg-neutral-100 text-neutral-500 group-hover:text-lime-600"
                              )}
                            >
                              <Icon className="h-10 w-10 stroke-[1.5]" />
                            </div>
                          )}

                          <span
                            className={cn(
                              "text-sm font-bold tracking-tight leading-tight transition-colors duration-300 line-clamp-2",
                              active ? "text-lime-700" : "text-neutral-900 group-hover:text-neutral-950"
                            )}
                          >
                            {px(item.label)}
                          </span>
                        </div>

                        {/* Description (Optional, kept very small for card density) */}
                        <span
                          className={cn(
                            "mt-2 max-w-[18ch] text-[10px] leading-3.5 transition-colors duration-300 line-clamp-2",
                            active
                              ? "text-lime-800/80"
                              : "text-neutral-500 group-hover:text-neutral-600"
                          )}
                        >
                          {px(item.description)}
                        </span>

                        {/* Selection Indicator */}
                        {active && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-lime-500 text-white ring-2 ring-white shadow-sm">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
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

            {/* STEP 7: MONITORING PRIORITIES */}
            {step === equipmentStepNumber && sector && (
              <div>
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {selectedSector ? px(selectedSector.label) : null}
                  {subType && (
                    <>
                      <span className="text-muted-foreground/50">/</span>
                      {px(
                        subTypes.find((item) => item.id === subType)?.label
                      )}
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
                    const active = selectedEquipment.includes(item.id)
                    const disabled = Boolean(item.comingSoon)

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => !disabled && toggleEquipment(item.id)}
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

            {/* STEP 8: DATA SOURCES */}
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
                    const active = selectedSources.includes(source.id)

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
                          {active && <Check className="h-4 w-4" />}
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
                  {tx("Configurer plus tard", "Set this up later")}
                  {configureLater && <Check className="h-4 w-4" />}
                </button>

                <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {tx(
                          "Aucune connexion n'est requise maintenant",
                          "No connection is needed right now"
                        )}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {tx(
                          "SentrIA pourra être configuré avec votre ERP, vos capteurs ou vos fichiers CSV / Excel depuis votre espace, à tout moment.",
                          "SentrIA can be connected to your ERP, your sensors or your CSV and Excel files from your own workspace, at any time."
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step >= sectorStepNumber && (
              <div className="rounded-3xl bg-foreground p-4 text-background xl:hidden">
                <AlertPreview
                  tx={tx}
                  company={companyName.trim()}
                  sectorLabel={selectedSector ? px(selectedSector.label) : null}
                  headline={alertHeadline}
                />
              </div>
            )}
          </div>
        </div>

        {/* ACTION BAR */}
        <footer className="shrink-0 border-t border-border bg-card/85 px-5 py-4 backdrop-blur-sm md:px-8">
          <div className="mx-auto w-full max-w-5xl">
            {!canContinue && blockedReason && (
              <p className="mb-3 text-xs leading-5 text-muted-foreground">
                {blockedReason}
              </p>
            )}

            <div className="flex items-center justify-between gap-4">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={previousStep}
                  className="shrink-0 rounded-full border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {tx("Retour", "Back")}
                </button>
              ) : (
                <span />
              )}

              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!canContinue}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tx("Continuer", "Continue")}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {tx("Ouvrir mon dashboard", "Open my dashboard")}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}