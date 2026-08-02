"use client"

import {
  LayoutDashboard,
  Building2,
  Sparkles,
  User,
  Settings,
  CreditCard,
  Zap,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewKey = "dashboard" | "sites" | "ask" | "pricing" | "profile" | "settings"

const NAV: { key: ViewKey; label: string; icon: LucideIcon; badge?: string }[] = [
  { key: "dashboard", label: "Dashboard",   icon: LayoutDashboard },
  { key: "sites",     label: "Sites",       icon: Building2 },
  { key: "ask",       label: "Ask SentrIA", icon: Sparkles, badge: "IA" },
  { key: "pricing",   label: "Abonnement",  icon: CreditCard },
  { key: "profile",   label: "Profil",      icon: User },
  { key: "settings",  label: "Paramètres",  icon: Settings },
]

function SentriaLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0A0A0A"/>
      {/* Pulse signal line */}
      <polyline
        points="4,16 8,16 11,8 15,24 19,10 23,16 28,16"
        fill="none"
        stroke="#AEFF00"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
}: {
  active: ViewKey
  onNavigate: (v: ViewKey) => void
  open: boolean
  onClose: () => void
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
      {/* Logo */}
        <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-4">
          <img
            src="public/sentria logo.png"
            alt="Sentria"
            className="h-6 w-auto brightness-0 invert"
          />
          <span className="text-[10px] tracking-widest text-sidebar-foreground/30 uppercase">Ops</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-3 mt-2">
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = active === item.key
            return (
              <button
                key={item.key}
                onClick={() => { onNavigate(item.key); onClose() }}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-accent-foreground" : "text-sidebar-foreground/40 group-hover:text-sidebar-accent-foreground"
                  )}
                />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom CTA */}
        <div className="mt-auto p-3">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-accent-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-foreground">Plan Pro</span>
            </div>
            <p className="text-xs text-sidebar-foreground/60 leading-relaxed mb-3">
              Sites illimités, IoT, rapports avancés et support prioritaire.
            </p>
            <button
              onClick={() => { onNavigate("pricing"); onClose() }}
              className="w-full rounded-xl bg-foreground py-2 text-xs font-bold text-background transition-opacity hover:opacity-80"
            >
              Passer au Pro →
            </button>
          </div>

          {/* User row */}
          <div className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-sidebar-accent transition-colors cursor-pointer">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground shrink-0">
              JK
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-foreground truncate">Jean Kokou</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">Admin</p>
            </div>
            <LifeBuoy className="h-4 w-4 text-sidebar-foreground/30 shrink-0" />
          </div>
        </div>
      </aside>
    </>
  )
}
