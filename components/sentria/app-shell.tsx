"use client"

import { useState, useEffect, useMemo } from "react"

import { inAccountScope, readSectors } from "@/lib/activities"
import { API_BASE, apiFetch } from "@/lib/api"
import { useCompanyIdentity } from "@/lib/company"
import { fetchAssignments, taskKeyFor } from "@/lib/crm"
import { useT, useTx, type MessageKey } from "@/lib/i18n"
import { withOurSector } from "@/lib/sector"
import { DocumentLanguage } from "./document-language"
import { Sidebar } from "./sidebar"
import type { ViewKey } from "./types"
import { Topbar, type Notification } from "./topbar"
import { DashboardView } from "./dashboard-view"
import { CalendarView } from "./calendar-view"
import { SitesView } from "./sites-view"
import { AskView } from "./ask-view"
import { PricingView } from "./pricing-view"
import { ProfileView } from "./profile-view"
import { SettingsView } from "./settings-view"
import { OnboardingView } from "./onboarding-modal"
import { ReportView } from "./report-view"
import { ContractorsView } from "./contractors-view"
import { TrackingView } from "./tracking-view"
import { AdminView } from "./admin-view"
import { UploadPanelHost } from "./upload-panel-host"
import { readAccountPlan } from "@/lib/plans"

/* Message keys, not labels. app-shell was holding a second copy of
   every view name next to the sidebar's. */
const META: Record<ViewKey, { title: MessageKey; subtitle: MessageKey }> = {
  dashboard: {
    title: "view.dashboard.title",
    subtitle: "view.dashboard.subtitle",
  },
  tracking: {
    title: "view.tracking.title",
    subtitle: "view.tracking.subtitle",
  },
  calendar: {
    title: "view.calendar.title",
    subtitle: "view.calendar.subtitle",
  },
  sites: {
    title: "view.sites.title",
    subtitle: "view.sites.subtitle",
  },
  ask: {
    title: "view.ask.title",
    subtitle: "view.ask.subtitle",
  },
  pricing: {
    title: "view.pricing.title",
    subtitle: "view.pricing.subtitle",
  },
  profile: {
    title: "view.profile.title",
    subtitle: "view.profile.subtitle",
  },
  settings: {
    title: "view.settings.title",
    subtitle: "view.settings.subtitle",
  },
  report: {
    title: "view.report.title",
    subtitle: "view.report.subtitle",
  },
  contractors: {
    title: "view.contractors.title",
    subtitle: "view.contractors.subtitle",
  },
  admin: {
    title: "view.admin.title",
    subtitle: "view.admin.subtitle",
  },
}

/** When the bell was last opened: alerts dated after it are unread. */
const NOTIFICATIONS_SEEN_KEY = "sentria_notifications_seen_at"

