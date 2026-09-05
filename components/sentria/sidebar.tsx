"use client"

import type { ReactNode } from "react"

export type ViewKey =
  | "dashboard"
  | "sites"
  | "ask"
  | "pricing"
  | "profile"
  | "settings"
  | "report"

interface SidebarProps {
  active: ViewKey
  onNavigate: (v: ViewKey) => void
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

interface NavItem {
  key: ViewKey
  label: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: "sites",
    label: "Sites",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
      >
        <path d="M3 21h18" />
        <path d="M5 21V5l7-3v19" />
        <path d="M12 7l7-3v17" />
        <path d="M8 7h1" />
        <path d="M8 11h1" />
        <path d="M8 15h1" />
        <path d="M15 8h1" />
        <path d="M15 12h1" />
        <path d="M15 16h1" />
      </svg>
    ),
  },
  {
    key: "ask",
    label: "Ask SentrIA",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
      >
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
        <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
      </svg>
    ),
  },
  {
    key: "pricing",
    label: "Abonnement",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "Profil",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6" />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "Paramètres",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.5V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4.3v-2.5h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.5v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.5h-.2a1.7 1.7 0 0 0-1.6 1z" />
      </svg>
    ),
  },
  {
    key: "report",
    label: "Rapport",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h6" />
      </svg>
    ),
  },
]

export function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <>
      {/* MOBILE OVERLAY */}
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onClose}
          className="
            fixed
            inset-0
            z-40
            bg-black/40
            lg:hidden
          "
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={[
          "fixed",
          "z-50",
          "flex",
          "flex-col",
          "bg-sidebar",
          "text-sidebar-foreground",
          "transition-all",
          "duration-300",
          "ease-out",

          // Mobile
          "left-0",
          "top-0",
          "h-screen",

          // Desktop floating position
          "lg:left-8",
          "lg:top-8",
          "lg:h-[calc(100vh-4rem)]",
          "lg:rounded-[24px]",

          // Width
          collapsed
            ? "w-[60px]"
            : "w-[240px]",

          // Mobile open/close
          open
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* LOGO */}
        <div
          className={[
            "flex h-20 items-center",
            collapsed
              ? "justify-center"
              : "justify-between px-5",
          ].join(" ")}
        >
          {collapsed ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
              S
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
                S
              </div>

              <span className="text-lg font-semibold">
                SentrIA
              </span>
            </div>
          )}
        </div>

        {/* COLLAPSE BUTTON */}
        <div className="px-2 pb-4">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={
              collapsed
                ? "Développer la barre latérale"
                : "Réduire la barre latérale"
            }
            title={
              collapsed
                ? "Développer"
                : "Réduire"
            }
            className="
              flex
              h-10
              w-full
              items-center
              justify-center
              rounded-xl
              text-sidebar-foreground/70
              transition-colors
              hover:bg-sidebar-accent
              hover:text-sidebar-foreground
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              {collapsed ? (
                <path d="M9 18l6-6-6-6" />
              ) : (
                <path d="M15 18l-6-6 6-6" />
              )}
            </svg>

            {!collapsed && (
              <span className="ml-2 text-sm">
                Réduire
              </span>
            )}
          </button>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 px-2">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = active === item.key

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onNavigate(item.key)
                    onClose()
                  }}
                  title={collapsed ? item.label : undefined}
                  className={[
                    "flex h-11 w-full items-center rounded-xl",
                    "transition-colors duration-200",
                    collapsed
                      ? "justify-center"
                      : "gap-3 px-3",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  ].join(" ")}
                >
                  <span className="shrink-0">
                    {item.icon}
                  </span>

                  {!collapsed && (
                    <span className="truncate text-sm font-medium">
                      {item.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>

        {/* PROFILE */}
        <div className="p-2">
          <div
            className={[
              "flex items-center rounded-xl",
              collapsed
                ? "justify-center p-2"
                : "gap-3 px-3 py-3",
            ].join(" ")}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              U
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  Utilisateur
                </p>

                <p className="truncate text-xs text-sidebar-foreground/60">
                  Compte SentrIA
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}