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
  ChevronRight,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewKey =
  | "dashboard"
  | "sites"
  | "ask"
  | "pricing"
  | "profile"
  | "settings"

const NAV: {
  key: ViewKey
  label: string
  icon: LucideIcon
  badge?: string
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "sites",
    label: "Sites",
    icon: Building2,
  },
  {
    key: "ask",
    label: "Ask SentrIA",
    icon: Sparkles,
    badge: "AI",
  },
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
]

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
  const navigate = (view: ViewKey) => {
    onNavigate(view)
    onClose()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col",
          "border-r border-sidebar-border/70 bg-sidebar",
          "text-sidebar-foreground",
          "transition-transform duration-300 ease-out",
          "lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* ======================================================
            BRAND
        ====================================================== */}
        <div className="px-5 pb-5 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/sentria logo.png"
                alt="SentrIA"
                className="h-9 w-auto object-contain"
              />

              <div className="h-5 w-px bg-sidebar-border" />

              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/30">
                Ops
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================
            NAVIGATION
        ====================================================== */}
        <div className="px-3">
          <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/25">
            Workspace
          </p>

          <nav className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon
              const isActive = active === item.key

              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  className={cn(
                    "group relative flex h-11 w-full items-center gap-3 rounded-xl px-3",
                    "text-sm font-medium",
                    "transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/50 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                  )}
                >
                  {/* Active green line */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-accent" />
                  )}

                  <Icon
                    className={cn(
                      "h-[17px] w-[17px] shrink-0 transition-all duration-200",
                      isActive
                        ? "text-accent"
                        : "text-sidebar-foreground/35 group-hover:text-sidebar-foreground/70",
                    )}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />

                  <span className="flex-1 text-left">
                    {item.label}
                  </span>

                  {item.badge && (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[8px] font-bold tracking-wide",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "bg-accent/10 text-accent-foreground",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}

                  {isActive && !item.badge && (
                    <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/25" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* ======================================================
            DIVIDER
        ====================================================== */}
        <div className="mx-5 mt-6 h-px bg-sidebar-border/70" />

        {/* ======================================================
            LIVE STATUS
        ====================================================== */}
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>

              <span className="text-[10px] font-medium text-sidebar-foreground/40">
                SentrIA Live
              </span>
            </div>

            <span className="text-[9px] font-medium text-sidebar-foreground/20">
              CONNECTÉ
            </span>
          </div>
        </div>

        {/* ======================================================
            SPACER
        ====================================================== */}
        <div className="flex-1" />

        {/* ======================================================
            PRO CARD
        ====================================================== */}
        <div className="px-3">
          <div className="relative overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4">
            {/* subtle decorative element */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />

            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
                    <Zap className="h-3.5 w-3.5 text-accent-foreground" />
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
                    Pro
                  </span>
                </div>

                <span className="rounded-full border border-sidebar-border px-2 py-0.5 text-[8px] font-medium text-sidebar-foreground/30">
                  UPGRADE
                </span>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-sidebar-foreground/45">
                Débloquez les analyses avancées et les sites illimités.
              </p>

              <button
                onClick={() => navigate("pricing")}
                className="mt-3 flex w-full items-center justify-between rounded-lg bg-foreground px-3 py-2 text-[10px] font-bold text-background transition-all hover:opacity-85"
              >
                <span>Passer au Pro</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================
            USER
        ====================================================== */}
        <div className="p-3">
          <button
            onClick={() => navigate("profile")}
            className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-sidebar-accent"
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                JK
              </div>

              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-accent" />
            </div>

            {/* User info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-sidebar-foreground/80">
                Jean Kokou
              </p>

              <p className="mt-0.5 truncate text-[9px] text-sidebar-foreground/30">
                Administrateur
              </p>
            </div>

            <LifeBuoy
              className="h-4 w-4 text-sidebar-foreground/20 transition-colors group-hover:text-sidebar-foreground/50"
              strokeWidth={1.7}
            />
          </button>
        </div>
      </aside>
    </>
  )
}