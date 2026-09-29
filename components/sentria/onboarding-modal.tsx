
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
  readCompanyName,
  TIMEZONES,
  writeCompanyName,
  writeTimezoneId,
} from "@/lib/company"
import {
  accountCurrencyParam,
  COUNTRIES,
  CURRENCIES,
  writeCurrency,
  LANGUAGES,
  countryFor,
  readLanguage,
  languagePromise,
  writeCountryCode,
  writeLanguage,
} from "@/lib/locale"
import {
  DEPARTMENTS_KEY,
  DEPARTMENT_GROUPS,
  atLeast,
  combinableWith,
  isAllowedCombo,
  readAccountPlan,
  type PlanId,
} from "@/lib/plans"
import { uploadProblemMessage } from "@/lib/upload-problem"
import { runUpload, type UploadState } from "@/lib/upload"
import { UploadProgress } from "./upload-progress"
import { StatusTag } from "./status-tag"
import { prioritiesFor } from "@/lib/priorities"
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

/* -------------------------------------------------------------------------- */
/* PRIORITY IMAGES                                                            */
/* -------------------------------------------------------------------------- */

/**
 * One PNG per priority id. Filenames come straight from
 * PRIORITIES_BY_SECTOR: the id plus ".png", in /public.
 *
 * A shared id (temperature, stocks, storage, oil, fuel, maintenance,
 * cold-chain, expiry) resolves to the same file across sectors, so
 * those PNGs only need to exist once.
 */
const PRIORITY_IMAGES: Record<string, string> = {
  // Logistics
  blockages: "/blockage.png",
  wait: "/waiting.png",
  cost: "/cost.png",
  anticipate: "/warned.png",
  recommend: "/recommendations.png",

  // Industry
  machines: "/machines.png",
  motors: "/motors.png",
  pressure: "/pressure.png",
  production: "/production.png",

  // Health / Agriculture / Commerce shared
  stocks: "/stocks.png",
  "cold-chain": "/cold-chain.png",
  expiry: "/expiry.png",
  medications: "/medications.png",
  storage: "/storage.png",

  // Agriculture
  transport: "/transport.png",
  // Activity feature cards.
  "network-rebalancing": "/networking-rebalancing.png",
  rebalancing: "/rebalancing.png",
  "output-drift": "/output-drift.png",
  "hygiene-lead-time": "/hygiene-lead-time.png",
  "failure-signature": "/failure-signature.png",
  "maintenance-production-link": "/maintenance-production-link.png",

  // Transportation
  vehicles: "/vehicles.png",
  engine: "/engine.png",
  tires: "/tires.png",

  // Energy
  generators: "/generators.png",
  load: "/load.png",
  sensors: "/sensors.png",

  // Commerce
  "shelf-availability": "/shelf-availability.png",
  replenishment: "/replenishment.png",

  // Shared across sectors
  temperature: "/temperature.png",
  maintenance: "/maintenance.png",
  oil: "/oil.png",
  fuel: "/fuel.png",
}

function normalizeKey(id: string): string {
  return id.toLowerCase().replace(/[-_\s]/g, "")
}

/** Look up by raw id, then by normalized id (dashes/underscores stripped). */
function imageForPriority(priorityId: string | undefined): string | undefined {
  if (!priorityId) return undefined
  if (PRIORITY_IMAGES[priorityId]) return PRIORITY_IMAGES[priorityId]
  return PRIORITY_IMAGES[normalizeKey(priorityId)]
}

/* -------------------------------------------------------------------------- */
/* GRID COLUMN SPANS                                                          */
/* -------------------------------------------------------------------------- */

/** Cards per row for the activity and priority steps: balanced rows
 *  whatever the count (5 and 6 become 3 + 2 and 3 + 3), never a lone card
 *  pushed to one side. */
function cardColumns(total: number): number {
  if (total <= 4) return Math.max(total, 2)
  if (total <= 6) return 3
  return 4
}

const CARD_WIDTH = 208
const CARD_GAP = 16

