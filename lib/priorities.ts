import {
  Activity,
  BatteryCharging,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  Clock,
  Cog,
  Droplets,
  Fuel,
  Gauge,
  HeartPulse,
  Package,
  PackageX,
  Radar,
  Radio,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Thermometer,
  Truck,
  Warehouse,
  Wheat,
  Zap,
} from "lucide-react"

import { localized, type Localized, type Tx } from "@/lib/i18n"

export type Sector =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"
  | "commerce"

/** The sector names, in one place. They were written out again in the
 *  onboarding modal, the dashboard, the sites view, the recommendations
 *  panel and the profile page, which is how the profile page ended up
 *  listing six sectors nobody had selected. */
export const SECTOR_LABELS: Record<Sector, Localized> = {
  industry: localized("Industrie", "Industry"),
  health: localized("Santé", "Health"),
  agriculture: localized("Agriculture", "Agriculture"),
  transportation: localized("Transport", "Transport"),
  logistics: localized("Logistique", "Logistics"),
  energy: localized("Énergie", "Energy"),
  commerce: localized("Commerce", "Retail"),
}

export function sectorLabel(
  sector: string | null | undefined,
  tx: Tx
): string {
  if (!sector) return ""

  const label = SECTOR_LABELS[sector as Sector]

  return label ? tx(label.fr, label.en) : sector
}

/** One monitoring priority a user can pick during onboarding.
 *
 *  This catalog is the only place priorities are named. It used to live
 *  twice: once in the onboarding modal (goal-phrased, with icons) and
 *  once in the dashboard (short labels, separate descriptions), which is
 *  how "Éviter les blocages" in the wizard became "Blocages" on the
 *  dashboard with nothing tying the two together. */
export type Priority = {
  id: string
  /** Goal-phrased name. Shown in onboarding, where we explain the value. */
  label: Localized
  /** Short name for nav chips and cards, when `label` is a full sentence. */
  short?: Localized
  description: Localized
  icon: React.ElementType
  comingSoon?: boolean
}

