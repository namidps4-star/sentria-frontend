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

export type Sector =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"
  | "commerce"

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
  label: string
  /** Short name for nav chips and cards, when `label` is a full sentence. */
  short?: string
  description: string
  icon: React.ElementType
  comingSoon?: boolean
}

export const PRIORITIES_BY_SECTOR: Record<Sector, Priority[]> = {
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
      short: "Blocages",
      description:
        "Identifier les équipements, flux ou opérations actuellement bloqués",
      icon: PackageX,
    },
    {
      id: "wait",
      label: "Réduire les temps d'attente",
      short: "Temps d'attente",
      description:
        "Surveiller les files d'attente et les temps d'immobilisation",
      icon: Clock,
    },
    {
      id: "cost",
      label: "Réduire les coûts imprévus",
      short: "Coûts",
      description:
        "Analyser les postes qui génèrent les coûts logistiques les plus importants",
      icon: CircleDollarSign,
    },
    {
      id: "anticipate",
      label: "Être alerté à temps",
      short: "Anticipation",
      description:
        "Anticiper les risques et les perturbations à venir",
      icon: Radar,
    },
    {
      id: "recommend",
      label: "Obtenir des recommandations",
      short: "Recommandations",
      description:
        "Les 5 alertes les plus urgentes, chacune avec une action concrète à mener en priorité",
      icon: Sparkles,
    },
    {
      id: "resources",
      label: "Optimiser les ressources",
      short: "Ressources",
      description:
        "Identifier les équipements, équipes ou capacités qui risquent de devenir un point de blocage",
      icon: Cog,
      comingSoon: true,
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

  commerce: [
    {
      id: "stocks",
      label: "Stocks",
      description: "Niveaux bas et risques de rupture",
      icon: Package,
    },
    {
      id: "shelf-availability",
      label: "Disponibilité en rayon",
      description: "Ruptures visibles côté client",
      icon: Boxes,
    },
    {
      id: "expiry",
      label: "Péremption",
      description: "Produits proches de la date limite",
      icon: CalendarClock,
    },
    {
      id: "cold-chain",
      label: "Chaîne du froid",
      description: "Température des produits frais et surgelés",
      icon: Snowflake,
    },
    {
      id: "replenishment",
      label: "Réapprovisionnement",
      description: "Délais et anticipation des commandes",
      icon: Truck,
    },
    {
      id: "storage",
      label: "Stockage / entrepôt",
      description: "Capacité et conditions de conservation",
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
  id: string
): string {
  const meta = priorityMeta(sector, id)

  return meta ? (meta.short ?? meta.label) : id
}

/** Goal-phrased name, as worded in onboarding. Used on the overview
 *  cards so the dashboard echoes the wording the user chose. */
export function priorityGoal(
  sector: Sector | string | null | undefined,
  id: string
): string {
  return priorityMeta(sector, id)?.label ?? id
}

export function priorityDescription(
  sector: Sector | string | null | undefined,
  id: string
): string {
  return priorityMeta(sector, id)?.description ?? ""
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
