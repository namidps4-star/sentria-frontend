"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from "@/lib/icons"
import { usePresence } from "@/lib/use-presence"
import { useShake } from "@/lib/use-shake"
import { enterAt } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { PLAN_NAMES, PLAN_UPDATED_EVENT, maxSitesFor, readAccountPlan, type PlanId } from "@/lib/plans"
import { StatusTag, type TagTone } from "./status-tag"
import type { ViewKey } from "./types"
import { localized, useTx, type Localized, type Tx, resolve } from "@/lib/i18n"

type Sector =
  | "industry"
  | "health"
  | "agriculture"
  | "transportation"
  | "logistics"
  | "energy"

type SiteStatus = "connected" | "warning" | "offline"

/** When the last sync happened. A marker, not a sentence: storing
 *  "À l'instant" in state meant a site created in French still said it
 *  after the operator switched the interface to English. */
type Freshness = "none" | "now"

type DataSource = {
  type: "csv" | "api" | "iot"
  name: Localized
  connected: boolean
  lastSync?: Freshness
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
  lastData: Freshness
  health: number
  sources: DataSource[]
}

const SECTORS: {
  key: Sector
  label: Localized
  icon: LucideIcon
}[] = [
  { key: "industry", label: localized("Industrie", "Industry"), icon: Cog },
  { key: "health", label: localized("Santé", "Health"), icon: HeartPulse },
  {
    key: "agriculture",
    label: localized("Agriculture", "Agriculture"),
    icon: Wheat,
  },
  {
    key: "transportation",
    label: localized("Transport", "Transport"),
    icon: Truck,
  },
  { key: "logistics", label: localized("Logistique", "Logistics"), icon: Ship },
  { key: "energy", label: localized("Énergie", "Energy"), icon: Zap },
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
    label: localized("Connecté", "Connected"),
    tone: "success" as TagTone,
    icon: CheckCircle2,
    className: "bg-accent/20 text-accent-foreground",
    dot: "bg-green-500",
  },
  warning: {
    label: localized("Attention", "Attention"),
    tone: "warning" as TagTone,
    icon: AlertTriangle,
    className: "bg-warning/12 text-warning",
    dot: "bg-warning",
  },
  offline: {
    label: localized("Hors ligne", "Offline"),
    tone: "danger" as TagTone,
    icon: XCircle,
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
}

/** The words for a Freshness marker. */
function freshnessLabel(value: Freshness, tx: Tx): string {
  return value === "now"
    ? tx("À l'instant", "Just now")
    : tx("Aucune donnée", "No data")
}

function getSector(sector: Sector) {
  return (
    SECTORS.find((item) => item.key === sector) ??
    SECTORS[0]
  )
}

/** `measured` is false for a site no data has reached (L4): a ring at zero
 *  reads "action required" and a full one reads "operational", and neither
 *  is a reading. */
function HealthScore({ value, measured = true }: { value: number; measured?: boolean }) {
  const tx = useTx()

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

          {/* Nothing measured, nothing drawn: a zero-length arc with a round
              cap still leaves a dot. */}
          {measured && (
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
                    ? "text-warning"
                    : "text-destructive"
              }
            />
          )}
        </svg>

        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {measured ? value : "—"}
        </span>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">
          {tx("Santé du site", "Site health")}
        </p>
        <p className="text-sm font-semibold">
          {!measured
            ? tx("Non mesuré", "Not measured")
            : value >= 80
              ? tx("Opérationnel", "Operational")
              : value >= 50
                ? tx("À surveiller", "Worth watching")
                : tx("Action requise", "Action required")}
        </p>
      </div>
    </div>
  )
}