export const PRIORITIES_BY_SECTOR: Record<Sector, Priority[]> = {
  industry: [
    {
      id: "machines",
      label: localized(
        "Machines de production",
        "Production machines"
      ),
      description: localized(
        "Usure, vibrations et pannes",
        "Wear, vibration and breakdowns"
      ),
      icon: Cog,
    },
    {
      id: "motors",
      label: localized(
        "Moteurs",
        "Motors"
      ),
      description: localized(
        "Performance et anomalies",
        "Performance and anomalies"
      ),
      icon: Activity,
    },
    {
      id: "temperature",
      label: localized(
        "Température",
        "Temperature"
      ),
      description: localized(
        "Surchauffe et dérives thermiques",
        "Overheating and thermal drift"
      ),
      icon: Thermometer,
    },
    {
      id: "pressure",
      label: localized(
        "Pression",
        "Pressure"
      ),
      description: localized(
        "Pression hydraulique et pneumatique",
        "Hydraulic and pneumatic pressure"
      ),
      icon: Gauge,
    },
    {
      id: "production",
      label: localized(
        "Production",
        "Production"
      ),
      description: localized(
        "Cycles, rendement et arrêts",
        "Cycles, output and stoppages"
      ),
      icon: Boxes,
    },
    {
      id: "maintenance",
      label: localized(
        "Maintenance",
        "Maintenance"
      ),
      description: localized(
        "Révisions et interventions",
        "Services and interventions"
      ),
      icon: ShieldCheck,
    },
  ],

  health: [
    {
      id: "stocks",
      label: localized(
        "Stocks",
        "Stock"
      ),
      description: localized(
        "Niveaux bas et risques de rupture",
        "Low levels and stockout risk"
      ),
      icon: Package,
    },
    {
      id: "cold-chain",
      label: localized(
        "Chaîne du froid",
        "Cold chain"
      ),
      description: localized(
        "Température et conservation",
        "Temperature and preservation"
      ),
      icon: Snowflake,
    },
    {
      id: "temperature",
      label: localized(
        "Température",
        "Temperature"
      ),
      description: localized(
        "Surveillance des conditions de stockage",
        "Monitoring of storage conditions"
      ),
      icon: Thermometer,
    },
    {
      id: "expiry",
      label: localized(
        "Péremption",
        "Expiry"
      ),
      description: localized(
        "Produits proches de l'expiration",
        "Products close to their expiry date"
      ),
      icon: CalendarClock,
    },
    {
      id: "medications",
      label: localized(
        "Médicaments",
        "Medicines"
      ),
      description: localized(
        "Disponibilité et risque de rupture",
        "Availability and stockout risk"
      ),
      icon: HeartPulse,
    },
    {
      id: "storage",
      label: localized(
        "Stockage",
        "Storage"
      ),
      description: localized(
        "Conditions et capacité",
        "Conditions and capacity"
      ),
      icon: Warehouse,
    },
  ],

  agriculture: [
    {
      id: "crops",
      label: localized(
        "Récoltes",
        "Harvests"
      ),
      description: localized(
        "Pertes et risques de production",
        "Losses and production risk"
      ),
      icon: Wheat,
    },
    {
      id: "storage",
      label: localized(
        "Stockage",
        "Storage"
      ),
      description: localized(
        "Conditions et conservation",
        "Conditions and preservation"
      ),
      icon: Warehouse,
    },
    {
      id: "temperature",
      label: localized(
        "Température",
        "Temperature"
      ),
      description: localized(
        "Conditions de conservation",
        "Preservation conditions"
      ),
      icon: Thermometer,
    },
    {
      id: "transport",
      label: localized(
        "Transport",
        "Transport"
      ),
      description: localized(
        "Retards et livraisons",
        "Delays and deliveries"
      ),
      icon: Truck,
    },
    {
      id: "stocks",
      label: localized(
        "Stocks",
        "Stock"
      ),
      description: localized(
        "Disponibilité des produits",
        "Product availability"
      ),
      icon: Package,
    },
    {
      id: "irrigation",
      label: localized(
        "Irrigation",
        "Irrigation"
      ),
      description: localized(
        "Eau et fonctionnement des systèmes",
        "Water and system operation"
      ),
      icon: Droplets,
    },
  ],

  transportation: [
    {
      id: "vehicles",
      label: localized(
        "Véhicules",
        "Vehicles"
      ),
      description: localized(
        "État général de la flotte",
        "Overall fleet condition"
      ),
      icon: Truck,
    },
    {
      id: "engine",
      label: localized(
        "Moteurs",
        "Motors"
      ),
      description: localized(
        "Performance et anomalies",
        "Performance and anomalies"
      ),
      icon: Activity,
    },
    {
      id: "oil",
      label: localized(
        "Huile",
        "Oil"
      ),
      description: localized(
        "Niveaux et maintenance",
        "Levels and maintenance"
      ),
      icon: Droplets,
    },
    {
      id: "fuel",
      label: localized(
        "Carburant",
        "Fuel"
      ),
      description: localized(
        "Niveau et consommation",
        "Level and consumption"
      ),
      icon: Fuel,
    },
    {
      id: "tires",
      label: localized(
        "Pneus",
        "Tyres"
      ),
      description: localized(
        "Usure et pression",
        "Wear and pressure"
      ),
      icon: Gauge,
    },
    {
      id: "maintenance",
      label: localized(
        "Maintenance",
        "Maintenance"
      ),
      description: localized(
        "Révisions et interventions",
        "Services and interventions"
      ),
      icon: ShieldCheck,
    },
  ],

  logistics: [
    {
      id: "blockages",
      label: localized(
        "Éviter les blocages",
        "Avoid blockages"
      ),
      short: localized(
        "Blocages",
        "Blockages"
      ),
      description: localized(
        "Identifier les équipements, flux ou opérations actuellement bloqués",
        "Spot the equipment, flows or operations that are blocked right now"
      ),
      icon: PackageX,
    },
    {
      id: "wait",
      label: localized(
        "Réduire les temps d'attente",
        "Cut waiting times"
      ),
      short: localized(
        "Temps d'attente",
        "Waiting time"
      ),
      description: localized(
        "Surveiller les files d'attente et les temps d'immobilisation",
        "Watch the queues and the time things spend standing still"
      ),
      icon: Clock,
    },
    {
      id: "cost",
      label: localized(
        "Réduire les coûts imprévus",
        "Cut unplanned cost"
      ),
      short: localized(
        "Coûts",
        "Cost"
      ),
      description: localized(
        "Analyser les postes qui génèrent les coûts logistiques les plus importants",
        "See which items drive the largest logistics cost"
      ),
      icon: CircleDollarSign,
    },
    {
      id: "anticipate",
      label: localized(
        "Être alerté à temps",
        "Be warned in time"
      ),
      short: localized(
        "Anticipation",
        "Anticipation"
      ),
      description: localized(
        "Anticiper les risques et les perturbations à venir",
        "Anticipate the risks and disruptions that are coming"
      ),
      icon: Radar,
    },
    {
      id: "recommend",
      label: localized(
        "Obtenir des recommandations",
        "Get recommendations"
      ),
      short: localized(
        "Recommandations",
        "Recommendations"
      ),
      description: localized(
        "Les 5 alertes les plus urgentes, chacune avec une action concrète à mener en priorité",
        "The 5 most urgent alerts, each with one concrete action to take first"
      ),
      icon: Sparkles,
    },
    {
      id: "resources",
      label: localized(
        "Optimiser les ressources",
        "Make the most of resources"
      ),
      short: localized(
        "Ressources",
        "Resources"
      ),
      description: localized(
        "Identifier les équipements, équipes ou capacités qui risquent de devenir un point de blocage",
        "Spot the equipment, teams or capacity about to become a bottleneck"
      ),
      icon: Cog,
      comingSoon: true,
    },
  ],

  energy: [
    {
      id: "generators",
      label: localized(
        "Générateurs",
        "Generators"
      ),
      description: localized(
        "Performance et disponibilité",
        "Performance and availability"
      ),
      icon: Zap,
    },
    {
      id: "fuel",
      label: localized(
        "Carburant",
        "Fuel"
      ),
      description: localized(
        "Niveau et réapprovisionnement",
        "Level and refuelling"
      ),
      icon: Fuel,
    },
    {
      id: "temperature",
      label: localized(
        "Température",
        "Temperature"
      ),
      description: localized(
        "Surchauffe et conditions thermiques",
        "Overheating and thermal conditions"
      ),
      icon: Thermometer,
    },
    {
      id: "oil",
      label: localized(
        "Huile",
        "Oil"
      ),
      description: localized(
        "Niveau et maintenance",
        "Level and maintenance"
      ),
      icon: Droplets,
    },
    {
      id: "load",
      label: localized(
        "Charge",
        "Load"
      ),
      description: localized(
        "Surcharge et capacité",
        "Overload and capacity"
      ),
      icon: BatteryCharging,
    },
    {
      id: "sensors",
      label: localized(
        "Capteurs",
        "Sensors"
      ),
      description: localized(
        "Données et connectivité",
        "Data and connectivity"
      ),
      icon: Radio,
    },
  ],

  commerce: [
    {
      id: "stocks",
      label: localized(
        "Stocks",
        "Stock"
      ),
      description: localized(
        "Niveaux bas et risques de rupture",
        "Low levels and stockout risk"
      ),
      icon: Package,
    },
    {
      id: "shelf-availability",
      label: localized(
        "Disponibilité en rayon",
        "On-shelf availability"
      ),
      description: localized(
        "Ruptures visibles côté client",
        "Gaps the customer can see"
      ),
      icon: Boxes,
    },
    {
      id: "expiry",
      label: localized(
        "Péremption",
        "Expiry"
      ),
      description: localized(
        "Produits proches de la date limite",
        "Products close to their use-by date"
      ),
      icon: CalendarClock,
    },
    {
      id: "cold-chain",
      label: localized(
        "Chaîne du froid",
        "Cold chain"
      ),
      description: localized(
        "Température des produits frais et surgelés",
        "Temperature of chilled and frozen goods"
      ),
      icon: Snowflake,
    },
    {
      id: "replenishment",
      label: localized(
        "Réapprovisionnement",
        "Replenishment"
      ),
      description: localized(
        "Délais et anticipation des commandes",
        "Lead times and order planning"
      ),
      icon: Truck,
    },
    {
      id: "storage",
      label: localized(
        "Stockage / entrepôt",
        "Storage / warehouse"
      ),
      description: localized(
        "Capacité et conditions de conservation",
        "Capacity and preservation conditions"
      ),
      icon: Warehouse,
    },
  ],
}