function cardRowWidth(total: number): number {
  const columns = cardColumns(total)
  return columns * CARD_WIDTH + (columns - 1) * CARD_GAP
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

const CSV_COLUMNS: Record<string, string[]> = {
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
  "health": ["medicine_name", "stock_qty", "min_stock"],
  "industry": [
    "Product ID", "Torque [Nm]", "Tool wear [min]",
    "Rotational speed [rpm]",
  ],
  "usine-agroalimentaire": [
    "Product ID", "food_temp", "max_food_temp", "hygiene_control_passed",
    "production_rate", "target_rate",
  ],
  "usine-production": [
    "Product ID", "Torque [Nm]", "Tool wear [min]", "Rotational speed [rpm]",
    "production_rate", "target_rate", "last_maintenance_date",
  ],
  "atelier-soustraitance": [
    "Product ID", "Torque [Nm]", "Tool wear [min]", "Rotational speed [rpm]",
    "last_maintenance_date",
  ],
  // Names check_logistics reads (and the /upload check requires):
  // equipment_id and daily_cycles.
  "logistics": ["equipment_id", "daily_cycles", "hydraulic_pressure", "fuel_level"],
  // A port file can also carry vessel rows (arrival, berth window) and
  // customs rows (clearance against free time): port_flow.py.
  "entrepot-manutention": [
    "equipment_id", "daily_cycles", "max_cycles", "hydraulic_pressure",
    "fuel_level", "last_service_date",
  ],
  "preparation-expedition": [
    "equipment_id", "daily_cycles", "max_cycles", "avg_wait_hours",
    "last_service_date",
  ],
  "chaine-froid": [
    "equipment_id", "temperature", "max_temperature", "fuel_level",
    "last_service_date",
  ],
  // Trucks: the upload sends ops_type=transport, so the vehicle checks run.
  "transport-distribution": [
    "truck_id", "mileage_km", "last_service_km", "engine_temp",
    "fuel_level", "oil_level", "tire_age_months",
  ],
  "port-conteneurs": [
    "equipment_id", "daily_cycles", "avg_wait_hours",
    "vessel_id", "eta", "berth_window_end", "containers_aboard",
    "declaration_id", "hours_in_customs", "docs_missing",
    "free_time_hours_left",
  ],
  // Names the backend reads (check_agriculture): days_in_storage, not
  // days_stored. product_name drives the silo spoilage profiles (A-PROF).
  "agriculture": ["product_name", "days_in_storage", "storage_temp"],
  "exploitation-agricole": [
    "product_name", "storage_temp", "days_in_storage", "scheduled_pickup",
    "actual_pickup", "qty", "unit_cost",
  ],
  "silo-stockage": [
    "product_name", "days_in_storage", "storage_temp", "max_storage_temp",
  ],
  // One row per member lot; the capacity column drives A-COOP pairing
  // (spare_capacity_kg, available_transport_capacity or transport_capacity).
  "cooperative-agricole": [
    "member_id", "product_name", "days_in_storage", "spare_capacity_kg",
    "qty", "unit_cost",
  ],
  // Names check_transportation reads: truck_id, mileage_km and
  // last_service_km (not vehicle_id / km_since_service).
  "transportation": [
    "truck_id", "mileage_km", "last_service_km", "engine_temp", "fuel_level",
  ],
  // Cold chain reads the cargo's own temperature against its category
  // (surgelés, viande, vaccins...), never the engine's.
  "flotte-entreprise": [
    "truck_id", "mileage_km", "last_service_km", "fuel_level",
    "harsh_braking_count", "speeding_minutes", "idle_minutes",
    "days_used_this_month", "days_available_this_month",
    "cost_per_km", "budget_cost_per_km",
  ],
  "location-vehicules": [
    "truck_id", "mileage_km", "last_service_km", "damage_reported",
    "turnaround_days_since_return", "days_rented_this_month",
    "days_available_this_month", "contract_end_date",
  ],
  "transporteur-routier": [
    "truck_id", "mileage_km", "last_service_km", "engine_temp", "fuel_level",
    "cargo_category", "cargo_temp", "scheduled_arrival", "actual_arrival",
  ],
  // Names check_energy reads: fuel_level_pct, not fuel_level.
  "energy": ["generator_id", "fuel_level_pct", "coolant_temp"],
  "centrale-production": [
    "generator_id", "output_kw", "rated_kw", "fuel_level_pct", "coolant_temp",
  ],
  "generateurs-secours": [
    "generator_id", "fuel_level_pct", "coolant_temp", "load_pct",
    "runtime_hours", "last_service_hours",
  ],
  "distribution-energetique": [
    "site_id", "generator_id", "fuel_level_pct", "load_pct", "rated_kw",
  ],
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
    "store_id", "product_name", "stock_qty", "min_stock",
    "sales_last_30_days", "unit_cost",
  ],
  "grossiste-distributeur": [
    "client_name", "order_date", "amount", "outstanding_balance",
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
  // Defaults to the country's currency; can be changed (a company in
  // Ghana may bill in dollars). It also prices the plans.
  const [currencyCode, setCurrencyCode] = useState("")

  const [language, setLanguage] = useState("fr")

  function chooseLanguage(code: string) {
    setLanguage(code)
    writeLanguage(code)
  }

  useEffect(() => {
    // The company typed at sign-up (S-3), so it isn't asked twice.
    setCompanyName((current) => current || readCompanyName())
    setTimezoneId(detectTimezoneId())
    // The language already stored (e.g. picked on the sign-in screen a
    // moment ago) wins; the browser's is only the fallback.
    const stored = readLanguage()
    const safeLang = stored === "en" ? "en" : "fr"
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
  // Brought into view when the last file passes: it sits low, above the
  // step's fixed footer.
  const goodToGoRef = useRef<HTMLDivElement>(null)

  // One import per department chosen (a clinic with its pharmacy and
  // lab uploads three files), each checked by the API before anything is
  // saved. Keyed by department id ("" when the sector has none).
  const [deptUploads, setDeptUploads] = useState<Record<string, UploadState>>({})

  const [selectedSources, setSelectedSources] = useState<DataSource["id"][]>([])
  const [configureLater, setConfigureLater] = useState(false)

  const equipment = useMemo(
    () => prioritiesFor(sector, subType),
    [sector, subType]
  )

  // Changing activity can remove cards: drop ticks on cards no longer offered.
  useEffect(() => {
    const offered = new Set(equipment.map((item) => item.id))
    setSelectedEquipment((ids) => {
      const kept = ids.filter((id) => offered.has(id))
      return kept.length === ids.length ? ids : kept
    })
  }, [equipment])

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

  // What the plan allows (lib/plans.ts). Right after sign-up this is the
  // Business trial: linked departments, one sector.
  const [plan, setPlan] = useState<PlanId>("decouverte")
  useEffect(() => setPlan(readAccountPlan().effective), [])
  const canMultiSector = atLeast(plan, "entreprise")
  const canMultiDepartment =
    atLeast(plan, "business") && Boolean(sector && DEPARTMENT_GROUPS[sector])

  const langStepNumber = 1
  // Country, currency and time zone share one step: the zone is detected
  // before the user gets there, so it only needs to be visible and
  // editable, not a step of its own.
  const countryStepNumber = 2
  const companyStepNumber = 3
  const sectorStepNumber = 4
  const subTypeStepNumber = 5
  const equipmentStepNumber = 6
  const sourcesStepNumber = 7

  const totalSteps = 7

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
        "Il fixe la devise de vos montants. Vérifiez aussi votre fuseau horaire.",
        "It sets the currency your amounts are in. Check your time zone too."
      ),
      icon: Globe2,
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
    if (!canMultiDepartment) {
      setSubType(id)
      setSubTypes2([id])
      return
    }

    setSubTypes2((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : atLeast(plan, "entreprise") || isAllowedCombo(sector ?? "", [...current, id])
          ? [...current, id]
          : // Doesn't run with the others: start over with this one.
            [id]

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

  /** The departments to import for: every one chosen, or the sector alone. */
  const importTargets: string[] =
    subTypes2.length > 0 ? subTypes2 : subType ? [subType] : [""]

  const columnsFor = (department: string) =>
    (department && CSV_COLUMNS[department]) || (sector && CSV_COLUMNS[sector]) || []

  const labelFor = (department: string) => {
    const item = subTypes.find((entry) => entry.id === department)
    return item ? px(item.label) : selectedSector ? px(selectedSector.label) : ""
  }

  const readyCount = importTargets.filter(
    (department) => deptUploads[department]?.phase === "done"
  ).length
  const allReady = readyCount === importTargets.length

  useEffect(() => {
    if (allReady) goodToGoRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [allReady])

  async function importFor(department: string, file: File) {
    if (!sector) return

    const query =
      `?sector=${encodeURIComponent(toApiSector(sector))}&lang=${language}` +
      (department ? `&business_type=${encodeURIComponent(department)}` : "") +
      // Logistics picks its checks by ops type, as the dashboard upload
      // does: without it a truck file ran the equipment checks (B-03).
      (sector === "logistics" && normalizeOpsType(department)
        ? `&ops_type=${normalizeOpsType(department)}`
        : "") +
      accountCurrencyParam()

    await runUpload(
      `${API_BASE}/upload${query}`,
      file,
      (state) => setDeptUploads((current) => ({ ...current, [department]: state })),
      // 422: not this department's data (B-24); 403: outside the plan.
      (problem) =>
        uploadProblemMessage(problem, tx) ??
        tx(
          "Ce fichier ne correspond pas à ce département.",
          "This file doesn't match this department."
        ),
      tx(
        "L'API SentrIA n'a pas répondu. Réessayez dans un instant.",
        "The SentrIA API did not answer. Try again in a moment."
      )
    )
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
      writeCurrency(currencyCode || (selectedCountry?.currency.code ?? ""))
      writeLanguage(language)

      if (sector) {
        localStorage.setItem("sentria_sector", sector)
        localStorage.setItem("sentria_sectors", JSON.stringify(allSectors))
      }

      if (subType) {
        localStorage.setItem("sentria_business_type", subType)
      }

      // The departments the company runs, within what its plan allows.
      if (sector && subTypes2.length > 0) {
        localStorage.setItem(DEPARTMENTS_KEY, JSON.stringify({ [sector]: subTypes2 }))
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
      : step === companyStepNumber        ? tx(
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
                              setCurrencyCode(item.currency.code)
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

                <label className="mt-5 flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/90 px-5 py-3 text-sm text-zinc-300">
                  <span className="font-medium">{tx("Devise", "Currency")}</span>
                  <select
                    value={currencyCode}
                    onChange={(event) => setCurrencyCode(event.target.value)}
                    disabled={!countryCode}
                    aria-label={tx("Devise du compte", "Account currency")}
                    className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/50 disabled:opacity-50"
                  >
                    {!countryCode && <option value="">{tx("Choisissez un pays", "Pick a country")}</option>}
                    {CURRENCIES.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} · {currency.symbol}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Time zone: already detected (then set from the country
                    picked above), shown here to confirm or correct. */}
                <div
                  role="group"
                  aria-label={tx("Fuseau horaire", "Time zone")}
                  className="mt-3 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/90 px-5 py-4 text-sm text-zinc-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tx("Fuseau horaire", "Time zone")}</span>
                    <Clock3 className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {TIMEZONES.map((zone) => {
                      const active = timezoneId === zone.id
                      const suggested = countryFor(countryCode)?.timezoneId === zone.id

                      return (
                        <button
                          key={zone.id}
                          type="button"
                          onClick={() => setTimezoneId(zone.id)}
                          aria-pressed={active}
                          className={cn(
                            "flex flex-col items-start rounded-xl border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/50",
                            active
                              ? "border-lime-500/70 bg-lime-500/10 text-lime-300"
                              : "border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <span className="font-medium">{zone.label}</span>
                          {suggested && (
                            <span className="text-[10px] font-medium text-lime-500/80">
                              {tx("Déduit de votre pays", "From your country")}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-muted-foreground max-w-sm">
                  {tx(
                    "La devise étiquette vos montants et fixe le prix de votre offre, sans conversion. Vos seuils sont en heures : ils suivent votre fuseau.",
                    "The currency labels your figures and sets your plan's price, with no conversion. Your thresholds are in hours, so they follow your time zone."
                  )}
                </p>
              </div>
            )}

            {/* STEP 3: COMPANY */}
            {step === companyStepNumber && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative w-full max-w-xl group">
                  <Sparkles className="absolute -left-8 -top-8 h-6 w-6 text-lime-400 rotate-12 opacity-60 hidden sm:block" />

                  <div className="flex w-full items-stretch rounded-[2rem] overflow-hidden shadow-xl transition-transform duration-300 hover:scale-[1.01]">
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

                  <div className="absolute -bottom-4 left-4 right-4 -z-10 rounded-[2rem] bg-lime-400/20 blur-xl" />
                </div>

                <p className="mt-8 text-center text-xs text-muted-foreground max-w-sm">
                  {tx(
                    "Ce nom sera utilisé dans vos rapports et par l'assistant IA.",
                    "This name will be used in your reports and by the AI assistant."
                  )}
                </p>
              </div>
            )}

            {/* STEP 4: SECTOR */}
            {step === sectorStepNumber && (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-12">
                  {SECTORS.map((item, index) => {
                    const Icon = item.icon
                    const active = sector === item.id
                    const secondary = extraSectors.includes(item.id)
                    const isSelected = active || secondary

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

                {canMultiSector ? (
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
                ) : (
                  <p className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 text-xs leading-5 text-neutral-500 shadow-sm">
                    {tx(
                      "Une entreprise suit un secteur. Plusieurs secteurs (une usine avec son entrepôt, par exemple) : offre Entreprise.",
                      "A company follows one sector. Several sectors (a factory with its own warehouse, say): Entreprise plan."
                    )}
                  </p>
                )}
              </>
            )}

            {/* STEP 5: BUSINESS TYPE (ACTIVITY) */}
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

                {!canMultiDepartment && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {tx(
                      "Choisissez votre département. Plusieurs départements qui tournent ensemble : offre Business.",
                      "Pick your department. Several departments that run together: Business plan."
                    )}
                  </p>
                )}

                {canMultiDepartment && !isLogistics && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {tx(
                      "Cochez tous les départements que vous exploitez ensemble, par exemple une clinique avec sa pharmacie et son laboratoire. Ceux qui ne vont pas avec votre choix sont grisés.",
                      "Tick every department you run together, a clinic with its own pharmacy and lab for instance. Those that don't go with your choice are greyed out."
                    )}
                  </p>
                )}

                {canMultiDepartment && isLogistics && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {tx(
                      "Sélectionnez toutes les activités que vous exploitez. Un terminal qui manipule des conteneurs réfrigérés fait du port et de la chaîne du froid : cochez les deux et SentrIA suivra les étapes des deux, sans y ajouter celles que vous n'avez pas.",
                      "Select every activity you run. A terminal handling refrigerated containers does both port work and cold chain: tick both and SentrIA follows the stages of both, without adding the ones you do not have."
                    )}
                  </p>
                )}

                <div
                  className="mx-auto flex flex-wrap justify-center gap-4"
                  style={{ maxWidth: cardRowWidth(shownSubTypes.length) }}
                >
                  {shownSubTypes.map((item) => {
                    const Icon = item.icon
                    const active = subTypes2.includes(item.id)
                    const img = imageForActivity(item.id)
                    // Greyed when it doesn't run with what is ticked: a
                    // click then starts over with it.
                    const fits =
                      !canMultiDepartment ||
                      active ||
                      subTypes2.length === 0 ||
                      atLeast(plan, "entreprise") ||
                      combinableWith(sector, subTypes2).has(item.id)

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => chooseSubType(item.id)}
                        aria-pressed={active}
                        title={
                          fits
                            ? undefined
                            : tx(
                                "Ne va pas avec votre choix : le sélectionner remplace la sélection.",
                                "Doesn't go with your choice: selecting it replaces the selection."
                              )
                        }
                        className={cn(
                          !fits && "opacity-50",
                          "group relative flex flex-col items-center rounded-2xl border px-3 pb-5 pt-6 text-center transition-all duration-300",
                          // Two per row on phones, a fixed width from sm up so
                          // every row lines up whatever the card count.
                          "w-[calc(50%-0.5rem)] sm:w-[208px]",
                          "border-neutral-200 bg-white shadow-sm hover:-translate-y-1 hover:border-lime-500 hover:shadow-md",
                          active && "border-lime-500 bg-lime-50 shadow-md ring-1 ring-lime-500/20"
                        )}
                      >
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

                        <div className="flex w-full flex-col items-center">
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
                                "flex h-24 w-24 items-center justify-center rounded-xl transition-all duration-300 mb-3",
                                active
                                  ? "bg-lime-100 text-lime-700 scale-105"
                                  : "bg-neutral-100 text-neutral-500 group-hover:text-lime-600"
                              )}
                            >
                              <Icon className="h-9 w-9 stroke-[1.5]" />
                            </div>
                          )}

                          <span
                            className={cn(
                              "min-h-[2.5em] text-sm font-bold leading-tight tracking-tight transition-colors duration-300 line-clamp-2",
                              active ? "text-lime-700" : "text-neutral-900 group-hover:text-neutral-950"
                            )}
                          >
                            {px(item.label)}
                          </span>
                        </div>

                        <span
                          className={cn(
                            "mt-1.5 min-h-[2.8em] w-full text-xs leading-snug transition-colors duration-300 line-clamp-3 sm:line-clamp-2",
                            active
                              ? "text-lime-800/80"
                              : "text-neutral-500 group-hover:text-neutral-600"
                          )}
                        >
                          {px(item.description)}
                        </span>

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

            {/* STEP 6: MONITORING PRIORITIES */}
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
                  // French keeps 0 and 1 singular; English only 1.
                  noun={tx(
                    selectedEquipment.length > 1
                      ? "priorités sélectionnées"
                      : "priorité sélectionnée",
                    selectedEquipment.length === 1
                      ? "priority selected"
                      : "priorities selected"
                  )}
                />

                <div
                  className="mx-auto flex flex-wrap justify-center gap-4"
                  style={{ maxWidth: cardRowWidth(equipment.length) }}
                >
                  {equipment.map((item, index) => {
                    const Icon = item.icon
                    const active = selectedEquipment.includes(item.id)
                    const disabled = Boolean(item.comingSoon)
                    const img = imageForPriority(item.id)

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => !disabled && toggleEquipment(item.id)}
                        disabled={disabled}
                        className={cn(
                          "group relative flex flex-col items-center rounded-2xl border px-3 pb-5 pt-6 text-center transition-all duration-300",
                          // Two per row on phones, a fixed width from sm up so
                          // every row lines up whatever the card count.
                          "w-[calc(50%-0.5rem)] sm:w-[208px]",
                          disabled
                            ? "cursor-not-allowed border-neutral-200 bg-white opacity-60"
                            : active
                              ? "border-lime-500 bg-lime-50 shadow-md ring-1 ring-lime-500/20"
                              : "border-neutral-200 bg-white shadow-sm hover:-translate-y-1 hover:border-lime-500 hover:shadow-md"
                        )}
                      >
                        {disabled && (
                          <span className="absolute right-2 top-2 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-700">
                            {tx("Bientôt", "Soon")}
                          </span>
                        )}

                        <div className="flex w-full flex-col items-center">
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
                                "flex h-24 w-24 items-center justify-center rounded-xl transition-all duration-300 mb-3",
                                active
                                  ? "bg-lime-100 text-lime-700 scale-105"
                                  : "bg-neutral-100 text-neutral-500 group-hover:text-lime-600"
                              )}
                            >
                              <Icon className="h-9 w-9 stroke-[1.5]" />
                            </div>
                          )}

                          <span
                            className={cn(
                              "min-h-[2.5em] text-sm font-bold leading-tight tracking-tight transition-colors duration-300 line-clamp-2",
                              active ? "text-lime-700" : "text-neutral-900 group-hover:text-neutral-950"
                            )}
                          >
                            {px(item.label)}
                          </span>
                        </div>

                        <span
                          className={cn(
                            "mt-1.5 min-h-[2.8em] w-full text-xs leading-snug transition-colors duration-300 line-clamp-3 sm:line-clamp-2",
                            active
                              ? "text-lime-800/80"
                              : "text-neutral-500 group-hover:text-neutral-600"
                          )}
                        >
                          {px(item.description)}
                        </span>

                        {active && !disabled && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-lime-500 text-white ring-2 ring-white shadow-sm">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <p className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {tx("Modifiable plus tard", "Changeable later")}
                </p>
              </div>
            )}

            {/* STEP 7: DATA SOURCES */}
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
                  noun={tx(
                    selectedSources.length > 1 ? "sources choisies" : "source choisie",
                    selectedSources.length === 1 ? "source chosen" : "sources chosen"
                  )}
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
                  <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/5 p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {importTargets.length > 1
                            ? tx("Importez un fichier par département", "Import one file per department")
                            : tx("Importez votre fichier maintenant", "Import your file now")}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {tx(
                            "SentrIA vérifie chaque fichier avant d'enregistrer quoi que ce soit.",
                            "SentrIA checks each file before saving anything."
                          )}
                        </p>
                      </div>
                      {importTargets.length > 1 && (
                        <p className="text-sm font-bold tabular-nums" aria-live="polite">
                          {tx(`${readyCount} / ${importTargets.length} prêts`, `${readyCount} / ${importTargets.length} ready`)}
                        </p>
                      )}
                    </div>

                    {importTargets.length > 1 && (
                      <div
                        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label={tx("Départements prêts", "Departments ready")}
                        aria-valuemin={0}
                        aria-valuemax={importTargets.length}
                        aria-valuenow={readyCount}
                      >
                        <div
                          className="h-full rounded-full bg-foreground transition-[width] duration-300"
                          style={{ width: `${(readyCount / importTargets.length) * 100}%` }}
                        />
                      </div>
                    )}

                    <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {importTargets.map((department) => {
                        const upload = deptUploads[department] ?? { phase: "idle" as const }
                        const working = upload.phase === "sending" || upload.phase === "analysing"
                        const columns = columnsFor(department)
                        const label = labelFor(department)

                        return (
                          <li
                            key={department || "sector"}
                            className={cn(
                              "rounded-2xl border bg-background p-4",
                              upload.phase === "done" ? "border-lime-500/60" : upload.phase === "refused" || upload.phase === "failed" ? "border-destructive/50" : "border-border"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-bold">{label}</p>
                              <StatusTag
                                size="xs"
                                tone={
                                  upload.phase === "done"
                                    ? "success"
                                    : upload.phase === "refused" || upload.phase === "failed"
                                      ? "danger"
                                      : working
                                        ? "info"
                                        : "neutral"
                                }
                              >
                                {upload.phase === "done"
                                  ? tx("Prêt", "Ready")
                                  : upload.phase === "refused" || upload.phase === "failed"
                                    ? tx("À corriger", "Needs a fix")
                                    : working
                                      ? tx("Vérification…", "Checking…")
                                      : tx("À importer", "To import")}
                              </StatusTag>
                            </div>

                            {columns.length > 0 && upload.phase === "idle" && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {columns.map((col) => (
                                  <code key={col} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                                    {col}
                                  </code>
                                ))}
                              </div>
                            )}

                            {upload.phase !== "idle" && (
                              <div className="mt-3">
                                <UploadProgress state={upload} compact />
                              </div>
                            )}

                            {!working && (
                              <label
                                className={cn(
                                  "relative mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity",
                                  "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                                  upload.phase === "done"
                                    ? "border border-border bg-background hover:bg-muted"
                                    : "bg-foreground text-background hover:opacity-90"
                                )}
                              >
                                <Upload className="h-4 w-4" aria-hidden="true" />
                                {upload.phase === "done"
                                  ? tx("Remplacer le fichier", "Replace the file")
                                  : upload.phase === "idle"
                                    ? tx("Choisir un fichier CSV", "Choose a CSV file")
                                    : tx("Choisir un autre fichier", "Choose another file")}
                                <input
                                  type="file"
                                  accept=".csv"
                                  className="sr-only"
                                  disabled={!sector}
                                  aria-label={tx(`Fichier CSV : ${label}`, `CSV file: ${label}`)}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0]
                                    event.target.value = ""
                                    if (file) void importFor(department, file)
                                  }}
                                />
                              </label>
                            )}
                          </li>
                        )
                      })}
                    </ul>

                    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                      {tx(
                        "Les colonnes manquantes sont simplement ignorées, jamais une erreur.",
                        "Missing columns are simply skipped, never an error."
                      )}
                    </p>

                    {allReady && (
                      <div
                        ref={goodToGoRef}
                        className="mt-4 flex scroll-mb-28 items-start gap-3 rounded-2xl bg-lime-500/15 p-4"
                        role="status"
                      >
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-lime-700 dark:text-lime-300" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-bold">{tx("Tout est prêt", "You're good to go")}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {importTargets.length > 1
                              ? tx(
                                  `Vos ${importTargets.length} départements sont vérifiés. Chacun a sa vue sur le tableau de bord.`,
                                  `Your ${importTargets.length} departments are checked. Each one gets its own view on the dashboard.`
                                )
                              : tx("Votre fichier est vérifié et analysé.", "Your file is checked and analysed.")}
                          </p>
                          <ul className="mt-2 space-y-0.5 text-sm tabular-nums">
                            {importTargets.map((department) => (
                              <li key={department || "sector"}>
                                <span className="font-semibold">{labelFor(department)}</span>
                                {" · "}
                                {tx(
                                  `${(deptUploads[department]?.rows ?? 0).toLocaleString("fr-FR")} lignes, ${(deptUploads[department]?.alerts ?? 0).toLocaleString("fr-FR")} alertes`,
                                  `${(deptUploads[department]?.rows ?? 0).toLocaleString("en-GB")} rows, ${(deptUploads[department]?.alerts ?? 0).toLocaleString("en-GB")} alerts`
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
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