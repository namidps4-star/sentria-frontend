"use client"

import { useState } from "react"
import { Sidebar, type ViewKey } from "./sidebar"
import { Topbar } from "./topbar"
import { DashboardView } from "./dashboard-view"
import { SitesView } from "./sites-view"
import { AskView } from "./ask-view"
import { PricingView } from "./pricing-view"
import { ProfileView } from "./profile-view"
import { SettingsView } from "./settings-view"


const META: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Vue globale des opérations" },
  sites: { title: "Sites", subtitle: "Gérez vos usines, ateliers et clients" },
  ask: { title: "Ask SentrIA", subtitle: "Votre analyste augmenté par l'IA" },
  pricing: { title: "Abonnement", subtitle: "Choisissez le plan adapté à vos opérations" },
  profile: { title: "Profil", subtitle: "Votre compte et votre activité" },
  settings: { title: "Paramètres", subtitle: "Langue, notifications et organisation" },
}

export function AppShell() {
  const [view, setView] = useState<ViewKey>("dashboard")
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar active={view} onNavigate={setView} open={open} onClose={() => setOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={META[view].title} subtitle={META[view].subtitle} onMenu={() => setOpen(true)} />

        <main className="flex-1 p-4 lg:p-8">
          {view === "dashboard" && <DashboardView />}
          {view === "sites" && <SitesView />}
          {view === "ask" && <AskView />}
          {view === "pricing" && <PricingView />}
          {view === "profile" && <ProfileView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  )
}