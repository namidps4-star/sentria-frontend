"use client"

import { useState } from "react"
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
  Settings2,
  Boxes,
  BatteryCharging,
  Thermometer,
  Wrench,
  ShieldAlert,
  FileSpreadsheet,
  RadioTower,
  PenLine,
} from "lucide-react"
import { cn } from "@/lib/utils"

const SECTORS = [
  {
    key: "industry",
    label: "Industrie",
    desc: "Machines, générateurs, usines",
    icon: Factory,
  },
  {
    key: "health",
    label: "Santé",
    desc: "Pharmacies, cliniques, médicaments",
    icon: HeartPulse,
  },
  {
    key: "agriculture",
    label: "Agriculture",
    desc: "Récoltes, irrigation, stockage",
    icon: Wheat,
  },
  {
    key: "transportation",
    label: "Transport",
    desc: "Flottes, camions, véhicules",
    icon: Truck,
  },
  {
    key: "logistics",
    label: "Logistique",
    desc: "Ports, entrepôts, conteneurs",
    icon: Ship,
  },
  {
    key: "energy",
    label: "Énergie",
    desc: "Générateurs, solaire, réseaux",
    icon: Zap,
  },
]

const MONITORING = [
  {
    key: "equipment",
    label: "Machines & équipements",
    desc: "État, performance et disponibilité",
    icon: Settings2,
  },
  {
    key: "fleet",
    label: "Flottes & véhicules",
    desc: "Utilisation, état et incidents",
    icon: Truck,
  },
  {
    key: "inventory",
    label: "Stocks & inventaires",
    desc: "Niveaux, mouvements et ruptures",
    icon: Boxes,
  },
  {
    key: "energy",
    label: "Énergie & consommation",
    desc: "Production, consommation et coûts",
    icon: BatteryCharging,
  },
  {
    key: "conditions",
    label: "Température & conditions",
    desc: "Conditions environnementales",
    icon: Thermometer,
  },
  {
    key: "maintenance",
    label: "Maintenance",
    desc: "Interventions, pannes et prévision",
    icon: Wrench,
  },
  {
    key: "risks",
    label: "Risques & anomalies",
    desc: "Détection et priorisation des alertes",
    icon: ShieldAlert,
  },
]

const DATA_SOURCES = [
  {
    key: "csv",
    label: "Importer un CSV",
    desc: "J'ai déjà des données à analyser",
    icon: FileSpreadsheet,
  },
  {
    key: "iot",
    label: "Connecter mes équipements",
    desc: "Mes équipements envoient des données",
    icon: RadioTower,
  },
  {
    key: "manual",
    label: "Commencer manuellement",
    desc: "Je vais configurer mon premier site",
    icon: PenLine,
  },
]

type Step = 1 | 2 | 3

