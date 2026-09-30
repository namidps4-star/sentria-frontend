import {
  Activity,
  ArrowLeftRight,
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
  TrendingDown,
  Truck,
  Warehouse,
  Zap,
} from "@/lib/icons"

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

/** Cards only some activities offer. Kept out of PRIORITIES_BY_SECTOR so
 *  an account without an activity never sees them. */
const ACTIVITY_ONLY_PRIORITIES: Partial<Record<Sector, Priority[]>> = {
  industry: [
    {
      id: "hygiene-lead-time",
      label: localized(
        "Anticiper un arrêt sanitaire",
        "See a hygiene shutdown coming"
      ),
      description: localized(
        "Température bloquée près de la limite",
        "Temperature stuck near the limit"
      ),
      icon: ShieldCheck,
    },
    {
      id: "maintenance-production-link",
      label: localized(
        "Entretien et production",
        "Maintenance and output"
      ),
      description: localized(
        "Entretien en retard qui freine la production",
        "Overdue maintenance cutting output"
      ),
      icon: Cog,
    },
    {
      id: "failure-signature",
      label: localized(
        "Pannes récurrentes",
        "Recurring faults"
      ),
      description: localized(
        "Machines qui alertent encore et encore",
        "Machines that keep raising alerts"
      ),
      icon: Radar,
    },
  ],
  agriculture: [
    {
      id: "network-rebalancing",
      label: localized(
        "Rééquilibrage entre membres",
        "Rebalancing between members"
      ),
      description: localized(
        "Confier un lot à risque à un autre membre",
        "Give at-risk lots to a member with transport"
      ),
      icon: ArrowLeftRight,
    },
  ],
  energy: [
    {
      id: "output-drift",
      label: localized(
        "Dérive de production",
        "Output drift"
      ),
      description: localized(
        "Baisse de production sur plusieurs relevés",
        "Output loss that lasts over several readings"
      ),
      icon: TrendingDown,
    },
    {
      id: "rebalancing",
      label: localized(
        "Rééquilibrage entre sites",
        "Rebalancing between sites"
      ),
      description: localized(
        "Carburant transféré entre sites avant commande",
        "Move fuel between sites before ordering more"
      ),
      icon: ArrowLeftRight,
    },
  ],
}

/** Card lists for activities that do not offer the whole sector list, in
 *  display order. Ids come from PRIORITIES_BY_SECTOR or
 *  ACTIVITY_ONLY_PRIORITIES; an activity without an entry gets the
 *  sector list. */
const PRIORITY_IDS_BY_ACTIVITY: Record<string, string[]> = {
  "exploitation-agricole": ["storage", "temperature", "transport"],
  "cooperative-agricole": ["network-rebalancing", "transport"],
  "silo-stockage": ["storage", "temperature"],
  // Industry lists follow the columns each activity is asked for
  // (onboarding CSV_COLUMNS): rpm is supplied to the production plant and
  // the workshop, so motors stay there; nobody supplies pressure.
  "usine-agroalimentaire": ["temperature", "hygiene-lead-time", "production"],
  "usine-production": ["machines", "motors", "production", "maintenance-production-link"],
  "atelier-soustraitance": ["machines", "motors", "failure-signature", "maintenance"],
  "centrale-production": ["generators", "output-drift", "sensors", "load"],
  "distribution-energetique": ["generators", "rebalancing", "load"],
}

/** The activity's feature cards (activity-only ones). Always shown on the
 *  dashboard, even when the saved onboarding selection predates them:
 *  otherwise an existing account never sees a new feature. */
export function featurePriorityIds(
  sector: Sector | string | null | undefined,
  businessType?: string | null
): string[] {
  if (!sector || !businessType) return []

  const ids = PRIORITY_IDS_BY_ACTIVITY[businessType] ?? []
  const featureIds = new Set(
    (ACTIVITY_ONLY_PRIORITIES[sector as Sector] ?? []).map((item) => item.id)
  )

  return ids.filter((id) => featureIds.has(id))
}

