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
<<<<<<< HEAD
=======
  FileText,
>>>>>>> feature/layout
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

<<<<<<< HEAD
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
=======
export type ViewKey =
  | "dashboard"
  | "sites"
  | "ask"
  | "report"
  | "pricing"
  | "profile"
  | "settings"

const NAV_SECTIONS: {
  title: string
  items: {
    key: ViewKey
    label: string
    icon: LucideIcon
    badge?: string
  }[]
}[] = [
    {
      title: "Overview",
      items: [
        {
          key: "dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          key: "sites",
          label: "Sites",
          icon: Building2,
        },
      ],
    },
    {
      title: "Intelligence",
      items: [
        {
          key: "ask",
          label: "Ask SentrIA",
          icon: Sparkles,
          badge: "IA",
        },
        {
          key: "report",
          label: "Rapports",
          icon: FileText,
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          key: "pricing",
          label: "Abonnement",
          icon: CreditCard,
        },
        {
          key: "profile",
          label: "Profil",
          icon: User,
        },
        {
          key: "settings",
          label: "Paramètres",
          icon: Settings,
        },
      ],
    },
  ]
>>>>>>> feature/layout

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
<<<<<<< HEAD
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden
=======
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
>>>>>>> feature/layout
        />
      )}

      <aside
        className={cn(
<<<<<<< HEAD
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:z-auto lg:translate-x-0",
=======
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col",
          "border-r border-sidebar-border",
          "bg-sidebar text-sidebar-foreground",
          "transition-transform duration-300",
          "lg:static lg:z-auto lg:translate-x-0",
>>>>>>> feature/layout
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
<<<<<<< HEAD
      {/* Logo */}
        <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-4">
          <img
            src="/sentria logo"
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
=======
        <div className="flex h-[76px] items-center justify-between border-b border-sidebar-border px-5">
          <img
            src="/sentria logo.png"
            alt="SentrIA"
            className="h-11 w-auto object-contain"
          />

          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/25">
            Ops
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div
              key={section.title}
              className={cn(
                sectionIndex > 0 && "mt-6",
              )}
            >
              <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/30">
                {section.title}
              </p>

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = active === item.key

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        onNavigate(item.key)
                        onClose()
                      }}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5",
                        "text-sm font-medium",
                        "transition-all duration-200",

                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                      )}

                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-accent-foreground"
                            : "text-sidebar-foreground/35 group-hover:text-sidebar-accent-foreground",
                        )}
                        strokeWidth={1.8}
                      />

                      <span className="flex-1 text-left">
                        {item.label}
                      </span>

                      {/* AI badge */}
                      {item.badge && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom area */}
        <div className="border-t border-sidebar-border p-3">
          {/* Pro card */}
          <button
            type="button"
            onClick={() => {
              onNavigate("pricing")
              onClose()
            }}
            className="group mb-2 w-full rounded-2xl border border-sidebar-border bg-sidebar-accent p-4 text-left transition-colors hover:bg-sidebar-accent/70"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
                <Zap className="h-3.5 w-3.5 text-accent-foreground" />
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent-foreground">
                  Plan Pro
                </p>

                <p className="mt-0.5 text-[9px] text-sidebar-foreground/40">
                  Intelligence avancée
                </p>
              </div>
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-sidebar-foreground/45">
              Sites illimités, IoT, rapports avancés et support prioritaire.
            </p>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-sidebar-foreground">
                Gérer mon abonnement
              </span>

              <span className="text-sm text-accent-foreground transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </div>
          </button>

          {/* User */}
          <button
            type="button"
            onClick={() => {
              onNavigate("profile")
              onClose()
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              JK
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">
                Jean Kokou
              </p>

              <p className="mt-0.5 truncate text-[10px] text-sidebar-foreground/35">
                Administrateur
              </p>
            </div>

            <User className="h-4 w-4 text-sidebar-foreground/25" />
          </button>

          {/* Support */}
          <div className="mt-1 flex items-center justify-center gap-1.5 py-2">
            <LifeBuoy className="h-3 w-3 text-sidebar-foreground/20" />

            <span className="text-[9px] text-sidebar-foreground/25">
              Support SentrIA
            </span>
>>>>>>> feature/layout
          </div>
        </div>
      </aside>
    </>
  )
}
