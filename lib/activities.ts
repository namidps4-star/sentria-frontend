import {
  Activity,
  Anchor,
  BatteryCharging,
  Boxes,
  Building2,
  Cog,
  Factory,
  Gauge,
  HeartPulse,
  PackageSearch,
  Radio,
  Recycle,
  ShoppingCart,
  Snowflake,
  Store,
  Truck,
  Warehouse,
  Wheat,
  Zap,
} from "lucide-react"
import type { OpsType } from "@/lib/logistics-signals"
import type { Sector } from "@/lib/priorities"
import { localized, type Localized, type Tx } from "@/lib/i18n"

/** One activity inside a sector: what the user picks at step 2 of
 *  onboarding, and what the import panel now lets them confirm per file.
 *
 *  This catalog used to live only inside the onboarding modal, which is
 *  why the import panel had no way to show the activity it was about to
 *  send and the user had to set localStorage by hand to change it. */
export type Activity = {
  id: string
  label: Localized
  description: Localized
  icon: React.ElementType
  /* A key, not the badge text: the French words used to be the value AND
     the thing every comparison was written against, so translating the
     badge would have broken the comparison. */
  maturity?: "pilot" | "early"
}

/** The badge wording for a maturity key. */
export function activityMaturityLabel(
  maturity: "pilot" | "early",
  tx: Tx
): string {
  return maturity === "pilot"
    ? tx("Pilote recommandé", "Recommended pilot")
    : tx("Accès anticipé", "Early access")
}

