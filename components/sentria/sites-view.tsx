"use client"

import { useState } from "react"
import {
  Building2,
  Factory,
  Plus,
  Upload,
  Wifi,
  CheckCircle2,
  HeartPulse,
  Wheat,
  Truck,
  Ship,
  Zap,
  Cog,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Sector =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"

type Site = {
  id: string
  name: string
  sector: Sector
  machines: number
  warnings: number
  critical: number
  lastScan: string
}

const SECTORS: { key: Sector; label: string; icon: any }[] = [
  { key: "industry", label: "Industrie", icon: Cog },
  { key: "health", label: "Santé", icon: HeartPulse },
  { key: "agriculture", label: "Agriculture", icon: Wheat },
  { key: "transportation", label: "Transport", icon: Truck },
  { key: "logistics", label: "Logistique", icon: Ship },
  { key: "energy", label: "Énergie", icon: Zap },
]

const DEFAULT_SITES: Site[] = [
  {
    id: "main",
    name: "Site principal",
    sector: "industry",
    machines: 42,
    warnings: 8,
    critical: 2,
    lastScan: "Aujourd'hui",
  },
  {
    id: "health",
    name: "Clinique Nord",
    sector: "health",
    machines: 18,
    warnings: 3,
    critical: 0,
    lastScan: "Hier",
  },
  {
    id: "energy",
    name: "Générateurs Est",
    sector: "energy",
    machines: 12,
    warnings: 1,
    critical: 0,
    lastScan: "Il y a 2 jours",
  },
]

export function SitesView() {
  const [sites, setSites] = useState<Site[]>(DEFAULT_SITES)
  const [activeSite, setActiveSite] = useState("main")

  function getConfiguredSector(): Sector {
    try {
      const stored = localStorage.getItem("sentria_sectors")

      if (stored) {
        const sectors = JSON.parse(stored)

        if (Array.isArray(sectors) && sectors.length > 0) {
          const configuredSector = sectors[0]

          if (SECTORS.some((sector) => sector.key === configuredSector)) {
            return configuredSector
          }
        }
      }
    } catch {
      // Fall back to the default sector.
    }

    return "industry"
  }

  function addSite() {
    const next = sites.length + 1

    const site: Site = {
      id: `site-${next}`,
      name: `Nouveau site ${next}`,
      sector: getConfiguredSector(),
      machines: 0,
      warnings: 0,
      critical: 0,
      lastScan: "Aucun scan",
    }

    setSites((prev) => [...prev, site])
    setActiveSite(site.id)
  }

  function getSector(site: Site) {
    return SECTORS.find((sector) => sector.key === site.sector) ?? SECTORS[0]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Gestion multi-sites et multi-secteurs
          </div>

          <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight">
            Pilotez plusieurs sites depuis le même espace.
          </h2>

          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Ajoutez un site, connectez ses capteurs IoT ou importez un
            historique CSV pour centraliser vos données.
          </p>
        </div>

        <button
          type="button"
          onClick={addSite}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Ajouter un site
        </button>
      </div>

      {/* Sites */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {sites.map((site) => {
          const selected = activeSite === site.id
          const sector = getSector(site)
          const Icon = sector.icon

          return (
            <button
              key={site.id}
              type="button"
              onClick={() => setActiveSite(site.id)}
              className={cn(
                "rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-foreground/20 hover:shadow-sm",
                selected && "ring-2 ring-ring"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <Factory className="h-5 w-5" />
                  </span>

                  <div>
                    <h3 className="font-heading text-base font-bold">
                      {site.name}
                    </h3>

                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {sector.label}
                    </p>
                  </div>
                </div>

                {selected && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted p-3">
                  <p className="font-heading text-xl font-bold">
                    {site.machines}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Actifs</p>
                </div>

                <div className="rounded-xl bg-muted p-3">
                  <p className="font-heading text-xl font-bold">
                    {site.warnings}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Warnings
                  </p>
                </div>

                <div className="rounded-xl bg-muted p-3">
                  <p className="font-heading text-xl font-bold">
                    {site.critical}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Critiques
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Dernier scan : {site.lastScan}
              </p>
            </button>
          )
        })}
      </div>

      {/* Data sources */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-heading text-lg font-bold">
          Sources de données du site
        </h3>

        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Reliez chaque capteur, machine, import CSV et alerte à un site et à
          son secteur.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Wifi className="h-4 w-4" />
            Connecter capteurs IoT
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <Upload className="h-4 w-4" />
            Importer historique CSV
          </button>
        </div>
      </div>
    </div>
  )
}