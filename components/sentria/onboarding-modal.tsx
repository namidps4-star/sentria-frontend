"use client"

import { useState } from "react"
import { Check, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const SECTORS = [
  { key: "industry",       emoji: "🏭", label: "Industrie",   desc: "Machines, générateurs, usines" },
  { key: "health",         emoji: "💊", label: "Santé",       desc: "Pharmacies, cliniques, médicaments" },
  { key: "agriculture",    emoji: "🌾", label: "Agriculture", desc: "Récoltes, irrigation, stockage" },
  { key: "transportation", emoji: "🚛", label: "Transport",   desc: "Flottes, camions, véhicules" },
  { key: "logistics",      emoji: "🚢", label: "Logistique",  desc: "Ports, entrepôts, conteneurs" },
  { key: "energy",         emoji: "⚡", label: "Énergie",     desc: "Générateurs, solaire, réseaux" },
]

export function OnboardingModal({ onDone }: { onDone: (sectors: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const [step, setStep] = useState<"sectors" | "confirm">("sectors")

  function toggle(key: string) {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  function finish() {
    localStorage.setItem("sentria_sectors", JSON.stringify(selected))
    localStorage.setItem("sentria_onboarded", "true")
    window.dispatchEvent(new Event("sentria_sectors_updated"))
    onDone(selected)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl">

        {/* Header */}
        <div className="border-b border-border p-6 pb-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-heading text-sm font-bold tracking-tight">SentrIA</span>
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-tight">
            Bienvenue. Dans quel secteur opérez-vous ?
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choisissez un ou plusieurs secteurs — votre dashboard et vos templates s'adapteront automatiquement.
          </p>
        </div>

        {/* Sector grid */}
        <div className="grid grid-cols-2 gap-2.5 p-6">
          {SECTORS.map((s) => {
            const active = selected.includes(s.key)
            return (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                className={cn(
                  "relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:border-ring"
                )}
              >
                <span className="text-2xl">{s.emoji}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{s.label}</p>
                  <p className={cn("text-xs mt-0.5", active ? "text-background/60" : "text-muted-foreground")}>
                    {s.desc}
                  </p>
                </div>
                {active && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {selected.length === 0
              ? "Sélectionnez au moins un secteur"
              : `${selected.length} secteur${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""}`
            }
          </p>
          <button
            onClick={finish}
            disabled={selected.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            Accéder au dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
