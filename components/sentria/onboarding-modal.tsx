"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Factory,
  HeartPulse,
  Wheat,
  Truck,
  Ship,
  Zap,
  Cpu,
  Thermometer,
  Package,
  Droplets,
  Gauge,
  Fuel,
  Battery,
  Settings2,
  Boxes,
  CircleGauge,
  Snowflake,
  Activity,
  Database,
  Upload,
  Wifi,
  PenLine,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

type SectorKey =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"

type EquipmentKey = string

type SourceKey = "csv" | "iot" | "manual" | "later"

type Equipment = {
  key: EquipmentKey
  label: string
  description: string
  icon: React.ElementType
}

type Sector = {
  key: SectorKey
  label: string
  description: string
  icon: React.ElementType
  equipment: Equipment[]
}

const SECTORS: Sector[] = [
  {
    key: "industry",
    label: "Industrie",
    description: "Machines, production et maintenance",
    icon: Factory,
    equipment: [
      {
        key: "machines",
        label: "Machines",
        description: "État et disponibilité des machines",
        icon: Settings2,
      },
      {
        key: "motors",
        label: "Moteurs",
        description: "Performance et anomalies moteur",
        icon: Cpu,
      },
      {
        key: "pumps",
        label: "Pompes",
        description: "Pression, débit et fonctionnement",
        icon: Droplets,
      },
      {
        key: "compressors",
        label: "Compresseurs",
        description: "Pression et performance",
        icon: Gauge,
      },
      {
        key: "production",
        label: "Lignes de production",
        description: "Arrêts et performances",
        icon: Activity,
      },
      {
        key: "temperature",
        label: "Température",
        description: "Surchauffe et conditions anormales",
        icon: Thermometer,
      },
    ],
  },

  {
    key: "health",
    label: "Santé",
    description: "Stocks, chaîne du froid et équipements",
    icon: HeartPulse,
    equipment: [
      {
        key: "stocks",
        label: "Stocks",
        description: "Niveaux, ruptures et réapprovisionnement",
        icon: Package,
      },
      {
        key: "temperature",
        label: "Température",
        description: "Chaîne du froid et conservation",
        icon: Snowflake,
      },
      {
        key: "expiry",
        label: "Expiration",
        description: "Lots et dates limites",
        icon: Boxes,
      },
      {
        key: "medical_equipment",
        label: "Équipements médicaux",
        description: "Disponibilité et maintenance",
        icon: HeartPulse,
      },
      {
        key: "cold_chain",
        label: "Chaîne du froid",
        description: "Transport et stockage sensibles",
        icon: Snowflake,
      },
    ],
  },

  {
    key: "agriculture",
    label: "Agriculture",
    description: "Cultures, stockage et équipements",
    icon: Wheat,
    equipment: [
      {
        key: "stocks",
        label: "Stocks",
        description: "Réserves et produits agricoles",
        icon: Package,
      },
      {
        key: "temperature",
        label: "Température",
        description: "Conditions de stockage",
        icon: Thermometer,
      },
      {
        key: "irrigation",
        label: "Irrigation",
        description: "Débit, pression et disponibilité",
        icon: Droplets,
      },
      {
        key: "equipment",
        label: "Équipements agricoles",
        description: "Machines et maintenance",
        icon: Settings2,
      },
      {
        key: "transport",
        label: "Transport",
        description: "Retards et acheminement",
        icon: Truck,
      },
    ],
  },

  {
    key: "transportation",
    label: "Transport",
    description: "Flottes, maintenance et mobilité",
    icon: Truck,
    equipment: [
      {
        key: "engine",
        label: "Moteur",
        description: "Performance et anomalies moteur",
        icon: Cpu,
      },
      {
        key: "oil",
        label: "Huile",
        description: "Niveaux et maintenance",
        icon: Droplets,
      },
      {
        key: "fuel",
        label: "Carburant",
        description: "Niveaux et consommation",
        icon: Fuel,
      },
      {
        key: "tires",
        label: "Pneus",
        description: "Pression et usure",
        icon: CircleGauge,
      },
      {
        key: "battery",
        label: "Batterie",
        description: "État et charge",
        icon: Battery,
      },
      {
        key: "maintenance",
        label: "Maintenance",
        description: "Révisions et interventions",
        icon: Settings2,
      },
    ],
  },

  {
    key: "logistics",
    label: "Logistique",
    description: "Flux, conteneurs et équipements",
    icon: Ship,
    equipment: [
      {
        key: "containers",
        label: "Conteneurs",
        description: "État, mouvements et disponibilité",
        icon: Boxes,
      },
      {
        key: "temperature",
        label: "Température",
        description: "Marchandises sensibles",
        icon: Thermometer,
      },
      {
        key: "pressure",
        label: "Pression",
        description: "Systèmes hydrauliques",
        icon: Gauge,
      },
      {
        key: "fuel",
        label: "Carburant",
        description: "Niveaux et consommation",
        icon: Fuel,
      },
      {
        key: "equipment",
        label: "Équipements",
        description: "Machines de manutention",
        icon: Settings2,
      },
      {
        key: "queues",
        label: "Files d'attente",
        description: "Délais et congestion",
        icon: Activity,
      },
    ],
  },

  {
    key: "energy",
    label: "Énergie",
    description: "Générateurs, consommation et performance",
    icon: Zap,
    equipment: [
      {
        key: "generators",
        label: "Générateurs",
        description: "État et disponibilité",
        icon: Zap,
      },
      {
        key: "fuel",
        label: "Carburant",
        description: "Niveaux et autonomie",
        icon: Fuel,
      },
      {
        key: "temperature",
        label: "Température",
        description: "Surchauffe et refroidissement",
        icon: Thermometer,
      },
      {
        key: "oil",
        label: "Huile",
        description: "Niveaux et maintenance",
        icon: Droplets,
      },
      {
        key: "overload",
        label: "Surcharge",
        description: "Charge et consommation",
        icon: Gauge,
      },
      {
        key: "battery",
        label: "Batteries",
        description: "Charge et état",
        icon: Battery,
      },
    ],
  },
]

