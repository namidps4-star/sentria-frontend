
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
    subtitle: "Votre analyste augmenté par l’IA",
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
    <div className="min-h-screen bg-background text-foreground">
      {showOnboarding && (
        <OnboardingView
          onComplete={() => setShowOnboarding(false)}
        />
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
        onToggleCollapse={() =>
          setCollapsed((current) => !current)
        }
      />

      <div
        className={[
          "min-h-screen px-4 py-4 transition-all duration-300",
          "lg:px-8 lg:py-8",
          collapsed
            ? "lg:pl-[108px]"
            : "lg:pl-[290px]",
        ].join(" ")}
      >
        <div className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[32px] bg-card shadow-sm lg:min-h-[calc(100vh-4rem)]">
          <Topbar
            title={META[view].title}
            subtitle={META[view].subtitle}
            onMenu={() => setOpen(true)}
            search={search}
            onSearch={handleSearch}
          />

          <main className="flex-1 p-4 lg:p-8">
            {view === "dashboard" && (
              <DashboardView search={search} />
            )}

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