export function AppShell({
  email,
  name,
  username,
  onSignOut,
}: {
  email?: string
  name?: string
  username?: string | null
  onSignOut?: () => void
} = {}) {
  const t = useT()

  const [view, setView] = useState<ViewKey>("dashboard")
  // SentrIA staff (read at sign-in). Only shows the page: the API checks
  // the flag itself on every admin call.
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => setIsAdmin(readAccountPlan().isAdmin), [])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // The bell (B-22): critical alerts of the account's sectors and
  // activity that nobody has marked handled, newest first. Fetched by the
  // shell, which owns the chrome, and again on every page change so a
  // task closed on the board leaves the bell. Failure is silent on
  // purpose: an unreachable API leaves the bell quiet rather than showing
  // a dot for alerts nobody can read.
  const tx = useTx()
  const lang = tx("fr", "en")
  const { name: companyName } = useCompanyIdentity()

  const [bellAlerts, setBellAlerts] = useState<Notification[]>([])
  const [seenAt, setSeenAt] = useState("")

  useEffect(() => {
    try {
      setSeenAt(localStorage.getItem(NOTIFICATIONS_SEEN_KEY) ?? "")
    } catch {
      setSeenAt("")
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [alerts, handled] = await Promise.all([
        apiFetch(`${API_BASE}/alerts?lang=${lang}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((d) => (Array.isArray(d) ? d.map(withOurSector) : [])),
        companyName
          ? fetchAssignments(companyName).then((result) =>
              result.ok
                ? new Set(
                    result.data
                      .filter((a) => a.status === "done")
                      .map((a) => a.task_key)
                  )
                : new Set<string>()
            )
          : Promise.resolve(new Set<string>()),
      ])

      if (cancelled) return

      let businessType: string | null = null

      try {
        businessType = localStorage.getItem("sentria_business_type")
      } catch {
        businessType = null
      }

      const byTask = new Map<string, Notification>()

      for (const a of inAccountScope(alerts, readSectors(), businessType)) {
        if (a?.severity !== "CRITICAL") continue

        const key = taskKeyFor({ ...a, id: String(a.id ?? "") })

        if (handled.has(key)) continue

        const seen = byTask.get(key)

        if (!seen || (a.date ?? "") > seen.date) {
          byTask.set(key, {
            key,
            equipment: String(a.equipment ?? ""),
            message: String(a.message ?? "").trim(),
            date: String(a.date ?? ""),
            sector: a.sector ?? null,
          })
        }
      }

      setBellAlerts(
        Array.from(byTask.values()).sort((x, y) =>
          y.date.localeCompare(x.date)
        )
      )
    }

    load().catch((err) => {
      console.error("Failed to load the notifications:", err)
    })

    return () => {
      cancelled = true
    }
  }, [lang, companyName, view])

  const unreadCount = useMemo(() => {
    const since = Date.parse(seenAt)

    return bellAlerts.filter((n) => {
      const at = Date.parse(n.date)

      return !Number.isFinite(since) || (Number.isFinite(at) && at > since)
    }).length
  }, [bellAlerts, seenAt])

  function markNotificationsSeen() {
    const now = new Date().toISOString()

    setSeenAt(now)

    try {
      localStorage.setItem(NOTIFICATIONS_SEEN_KEY, now)
    } catch {
      /* A blocked localStorage keeps the count for this session only. */
    }
  }

  useEffect(() => {
    const onboarded = localStorage.getItem("sentria_onboarded")

    if (!onboarded) {
      setShowOnboarding(true)
    }
  }, [])

  function handleSearch(value: string) {
    setSearch(value)

    if (value.trim()) {
      setView("dashboard")
    }
  }

  // The shell is exactly the visible screen and never scrolls itself:
  // only <main> scrolls. It is positioned so a hidden absolute element
  // (an sr-only file input, say) is clipped here instead of making the
  // page taller and dragging the whole box when scrolled or focused.
  // h-dvh follows the phone's visible height as its URL bar shows/hides.
  return (
    <div className="relative flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Corrects the tab title and <html lang> once the operator's
          language is known. Renders nothing. */}
      <DocumentLanguage />
      <UploadPanelHost />

      {showOnboarding && (
        <OnboardingView name={name} onComplete={() => setShowOnboarding(false)} />
      )}

      <Sidebar
        active={view}
        onNavigate={(v) => {
          setView(v)
          setSearch("")
        }}
        open={open}
        onClose={() => setOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((current) => !current)}
        email={email}
        name={name}
        username={username}
        onSignOut={onSignOut}
        isAdmin={isAdmin}
      />

      <div
        className={[
          "flex min-w-0 flex-1 flex-col p-2 transition-all duration-300",
          "lg:py-3 lg:pl-0 lg:pr-3",
          collapsed ? "lg:ml-[92px]" : "lg:ml-[274px]",
        ].join(" ")}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-border bg-canvas shadow-lg">
          <div className="shrink-0">
            <Topbar
              title={t(META[view].title)}
              subtitle={t(META[view].subtitle)}
              onMenu={() => setOpen(true)}
              search={search}
              onSearch={handleSearch}
              unreadCount={unreadCount}
              notifications={bellAlerts}
              onNotificationsOpen={markNotificationsSeen}
              onOpenTracking={() => setView("tracking")}
            />
          </div>

          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            {view === "dashboard" && <DashboardView search={search} onNavigate={setView} />}
            {view === "tracking" && <TrackingView />}
            {view === "calendar" && <CalendarView />}
            {view === "sites" && <SitesView onNavigate={setView} />}
            {view === "ask" && (
              <AskView name={name} email={email} openCritical={bellAlerts} onNavigate={setView} />
            )}
            {view === "pricing" && <PricingView />}
            {view === "profile" && <ProfileView onNavigate={setView} username={username} email={email} />}
            {view === "settings" && <SettingsView />}
            {view === "report" && <ReportView />}
            {view === "contractors" && (
              <ContractorsView onNavigate={setView} />
            )}
            {view === "admin" && isAdmin && <AdminView />}
          </main>
        </div>
      </div>
    </div>
  )
}