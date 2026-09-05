"use client"

import { useState } from "react"
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
  ChevronLeft,
  ChevronRight,
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

type NavItem = {
  key: ViewKey
  label: string
  icon: LucideIcon
  badge?: string
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
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

/** Tooltip shown to the right of an icon when the rail is collapsed. */
function RailTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-[-4px]",
        "whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-lg",
        "opacity-0 transition-all duration-150",
        "group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
      )}
    >
      <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-foreground" />
      {label}
    </span>
  )
}

function NavButton({
  item,
  isActive,
  expanded,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  expanded: boolean
  onClick: () => void
}) {
  const Icon = item.icon

  return (
    <div className={cn("group relative", expanded ? "w-full" : "flex w-full justify-center")}>
      <button
        type="button"
        onClick={onClick}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-2xl transition-all duration-200",
          expanded ? "w-full px-3.5 py-2.5 text-sm font-medium" : "h-11 w-11 justify-center",
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

        {expanded && <span className="flex-1 text-left">{item.label}</span>}

        {expanded && item.badge && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">
            {item.badge}
          </span>
        )}

        {!expanded && item.badge && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[7px] font-bold text-accent-foreground ring-2 ring-sidebar">
            {item.badge[0]}
          </span>
        )}
      </button>

      {!expanded && <RailTooltip label={item.label} />}
    </div>
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
  const [expanded, setExpanded] = useState(false)

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
          "fixed inset-y-0 left-0 z-40 flex flex-col overflow-visible",
          "bg-sidebar text-sidebar-foreground",
          "transition-[width,transform] duration-300 ease-out",
          "lg:static lg:z-auto lg:translate-x-0",
          expanded ? "w-64" : "w-20",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Collapse / expand handle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Réduire le menu" : "Développer le menu"}
          className={cn(
            "absolute -right-3 top-[26px] z-10 flex h-6 w-6 items-center justify-center rounded-full",
            "border border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground shadow-md",
            "transition-transform hover:scale-105",
          )}
        >
          {expanded ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Logo */}
        <div className={cn("flex h-[76px] shrink-0 items-center", expanded ? "justify-between px-5" : "justify-center px-2")}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent">
              <img src="/icon-dark-32x32.png" alt="Sentria" className="h-5 w-5 object-contain" />
            </span>
            {expanded && (
              <span className="whitespace-nowrap text-[17px] font-bold tracking-tight text-sidebar-foreground">
                Sentria
              </span>
            )}
          </div>

          {expanded && (
            <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/30">
              Ops
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-4", expanded ? "px-3" : "items-center px-3")}>
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div
              key={section.title}
              className={cn(
                "w-full",
                sectionIndex > 0 &&
                  (expanded ? "mt-3 border-t border-sidebar-border pt-3" : "mt-3 flex flex-col items-center border-t border-sidebar-border pt-3"),
              )}
            >
              <div className={cn("flex flex-col gap-1", expanded ? "w-full" : "w-full items-center")}>
                {section.items.map((item) => (
                  <NavButton
                    key={item.key}
                    item={item}
                    isActive={active === item.key}
                    expanded={expanded}
                    onClick={() => {
                      onNavigate(item.key)
                      onClose()
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom area */}
        <div className={cn("shrink-0 space-y-2 p-3", !expanded && "flex flex-col items-center")}>
          {/* Pro card */}
          {expanded ? (
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

              <p className="text-[15px] font-bold leading-tight text-accent-foreground">Passer au Pro</p>
              <p className="mt-1 text-xs leading-relaxed text-accent-foreground/70">
                Sites illimités, IoT, rapports avancés et support prioritaire.
              </p>

              <span className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-sidebar-primary py-2 text-xs font-semibold text-sidebar-primary-foreground transition-opacity group-hover:opacity-85">
                <Zap className="h-3.5 w-3.5" />
                Mettre à niveau
              </span>
            </button>
          ) : (
            <div className="group relative flex w-full justify-center">
              <button
                type="button"
                onClick={() => {
                  onNavigate("pricing")
                  onClose()
                }}
                aria-label="Passer au Pro"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200",
                  active === "pricing"
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "bg-accent text-accent-foreground hover:opacity-85",
                )}
              >
                <Zap className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              <RailTooltip label="Passer au Pro" />
            </div>
          )}

          {/* User */}
          <div className={cn("group relative", expanded ? "w-full" : "flex w-full justify-center")}>
            <button
              type="button"
              onClick={() => {
                onNavigate("profile")
                onClose()
              }}
              className={cn(
                "flex items-center rounded-2xl text-left transition-colors hover:bg-sidebar-accent",
                expanded ? "w-full gap-3 px-3 py-2.5" : "h-11 w-11 justify-center",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                JK
              </div>

              {expanded && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-sidebar-foreground">Jean Kokou</p>
                    <p className="mt-0.5 truncate text-[10px] text-sidebar-foreground/40">Administrateur</p>
                  </div>
                  <User className="h-4 w-4 text-sidebar-foreground/25" />
                </>
              )}
            </button>

            {!expanded && <RailTooltip label="Jean Kokou" />}
          </div>

          {/* Support */}
          <div className={cn("group relative flex items-center justify-center gap-1.5 py-1.5", expanded ? "w-full" : "w-full")}>
            <LifeBuoy className="h-3 w-3 text-sidebar-foreground/20" />
            {expanded && (
              <span className="whitespace-nowrap text-[9px] text-sidebar-foreground/25">Support SentrIA</span>
            )}
            {!expanded && <RailTooltip label="Support SentrIA" />}
          </div>
        </div>
      </aside>
    </>
  )
}