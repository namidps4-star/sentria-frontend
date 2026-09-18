"use client"

import {
  Activity as ActivityIcon,
  AlertTriangle,
  Bell,
  Building2,
  Clock3,
  Globe2,
  Inbox,
  Layers,
  Pencil,
  Sparkles,
  User,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  opsTypeFor,
  readOpsTypes,
  type SingleOpsType,
} from "@/lib/activities"
import { API_BASE } from "@/lib/api"
import {
  formatInCompanyZone,
  initialsOf,
  timezoneFor,
  useCompanyIdentity,
} from "@/lib/company"
import {
  OPS_LABELS,
  opsLabelFor,
  type LogisticsAlert,
} from "@/lib/logistics-signals"
import { useTx } from "@/lib/i18n"
import { sectorLabel } from "@/lib/priorities"
import { cn } from "@/lib/utils"
import type { ViewKey } from "./types"

/* -------------------------------------------------------------------------- */
/* Why this file no longer holds any constants                                */
/* -------------------------------------------------------------------------- */

/* This page used to be a persona. It showed "Aïcha Mbaye, Responsable des
   opérations, SentrIA Operations, aicha.mbaye@sentria.io" above a green
   presence dot, a Pro badge and an Administrateur access level, then four
   stat cards reading 42 / 127 / 8 / 24, six sectors with counts summing to
   that same 42, and four timestamped events about a machine CNC-04 and a
   générateur EST-02. Every one of those numbers was a literal in this
   file. None of them came from anywhere, and they were internally
   consistent enough to be believed.

   Nothing in the product knows a person: there is no account system and
   onboarding never asks for a name, a role or an email. What it does know
   is the company, the timezone, the sectors and activities the operator
   selected, and the alerts the backend returns. The page is built from
   those and says so plainly when there are none.

   The "Compte sécurisé / Sécurité active" card is gone rather than
   rewritten. The API has no authentication at all, so a green check
   claiming the operator's data is protected was the most costly sentence
   on the page. */

function readSectors(): string[] {
  if (typeof window === "undefined") return []

  try {
    const many = JSON.parse(localStorage.getItem("sentria_sectors") || "null")

    if (Array.isArray(many)) {
      const valid = many.filter((s): s is string => typeof s === "string")

      if (valid.length > 0) return valid
    }
  } catch {
    /* fall through to the single-value key */
  }

  try {
    const one = localStorage.getItem("sentria_sector")

    return one ? [one] : []
  } catch {
    return []
  }
}

function timeOf(alert: LogisticsAlert): number {
  const t = new Date(alert.date).getTime()

  return Number.isFinite(t) ? t : 0
}

