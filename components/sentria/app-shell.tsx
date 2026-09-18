"use client"

import { useState, useEffect } from "react"

import { API_BASE } from "@/lib/api"
import { useT, type MessageKey } from "@/lib/i18n"
import { Sidebar } from "./sidebar"
import type { ViewKey } from "./types"
import { Topbar } from "./topbar"
import { DashboardView } from "./dashboard-view"
import { SitesView } from "./sites-view"
import { AskView } from "./ask-view"
import { PricingView } from "./pricing-view"
import { ProfileView } from "./profile-view"
import { SettingsView } from "./settings-view"
import { OnboardingView } from "./onboarding-modal"
import { ReportView } from "./report-view"
import { ContractorsView } from "./contractors-view"

/* Message keys, not labels. app-shell was holding a second copy of
   every view name next to the sidebar's. */
const META: Record<ViewKey, { title: MessageKey; subtitle: MessageKey }> = {
  dashboard: {
    title: "view.dashboard.title",
    subtitle: "view.dashboard.subtitle",
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
}

export function AppShell() {
  const t = useT()

  const [view, setView] = useState<ViewKey>("dashboard")
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // The shell owns the chrome, so the bell's count is fetched here rather
  // than reaching into the dashboard's state. Failure is silent on
  // purpose: an unreachable API should leave the bell quiet, not show a
  // dot implying unread alerts nobody can read.
  const [criticalCount, setCriticalCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE}/alerts`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (cancelled) return

        setCriticalCount(
          Array.isArray(d)
            ? d.filter((a) => a?.severity === "CRITICAL").length
            : 0
        )
      })
      .catch((err) => {
        console.error("Failed to load the alert count:", err)
      })

    return () => {
      cancelled = true
    }
  }, [])

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

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {showOnboarding && (
        <OnboardingView onComplete={() => setShowOnboarding(false)} />
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
      />

      <div
        className={[
          "flex min-w-0 flex-1 flex-col p-2 transition-all duration-300",
          "lg:py-3 lg:pl-0 lg:pr-3",
          collapsed ? "lg:ml-[92px]" : "lg:ml-[274px]",
        ].join(" ")}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-lg">
          <div className="shrink-0">
            <Topbar
              title={t(META[view].title)}
              subtitle={t(META[view].subtitle)}
              onMenu={() => setOpen(true)}
              search={search}
              onSearch={handleSearch}
              unreadCount={criticalCount}
            />
          </div>

          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            {view === "dashboard" && <DashboardView search={search} />}
            {view === "sites" && <SitesView />}
            {view === "ask" && <AskView />}
            {view === "pricing" && <PricingView />}
            {view === "profile" && <ProfileView onNavigate={setView} />}
            {view === "settings" && <SettingsView />}
            {view === "report" && <ReportView />}
            {view === "contractors" && (
              <ContractorsView onNavigate={setView} />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}