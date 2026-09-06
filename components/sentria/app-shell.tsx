"use client"

import { useState, useEffect } from "react"
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

const META: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Vue globale des opérations",
  },
  sites: {
    title: "Sites",
    subtitle: "Gérez vos usines, ateliers et clients",
  },
  ask: {
    title: "Ask SentrIA",
    subtitle: "Votre analyste augmenté par l'IA",
  },
  pricing: {
    title: "Abonnement",
    subtitle: "Choisissez le plan adapté à vos opérations",
  },
  profile: {
    title: "Profil",
    subtitle: "Votre compte et votre activité",
  },
  settings: {
    title: "Paramètres",
    subtitle: "Langue, notifications et organisation",
  },
  report: {
    title: "Rapport",
    subtitle: "Analyse détaillée de vos opérations",
  },
}

export function AppShell() {
  const [view, setView] = useState<ViewKey>("dashboard")
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

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
    // `h-screen` on the shell (no overflow-hidden here — that would clip the
    // sidebar's hover tooltips and active-tab notch, since ancestor overflow
    // clips fixed-position children too). Locking is achieved structurally:
    // every child is height-bound via flex stretch, and only <main> scrolls.
    <div className="flex h-screen bg-background text-foreground">
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

      {/* Padding here (not margin on the card) is what creates the floating
          gap around the card without the card's own height ever overflowing
          its parent — the parent already has a fixed height from flex
          stretch, and padding just eats into that space cleanly. */}
      <div
        className={[
          "flex min-w-0 flex-1 flex-col p-2 transition-all duration-300",
          "lg:py-3 lg:pl-0 lg:pr-3",
          collapsed ? "lg:ml-[92px]" : "lg:ml-[274px]",
        ].join(" ")}
      >
        {/* The floating rounded card, matching the sidebar's rounded-[28px]
            treatment: topbar + scrollable content live inside this one
            card, so the whole shell reads as sidebar-card + content-card. */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-lg">
          {/* shrink-0 keeps the topbar's own height fixed so it never gets
              squashed or scrolled by the flex-1 content area below it */}
          <div className="shrink-0">
            <Topbar
              title={META[view].title}
              subtitle={META[view].subtitle}
              onMenu={() => setOpen(true)}
              search={search}
              onSearch={handleSearch}
            />
          </div>

          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            {view === "dashboard" && <DashboardView search={search} />}
            {view === "sites" && <SitesView />}
            {view === "ask" && <AskView />}
            {view === "pricing" && <PricingView />}
            {view === "profile" && <ProfileView />}
            {view === "settings" && <SettingsView />}
            {view === "report" && <ReportView />}
          </main>
        </div>
      </div>
    </div>
  )
}