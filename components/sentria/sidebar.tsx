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

// Flattened nav list — groups are separated with a short centered
// rule instead of section titles, since the rail has no room for text.
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

/** Short centered rule that separates nav groups on the rail. */
function RailDivider() {
  return <div className="h-px w-6 shrink-0 bg-sidebar-border" />
}

/** Label that appears to the right of an icon button on hover, with a small arrow. */
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
    <div className="group relative flex w-full justify-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-2xl",
          "transition-all duration-200 ease-out",
          isActive
            ? "bg-accent text-accent-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon
          className="h-[18px] w-[18px] shrink-0"
          strokeWidth={isActive ? 2 : 1.75}
        />

        {item.badge && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[7px] font-bold text-accent-foreground ring-2 ring-sidebar">
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
        <div className="flex h-[76px] w-full shrink-0 items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent shadow-sm">
            <img
              src="/icon-dark-32x32.png"
              alt="SentrIA"
              className="h-6 w-6 object-contain"
            />
          </div>
        </div>

        {/* Navigation — vertically centered for visual balance */}
        <nav className="flex w-full flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, i) => (
            <div key={i} className="flex w-full flex-col items-center gap-3">
              {i > 0 && <RailDivider />}
              <div className="flex w-full flex-col items-center gap-2">
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
            </div>
          ))}
        </nav>

        {/* Bottom area */}
        <div className="flex w-full shrink-0 flex-col items-center gap-2 py-4">
          <RailDivider />

          <div className="mt-1 flex w-full flex-col items-center gap-2">
            {/* Pro */}
            <div className="group relative flex w-full justify-center">
              <button
                type="button"
                onClick={() => {
                  onNavigate("pricing")
                  onClose()
                }}
                aria-label="Plan Pro"
                aria-current={active === "pricing" ? "page" : undefined}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ease-out",
                  active === "pricing"
                    ? "bg-accent text-accent-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                    : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Zap className="h-[18px] w-[18px]" strokeWidth={active === "pricing" ? 2 : 1.75} />
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
          </div>

          <RailDivider />

          {/* User avatar */}
          <div className="group relative mt-1 flex w-full justify-center">
            <button
              type="button"
              onClick={() => {
                onNavigate("profile")
                onClose()
              }}
              aria-label="Jean Kokou — Administrateur"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background ring-2 ring-sidebar transition-transform duration-150 hover:scale-105"
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