export const ACTIVITIES_BY_SECTOR: Record<Sector, Activity[]> = {
  industry: [
    {
      id: "usine-production",
      label: localized(
        "Usine de production",
        "Production plant"
      ),
      description: localized(
        "Lignes de fabrication et machines critiques",
        "Production lines and critical machines"
      ),
      icon: Factory,
    },
    {
      id: "atelier-soustraitance",
      label: localized(
        "Atelier / sous-traitance",
        "Workshop / subcontracting"
      ),
      description: localized(
        "Production pour le compte de tiers",
        "Production on behalf of others"
      ),
      icon: Cog,
    },
    {
      id: "usine-agroalimentaire",
      label: localized(
        "Usine agroalimentaire",
        "Food processing plant"
      ),
      description: localized(
        "Production avec contraintes sanitaires",
        "Production under hygiene constraints"
      ),
      icon: Boxes,
    },
  ],

  health: [
    {
      id: "pharmacie",
      label: localized(
        "Pharmacie",
        "Pharmacy"
      ),
      description: localized(
        "Officine et vente au détail de médicaments",
        "Dispensary and retail sale of medicines"
      ),
      icon: HeartPulse,
      maturity: "pilot",
    },
    {
      id: "grossiste-pharma",
      label: localized(
        "Grossiste-répartiteur pharmaceutique",
        "Pharmaceutical wholesaler"
      ),
      description: localized(
        "Distribution en gros de produits de santé",
        "Wholesale distribution of health products"
      ),
      icon: Warehouse,
      maturity: "early",
    },
    {
      id: "clinique-hopital",
      label: localized(
        "Clinique / Hôpital",
        "Clinic / Hospital"
      ),
      description: localized(
        "Établissement de soins et stocks cliniques",
        "Care facility and clinical stock"
      ),
      icon: Building2,
      maturity: "early",
    },
    {
      id: "laboratoire",
      label: localized(
        "Laboratoire",
        "Laboratory"
      ),
      description: localized(
        "Analyses, réactifs et échantillons",
        "Tests, reagents and samples"
      ),
      icon: Activity,
      maturity: "early",
    },
  ],

  agriculture: [
    {
      id: "exploitation-agricole",
      label: localized(
        "Exploitation agricole",
        "Farm"
      ),
      description: localized(
        "Production, culture et élevage",
        "Production, crops and livestock"
      ),
      icon: Wheat,
    },
    {
      id: "cooperative-agricole",
      label: localized(
        "Coopérative agricole",
        "Agricultural cooperative"
      ),
      description: localized(
        "Mutualisation entre plusieurs producteurs",
        "Shared operations between several growers"
      ),
      icon: Building2,
    },
    {
      id: "silo-stockage",
      label: localized(
        "Silo / stockage de récolte",
        "Silo / harvest storage"
      ),
      description: localized(
        "Conservation avant transformation ou vente",
        "Keeping the crop before processing or sale"
      ),
      icon: Warehouse,
    },
  ],

  transportation: [
    {
      id: "transporteur-routier",
      label: localized(
        "Transporteur routier",
        "Road haulier"
      ),
      description: localized(
        "Transport pour compte d'autrui",
        "Haulage for third parties"
      ),
      icon: Truck,
    },
    {
      id: "flotte-entreprise",
      label: localized(
        "Flotte d'entreprise",
        "Company fleet"
      ),
      description: localized(
        "Véhicules utilisés pour votre propre activité",
        "Vehicles used for your own operation"
      ),
      icon: Truck,
    },
    {
      id: "location-vehicules",
      label: localized(
        "Location de véhicules",
        "Vehicle rental"
      ),
      description: localized(
        "Parc mis à disposition de clients",
        "A fleet made available to customers"
      ),
      icon: Gauge,
    },
  ],

  logistics: [
    {
      id: "port-conteneurs",
      label: localized(
        "Port & conteneurs",
        "Port & containers"
      ),
      description: localized(
        "Opérations portuaires et manutention de conteneurs",
        "Port operations and container handling"
      ),
      icon: Anchor,
    },
    {
      id: "entrepot-manutention",
      label: localized(
        "Entrepôt & manutention",
        "Warehouse & handling"
      ),
      description: localized(
        "Stockage et mouvements de marchandises",
        "Storage and movement of goods"
      ),
      icon: Warehouse,
    },
    {
      id: "transport-distribution",
      label: localized(
        "Transport & distribution",
        "Transport & distribution"
      ),
      description: localized(
        "Acheminement vers plusieurs points de livraison",
        "Delivery to several drop points"
      ),
      icon: Truck,
    },
    {
      id: "preparation-expedition",
      label: localized(
        "Préparation & expédition",
        "Picking & dispatch"
      ),
      description: localized(
        "Traitement et envoi des commandes",
        "Processing and sending orders"
      ),
      icon: PackageSearch,
    },
    {
      id: "chaine-froid",
      label: localized(
        "Chaîne du froid",
        "Cold chain"
      ),
      description: localized(
        "Logistique sous température dirigée",
        "Temperature-controlled logistics"
      ),
      icon: Snowflake,
    },
    {
      id: "plusieurs-activites",
      label: localized(
        "Plusieurs activités",
        "Several activities"
      ),
      description: localized(
        "Une combinaison de ces opérations",
        "A combination of these operations"
      ),
      icon: Recycle,
    },
  ],

  energy: [
    {
      id: "centrale-production",
      label: localized(
        "Centrale de production",
        "Power plant"
      ),
      description: localized(
        "Production d'énergie à grande échelle",
        "Large-scale power generation"
      ),
      icon: Zap,
    },
    {
      id: "generateurs-secours",
      label: localized(
        "Générateurs de secours",
        "Backup generators"
      ),
      description: localized(
        "Alimentation de secours et continuité",
        "Standby power and continuity"
      ),
      icon: BatteryCharging,
    },
    {
      id: "distribution-energetique",
      label: localized(
        "Distribution énergétique",
        "Power distribution"
      ),
      description: localized(
        "Réseau et acheminement de l'énergie",
        "The grid and how power gets there"
      ),
      icon: Radio,
    },
  ],

  commerce: [
    {
      id: "grossiste-distributeur",
      label: localized(
        "Grossiste / distributeur",
        "Wholesaler / distributor"
      ),
      description: localized(
        "Vente en gros à d'autres commerces",
        "Wholesale to other businesses"
      ),
      icon: Warehouse,
    },
    {
      id: "supermarche-hypermarche",
      label: localized(
        "Supermarché / hypermarché",
        "Supermarket / hypermarket"
      ),
      description: localized(
        "Grande surface avec rayons multiples",
        "A large store with many aisles"
      ),
      icon: Store,
    },
    {
      id: "chaine-magasins",
      label: localized(
        "Chaîne de magasins",
        "Retail chain"
      ),
      description: localized(
        "Plusieurs points de vente à surveiller",
        "Several outlets to keep an eye on"
      ),
      icon: Store,
    },
    {
      id: "epicerie-proximite",
      label: localized(
        "Épicerie / commerce de proximité",
        "Grocery / convenience store"
      ),
      description: localized(
        "Commerce local à taille humaine",
        "A small local shop"
      ),
      icon: ShoppingCart,
    },
  ],
}

export function activitiesFor(sector: string | null | undefined): Activity[] {
  if (!sector) return []

  return ACTIVITIES_BY_SECTOR[sector as Sector] ?? []
}