export function SitesView({ onNavigate }: { onNavigate?: (view: ViewKey) => void } = {}) {
  const tx = useTx()

  /** Resolve a module-level pair. */
  const px = (text: Localized | undefined) => resolve(text, tx)

  const [sites, setSites] = useState<Site[]>(
    INITIAL_SITES
  )

  const [activeSiteId, setActiveSiteId] =
    useState<string | null>(null)

  const [selectedSector, setSelectedSector] =
    useState<Sector>("industry")

  const [showAddSite, setShowAddSite] =
    useState(false)

  // F-FORMSHAKE: a site needs a name. An empty one is refused out loud.
  const [nameInvalid, setNameInvalid] = useState(false)
  const [nameShakeRef, shakeName] = useShake()
  const nameInput = useRef<HTMLInputElement>(null)

  // F-SITEGATE: sites are capped by plan (lib/plans.ts maxSitesFor). At the
  // cap, "Add a site" explains the upgrade instead of opening the form.
  const [plan, setPlan] = useState<PlanId>("decouverte")
  const [showUpgrade, setShowUpgrade] = useState(false)
  const upgrade = usePresence(showUpgrade, "--modal-close-dur")

  useEffect(() => {
    const load = () => setPlan(readAccountPlan().effective)
    load()
    window.addEventListener(PLAN_UPDATED_EVENT, load)
    return () => window.removeEventListener(PLAN_UPDATED_EVENT, load)
  }, [])

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

  const connectedCount = sites.filter((site) => site.status === "connected").length
  const criticalCount = sites.reduce((total, site) => total + site.critical, 0)

  const siteCap = maxSitesFor(plan)
  const atSiteCap = sites.length >= siteCap

  function requestAddSite() {
    if (atSiteCap) setShowUpgrade(true)
    else setShowAddSite(true)
  }

  function createSite() {
    if (atSiteCap) return

    if (!newSiteName.trim()) {
      setNameInvalid(true)
      shakeName()
      nameInput.current?.focus()
      return
    }

    const site: Site = {
      id: `site-${Date.now()}`,
      name: newSiteName.trim(),
      location:
        newSiteLocation.trim() ||
        tx("Localisation à définir", "Location to be set"),
      sector: newSiteSector,
      status: "offline",
      assets: 0,
      critical: 0,
      warnings: 0,
      lastData: "none",
      health: 0,
      sources: [
        {
          type: "csv",
          name: localized("Import CSV", "CSV import"),
          connected: false,
        },
        {
          type: "api",
          name: localized("API", "API"),
          connected: false,
        },
        {
          type: "iot",
          name: localized("Capteurs IoT", "IoT sensors"),
          connected: false,
        },
      ],
    }

    setSites((current) => [...current, site])
    setActiveSiteId(site.id)
    setShowAddSite(false)
    setNameInvalid(false)

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
                        lastSync: "now",
                      }
                    : source
              ),
              status: "connected",
              lastData: "now",
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
              {tx("Tous les sites", "All sites")}
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
                    {px(status.label)}
                  </span>
                </div>

                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {activeSite.location}
                  <span>·</span>
                  {px(sector.label)}
                </p>
              </div>
            </div>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <Settings2 className="h-4 w-4" />
            {tx("Configurer le site", "Configure this site")}
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto border-b border-border pb-2">
          {[
            tx("Vue d'ensemble", "Overview"),
            tx("Actifs", "Assets"),
            tx("Alertes", "Alerts"),
            tx("Sources de données", "Data sources"),
            tx("Paramètres", "Settings"),
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
              {tx("Santé du site", "Site health")}
            </div>

            <div className="mt-4">
              <HealthScore value={activeSite.health} measured={activeSite.assets > 0} />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Cpu className="h-4 w-4" />
              {tx("Actifs surveillés", "Assets monitored")}
            </div>

            <p className="mt-3 font-heading text-3xl font-bold">
              {activeSite.assets}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {tx(
                "Machines, équipements ou actifs",
                "Machines, equipment or other assets"
              )}
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              {tx("Alertes critiques", "Critical alerts")}
            </div>

            <p
              className={cn(
                "mt-3 font-heading text-3xl font-bold",
                activeSite.critical > 0 &&
                  "text-destructive"
              )}
            >
              {activeSite.assets > 0 ? activeSite.critical : "—"}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {tx(
                "Nécessitent une action immédiate",
                "Need action right away"
              )}
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleDot className="h-4 w-4" />
              {tx("Warnings", "Warnings")}
            </div>

            <p className="mt-3 font-heading text-3xl font-bold">
              {activeSite.assets > 0 ? activeSite.warnings : "—"}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {tx("À surveiller", "Worth watching")}
            </p>
          </div>
        </div>

        {/* ATTENTION / DATA SOURCES */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold">
                  {tx("Attention requise", "Needs attention")}
                </h3>

                <p className="text-sm text-muted-foreground">
                  {tx(
                    "Ce qui nécessite votre attention.",
                    "What needs you to look at it."
                  )}
                </p>
              </div>

              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>

            {activeSite.assets === 0 ? (
              <div data-not-measured="" className="mt-6 flex items-center gap-3 rounded-2xl bg-muted p-4">
                <CircleDot className="h-5 w-5 text-muted-foreground" />

                <div>
                  <p className="text-sm font-semibold">
                    {tx("Non mesuré", "Not measured")}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {tx(
                      "Aucune donnée n'est arrivée de ce site : il n'y a pas d'état à annoncer.",
                      "No data has reached this site, so there is no status to report."
                    )}
                  </p>
                </div>
              </div>
            ) : activeSite.critical === 0 &&
            activeSite.warnings === 0 ? (
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-muted p-4">
                <CheckCircle2 className="h-5 w-5 text-green-500" />

                <div>
                  <p className="text-sm font-semibold">
                    {tx("Aucun problème détecté", "No problem detected")}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {tx(
                      "Le site fonctionne normalement.",
                      "The site is running normally."
                    )}
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
                          {activeSite.critical}{" "}
                          {activeSite.critical > 1
                            ? tx("alertes critiques", "critical alerts")
                            : tx("alerte critique", "critical alert")}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {tx(
                            "Action immédiate recommandée",
                            "Immediate action recommended"
                          )}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                {activeSite.warnings > 0 && (
                  <div className="flex items-center justify-between rounded-2xl bg-warning/5 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      </span>

                      <div>
                        <p className="text-sm font-semibold">
                          {activeSite.warnings}{" "}
                          {activeSite.warnings > 1
                            ? tx("warnings", "warnings")
                            : tx("warning", "warning")}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {tx(
                            "Surveillance recommandée",
                            "Worth keeping an eye on"
                          )}
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
                  {tx("Sources de données", "Data sources")}
                </h3>

                <p className="text-sm text-muted-foreground">
                  {tx(
                    "Comment SentrIA reçoit les données.",
                    "How SentrIA receives the data."
                  )}
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
                        {px(source.name)}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {source.connected
                          ? tx(
                              `Dernière synchronisation : ${
                                source.lastSync
                                  ? freshnessLabel(source.lastSync, tx)
                                  : tx("récemment", "recently")
                              }`,
                              `Last sync: ${
                                source.lastSync
                                  ? freshnessLabel(source.lastSync, tx)
                                  : tx("récemment", "recently")
                              }`
                            )
                          : tx("Non connecté", "Not connected")}
                      </p>
                    </div>
                  </div>

                  {source.connected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      {tx("Actif", "Active")}
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
                      {tx("Connecter", "Connect")}
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
                {tx("Données du site", "Site data")}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {tx(
                  "Dernières données reçues par SentrIA.",
                  "The latest data SentrIA received."
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  activeSite.lastData === "none" ? "bg-muted-foreground/40" : "bg-green-500"
                )}
              />
              {tx("Dernière donnée :", "Last data:")}{" "}
              {freshnessLabel(activeSite.lastData, tx)}
            </div>
          </div>

          {activeSite.assets === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
              <Database className="mx-auto h-8 w-8 text-muted-foreground" />

              <h4 className="mt-3 font-semibold">
                {tx("Aucune donnée pour le moment", "No data yet")}
              </h4>

              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {tx(
                  "Connectez une source de données ou importez votre historique CSV pour commencer la surveillance.",
                  "Connect a data source, or import your CSV history, to start monitoring."
                )}
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() =>
                    addSource(activeSite.id, "csv")
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
                >
                  <Upload className="h-4 w-4" />
                  {tx("Importer CSV", "Import CSV")}
                </button>

                <button
                  onClick={() =>
                    addSource(activeSite.id, "iot")
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold"
                >
                  <Wifi className="h-4 w-4" />
                  {tx("Connecter IoT", "Connect IoT")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  {tx("Actifs", "Assets")}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {activeSite.assets}
                </p>
              </div>

              <div className="rounded-2xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  {tx("Sources actives", "Active sources")}
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
                  {tx("Dernière donnée", "Last data")}
                </p>
                <p className="mt-1 text-lg font-bold">
                  {freshnessLabel(activeSite.lastData, tx)}
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
      {/* The Ask SentrIA layout: lime card and the site list on the left,
          the sites in the grey panel, the totals in the black card. */}
      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_290px]">
        {/* -------------------------------------------------------- LEFT */}
        <div className="flex flex-col gap-4">
          <div className="t-enter rounded-[28px] bg-brand p-5 text-[#141414]" style={enterAt(0)}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-bold">SentrIA</span>
                  <span className="block text-[11px] text-[#141414]/65">{tx("Infrastructure", "Infrastructure")}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={requestAddSite}
                aria-label={tx("Ajouter un site", "Add a site")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#141414] shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-5 font-heading text-2xl font-semibold leading-tight tracking-tight">
              {tx("Vos opérations, site par site.", "Your operations, site by site.")}
            </p>

            <div className="mt-4">
              <div
                className="h-2 overflow-hidden rounded-full bg-white/70"
                role="progressbar"
                aria-label={tx("Sites connectés", "Sites connected")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={sites.length ? Math.round((connectedCount / sites.length) * 100) : 0}
              >
                <div
                  className="h-full rounded-full bg-[var(--ink)] transition-[width] duration-500"
                  style={{ width: `${sites.length ? Math.round((connectedCount / sites.length) * 100) : 0}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
                <span>{tx("Connectés", "Connected")}</span>
                <span className="tabular-nums">
                  {connectedCount} / {sites.length}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden rounded-[28px] bg-card p-5 shadow-sm lg:block">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-xl font-semibold tracking-tight">{tx("Vos sites", "Your sites")}</h3>
              <button
                type="button"
                onClick={requestAddSite}
                aria-label={tx("Ajouter un site", "Add a site")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-white transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {sites.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
                {tx("Aucun site pour l'instant.", "No site yet.")}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {sites.map((site) => (
                  <li key={site.id}>
                    <button
                      type="button"
                      onClick={() => setActiveSiteId(site.id)}
                      className="w-full rounded-2xl bg-muted px-4 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{site.name}</span>
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_META[site.status].dot)} aria-hidden="true" />
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{site.location}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------ CENTER */}
        <section className="t-enter flex min-h-[420px] flex-col rounded-[28px] bg-foreground/[0.055] p-5 sm:p-6" style={enterAt(0.4)}>
          <h2 className="font-heading text-3xl font-semibold leading-[1.05] tracking-tight">{tx("Sites", "Sites")}</h2>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-brand ring-2 ring-brand/30" aria-hidden="true" />
            {tx(
              "Vos sites, actifs, sources de données et alertes dans un seul espace.",
              "Your sites, assets, data sources and alerts in one place."
            )}
          </p>

          {sites.length === 0 ? (
            <div className="mt-5 flex flex-col items-start gap-3">
              <div className="max-w-[85%] rounded-[22px] bg-[var(--ink)] p-4 text-sm leading-relaxed text-white">
                <p className="font-semibold">{tx("Aucun site configuré", "No site set up")}</p>
                <p className="mt-1 text-white/75">
                  {tx(
                    "Commencez par ajouter votre premier site. Vous pourrez ensuite connecter vos données, importer un historique et surveiller vos actifs.",
                    "Start by adding your first site. You can then connect your data, import a history and monitor your assets."
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={requestAddSite}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {tx("Créer mon premier site", "Create my first site")}
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 2xl:grid-cols-2">
              {sites.map((site) => {
                const sector = getSector(site.sector)
                const SectorIcon = sector.icon
                const status = STATUS_META[site.status]

                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => setActiveSiteId(site.id)}
                    className="group rounded-[22px] bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                          <SectorIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-heading text-lg font-semibold">{site.name}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            <span className="truncate">{site.location}</span>
                          </span>
                        </span>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted transition-transform group-hover:translate-x-0.5">
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <StatusTag tone={status.tone} size="xs">
                        {px(status.label)}
                      </StatusTag>
                      <StatusTag tone="neutral" size="xs" icon={false}>
                        {px(sector.label)}
                      </StatusTag>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { label: tx("Actifs", "Assets"), value: site.assets, hot: false },
                        { label: tx("Warnings", "Warnings"), value: site.assets > 0 ? site.warnings : "—", hot: false },
                        { label: tx("Critiques", "Critical"), value: site.assets > 0 ? site.critical : "—", hot: site.critical > 0 },
                      ].map((cell) => (
                        <div key={cell.label} className="rounded-2xl bg-muted p-3">
                          <p className="text-[11px] text-muted-foreground">{cell.label}</p>
                          <p className={cn("mt-1 font-heading text-xl font-bold", cell.hot && "text-destructive")}>{cell.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <HealthScore value={site.health} measured={site.assets > 0} />
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{tx("Dernière donnée", "Last data")}</p>
                        <p className="mt-1 text-sm font-semibold">{freshnessLabel(site.lastData, tx)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ------------------------------------------------------- RIGHT */}
        <div className="flex flex-col gap-4 lg:col-start-2 xl:col-start-auto">
          <div className="t-enter rounded-[28px] bg-[var(--ink)] p-5 text-white" style={enterAt(0.8)}>
            <div className="flex items-center justify-between">
              <p className="font-heading text-xl font-semibold tracking-tight">{tx("En un coup d'œil", "At a glance")}</p>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">{tx("Sites", "Sites")}</span>
            </div>
            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-white/55">{tx("Sites", "Sites")}</dt>
                <dd className="font-semibold tabular-nums">{sites.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-white/55">{tx("Connectés", "Connected")}</dt>
                <dd className="font-semibold tabular-nums">{connectedCount}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-white/55">{tx("Actifs suivis", "Assets tracked")}</dt>
                <dd className="font-semibold tabular-nums">{sites.reduce((total, site) => total + site.assets, 0)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
              <span className="text-xs text-white/55">{tx("Alertes critiques", "Critical alerts")}</span>
              <span className="font-heading text-4xl font-bold leading-none text-brand">{sites.some((site) => site.assets > 0) ? criticalCount : "—"}</span>
            </div>
          </div>

          <div className="rounded-[28px] bg-card p-5 shadow-sm">
            <p className="font-heading text-xl font-semibold tracking-tight">{tx("Sources de données", "Data sources")}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {[
                { icon: Upload, label: tx("Import CSV", "CSV import") },
                { icon: Database, label: tx("API", "API") },
                { icon: Wifi, label: tx("Capteurs IoT", "IoT sensors") },
              ].map((row) => (
                <li key={row.label} className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-sm font-medium">
                  <row.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {row.label}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {tx("Chaque site se connecte à une ou plusieurs sources.", "Each site connects to one or more sources.")}
            </p>
            <button
              type="button"
              onClick={requestAddSite}
              className="mt-4 flex w-full items-center justify-between rounded-full bg-brand py-2 pl-5 pr-2 text-sm font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Ajouter un site", "Add a site")}
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* UPGRADE: the plan's site limit is reached (F-SITEGATE) */}
      {upgrade.present && (
        <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 t-modal-backdrop", upgrade.className)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tx("Limite de sites atteinte", "Site limit reached")}
            className={cn("w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl t-modal", upgrade.className)}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-xl font-bold">
                {plan === "business"
                  ? tx("Plus de sites avec l'offre Entreprise", "More sites with the Entreprise plan")
                  : tx("Plus de sites avec l'offre Business", "More sites with the Business plan")}
              </h3>
              <button
                type="button"
                onClick={() => setShowUpgrade(false)}
                aria-label={tx("Fermer", "Close")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {Number.isFinite(siteCap)
                ? tx(
                    `Votre offre ${PLAN_NAMES[plan]} inclut ${siteCap} site${siteCap > 1 ? "s" : ""}, et vous les utilisez. ${
                      plan === "business"
                        ? "Passez à l'offre Entreprise pour des sites illimités."
                        : "Passez à une offre supérieure pour en ajouter d'autres : Business inclut 3 sites, Entreprise est illimitée."
                    }`,
                    `Your ${PLAN_NAMES[plan]} plan includes ${siteCap} site${siteCap > 1 ? "s" : ""}, and you are using them. ${
                      plan === "business"
                        ? "Upgrade to the Entreprise plan for unlimited sites."
                        : "Upgrade to add more: Business includes 3 sites, Entreprise is unlimited."
                    }`
                  )
                : ""}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpgrade(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {tx("Plus tard", "Not now")}
              </button>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUpgrade(false)
                    onNavigate("pricing")
                  }}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-[#141414] transition-opacity hover:opacity-90"
                >
                  {tx("Voir les offres", "See the plans")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD SITE MODAL */}
      {showAddSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-heading text-xl font-bold">
                  {tx("Ajouter un site", "Add a site")}
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  {tx(
                    "Créez le contexte opérationnel de votre nouveau site.",
                    "Set up the operational context for your new site."
                  )}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowAddSite(false)
                  setNameInvalid(false)
                }}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label={tx("Fermer", "Close")}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-semibold">
                  {tx("Nom du site", "Site name")}
                </label>

                <div ref={nameShakeRef}>
                  <input
                    ref={nameInput}
                    value={newSiteName}
                    onChange={(e) => {
                      setNewSiteName(e.target.value)
                      if (e.target.value.trim()) setNameInvalid(false)
                    }}
                    placeholder={tx("Ex. Usine Lyon", "e.g. Lyon plant")}
                    aria-invalid={nameInvalid}
                    aria-describedby={nameInvalid ? "site-name-error" : undefined}
                    className={cn(
                      "mt-2 w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition-colors",
                      nameInvalid ? "border-destructive" : "border-border focus:border-foreground"
                    )}
                  />
                </div>

                {nameInvalid && (
                  <p id="site-name-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                    {tx("Donnez un nom au site.", "Give the site a name.")}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold">
                  {tx("Localisation", "Location")}
                </label>

                <input
                  value={newSiteLocation}
                  onChange={(e) =>
                    setNewSiteLocation(e.target.value)
                  }
                  placeholder={tx("Ex. Lyon, France", "e.g. Lyon, France")}
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">
                  {tx("Secteur", "Sector")}
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
                        {px(sector.label)}
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
                      {tx(
                        "Vous pourrez connecter les données ensuite",
                        "You can connect the data afterwards"
                      )}
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {tx(
                        "CSV, API ou capteurs IoT. Le site sera créé même sans données afin de pouvoir terminer votre configuration.",
                        "CSV, API or IoT sensors. The site is created even with no data, so you can finish setting up."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddSite(false)
                  setNameInvalid(false)
                }}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
              >
                {tx("Annuler", "Cancel")}
              </button>

              <button
                onClick={createSite}
                className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
              >
                {tx("Créer le site", "Create the site")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}