export function prioritiesFor(sector: Sector | string | null | undefined) {
  if (!sector) return []

  return PRIORITIES_BY_SECTOR[sector as Sector] ?? []
}

export function priorityMeta(
  sector: Sector | string | null | undefined,
  id: string
): Priority | undefined {
  return prioritiesFor(sector).find((item) => item.id === id)
}

/** Short name, for nav chips and cards. Falls back to the id so an
 *  unknown priority saved by an older build still renders as something. */
export function priorityLabel(
  sector: Sector | string | null | undefined,
  id: string,
  tx: Tx
): string {
  const meta = priorityMeta(sector, id)

  if (!meta) return id

  const name = meta.short ?? meta.label

  return tx(name.fr, name.en)
}

/** Goal-phrased name, as worded in onboarding. Used on the overview
 *  cards so the dashboard echoes the wording the user chose. */
export function priorityGoal(
  sector: Sector | string | null | undefined,
  id: string,
  tx: Tx
): string {
  const label = priorityMeta(sector, id)?.label

  return label ? tx(label.fr, label.en) : id
}

export function priorityDescription(
  sector: Sector | string | null | undefined,
  id: string,
  tx: Tx
): string {
  const text = priorityMeta(sector, id)?.description

  return text ? tx(text.fr, text.en) : ""
}

/** Order stored ids the way the catalog lists them, and drop anything
 *  the catalog no longer knows about. */
export function orderPriorities(
  sector: Sector | string | null | undefined,
  ids: string[]
): string[] {
  const known = prioritiesFor(sector).map((item) => item.id)

  return known.filter((id) => ids.includes(id))
}