export function OnboardingModal({
  onDone,
}: {
  onDone: (sectors: string[]) => void
}) {
  const [step, setStep] = useState<Step>(1)
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [selectedMonitoring, setSelectedMonitoring] = useState<string[]>([])
  const [dataSource, setDataSource] = useState<string | null>(null)

  function toggleSector(key: string) {
    setSelectedSectors((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    )
  }

  function toggleMonitoring(key: string) {
    setSelectedMonitoring((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    )
  }

  function canContinue() {
    if (step === 1) return selectedSectors.length > 0
    if (step === 2) return selectedMonitoring.length > 0
    return dataSource !== null
  }

  function next() {
    if (!canContinue()) return

    if (step < 3) {
      setStep((current) => (current + 1) as Step)
    } else {
      finish()
    }
  }

  function back() {
    if (step > 1) {
      setStep((current) => (current - 1) as Step)
    }
  }

  function finish() {
    localStorage.setItem(
      "sentria_sectors",
      JSON.stringify(selectedSectors)
    )

    localStorage.setItem(
      "sentria_monitoring",
      JSON.stringify(selectedMonitoring)
    )

    if (dataSource) {
      localStorage.setItem("sentria_data_source", dataSource)
    }

    localStorage.setItem("sentria_onboarded", "true")

    window.dispatchEvent(new Event("sentria_sectors_updated"))

    onDone(selectedSectors)
  }

  const stepTitles = {
    1: "Secteurs",
    2: "Surveillance",
    3: "Données",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-[3px]">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-24px_rgba(0,0,0,0.3)]">

        {/* Header */}
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Zap className="h-4 w-4" />
              </div>

              <div>
                <p className="font-heading text-sm font-bold tracking-tight">
                  SentrIA
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Configuration de votre espace
                </p>
              </div>
            </div>

            <span className="text-xs font-medium text-muted-foreground">
              {step} / 3
            </span>
          </div>

          {/* Progress */}
          <div className="mt-5 flex gap-1.5">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  item <= step ? "bg-foreground" : "bg-muted"
                )}
              />
            ))}
          </div>

          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {stepTitles[step]}
            </p>

            {step === 1 && (
              <>
                <h2 className="mt-1.5 font-heading text-xl font-bold tracking-tight md:text-2xl">
                  Quels secteurs souhaitez-vous surveiller ?
                </h2>

                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Sélectionnez les secteurs pertinents pour personnaliser votre
                  dashboard, vos alertes et vos données.
                </p>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="mt-1.5 font-heading text-xl font-bold tracking-tight md:text-2xl">
                  Qu'est-ce que vous souhaitez surveiller ?
                </h2>

                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Choisissez les éléments qui comptent le plus pour votre
                  activité.
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="mt-1.5 font-heading text-xl font-bold tracking-tight md:text-2xl">
                  Comment souhaitez-vous alimenter SentrIA ?
                </h2>

                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Vous pourrez modifier cette configuration plus tard.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SECTORS.map((sector) => {
                const Icon = sector.icon
                const active = selectedSectors.includes(sector.key)

                return (
                  <button
                    key={sector.key}
                    type="button"
                    onClick={() => toggleSector(sector.key)}
                    aria-pressed={active}
                    className={cn(
                      "group relative flex min-h-[84px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground/30 hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        active
                          ? "border-background/10 bg-background/10 text-accent"
                          : "border-border bg-card text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>

                    <div className="min-w-0 pr-5">
                      <p className="text-sm font-semibold">
                        {sector.label}
                      </p>

                      <p
                        className={cn(
                          "mt-0.5 text-xs leading-relaxed",
                          active
                            ? "text-background/60"
                            : "text-muted-foreground"
                        )}
                      >
                        {sector.desc}
                      </p>
                    </div>

                    {active && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {MONITORING.map((item) => {
                const Icon = item.icon
                const active = selectedMonitoring.includes(item.key)

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleMonitoring(item.key)}
                    aria-pressed={active}
                    className={cn(
                      "group relative flex min-h-[84px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground/30 hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        active
                          ? "border-background/10 bg-background/10 text-accent"
                          : "border-border bg-card text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>

                    <div className="min-w-0 pr-5">
                      <p className="text-sm font-semibold">
                        {item.label}
                      </p>

                      <p
                        className={cn(
                          "mt-0.5 text-xs leading-relaxed",
                          active
                            ? "text-background/60"
                            : "text-muted-foreground"
                        )}
                      >
                        {item.desc}
                      </p>
                    </div>

                    {active && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2.5">
              {DATA_SOURCES.map((source) => {
                const Icon = source.icon
                const active = dataSource === source.key

                return (
                  <button
                    key={source.key}
                    type="button"
                    onClick={() => setDataSource(source.key)}
                    aria-pressed={active}
                    className={cn(
                      "group relative flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground/30 hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                        active
                          ? "border-background/10 bg-background/10 text-accent"
                          : "border-border bg-card text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1 pr-7">
                      <p className="text-sm font-semibold">
                        {source.label}
                      </p>

                      <p
                        className={cn(
                          "mt-0.5 text-xs",
                          active
                            ? "text-background/60"
                            : "text-muted-foreground"
                        )}
                      >
                        {source.desc}
                      </p>
                    </div>

                    {active && (
                      <span className="absolute right-4 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="text-xs text-muted-foreground">
            {step === 1 && (
              <>
                {selectedSectors.length === 0
                  ? "Sélectionnez au moins un secteur"
                  : `${selectedSectors.length} secteur${
                      selectedSectors.length > 1 ? "s" : ""
                    } sélectionné${
                      selectedSectors.length > 1 ? "s" : ""
                    }`}
              </>
            )}

            {step === 2 && (
              <>
                {selectedMonitoring.length === 0
                  ? "Sélectionnez au moins un élément"
                  : `${selectedMonitoring.length} élément${
                      selectedMonitoring.length > 1 ? "s" : ""
                    } sélectionné${
                      selectedMonitoring.length > 1 ? "s" : ""
                    }`}
              </>
            )}

            {step === 3 && (
              <>
                {dataSource
                  ? "Configuration prête"
                  : "Choisissez une source de données"}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={back}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>
            )}

            <button
              type="button"
              onClick={next}
              disabled={!canContinue()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-30"
            >
              {step === 3 ? "Accéder au dashboard" : "Continuer"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}