export function activityLabel(
  sector: string | null | undefined,
  id: string | null | undefined,
  tx: Tx
): string | undefined {
  if (!id) return undefined

  const label = activitiesFor(sector).find((a) => a.id === id)?.label

  return label ? tx(label.fr, label.en) : undefined
}

/* ------------------------------------------------------------------ */
/*  Logistics: onboarding ids vs the ops types the code speaks         */
/* ------------------------------------------------------------------ */

/** Onboarding writes its own subtype id into sentria_ops_type, so a user
 *  who picked "Port & conteneurs" stored "port-conteneurs". Every
 *  consumer compares against "port": the dashboard's chain lookup, and
 *  the backend's ops_type branch. The result was that a real onboarded
 *  port operator got neither the port chain nor the port checks, while
 *  anyone who set the value by hand did. One mapping, applied on read
 *  and on upload, so both spellings resolve. */
const OPS_TYPE_ALIASES: Record<string, OpsType> = {
  "port-conteneurs": "port",
  "entrepot-manutention": "entrepot",
  "transport-distribution": "transport",
  "preparation-expedition": "expedition",
  "chaine-froid": "froid",
  "plusieurs-activites": "multi",
  port: "port",
  entrepot: "entrepot",
  transport: "transport",
  expedition: "expedition",
  froid: "froid",
  multi: "multi",
}

export function normalizeOpsType(
  value: string | null | undefined
): OpsType | undefined {
  if (!value) return undefined

  return OPS_TYPE_ALIASES[value]
}

/* ------------------------------------------------------------------ */
/*  Logistics: the set of activities an operator actually runs         */
/* ------------------------------------------------------------------ */

/** A terminal that handles reefers runs port AND cold chain. A 3PL runs
 *  warehouse, transport and cold chain. The model only allowed one, with
 *  a "Plusieurs activités" option that composed the union of all five
 *  and watched twenty stages including ones the customer does not have.
 *  The set is stored here instead, and the chain is the union of exactly
 *  what they picked. */
export const OPS_TYPES_KEY = "sentria_ops_types"
export const OPS_TYPE_KEY = "sentria_ops_type"

export type SingleOpsType = Exclude<OpsType, "multi">

export const SINGLE_OPS_TYPES: SingleOpsType[] = [
  "port",
  "entrepot",
  "transport",
  "expedition",
  "froid",
]

function isSingleOpsType(value: unknown): value is SingleOpsType {
  return (
    typeof value === "string" &&
    (SINGLE_OPS_TYPES as string[]).includes(value)
  )
}

/** The activities this deployment runs, newest storage first.
 *
 *  Falls back to the single-value key so anyone onboarded before this
 *  keeps their configuration, including the old "multi", which meant
 *  "all of them" and is read that way. */
export function readOpsTypes(): SingleOpsType[] {
  if (typeof window === "undefined") return []

  try {
    const stored = JSON.parse(localStorage.getItem(OPS_TYPES_KEY) || "null")

    if (Array.isArray(stored)) {
      const valid = SINGLE_OPS_TYPES.filter((t) => stored.includes(t))

      if (valid.length > 0) return valid
    }
  } catch {
    /* fall through to the legacy key */
  }

  const legacy = normalizeOpsType(localStorage.getItem(OPS_TYPE_KEY))

  if (!legacy) return []

  if (legacy === "multi") return [...SINGLE_OPS_TYPES]

  return [legacy]
}

/** Store the set, and keep the single-value key in step so the upload
 *  parameter and anything still reading it stay correct: the one
 *  activity when there is one, "multi" when there are several. */
export function writeOpsTypes(types: SingleOpsType[]) {
  const valid = SINGLE_OPS_TYPES.filter((t) => types.includes(t))

  try {
    localStorage.setItem(OPS_TYPES_KEY, JSON.stringify(valid))

    if (valid.length === 1) {
      localStorage.setItem(OPS_TYPE_KEY, valid[0])
    } else if (valid.length > 1) {
      localStorage.setItem(OPS_TYPE_KEY, "multi")
    } else {
      localStorage.removeItem(OPS_TYPE_KEY)
    }
  } catch {
    /* A blocked localStorage must not break onboarding. */
  }

  return valid
}

/** What to pass as opsType given a set: the activity itself when there
 *  is one, "multi" when the chain is a union. */
export function opsTypeFor(types: SingleOpsType[]): OpsType | undefined {
  if (types.length === 0) return undefined

  return types.length === 1 ? types[0] : "multi"
}

export { isSingleOpsType }
