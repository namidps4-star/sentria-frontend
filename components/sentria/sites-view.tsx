"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cog,
  Cpu,
  Database,
  Factory,
  HeartPulse,
  MapPin,
  Plus,
  Settings2,
  Ship,
  Truck,
  Upload,
  Wifi,
  Wheat,
  XCircle,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Sector =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"

type SiteStatus = "connected" | "warning" | "offline"

type DataSource = {
  type: "csv" | "api" | "iot"
  name: string
  connected: boolean
  lastSync?: string
}

type Site = {
  id: string
  name: string
  location: string
  sector: Sector
  status: SiteStatus
  assets: number
  critical: number
  warnings: number
  lastData: string
  health: number
  sources: DataSource[]
}

const SECTORS: {
  key: Sector
  label: string
  icon: any
}[] = [
  { key: "industry", label: "Industrie", icon: Cog },
  { key: "health", label: "Santé", icon: HeartPulse },
  { key: "agriculture", label: "Agriculture", icon: Wheat },
  { key: "transportation", label: "Transport", icon: Truck },
  { key: "logistics", label: "Logistique", icon: Ship },
  { key: "energy", label: "Énergie", icon: Zap },
]

/*
 * No fake operational data.
 * If no sites exist, the UI starts with a real empty state.
 *
 * You can later replace this with:
 * GET /sites
 */
const INITIAL_SITES: Site[] = []

