"use client"

import { useEffect, useState } from "react"
import { Sidebar, type ViewKey } from "./sidebar"
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
    <div className="min-h-screen bg-[#111111] p-0 lg:p-4">
      {showOnboarding && (
        <OnboardingView
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      <div className="relative min-h-screen overflow-hidden rounded-none bg-[#111111] lg:min-h-[calc(100vh-2rem)] lg:rounded-[32px]">
        <Sidebar
          active={view}
          onNavigate={(v) => {
            setView(v)
            setSearch("")
          }}
          open={open}
          onClose={() => setOpen(false)}
        />

        <div className="min-h-screen lg:ml-[268px] lg:min-h-[calc(100vh-2rem)]">
          <div className="flex min-h-screen flex-col overflow-hidden bg-background lg:min-h-[calc(100vh-2rem)] lg:rounded-[32px]">
            <Topbar
              title={META[view].title}
              subtitle={META[view].subtitle}
              onMenu={() => setOpen(true)}
              search={search}
              onSearch={handleSearch}
            />

            <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-8">
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
    </div>
  )
}