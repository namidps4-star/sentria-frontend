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

/** One activity inside a sector: what the user picks at step 2 of
 *  onboarding, and what the import panel now lets them confirm per file.
 *
 *  This catalog used to live only inside the onboarding modal, which is
 *  why the import panel had no way to show the activity it was about to
 *  send and the user had to set localStorage by hand to change it. */
export type Activity = {
  id: string
  label: string
  description: string
  icon: React.ElementType
  maturity?: "Pilote recommandé" | "Accès anticipé"
}

export const ACTIVITIES_BY_SECTOR: Record<Sector, Activity[]> = {
  industry: [
    {
      id: "usine-production",
      label: "Usine de production",
      description: "Lignes de fabrication et machines critiques",
      icon: Factory,
    },
    {
      id: "atelier-soustraitance",
      label: "Atelier / sous-traitance",
      description: "Production pour le compte de tiers",
      icon: Cog,
    },
    {
      id: "usine-agroalimentaire",
      label: "Usine agroalimentaire",
      description: "Production avec contraintes sanitaires",
      icon: Boxes,
    },
  ],

  health: [
    {
      id: "pharmacie",
      label: "Pharmacie",
      description: "Officine et vente au détail de médicaments",
      icon: HeartPulse,
      maturity: "Pilote recommandé",
    },
    {
      id: "grossiste-pharma",
      label: "Grossiste-répartiteur pharmaceutique",
      description: "Distribution en gros de produits de santé",
      icon: Warehouse,
      maturity: "Accès anticipé",
    },
    {
      id: "clinique-hopital",
      label: "Clinique / Hôpital",
      description: "Établissement de soins et stocks cliniques",
      icon: Building2,
      maturity: "Accès anticipé",
    },
    {
      id: "laboratoire",
      label: "Laboratoire",
      description: "Analyses, réactifs et échantillons",
      icon: Activity,
      maturity: "Accès anticipé",
    },
  ],

  agriculture: [
    {
      id: "exploitation-agricole",
      label: "Exploitation agricole",
      description: "Production, culture et élevage",
      icon: Wheat,
    },
    {
      id: "cooperative-agricole",
      label: "Coopérative agricole",
      description: "Mutualisation entre plusieurs producteurs",
      icon: Building2,
    },
    {
      id: "silo-stockage",
      label: "Silo / stockage de récolte",
      description: "Conservation avant transformation ou vente",
      icon: Warehouse,
    },
  ],

  transportation: [
    {
      id: "transporteur-routier",
      label: "Transporteur routier",
      description: "Transport pour compte d'autrui",
      icon: Truck,
    },
    {
      id: "flotte-entreprise",
      label: "Flotte d'entreprise",
      description: "Véhicules utilisés pour votre propre activité",
      icon: Truck,
    },
    {
      id: "location-vehicules",
      label: "Location de véhicules",
      description: "Parc mis à disposition de clients",
      icon: Gauge,
    },
  ],

  logistics: [
    {
      id: "port-conteneurs",
      label: "Port & conteneurs",
      description: "Opérations portuaires et manutention de conteneurs",
      icon: Anchor,
    },
    {
      id: "entrepot-manutention",
      label: "Entrepôt & manutention",
      description: "Stockage et mouvements de marchandises",
      icon: Warehouse,
    },
    {
      id: "transport-distribution",
      label: "Transport & distribution",
      description: "Acheminement vers plusieurs points de livraison",
      icon: Truck,
    },
    {
      id: "preparation-expedition",
      label: "Préparation & expédition",
      description: "Traitement et envoi des commandes",
      icon: PackageSearch,
    },
    {
      id: "chaine-froid",
      label: "Chaîne du froid",
      description: "Logistique sous température dirigée",
      icon: Snowflake,
    },
    {
      id: "plusieurs-activites",
      label: "Plusieurs activités",
      description: "Une combinaison de ces opérations",
      icon: Recycle,
    },
  ],

  energy: [
    {
      id: "centrale-production",
      label: "Centrale de production",
      description: "Production d'énergie à grande échelle",
      icon: Zap,
    },
    {
      id: "generateurs-secours",
      label: "Générateurs de secours",
      description: "Alimentation de secours et continuité",
      icon: BatteryCharging,
    },
    {
      id: "distribution-energetique",
      label: "Distribution énergétique",
      description: "Réseau et acheminement de l'énergie",
      icon: Radio,
    },
  ],

  commerce: [
    {
      id: "grossiste-distributeur",
      label: "Grossiste / distributeur",
      description: "Vente en gros à d'autres commerces",
      icon: Warehouse,
    },
    {
      id: "supermarche-hypermarche",
      label: "Supermarché / hypermarché",
      description: "Grande surface avec rayons multiples",
      icon: Store,
    },
    {
      id: "chaine-magasins",
      label: "Chaîne de magasins",
      description: "Plusieurs points de vente à surveiller",
      icon: Store,
    },
    {
      id: "epicerie-proximite",
      label: "Épicerie / commerce de proximité",
      description: "Commerce local à taille humaine",
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
  id: string | null | undefined
): string | undefined {
  if (!id) return undefined

  return activitiesFor(sector).find((a) => a.id === id)?.label
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