const STATUS_META = {
  connected: {
    label: "Connecté",
    icon: CheckCircle2,
    className: "bg-accent/20 text-accent-foreground",
    dot: "bg-green-500",
  },
  warning: {
    label: "Attention",
    icon: AlertTriangle,
    className: "bg-amber-500/15 text-amber-600",
    dot: "bg-amber-500",
  },
  offline: {
    label: "Hors ligne",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
}

function getSector(sector: Sector) {
  return (
    SECTORS.find((item) => item.key === sector) ??
    SECTORS[0]
  )
}

function HealthScore({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12">
        <svg
          viewBox="0 0 36 36"
          className="h-12 w-12 -rotate-90"
        >
          <path
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-muted"
          />

          <path
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${value}, 100`}
            strokeLinecap="round"
            className={
              value >= 80
                ? "text-green-500"
                : value >= 50
                  ? "text-amber-500"
                  : "text-destructive"
            }
          />
        </svg>

        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {value}
        </span>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">
          Santé du site
        </p>
        <p className="text-sm font-semibold">
          {value >= 80
            ? "Opérationnel"
            : value >= 50
              ? "À surveiller"
              : "Action requise"}
        </p>
      </div>
    </div>
  )
}

export function SitesView() {
  const [sites, setSites] = useState<Site[]>(
    INITIAL_SITES
  )

  const [activeSiteId, setActiveSiteId] =
    useState<string | null>(null)

  const [selectedSector, setSelectedSector] =
    useState<Sector>("industry")

  const [showAddSite, setShowAddSite] =
    useState(false)

  const [newSiteName, setNewSiteName] =
    useState("")

  const [newSiteLocation, setNewSiteLocation] =
    useState("")

  const [newSiteSector, setNewSiteSector] =
    useState<Sector>("industry")

  const activeSite = useMemo(
    () =>
      sites.find(
        (site) => site.id === activeSiteId
      ) ?? null,
    [sites, activeSiteId]
  )

  function createSite() {
    if (!newSiteName.trim()) return

    const site: Site = {
      id: `site-${Date.now()}`,
      name: newSiteName.trim(),
      location:
        newSiteLocation.trim() || "Localisation à définir",
      sector: newSiteSector,
      status: "offline",
      assets: 0,
      critical: 0,
      warnings: 0,
      lastData: "Aucune donnée",
      health: 0,
      sources: [
        {
          type: "csv",
          name: "Import CSV",
          connected: false,
        },
        {
          type: "api",
          name: "API",
          connected: false,
        },
        {
          type: "iot",
          name: "Capteurs IoT",
          connected: false,
        },
      ],
    }

    setSites((current) => [...current, site])
    setActiveSiteId(site.id)
    setShowAddSite(false)

    setNewSiteName("")
    setNewSiteLocation("")
    setNewSiteSector("industry")
  }

  function addSource(
    siteId: string,
    sourceType: "csv" | "api" | "iot"
  ) {
    setSites((current) =>
      current.map((site) =>
        site.id === siteId
          ? {
              ...site,
              sources: site.sources.map(
                (source) =>
                  source.type === sourceType
                    ? {
                        ...source,
                        connected: true,
                        lastSync: "À l'instant",
                      }
                    : source
              ),
              status: "connected",
              lastData: "À l'instant",
            }
          : site
      )
    )
  }

  /*
   * SITE DETAIL
   */
  if (activeSite) {
    const sector = getSector(activeSite.sector)
    const SectorIcon = sector.icon
    const status = STATUS_META[activeSite.status]
    const StatusIcon = status.icon

    return (
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={() => setActiveSiteId(null)}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Tous les sites
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <SectorIcon className="h-6 w-6" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-2xl font-bold tracking-tight">
                    {activeSite.name}
                  </h2>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                      status.className
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        status.dot
                      )}
                    />
                    {status.label}
                  </span>
                </div>

                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {activeSite.location}
                  <span>·</span>
                  {sector.label}
                </p>
              </div>
            </div>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <Settings2 className="h-4 w-4" />
            Configurer le site
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto border-b border-border pb-2">
          {[
            "Vue d'ensemble",
            "Actifs",
            "Alertes",
            "Sources de données",
            "Paramètres",
          ].map((tab, index) => (
            <button
              key={tab}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold",
                index === 0
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* KPIS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Santé du site
            </div>

            <div className="mt-4">
              <HealthScore value={activeSite.health} />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Cpu className="h-4 w-4" />
              Actifs surveillés
            </div>

            <p className="mt-3 font-heading text-3xl font-bold">
              {activeSite.assets}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Machines, équipements ou actifs
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Alertes critiques
            </div>

            <p
              className={cn(
                "mt-3 font-heading text-3xl font-bold",
                activeSite.critical > 0 &&
                  "text-destructive"
              )}
            >
              {activeSite.critical}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Nécessitent une action immédiate
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleDot className="h-4 w-4" />
              Warnings
            </div>

            <p className="mt-3 font-heading text-3xl font-bold">
              {activeSite.warnings}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              À surveiller
            </p>
          </div>
        </div>

        {/* ATTENTION / DATA SOURCES */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold">
                  Attention requise
                </h3>

                <p className="text-sm text-muted-foreground">
                  Ce qui nécessite votre attention.
                </p>
              </div>

              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>

            {activeSite.critical === 0 &&
            activeSite.warnings === 0 ? (
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-muted p-4">
                <CheckCircle2 className="h-5 w-5 text-green-500" />

                <div>
                  <p className="text-sm font-semibold">
                    Aucun problème détecté
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Le site fonctionne normalement.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-2">
                {activeSite.critical > 0 && (
                  <div className="flex items-center justify-between rounded-2xl bg-destructive/5 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </span>

                      <div>
                        <p className="text-sm font-semibold">
                          {activeSite.critical} alerte
                          {activeSite.critical > 1
                            ? "s"
                            : ""}{" "}
                          critique
                          {activeSite.critical > 1
                            ? "s"
                            : ""}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Action immédiate recommandée
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                {activeSite.warnings > 0 && (
                  <div className="flex items-center justify-between rounded-2xl bg-amber-500/5 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </span>

                      <div>
                        <p className="text-sm font-semibold">
                          {activeSite.warnings} warning
                          {activeSite.warnings > 1
                            ? "s"
                            : ""}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Surveillance recommandée
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold">
                  Sources de données
                </h3>

                <p className="text-sm text-muted-foreground">
                  Comment SentrIA reçoit les données.
                </p>
              </div>

              <Database className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="mt-5 space-y-2">
              {activeSite.sources.map((source) => (
                <div
                  key={source.type}
                  className="flex items-center justify-between rounded-2xl border border-border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                      {source.type === "iot" ? (
                        <Wifi className="h-4 w-4" />
                      ) : source.type === "api" ? (
                        <Database className="h-4 w-4" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        {source.name}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {source.connected
                          ? `Dernière synchronisation : ${
                              source.lastSync ??
                              "récemment"
                            }`
                          : "Non connecté"}
                      </p>
                    </div>
                  </div>

                  {source.connected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      Actif
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        addSource(
                          activeSite.id,
                          source.type
                        )
                      }
                      className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
                    >
                      Connecter
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SITE DATA */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold">
                Données du site
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Dernières données reçues par SentrIA.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Dernière donnée : {activeSite.lastData}
            </div>
          </div>

          {activeSite.assets === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
              <Database className="mx-auto h-8 w-8 text-muted-foreground" />

              <h4 className="mt-3 font-semibold">
                Aucune donnée pour le moment
              </h4>

              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Connectez une source de données ou importez
                votre historique CSV pour commencer la
                surveillance.
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() =>
                    addSource(activeSite.id, "csv")
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
                >
                  <Upload className="h-4 w-4" />
                  Importer CSV
                </button>

                <button
                  onClick={() =>
                    addSource(activeSite.id, "iot")
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold"
                >
                  <Wifi className="h-4 w-4" />
                  Connecter IoT
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  Actifs
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {activeSite.assets}
                </p>
              </div>

              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  Sources actives
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {
                    activeSite.sources.filter(
                      (source) => source.connected
                    ).length
                  }
                </p>
              </div>

              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  Dernière donnée
                </p>
                <p className="mt-1 text-lg font-bold">
                  {activeSite.lastData}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  /*
   * SITES LIST
   */

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="flex flex-col gap-5 rounded-3xl bg-foreground p-6 text-background md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Infrastructure
          </span>

          <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight md:text-3xl">
            Vos opérations, site par site.
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-background/70">
            Centralisez vos sites, actifs, sources de données
            et alertes dans un seul espace.
          </p>
        </div>

        <button
          onClick={() => setShowAddSite(true)}
          className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          Ajouter un site
        </button>
      </div>

      {/* SUMMARY */}
      {sites.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Sites
            </p>

            <p className="mt-2 font-heading text-3xl font-bold">
              {sites.length}
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Connectés
            </p>

            <p className="mt-2 font-heading text-3xl font-bold">
              {
                sites.filter(
                  (site) =>
                    site.status === "connected"
                ).length
              }
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Alertes critiques
            </p>

            <p className="mt-2 font-heading text-3xl font-bold text-destructive">
              {sites.reduce(
                (total, site) =>
                  total + site.critical,
                0
              )}
            </p>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {sites.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center md:p-16">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
            <Building2 className="h-7 w-7 text-muted-foreground" />
          </div>

          <h3 className="mt-5 font-heading text-xl font-bold">
            Aucun site configuré
          </h3>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Commencez par ajouter votre premier site.
            Vous pourrez ensuite connecter vos données,
            importer un historique et surveiller vos actifs.
          </p>

          <button
            onClick={() => setShowAddSite(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" />
            Créer mon premier site
          </button>
        </div>
      )}

      {/* SITE GRID */}
      {sites.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sites.map((site) => {
            const sector = getSector(site.sector)
            const SectorIcon = sector.icon
            const status =
              STATUS_META[site.status]

            return (
              <button
                key={site.id}
                onClick={() =>
                  setActiveSiteId(site.id)
                }
                className="group rounded-3xl border border-border bg-card p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                      <SectorIcon className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-heading text-lg font-bold">
                        {site.name}
                      </h3>

                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {site.location}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                      status.className
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        status.dot
                      )}
                    />
                    {status.label}
                  </span>

                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {sector.label}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-muted p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Actifs
                    </p>

                    <p className="mt-1 font-heading text-xl font-bold">
                      {site.assets}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Warnings
                    </p>

                    <p className="mt-1 font-heading text-xl font-bold">
                      {site.warnings}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-muted p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Critiques
                    </p>

                    <p
                      className={cn(
                        "mt-1 font-heading text-xl font-bold",
                        site.critical > 0 &&
                          "text-destructive"
                      )}
                    >
                      {site.critical}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <HealthScore value={site.health} />

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Dernière donnée
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {site.lastData}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ADD SITE MODAL */}
      {showAddSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-heading text-xl font-bold">
                  Ajouter un site
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Créez le contexte opérationnel de votre
                  nouveau site.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowAddSite(false)
                }
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Fermer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-semibold">
                  Nom du site
                </label>

                <input
                  value={newSiteName}
                  onChange={(e) =>
                    setNewSiteName(e.target.value)
                  }
                  placeholder="Ex. Usine Lyon"
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">
                  Localisation
                </label>

                <input
                  value={newSiteLocation}
                  onChange={(e) =>
                    setNewSiteLocation(e.target.value)
                  }
                  placeholder="Ex. Lyon, France"
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">
                  Secteur
                </label>

                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {SECTORS.map((sector) => {
                    const Icon = sector.icon
                    const active =
                      newSiteSector === sector.key

                    return (
                      <button
                        key={sector.key}
                        onClick={() =>
                          setNewSiteSector(
                            sector.key
                          )
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {sector.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-muted p-4">
                <div className="flex items-start gap-3">
                  <Database className="mt-0.5 h-5 w-5 text-muted-foreground" />

                  <div>
                    <p className="text-sm font-semibold">
                      Vous pourrez connecter les données
                      ensuite
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      CSV, API ou capteurs IoT. Le site sera
                      créé même sans données afin de pouvoir
                      terminer votre configuration.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() =>
                  setShowAddSite(false)
                }
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
              >
                Annuler
              </button>

              <button
                onClick={createSite}
                disabled={!newSiteName.trim()}
                className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40"
              >
                Créer le site
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}