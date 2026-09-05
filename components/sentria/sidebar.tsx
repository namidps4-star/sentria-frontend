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
  FileText,
  Rocket,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

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
    items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Operations",
    items: [{ key: "sites", label: "Sites", icon: Building2 }],
  },
  {
    title: "Intelligence",
    items: [
      { key: "ask", label: "Ask SentrIA", icon: Sparkles, badge: "IA" },
      { key: "report", label: "Rapports", icon: FileText },
    ],
  },
  {
    title: "Account",
    items: [
      { key: "pricing", label: "Abonnement", icon: CreditCard },
      { key: "profile", label: "Profil", icon: User },
      { key: "settings", label: "Paramètres", icon: Settings },
    ],
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
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col",
          "bg-sidebar text-sidebar-foreground",
          "transition-transform duration-300",
          "lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-[76px] items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
              <img
                src="/icon-dark-32x32.png"
                alt=""
                className="h-5 w-5 object-contain"
              />
            </span>
            <span className="text-[17px] font-bold tracking-tight text-sidebar-foreground">
              Sentria
            </span>
          </div>

          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/30">
            Ops
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div
              key={section.title}
              className={cn(sectionIndex > 0 && "mt-3 border-t border-sidebar-border pt-3")}
            >
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
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5",
                        "text-sm font-medium",
                        "transition-all duration-200",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/40 group-hover:text-sidebar-accent-foreground",
                        )}
                        strokeWidth={1.8}
                      />

                      <span className="flex-1 text-left">{item.label}</span>

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
        <div className="space-y-2 p-3">
          {/* Pro card */}
          <button
            type="button"
            onClick={() => {
              onNavigate("pricing")
              onClose()
            }}
            className="group relative block w-full overflow-hidden rounded-3xl bg-accent p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
          >
            <Rocket
              className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rotate-45 text-accent-foreground/10"
              strokeWidth={1.2}
            />

            <p className="text-[15px] font-bold leading-tight text-accent-foreground">
              Passer au Pro
            </p>
            <p className="mt-1 text-xs leading-relaxed text-accent-foreground/70">
              Sites illimités, IoT, rapports avancés et support prioritaire.
            </p>

            <span className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-sidebar-primary py-2 text-xs font-semibold text-sidebar-primary-foreground transition-opacity group-hover:opacity-85">
              <Zap className="h-3.5 w-3.5" />
              Mettre à niveau
            </span>
          </button>

          {/* User */}
          <button
            type="button"
            onClick={() => {
              onNavigate("profile")
              onClose()
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              JK
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">
                Jean Kokou
              </p>
              <p className="mt-0.5 truncate text-[10px] text-sidebar-foreground/40">
                Administrateur
              </p>
            </div>

            <User className="h-4 w-4 text-sidebar-foreground/25" />
          </button>

          {/* Support */}
          <div className="flex items-center justify-center gap-1.5 py-1.5">
            <LifeBuoy className="h-3 w-3 text-sidebar-foreground/20" />
            <span className="text-[9px] text-sidebar-foreground/25">
              Support SentrIA
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}