function catalogFor(sector: Sector | string): Priority[] {
  return [
    ...(PRIORITIES_BY_SECTOR[sector as Sector] ?? []),
    ...(ACTIVITY_ONLY_PRIORITIES[sector as Sector] ?? []),
  ]
}

export function prioritiesFor(
  sector: Sector | string | null | undefined,
  businessType?: string | null
): Priority[] {
  if (!sector) return []

  const ids = businessType ? PRIORITY_IDS_BY_ACTIVITY[businessType] : undefined

  if (!ids) return PRIORITIES_BY_SECTOR[sector as Sector] ?? []

  const catalog = catalogFor(sector)

  return ids
    .map((id) => catalog.find((item) => item.id === id))
    .filter((item): item is Priority => item !== undefined)
}

export function priorityMeta(
  sector: Sector | string | null | undefined,
  id: string
): Priority | undefined {
  if (!sector) return undefined

  return catalogFor(sector).find((item) => item.id === id)
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
  ids: string[],
  businessType?: string | null
): string[] {
  const known = prioritiesFor(sector, businessType).map((item) => item.id)

  return known.filter((id) => ids.includes(id))
}

/** What sets each card apart from the others in its list, in one line.
 *  Shown under the card's description in onboarding, so two cards that
 *  sound alike ("Temperature", "Cold chain") are told apart before
 *  they're picked. Keyed "sector:id": the same id means different
 *  things in different sectors. */