export function ProfileView({
  onNavigate,
}: {
  /** Lets the two buttons on this page actually go somewhere. They were
   *  both inert, which is its own small fiction. */
  onNavigate?: (view: ViewKey) => void
}) {
  const { name: companyName, timezoneId } = useCompanyIdentity()

  const [alerts, setAlerts] = useState<LogisticsAlert[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sectors, setSectors] = useState<string[]>([])
  const [opsTypes, setOpsTypes] = useState<SingleOpsType[]>([])

  useEffect(() => {
    setSectors(readSectors())
    setOpsTypes(readOpsTypes())

    fetch(`${API_BASE}/alerts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAlerts(Array.isArray(d) ? d : []))
      .catch((error) => {
        console.error("Failed to load alerts for the profile page:", error)
      })
      .finally(() => setLoaded(true))
  }, [])

  const tx = useTx()

  const empty = loaded && alerts.length === 0

  const stats = useMemo(() => {
    const equipment = new Set(
      alerts.map((a) => a.equipment).filter((e): e is string => Boolean(e))
    )

    const critical = alerts.filter((a) => a.severity === "CRITICAL").length

    const since = Date.now() - 7 * 24 * 60 * 60 * 1000
    const week = alerts.filter((a) => timeOf(a) >= since).length

    return [
      {
        label: tx("Équipements suivis", "Assets monitored"),
        value: equipment.size,
        icon: ActivityIcon,
      },
      {
        label: tx("Signaux reçus", "Signals received"),
        value: alerts.length,
        icon: Bell,
      },
      {
        label: tx("Signaux critiques", "Critical signals"),
        value: critical,
        icon: AlertTriangle,
      },
      {
        label: tx("Signaux sur 7 jours", "Signals over 7 days"),
        value: week,
        icon: Clock3,
      },
    ]
  }, [alerts, tx])

  /* The sectors the operator selected, each carrying the number of alerts
     the backend attributed to it. A sector with nothing against it shows
     a zero, which is true, rather than being hidden. */
  const sectorRows = useMemo(() => {
    const counts = new Map<string, number>()

    for (const alert of alerts) {
      if (alert.sector) {
        counts.set(alert.sector, (counts.get(alert.sector) ?? 0) + 1)
      }
    }

    return sectors.map((id) => ({
      id,
      label: sectorLabel(id, tx),
      count: counts.get(id) ?? 0,
    }))
  }, [sectors, alerts, tx])

  const recent = useMemo(
    () => [...alerts].sort((a, b) => timeOf(b) - timeOf(a)).slice(0, 5),
    [alerts]
  )

  const activityLabel =
    opsLabelFor(opsTypeFor(opsTypes), tx, opsTypes) ??
    tx("Aucune activité sélectionnée", "No activity selected")

  const zoneLabel = timezoneId ? timezoneFor(timezoneId).label : "—"

  return (
    <div className="space-y-6">
      {/* IDENTITY */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="relative h-28 bg-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(174,255,0,0.25),transparent_35%)]" />

          <div className="absolute bottom-4 left-6 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-background/50">
              {tx("Espace SentrIA", "SentrIA workspace")}
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-accent text-xl font-bold text-accent-foreground shadow-sm">
            {companyName ? (
              initialsOf(companyName)
            ) : (
              <User className="h-7 w-7" aria-hidden="true" />
            )}
          </div>

          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="truncate font-heading text-2xl font-bold tracking-tight">
                {companyName ||
                  tx("Organisation non renseignée", "Organisation not set")}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {activityLabel}
              </p>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4" aria-hidden="true" />
                  {zoneLabel}
                </span>

                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4" aria-hidden="true" />
                  {sectorRows.length > 0
                    ? sectorRows.map((s) => s.label).join(", ")
                    : tx("Aucun secteur sélectionné", "No sector selected")}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.("settings")}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {tx("Modifier", "Edit")}
            </button>
          </div>
        </div>
      </div>

      {/* COUNTERS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon

          return (
            <div
              key={stat.label}
              className="rounded-3xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>

              <p className="mt-5 font-heading text-3xl font-bold tracking-tight">
                {loaded ? stat.value : "—"}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {empty && (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-4 text-sm leading-6 text-muted-foreground">
          Ces compteurs sont à zéro parce qu&apos;aucun signal n&apos;a
          encore été importé, pas parce que tout va bien. Importez un CSV
          depuis le tableau de bord pour les remplir.
        </p>
      )}

      {/* ACCOUNT + SECTORS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </div>

            <div>
              <h3 className="font-heading text-lg font-bold">
                {tx("Mon espace", "My workspace")}
              </h3>

              <p className="text-sm text-muted-foreground">
                {tx(
                  "Ce qui a été renseigné à l'onboarding",
                  "What was filled in during setup"
                )}
              </p>
            </div>
          </div>

          <dl className="mt-6 space-y-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tx("Organisation", "Organisation")}
              </dt>

              <dd className="mt-1 text-sm font-semibold">
                {companyName || tx("Non renseignée", "Not set")}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tx("Fuseau horaire", "Time zone")}
              </dt>

              <dd className="mt-1 text-sm font-semibold">{zoneLabel}</dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tx("Activités suivies", "Activities monitored")}
              </dt>

              <dd className="mt-1 text-sm font-semibold">
                {opsTypes.length > 0
                  ? opsTypes.map((type) => OPS_LABELS[type]).join(", ")
                  : tx("Aucune", "None")}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold">
                {tx("Secteurs actifs", "Active sectors")}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {tx(
                  "Vos secteurs, et les signaux reçus pour chacun.",
                  "Your sectors, and the signals received for each."
                )}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <Layers className="h-4 w-4 text-accent-foreground" aria-hidden="true" />
            </div>
          </div>

          {sectorRows.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              {tx(
                "Aucun secteur n'a été sélectionné à l'onboarding.",
                "No sector was selected during setup."
              )}
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sectorRows.map((sector) => (
                <div
                  key={sector.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-accent"
                      aria-hidden="true"
                    />

                    <span className="truncate text-sm font-semibold">
                      {sector.label}
                    </span>
                  </div>

                  <span className="shrink-0 text-xs text-muted-foreground">
                    {loaded ? sector.count : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RECENT SIGNALS */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-heading text-lg font-bold">
              {tx("Signaux récents", "Recent signals")}
            </h3>

            <p className="text-sm text-muted-foreground">
              {tx(
                "Les dernières alertes reçues, à l'heure de votre fuseau.",
                "The latest alerts received, in your own time zone."
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.("dashboard")}
            className="rounded text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {tx("Voir le tableau de bord →", "See the dashboard →")}
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>

            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              {loaded
                ? tx(
                    "Aucun signal reçu pour l'instant. Cette liste se remplira dès le premier import.",
                    "No signal received yet. This list fills up from the first import."
                  )
                : tx("Chargement des signaux…", "Loading signals…")}
            </p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-border">
            {recent.map((alert, index) => {
              const critical = alert.severity === "CRITICAL"
              const when = formatInCompanyZone(alert.date, timezoneId)

              return (
                <li
                  key={`${alert.equipment}-${alert.date}-${index}`}
                  className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      critical
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {critical ? (
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Bell className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {alert.equipment ||
                        tx("Équipement non nommé", "Unnamed asset")}
                    </p>

                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {alert.message}
                    </p>
                  </div>

                  {when && (
                    <div className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {when}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* PRODUCT */}
      <div className="rounded-3xl bg-foreground p-6 text-background">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
            <Sparkles className="h-4 w-4 text-accent-foreground" aria-hidden="true" />
          </div>

          <div>
            <h3 className="font-heading font-bold">
              {tx("Intelligence SentrIA", "SentrIA intelligence")}
            </h3>

            <p className="mt-1 text-sm text-background/60">
              {tx(
                "Analyse prédictive et recommandations pour anticiper les risques opérationnels.",
                "Predictive analysis and recommendations, so operational risk is seen coming."
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