const SOURCES: {
  key: SourceKey
  label: string
  description: string
  icon: React.ElementType
}[] = [
  {
    key: "csv",
    label: "Importer un CSV",
    description: "J'ai déjà des données historiques",
    icon: Upload,
  },
  {
    key: "iot",
    label: "Connecter mes capteurs",
    description: "Mes équipements produisent des données",
    icon: Wifi,
  },
  {
    key: "manual",
    label: "Ajouter manuellement",
    description: "Je veux commencer sans connexion",
    icon: PenLine,
  },
  {
    key: "later",
    label: "Je le ferai plus tard",
    description: "Configurer mon espace d'abord",
    icon: Database,
  },
]

export function OnboardingModal({
  onComplete,
}: {
  onComplete?: (data: {
    sector: SectorKey
    equipment: EquipmentKey[]
    source: SourceKey
  }) => void
}) {
  const [step, setStep] = useState(1)

  const [sector, setSector] = useState<SectorKey | null>(null)

  const [selectedEquipment, setSelectedEquipment] = useState<
    EquipmentKey[]
  >([])

  const [source, setSource] = useState<SourceKey | null>(null)

  const currentSector = useMemo(
    () => SECTORS.find((s) => s.key === sector) ?? null,
    [sector],
  )

  function selectSector(key: SectorKey) {
    setSector(key)
    setSelectedEquipment([])
  }

  function toggleEquipment(key: EquipmentKey) {
    setSelectedEquipment((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    )
  }

  function nextStep() {
    if (step === 1 && sector) {
      setStep(2)
      return
    }

    if (step === 2 && selectedEquipment.length > 0) {
      setStep(3)
      return
    }

    if (step === 3 && source) {
      const result = {
        sector: sector!,
        equipment: selectedEquipment,
        source,
      }

      localStorage.setItem(
        "sentria_onboarding",
        JSON.stringify(result),
      )

      onComplete?.(result)
    }
  }

  function previousStep() {
    if (step === 1) return
    setStep(step - 1)
  }

  const canContinue =
    (step === 1 && !!sector) ||
    (step === 2 && selectedEquipment.length > 0) ||
    (step === 3 && !!source)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 md:px-8">
        {/* HEADER */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/sentria logo.png"
              alt="SentrIA"
              className="h-9 w-auto object-contain"
            />

            <div className="hidden h-5 w-px bg-border sm:block" />

            <span className="hidden text-xs font-medium text-muted-foreground sm:block">
              Configuration
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />

            <span className="text-xs font-semibold">
              SentrIA
            </span>
          </div>
        </header>

        {/* PROGRESS */}
        <div className="mx-auto mt-10 w-full max-w-xl">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((item) => {
              const active = step === item
              const completed = step > item

              return (
                <div
                  key={item}
                  className="flex items-center gap-2"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all",
                      completed &&
                        "border-foreground bg-foreground text-background",
                      active &&
                        "border-accent bg-accent text-accent-foreground",
                      !active &&
                        !completed &&
                        "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {completed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      item
                    )}
                  </div>

                  <span
                    className={cn(
                      "hidden text-xs font-semibold sm:block",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {item === 1 && "Votre activité"}
                    {item === 2 && "À surveiller"}
                    {item === 3 && "Vos données"}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{
                width:
                  step === 1
                    ? "33%"
                    : step === 2
                      ? "66%"
                      : "100%",
              }}
            />
          </div>
        </div>

        {/* CONTENT */}
        <main className="mx-auto mt-12 w-full max-w-4xl flex-1">
          {/* STEP 1 */}
          {step === 1 && (
            <section>
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Étape 1
                </span>

                <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight md:text-4xl">
                  Quel type d’activité
                  <br />
                  souhaitez-vous surveiller ?
                </h1>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  SentrIA adaptera automatiquement les équipements,
                  indicateurs et alertes à votre secteur.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SECTORS.map((item) => {
                  const Icon = item.icon
                  const selected = sector === item.key

                  return (
                    <button
                      key={item.key}
                      onClick={() => selectSector(item.key)}
                      className={cn(
                        "group relative rounded-3xl border p-5 text-left transition-all",
                        "hover:-translate-y-0.5 hover:shadow-lg",
                        selected
                          ? "border-foreground bg-foreground text-background shadow-lg"
                          : "border-border bg-card hover:border-foreground/30",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl",
                          selected
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <h3 className="mt-4 font-heading text-lg font-bold">
                        {item.label}
                      </h3>

                      <p
                        className={cn(
                          "mt-1 text-sm leading-relaxed",
                          selected
                            ? "text-background/60"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.description}
                      </p>

                      {selected && (
                        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* STEP 2 */}
          {step === 2 && currentSector && (
            <section>
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent-foreground">
                  <currentSector.icon className="h-3.5 w-3.5" />
                  {currentSector.label}
                </span>

                <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight md:text-4xl">
                  Que souhaitez-vous
                  <br />
                  surveiller ?
                </h1>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Sélectionnez uniquement les équipements et
                  données qui comptent pour votre activité.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {currentSector.equipment.map((item) => {
                  const Icon = item.icon
                  const selected = selectedEquipment.includes(
                    item.key,
                  )

                  return (
                    <button
                      key={item.key}
                      onClick={() =>
                        toggleEquipment(item.key)
                      }
                      className={cn(
                        "group relative rounded-3xl border p-5 text-left transition-all",
                        "hover:-translate-y-0.5 hover:shadow-lg",
                        selected
                          ? "border-accent bg-accent/10 shadow-sm"
                          : "border-border bg-card hover:border-foreground/30",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-2xl",
                            selected
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-foreground",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border transition-all",
                            selected
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-background",
                          )}
                        >
                          {selected && (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </div>

                      <h3 className="mt-4 font-heading text-base font-bold">
                        {item.label}
                      </h3>

                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 flex items-center justify-center">
                <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {selectedEquipment.length}{" "}
                  {selectedEquipment.length > 1
                    ? "éléments sélectionnés"
                    : "élément sélectionné"}
                </span>
              </div>
            </section>
          )}

          {/* STEP 3 */}
          {step === 3 && currentSector && (
            <section>
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent-foreground">
                  <Database className="h-3.5 w-3.5" />
                  Étape 3
                </span>

                <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight md:text-4xl">
                  Où sont vos données ?
                </h1>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Choisissez comment SentrIA doit recevoir les
                  données de vos {currentSector.label.toLowerCase()}.
                </p>
              </div>

              <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
                {SOURCES.map((item) => {
                  const Icon = item.icon
                  const selected = source === item.key

                  return (
                    <button
                      key={item.key}
                      onClick={() => setSource(item.key)}
                      className={cn(
                        "relative flex items-start gap-4 rounded-3xl border p-5 text-left transition-all",
                        "hover:-translate-y-0.5 hover:shadow-lg",
                        selected
                          ? "border-foreground bg-foreground text-background shadow-lg"
                          : "border-border bg-card hover:border-foreground/30",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                          selected
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-heading font-bold">
                          {item.label}
                        </h3>

                        <p
                          className={cn(
                            "mt-1 text-sm",
                            selected
                              ? "text-background/60"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.description}
                        </p>
                      </div>

                      {selected && (
                        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* SUMMARY */}
              <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Votre configuration
                    </p>

                    <p className="mt-0.5 font-heading font-bold">
                      {currentSector.label} ·{" "}
                      {selectedEquipment.length} éléments
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedEquipment.map((key) => {
                    const equipment =
                      currentSector.equipment.find(
                        (item) => item.key === key,
                      )

                    if (!equipment) return null

                    return (
                      <span
                        key={key}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium"
                      >
                        {equipment.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            </section>
          )}
        </main>

        {/* FOOTER */}
        <footer className="mx-auto mt-10 flex w-full max-w-4xl items-center justify-between border-t border-border pt-5">
          <button
            onClick={previousStep}
            disabled={step === 1}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
              step === 1
                ? "pointer-events-none opacity-0"
                : "hover:bg-muted",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>

          <div className="hidden text-xs text-muted-foreground sm:block">
            Configuration personnalisée SentrIA
          </div>

          <button
            onClick={nextStep}
            disabled={!canContinue}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all",
              canContinue
                ? "bg-foreground text-background hover:scale-[1.02] hover:opacity-90"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            )}
          >
            {step === 3 ? "Créer mon espace" : "Continuer"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      </div>
    </div>
  )
}