const PRIORITY_EDGES: Record<string, Localized> = {
  "industry:machines": localized("Repère la machine dont l'usure ou les vibrations dépassent la limite, avant la panne.", "Flags the machine whose wear or vibration is past its limit, before it breaks down."),
  "industry:motors": localized("Suit la vitesse et le couple, pour repérer un moteur qui tourne anormalement.", "Follows speed and torque, to catch a motor running abnormally."),
  "industry:temperature": localized("Prévient quand un équipement chauffe plus que d'habitude.", "Warns when equipment runs hotter than usual."),
  "industry:pressure": localized("Prévient quand une pression sort de sa plage normale.", "Warns when a pressure leaves its normal range."),
  "industry:production": localized("Compare la production à l'attendu et pointe les arrêts.", "Compares output with what's expected and points to stoppages."),
  "industry:maintenance": localized("Tient l'entretien à jour et signale ce qui est en retard.", "Keeps servicing on schedule and flags what is overdue."),
  "industry:hygiene-lead-time": localized("Prévient tant que la température frôle la limite, avant un arrêt d'hygiène.", "Warns while a temperature sits near the limit, before a hygiene stop."),
  "industry:maintenance-production-link": localized("Relie l'entretien en retard à la production perdue.", "Links overdue maintenance to the output it costs."),
  "industry:failure-signature": localized("Trouve les machines qui tombent en panne de la même façon, encore et encore.", "Finds the machines that keep failing the same way."),

  "health:stocks": localized("Compte les jours de stock restants, d'après votre consommation.", "Counts the days of stock left, from what you use each day."),
  "health:cold-chain": localized("Surveille frigos et chambres froides : produits sensibles au froid.", "Watches fridges and cold rooms: products that need the cold."),
  "health:temperature": localized("Surveille les locaux de stockage, où la chaleur abîme les produits.", "Watches storage rooms, where heat spoils products."),
  "health:expiry": localized("Liste ce qui périme bientôt, pour l'écouler ou le retourner d'abord.", "Lists what expires soon, to use or return it first."),
  "health:medications": localized("Se concentre sur les médicaments dont vous ne pouvez pas manquer.", "Focuses on the medicines you can't run out of."),
  "health:storage": localized("Surveille la place et les conditions de stockage.", "Watches storage space and conditions."),

  "agriculture:storage": localized("Surveille silos et magasins : humidité, chaleur et pertes.", "Watches silos and stores: damp, heat and losses."),
  "agriculture:temperature": localized("Suit la température qui protège les récoltes.", "Follows the temperature that keeps harvests safe."),
  "agriculture:transport": localized("Signale les enlèvements et livraisons en retard.", "Flags late pick-ups and deliveries."),
  "agriculture:stocks": localized("Suit ce qui est en stock, des semences aux récoltes.", "Tracks what's in stock, from seed to harvest."),
  "agriculture:network-rebalancing": localized("Propose quel membre peut prendre les lots à risque.", "Suggests which member can take the lots at risk."),

  "transportation:vehicles": localized("Une vue de chaque véhicule, pour voir lequel demande de l'attention.", "One view of every vehicle, to see which one needs attention."),
  "transportation:engine": localized("Repère les relevés moteur qui annoncent une panne.", "Catches engine readings that point to a breakdown."),
  "transportation:oil": localized("Signale les niveaux bas et les vidanges dues.", "Flags low levels and oil changes due."),
  "transportation:fuel": localized("Repère les consommations anormales et les réservoirs bas.", "Spots abnormal fuel use and low tanks."),
  "transportation:tires": localized("Signale les pneus usés ou sous-gonflés.", "Flags worn or under-inflated tyres."),
  "transportation:maintenance": localized("Tient l'entretien à jour et signale ce qui est en retard.", "Keeps servicing on schedule and flags what is overdue."),

  "logistics:blockages": localized("Ce qui est bloqué maintenant : un conteneur, un camion, un quai.", "What is stuck right now: a container, a truck, a dock."),
  "logistics:wait": localized("Mesure combien de temps les choses restent immobiles, et où.", "Measures how long things stand still, and where."),
  "logistics:cost": localized("Montre les postes qui coûtent le plus, pour couper là où ça compte.", "Shows what costs the most, so you cut where it counts."),
  "logistics:anticipate": localized("Regarde devant : prévient avant le retard, pas après.", "Looks ahead: warns before a delay, not after."),
  "logistics:recommend": localized("Trie tout en 5 actions à mener en premier.", "Sorts everything into 5 actions to take first."),
  "logistics:resources": localized("Repère l'équipe, l'engin ou la place qui va manquer.", "Spots the team, equipment or space about to run short."),

  "energy:generators": localized("Vérifie que chaque groupe est disponible et rend ce qu'il doit.", "Checks each generator is available and performing."),
  "energy:fuel": localized("Dit quand ravitailler, avant qu'un site ne tombe à sec.", "Tells you when to refuel, before a site runs dry."),
  "energy:temperature": localized("Prévient quand un équipement chauffe trop.", "Warns when equipment runs too hot."),
  "energy:oil": localized("Signale les niveaux bas et les vidanges dues.", "Flags low levels and oil changes due."),
  "energy:load": localized("Prévient quand la demande approche de ce que l'installation supporte.", "Warns when demand nears what the equipment can carry."),
  "energy:sensors": localized("Repère les capteurs muets ou aux valeurs incohérentes.", "Spots sensors that go silent or send odd values."),
  "energy:output-drift": localized("Ne compte que les pertes qui durent, pas un relevé isolé.", "Only counts losses that last, not one bad reading."),
  "energy:rebalancing": localized("Propose de déplacer du carburant entre sites avant d'en racheter.", "Suggests moving fuel between sites before buying more."),

  "commerce:stocks": localized("Compte les jours de stock restants, produit par produit.", "Counts the days of stock left, product by product."),
  "commerce:shelf-availability": localized("Côté rayon : ce qui manque là où le client regarde.", "On the shelf: what's missing where customers look."),
  "commerce:expiry": localized("Liste ce qui atteint sa date limite bientôt, à vendre ou retirer d'abord.", "Lists what reaches its use-by date soon, to sell or pull first."),
  "commerce:cold-chain": localized("Surveille frigos et congélateurs du frais et du surgelé.", "Watches the fridges and freezers of chilled and frozen goods."),
  "commerce:replenishment": localized("Dit quand commander, d'après le délai de votre fournisseur.", "Tells you when to order, from your supplier's lead time."),
  "commerce:storage": localized("Surveille la place et les conditions en réserve.", "Watches back-room space and conditions."),
}

/** What sets this card apart from the others ("" when none is written). */
export function priorityEdge(
  sector: Sector | string | null | undefined,
  id: string,
  tx: Tx
): string {
  const text = sector ? PRIORITY_EDGES[`${sector}:${id}`] : undefined

  return text ? tx(text.fr, text.en) : ""
}
