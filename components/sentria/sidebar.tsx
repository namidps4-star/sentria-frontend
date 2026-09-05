"use client"

import {
  LayoutDashboard,
  Building2,
  Sparkles,
  User,
  Settings,
  Zap,
  FileText,
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

// Flattened nav list — groups are now indicated with a thin divider
// instead of section titles, since the rail has no room for text.
const NAV_GROUPS: NavItem[][] = [
  [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  [{ key: "sites", label: "Sites", icon: Building2 }],
  [
    { key: "ask", label: "Ask SentrIA", icon: Sparkles, badge: "IA" },
    { key: "report", label: "Rapports", icon: FileText },
  ],
]

const ACCOUNT_ITEMS: NavItem[] = [
  { key: "profile", label: "Profil", icon: User },
  { key: "settings", label: "Paramètres", icon: Settings },
]

/** Small label that appears to the right of an icon button on hover. */
function RailTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2",
        "whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background",
        "opacity-0 shadow-lg transition-opacity duration-150",
        "group-hover:opacity-100 group-focus-visible:opacity-100",
      )}
    >
      {label}
    </span>
  )
}

function RailButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick: () => void
}) {
  const Icon = item.icon

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={item.label}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-xl",
          "transition-all duration-200",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        {isActive && (
          <span className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
        )}

        <Icon
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors",
            isActive ? "text-accent" : "text-sidebar-foreground/45 group-hover:text-sidebar-accent-foreground",
          )}
          strokeWidth={1.8}
        />

        {item.badge && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[7px] font-bold text-accent-foreground ring-2 ring-sidebar">
            {item.badge[0]}
          </span>
        )}
      </button>

      <RailTooltip label={item.label} />
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
          "fixed inset-y-0 left-0 z-40 flex w-20 flex-col items-center",
          "border-r border-sidebar-border",
          "bg-sidebar text-sidebar-foreground",
          "transition-transform duration-300",
          "lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-[76px] w-full items-center justify-center border-b border-sidebar-border">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent">
            <img
              src="/icon-dark-32x32.png"
              alt="SentrIA"
              className="h-6 w-6 object-contain"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group, i) => (
            <div key={i} className={cn("flex flex-col items-center gap-1", i > 0 && "mt-4 border-t border-sidebar-border pt-4")}>
              {group.map((item) => (
                <RailButton
                  key={item.key}
                  item={item}
                  isActive={active === item.key}
                  onClick={() => {
                    onNavigate(item.key)
                    onClose()
                  }}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom area */}
        <div className="flex flex-col items-center gap-2 border-t border-sidebar-border py-4">
          {/* Pro */}
          <div className="group relative">
            <button
              type="button"
              onClick={() => {
                onNavigate("pricing")
                onClose()
              }}
              aria-label="Plan Pro"
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
                active === "pricing"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "bg-sidebar-accent text-accent-foreground hover:opacity-80",
              )}
            >
              <Zap className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
            <RailTooltip label="Plan Pro" />
          </div>

          {ACCOUNT_ITEMS.map((item) => (
            <RailButton
              key={item.key}
              item={item}
              isActive={active === item.key}
              onClick={() => {
                onNavigate(item.key)
                onClose()
              }}
            />
          ))}

          {/* User avatar */}
          <div className="group relative mt-1">
            <button
              type="button"
              onClick={() => {
                onNavigate("profile")
                onClose()
              }}
              aria-label="Jean Kokou — Administrateur"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground ring-2 ring-sidebar-border transition-opacity hover:opacity-85"
            >
              JK
            </button>
            <RailTooltip label="Jean Kokou" />
          </div>
        </div>
      </aside>
    </>
  )
}