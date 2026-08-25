"use client"

import { useState } from "react"
import { Check, ArrowRight, Factory, HeartPulse, Wheat, Truck, Ship, Zap } from "lucide-react"
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

export function OnboardingModal({
  onDone,
}: {
  onDone: (sectors: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((sector) => sector !== key)
        : [...prev, key]
    )
  }

  function finish() {
    localStorage.setItem("sentria_sectors", JSON.stringify(selected))
    localStorage.setItem("sentria_onboarded", "true")

    window.dispatchEvent(new Event("sentria_sectors_updated"))
    onDone(selected)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-[3px]">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-24px_rgba(0,0,0,0.3)]">

        {/* Header */}
        <div className="border-b border-border px-6 py-5">
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

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Étape 1 sur 1
            </p>

            <h2 className="mt-1.5 font-heading text-xl font-bold tracking-tight md:text-2xl">
              Quels secteurs souhaitez-vous surveiller ?
            </h2>

            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Sélectionnez les secteurs pertinents pour personnaliser votre
              dashboard, vos alertes et vos données.
            </p>
          </div>
        </div>

        {/* Sectors */}
        <div className="grid grid-cols-1 gap-2 p-6 sm:grid-cols-2">
          {SECTORS.map((sector) => {
            const Icon = sector.icon
            const active = selected.includes(sector.key)

            return (
              <button
                key={sector.key}
                type="button"
                onClick={() => toggle(sector.key)}
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
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
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

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {selected.length === 0 ? (
              "Sélectionnez au moins un secteur"
            ) : (
              <>
                <span className="font-semibold text-foreground">
                  {selected.length}
                </span>{" "}
                secteur{selected.length > 1 ? "s" : ""} sélectionné
                {selected.length > 1 ? "s" : ""}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={finish}
            disabled={selected.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-30"
          >
            Continuer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}