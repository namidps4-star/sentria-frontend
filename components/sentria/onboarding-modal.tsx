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
  Thermometer,
  Package,
  PackageX,
  Gauge,
  Cog,
  Droplets,
  Fuel,
  Warehouse,
  BatteryCharging,
  Activity,
  Boxes,
  Snowflake,
  CalendarClock,
  Radio,
  ShieldCheck,
  Database,
  Upload,
  Wifi,
  Clock3,
  CircleDollarSign,
  Radar,
  Sparkles,
  Anchor,
  PackageSearch,
  Recycle,
  Store,
  ShoppingCart,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Sector =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"
  | "commerce"

type Equipment = {
  id: string
  label: string
  description: string
  icon: React.ElementType
  comingSoon?: boolean
}

type SectorConfig = {
  id: Sector
  label: string
  description: string
  icon: React.ElementType
}

type SubType = {
  id: string
  label: string
  description: string
  icon: React.ElementType
}

type DataSource = {
  id: "erp" | "iot" | "csv"
  label: string
  description: string
  detail: string
  icon: React.ElementType
}

const SECTORS: SectorConfig[] = [
  {
    id: "industry",
    label: "Industrie",
    description: "Machines, production et maintenance",
    icon: Factory,
  },
  {
    id: "health",
    label: "Santé",
    description: "Stocks, chaîne du froid et produits",
    icon: HeartPulse,
  },
  {
    id: "agriculture",
    label: "Agriculture",
    description: "Récoltes, stockage et transport",
    icon: Wheat,
  },
  {
    id: "transportation",
    label: "Transport",
    description: "Flotte, moteurs et maintenance",
    icon: Truck,
  },
  {
    id: "logistics",
    label: "Logistique",
    description: "Port, équipements et flux",
    icon: Ship,
  },
  {
    id: "energy",
    label: "Énergie",
    description: "Générateurs, carburant et température",
    icon: Zap,
  },
  {
    id: "commerce",
    label: "Commerce",
    description: "Stocks, rayons et approvisionnement",
    icon: Store,
  },
]

const SUBTYPES_BY_SECTOR: Record<Sector, SubType[]> = {
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
    },
    {
      id: "grossiste-pharma",
      label: "Grossiste-répartiteur pharmaceutique",
      description: "Distribution en gros de produits de santé",
      icon: Warehouse,
    },
    {
      id: "clinique-hopital",
      label: "Clinique / Hôpital",
      description: "Établissement de soins et stocks cliniques",
      icon: Building2,
    },
    {
      id: "laboratoire",
      label: "Laboratoire",
      description: "Analyses, réactifs et échantillons",
      icon: Activity,
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

const EQUIPMENT_BY_SECTOR: Record<Sector, Equipment[]> = {
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
      description:
        "Identifier les opérations susceptibles de se retrouver bloquées avant qu'elles ne perturbent le flux",
      icon: PackageX,
    },
    {
      id: "wait",
      label: "Réduire les temps d'attente",
      description:
        "Détecter les files, retards et goulots d'étranglement qui ralentissent vos opérations",
      icon: Clock3,
    },
    {
      id: "cost",
      label: "Réduire les coûts imprévus",
      description:
        "Identifier les situations pouvant entraîner surcoûts, immobilisations ou pénalités",
      icon: CircleDollarSign,
    },
    {
      id: "anticipate",
      label: "Être alerté à temps",
      description:
        "Être prévenu dès qu'un seuil critique est franchi, avant que l'incident ne s'aggrave",
      icon: Radar,
    },
    {
      id: "recommend",
      label: "Obtenir des recommandations",
      description:
        "Les 5 alertes les plus urgentes, chacune avec une action concrète à mener en priorité",
      icon: Sparkles,
    },
    {
      id: "resources",
      label: "Optimiser les ressources",
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
      icon: PackageX,
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
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<
    DataSource["id"][]
  >([])
  const [configureLater, setConfigureLater] = useState(false)

  const equipment = useMemo(
    () => (sector ? EQUIPMENT_BY_SECTOR[sector] : []),
    [sector]
  )

  const subTypes = useMemo(
    () => (sector ? SUBTYPES_BY_SECTOR[sector] : []),
    [sector]
  )

  const selectedSector = useMemo(
    () => SECTORS.find((item) => item.id === sector),
    [sector]
  )

  const isLogistics = sector === "logistics"
  const subTypeStepNumber = 2
  const equipmentStepNumber = 3
  const sourcesStepNumber = 4
  const totalSteps = 4

  const STEP_META = [
    {
      title: "Votre secteur",
      description: "Choisissez le secteur que SentrIA doit surveiller.",
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
      description: "Sélectionnez ce qui compte pour votre activité.",
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

      if (isLogistics && subType) {
        localStorage.setItem("sentria_ops_type", subType)
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
              configurer vos secteurs et commencer à détecter les
              situations critiques.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Configuration</p>

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

        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            "md:grid-cols-4"
          )}
        >
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

        <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="flex flex-col gap-8">
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
                        "flex w-[calc(50%-6px)] flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all sm:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)]",
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

            {step === subTypeStepNumber && sector && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {selectedSector?.label}
                  </div>

                  <p className="text-xs leading-5 text-muted-foreground">
                    Cette précision adapte les seuils d&apos;alerte à
                    votre métier
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
                            active ? "bg-background/15" : "bg-muted"
                          )}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">
                              {item.label}
                            </span>

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
              </div>
            )}

            {step === equipmentStepNumber && sector && (
              <div>
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {selectedSector?.label}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {equipment.map((item) => {
                    const Icon = item.icon
                    const active = selectedEquipment.includes(
                      item.id
                    )
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

            {step === sourcesStepNumber && (
              <div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {DATA_SOURCES.map((source) => {
                    const Icon = source.icon
                    const active = selectedSources.includes(
                      source.id
                    )

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