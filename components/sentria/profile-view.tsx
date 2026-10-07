"use client"

import { UsernameCard } from "./username-card"
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Building2,
  Clock3,
  Globe2,
  Layers,
  Mail,
  Pencil,
  AtSign,
  CreditCard,
  Upload,
  User,
} from "@/lib/icons"
import { useEffect, useMemo, useState } from "react"

import {
  activityLabel as activityName,
  inAccountScope,
  readSectors,
  opsTypeFor,
  readOpsTypes,
  sectorOfActivity,
  type SingleOpsType,
} from "@/lib/activities"
import { API_BASE, apiFetch } from "@/lib/api"
import { fetchAssignments, taskKeyFor, type Assignment } from "@/lib/crm"
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
import { withOurSector } from "@/lib/sector"
import { enterAt } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { PLAN_NAMES, readAccountPlan, readDepartments, trialDaysLeft, type AccountPlan } from "@/lib/plans"
import type { ViewKey } from "./types"
import { SectorTag } from "./sector-tag"

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

function timeOf(alert: LogisticsAlert): number {
  const t = new Date(alert.date).getTime()

  return Number.isFinite(t) ? t : 0
}

export function ProfileView({
  onNavigate,
  username = null,
  email = "",
}: {
  /** The sign-in email, shown with the username under "How you sign in". */
  email?: string
  /** The account's @username (migrations/006); null when it has none. */
  username?: string | null
  /** Lets the two buttons on this page actually go somewhere. They were
   *  both inert, which is its own small fiction. */
  onNavigate?: (view: ViewKey) => void
}) {
  const { name: companyName, timezoneId } = useCompanyIdentity()

  const [alerts, setAlerts] = useState<LogisticsAlert[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sectors, setSectors] = useState<string[]>([])
  const [opsTypes, setOpsTypes] = useState<SingleOpsType[]>([])
  const [businessType, setBusinessType] = useState<string | null>(null)

  const tx = useTx()
  const lang = tx("fr", "en")

  useEffect(() => {
    setSectors(readSectors())
    setOpsTypes(readOpsTypes())

    try {
      setBusinessType(localStorage.getItem("sentria_business_type"))
    } catch {
      setBusinessType(null)
    }
  }, [])

  // Refetched on a language switch: /alerts rebuilds messages (B-11).
  useEffect(() => {
    apiFetch(`${API_BASE}/alerts?lang=${lang}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        setAlerts(Array.isArray(d) ? d.map(withOurSector) : [])
      )
      .catch((error) => {
        console.error("Failed to load alerts for the profile page:", error)
      })
      .finally(() => setLoaded(true))
  }, [lang])

  /* Only the account's own signals (B-09): alerts of the sectors it
     selected and, in the sector of its configured activity, of that
     activity. Same rule as the dashboard: an alert with no recorded
     activity still counts until that sector has alerts that record one. */
  // Task states, for the resolution rate (B-18).
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)

  useEffect(() => {
    if (!companyName) {
      setAssignments(null)
      return
    }

    let cancelled = false

    fetchAssignments(companyName).then((result) => {
      if (!cancelled) setAssignments(result.ok ? result.data : null)
    })

    return () => {
      cancelled = true
    }
  }, [companyName])

  const accountAlerts = useMemo(
    () => inAccountScope(alerts, sectors, businessType),
    [alerts, sectors, businessType]
  )

  const empty = loaded && accountAlerts.length === 0

  // The plan and departments, read after mount (localStorage).
  const [account, setAccount] = useState<AccountPlan | null>(null)
  const [departmentCount, setDepartmentCount] = useState(0)
  useEffect(() => {
    setAccount(readAccountPlan())
    setDepartmentCount(Object.values(readDepartments()).reduce((n, ids) => n + ids.length, 0))
  }, [])

  /* SentrIA's job is to warn before something breaks or runs out, so the
     profile says how fresh the data is (stale data means late alerts) and
     which open critical alert has waited longest. */
  const mission = useMemo(() => {
    const times = accountAlerts.map(timeOf).filter((t) => Number.isFinite(t) && t > 0)
    const latest = times.length ? Math.max(...times) : null
    const hours = latest === null ? null : Math.max(0, (Date.now() - latest) / 3_600_000)

    const done = new Set((assignments ?? []).filter((a) => a.status === "done").map((a) => a.task_key))
    const openCritical = accountAlerts
      .filter((a) => a.severity === "CRITICAL")
      .filter((a) => !done.has(taskKeyFor({ ...a, id: String((a as { id?: unknown }).id ?? "") })))
      .sort((a, b) => timeOf(a) - timeOf(b))

    return { latest, hours, openCritical, next: openCritical[0] ?? null }
  }, [accountAlerts, assignments])

  const stats = useMemo(() => {
    const equipment = new Set(
      accountAlerts.map((a) => a.equipment).filter((e): e is string => Boolean(e))
    )

    const critical = accountAlerts.filter((a) => a.severity === "CRITICAL").length

    const since = Date.now() - 7 * 24 * 60 * 60 * 1000
    const week = accountAlerts.filter((a) => timeOf(a) >= since).length

    /* Share of the account's tasks marked done, keyed like the tracking
       board (one task per equipment and issue). No company or no tasks:
       a dash, never a made-up 0 %. */
    const tasks = new Set(
      accountAlerts.map((a) =>
        taskKeyFor({ ...a, id: String((a as { id?: unknown }).id ?? "") })
      )
    )
    const done = new Set(
      (assignments ?? [])
        .filter((a) => a.status === "done")
        .map((a) => a.task_key)
    )
    const resolved = [...tasks].filter((key) => done.has(key)).length
    const resolution =
      assignments === null || tasks.size === 0
        ? "—"
        : `${Math.round((resolved / tasks.size) * 100)} %`

    return [
      {
        label: tx("Équipements suivis", "Assets monitored"),
        value: equipment.size,
        icon: ActivityIcon,
      },
      {
        label: tx("Signaux reçus", "Signals received"),
        value: accountAlerts.length,
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
      {
        label: tx("Tâches résolues", "Tasks resolved"),
        value: resolution,
        icon: CheckCircle2,
      },
    ]
  }, [accountAlerts, assignments, tx])

  /* The sectors the operator selected, each carrying the number of alerts
     the backend attributed to it. A sector with nothing against it shows
     a zero, which is true, rather than being hidden. */
  const sectorRows = useMemo(() => {
    const counts = new Map<string, number>()

    for (const alert of accountAlerts) {
      if (alert.sector) {
        counts.set(alert.sector, (counts.get(alert.sector) ?? 0) + 1)
      }
    }

    return sectors.map((id) => ({
      id,
      label: sectorLabel(id, tx),
      count: counts.get(id) ?? 0,
    }))
  }, [sectors, accountAlerts, tx])

  const recent = useMemo(
    () => [...accountAlerts].sort((a, b) => timeOf(b) - timeOf(a)).slice(0, 5),
    [accountAlerts]
  )

  // The activity chosen in onboarding, then the logistics ops types:
  // a health account read "No activity selected" or a logistics label.
  const activityLabel =
    activityName(sectorOfActivity(businessType), businessType, tx) ??
    opsLabelFor(opsTypeFor(opsTypes), tx, opsTypes) ??
    tx("Aucune activité sélectionnée", "No activity selected")

  const monitoredActivities = [
    activityName(sectorOfActivity(businessType), businessType, tx),
    ...opsTypes.map((type) => tx(OPS_LABELS[type].fr, OPS_LABELS[type].en)),
  ].filter((label): label is string => Boolean(label))

  const zoneLabel = timezoneId ? timezoneFor(timezoneId).label : "—"

  const [assetsStat, signalsStat, criticalStat, weekStat, resolvedStat] = stats
  const resolvedShare =
    typeof resolvedStat.value === "string" && resolvedStat.value.endsWith("%")
      ? Number(resolvedStat.value.replace(/[^\d]/g, "")) / 100
      : 0

  /* The Ask SentrIA layout, as on Calendar: lime card (who), grey panel
     (what happened lately, in a chat line, then the signals), black card
     (the counters). */
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_290px]">
        {/* -------------------------------------------------------- LEFT */}
        <div className="flex flex-col gap-4">
          <div className="t-enter rounded-[28px] bg-brand p-5 text-[#141414]" style={enterAt(0)}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ink)] text-lg font-bold text-brand">
                {companyName ? initialsOf(companyName) : <User className="h-6 w-6" aria-hidden="true" />}
              </span>
              <button
                type="button"
                onClick={() => onNavigate?.("settings")}
                aria-label={tx("Modifier", "Edit")}
                title={tx("Modifier", "Edit")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#141414] shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <h2 className="mt-5 break-words font-heading text-2xl font-semibold leading-tight tracking-tight">
              {companyName || tx("Organisation non renseignée", "Organisation not set")}
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#141414]/70">{activityLabel}</p>

            <div className="mt-4">
              <div
                className="h-2 overflow-hidden rounded-full bg-white/70"
                role="progressbar"
                aria-label={tx("Tâches résolues", "Tasks resolved")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(resolvedShare * 100)}
              >
                <div
                  className="h-full rounded-full bg-[var(--ink)] transition-[width] duration-500"
                  style={{ width: `${Math.round(resolvedShare * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
                <span>{resolvedStat.label}</span>
                <span className="tabular-nums">{loaded ? resolvedStat.value : "—"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-card p-5 shadow-sm">
            <h3 className="font-heading text-xl font-semibold tracking-tight">{tx("Mon espace", "My workspace")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx("Ce qui a été renseigné à l'onboarding", "What was filled in during setup")}
            </p>
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              {[
                { icon: Building2, label: tx("Organisation", "Organisation"), value: companyName || tx("Non renseignée", "Not set") },
                { icon: Globe2, label: tx("Fuseau horaire", "Time zone"), value: zoneLabel },
                {
                  icon: Layers,
                  label: tx("Activités suivies", "Activities monitored"),
                  value: monitoredActivities.length > 0 ? monitoredActivities.join(", ") : tx("Aucune", "None"),
                },
              ].map((row) => (
                <div key={row.label} className="rounded-2xl bg-muted px-4 py-2.5">
                  <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <row.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 font-semibold">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* ------------------------------------------------------ CENTER */}
        <section className="t-enter flex min-w-0 flex-col rounded-[28px] bg-foreground/[0.055] p-5 sm:p-6" style={enterAt(0.4)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-heading text-3xl font-semibold leading-[1.05] tracking-tight">
                {tx("Signaux récents", "Recent signals")}
              </h2>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-brand ring-2 ring-brand/30" aria-hidden="true" />
                {tx("À l'heure de votre fuseau", "In your own time zone")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("dashboard")}
              className="shrink-0 rounded-full bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Voir le tableau de bord", "See the dashboard")}
            </button>
          </div>

          <div className="mt-5 max-w-[85%] self-start rounded-[22px] bg-[var(--ink)] p-4 text-sm leading-relaxed text-white">
            {!loaded
              ? tx("Je charge votre activité…", "Loading your activity…")
              : empty
                ? tx(
                    "Ces compteurs sont à zéro parce qu'aucun signal n'a encore été importé, pas parce que tout va bien. Importez un CSV depuis le tableau de bord pour les remplir.",
                    "These counters are at zero because no signal has been imported yet, not because all is well. Import a CSV from the dashboard to fill them."
                  )
                : tx(
                    `${assetsStat.value} équipement${Number(assetsStat.value) > 1 ? "s" : ""} suivi${Number(assetsStat.value) > 1 ? "s" : ""}, ${criticalStat.value} signal${Number(criticalStat.value) > 1 ? "aux" : ""} critique${Number(criticalStat.value) > 1 ? "s" : ""}, ${weekStat.value} sur les 7 derniers jours.`,
                    `${assetsStat.value} asset${assetsStat.value === 1 ? "" : "s"} monitored, ${criticalStat.value} critical signal${criticalStat.value === 1 ? "" : "s"}, ${weekStat.value} over the last 7 days.`
                  )}
          </div>

          {/* Mission: is the data fresh enough to warn in time, and what
              to act on first. */}
          {loaded && !empty && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(() => {
                const h = mission.hours ?? 0
                const tone = h < 24 ? "success" : h < 24 * 7 ? "warning" : "danger"
                const age =
                  h < 1
                    ? tx("il y a moins d'une heure", "less than an hour ago")
                    : h < 48
                      ? tx(`il y a ${Math.round(h)} h`, `${Math.round(h)} h ago`)
                      : tx(`il y a ${Math.round(h / 24)} jours`, `${Math.round(h / 24)} days ago`)
                return (
                  <div
                    className="rounded-[22px] p-4"
                    style={{ background: `var(--tag-${tone}-bg)`, color: `var(--tag-${tone}-fg)` }}
                    data-testid="profile-freshness"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                      {tx("Fraîcheur des données", "Data freshness")}
                    </p>
                    <p className="mt-1 font-heading text-xl font-bold">{age}</p>
                    <p className="mt-1 text-xs leading-snug opacity-90">
                      {tone === "success"
                        ? tx("À jour : les alertes partent à temps.", "Up to date: alerts go out in time.")
                        : tx(
                            "Importez des données récentes, sinon SentrIA prévient trop tard.",
                            "Import recent data, or SentrIA warns too late."
                          )}
                    </p>
                    {tone !== "success" && (
                      <button
                        type="button"
                        onClick={() => onNavigate?.("dashboard")}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        {tx("Importer", "Import")}
                      </button>
                    )}
                  </div>
                )
              })()}

              <div className="rounded-[22px] bg-card p-4 shadow-sm" data-testid="profile-next">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {tx("Critique en attente depuis le plus longtemps", "Critical waiting longest")}
                </p>
                {mission.next ? (
                  <>
                    <p className="mt-1 truncate font-heading text-xl font-bold">
                      {mission.next.equipment || tx("Équipement non nommé", "Unnamed asset")}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{mission.next.message}</p>
                    <button
                      type="button"
                      onClick={() => onNavigate?.("tracking")}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-[#141414]"
                    >
                      {tx("Ouvrir le suivi", "Open Tracking")}
                      <span className="rounded-full bg-[var(--ink)] px-1.5 text-[10px] text-brand tabular-nums">
                        {mission.openCritical.length}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-1 font-heading text-xl font-bold">{tx("Rien de critique", "Nothing critical")}</p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                      {tx("Toutes les alertes critiques sont traitées.", "Every critical alert has been handled.")}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {recent.map((alert, index) => {
                const critical = alert.severity === "CRITICAL"
                const when = formatInCompanyZone(alert.date, tx, timezoneId)

                return (
                  <li
                    key={`${alert.equipment}-${alert.date}-${index}`}
                    className="flex items-center gap-3 rounded-[22px] bg-card px-4 py-3 shadow-sm"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        critical
                          ? "bg-[var(--tag-danger-bg)] text-[var(--tag-danger-fg)]"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {critical ? (
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Bell className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {alert.equipment || tx("Équipement non nommé", "Unnamed asset")}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{alert.message}</span>
                    </span>

                    {when && (
                      <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        {when}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {/* The sectors, each with the number of signals it received. A
              sector with nothing against it shows a zero, which is true. */}
          <p className="mt-5 px-1 text-xs text-muted-foreground">{tx("Secteurs actifs :", "Active sectors:")}</p>
          {sectorRows.length === 0 ? (
            <p className="mt-2 self-start rounded-full bg-card px-4 py-2 text-sm">
              {tx("Aucun secteur n'a été sélectionné à l'onboarding.", "No sector was selected during setup.")}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {sectorRows.map((sector) => (
                <span
                  key={sector.id}
                  className="inline-flex items-center gap-2 rounded-full bg-card py-1.5 pl-4 pr-1.5 text-sm font-medium"
                >
                  {sector.label}
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold tabular-nums">
                    {loaded ? sector.count : "—"}
                  </span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------------- RIGHT */}
        <div className="flex flex-col gap-4 lg:col-start-2 xl:col-start-auto">
        <div className="t-enter rounded-[28px] bg-[var(--ink)] p-5 text-white" style={enterAt(0.8)}>
          <div className="flex items-center justify-between">
            <p className="font-heading text-xl font-semibold tracking-tight">{tx("Votre activité", "Your activity")}</p>
            <SectorTag />
          </div>
          <dl className="mt-4 space-y-2.5 text-xs">
            {[assetsStat, signalsStat, criticalStat, weekStat].map((stat) => (
              <div key={stat.label} className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-white/55">
                  <stat.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {stat.label}
                </dt>
                <dd
                  className={cn(
                    "font-semibold tabular-nums",
                    stat === criticalStat && loaded && Number(stat.value) > 0 && "text-[#ffb8bf]"
                  )}
                >
                  {loaded ? stat.value : "—"}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
            <span className="text-xs text-white/55">{resolvedStat.label}</span>
            <span className="font-heading text-4xl font-bold leading-none text-brand tabular-nums">
              {loaded ? resolvedStat.value : "—"}
            </span>
          </div>
        </div>

        {/* The plan: what the account may do, and until when. */}
        {account && (
          <div className="rounded-[28px] bg-card p-5 shadow-sm" data-testid="profile-plan">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading text-xl font-semibold tracking-tight">{tx("Votre offre", "Your plan")}</p>
              <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 font-heading text-2xl font-bold">
              {account.isAdmin ? tx("Admin SentrIA", "SentrIA admin") : PLAN_NAMES[account.effective]}
            </p>
            {!account.isAdmin && account.trialEndsAt && account.effective !== account.plan && (
              <p className="mt-1 inline-block rounded-full bg-[var(--tag-info-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--tag-info-fg)]">
                {tx(
                  `Essai : encore ${trialDaysLeft(account.trialEndsAt)} jour${trialDaysLeft(account.trialEndsAt) > 1 ? "s" : ""}`,
                  `Trial: ${trialDaysLeft(account.trialEndsAt)} day${trialDaysLeft(account.trialEndsAt) === 1 ? "" : "s"} left`
                )}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {tx(
                `${departmentCount} département${departmentCount > 1 ? "s" : ""} surveillé${departmentCount > 1 ? "s" : ""}`,
                `${departmentCount} department${departmentCount === 1 ? "" : "s"} monitored`
              )}
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.("pricing")}
              className="mt-3 rounded-full bg-muted px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/70"
            >
              {tx("Voir les offres", "See the plans")}
            </button>
          </div>
        )}

        {/* How this account signs in: both work. */}
        <div className="rounded-[28px] bg-card p-5 shadow-sm" data-testid="profile-signin">
          <p className="font-heading text-xl font-semibold tracking-tight">{tx("Connexion", "How you sign in")}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2.5">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{email || "—"}</span>
            </li>
            <li className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2.5">
              <AtSign className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">
                {username ? `@${username}` : tx("Pas encore de nom d'utilisateur", "No username yet")}
              </span>
            </li>
          </ul>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            {username
              ? tx("L'un ou l'autre, avec votre mot de passe.", "Either one, with your password.")
              : tx("Choisissez-en un ci-dessous pour vous connecter avec.", "Choose one below to sign in with it.")}
          </p>
        </div>
        </div>
      </div>

      <UsernameCard username={username} />
    </div>
  )
}
