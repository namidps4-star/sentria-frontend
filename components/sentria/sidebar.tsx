"use client"

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
  onNavigate: (view: ViewKey) => void
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const items: {
  id: ViewKey
  label: string
  icon: string
}[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "⌂",
  },
  {
    id: "sites",
    label: "Sites",
    icon: "◇",
  },
  {
    id: "ask",
    label: "Ask SentrIA",
    icon: "◉",
  },
  {
    id: "report",
    label: "Rapport",
    icon: "✦",
  },
  {
    id: "pricing",
    label: "Abonnement",
    icon: "◆",
  },
  {
    id: "profile",
    label: "Profil",
    icon: "○",
  },
  {
    id: "settings",
    label: "Paramètres",
    icon: "⚙",
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
      {open && (
        <button
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed z-50",
          "left-8 top-8 bottom-8",
          "rounded-[28px]",
          "bg-[#181818]",
          "border border-white/10",
          "shadow-2xl",
          "transition-all duration-300",
          "lg:block",
          collapsed ? "w-[60px]" : "w-[240px]",
          open
            ? "translate-x-0"
            : "-translate-x-[120%] lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-[28px]">
          {/* Header */}
          <div className="flex h-16 shrink-0 items-center px-3">
            {!collapsed && (
              <div className="px-2 text-sm font-semibold text-white">
                SentrIA
              </div>
            )}

            <button
              type="button"
              onClick={onToggleCollapse}
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                "text-white/70 transition",
                "hover:bg-white/10 hover:text-white",
                collapsed ? "mx-auto" : "ml-auto",
              ].join(" ")}
              aria-label={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
            >
              {collapsed ? "→" : "←"}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col gap-2 px-2 py-4">
            {items.map((item) => {
              const isActive = active === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id)
                    onClose()
                  }}
                  className={[
                    "flex h-11 items-center rounded-xl transition",
                    collapsed
                      ? "justify-center"
                      : "gap-3 px-3 text-left",
                    isActive
                      ? "bg-white text-black"
                      : "text-white/60 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  <span className="flex w-5 shrink-0 justify-center text-base">
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
          </nav>
        </div>
      </aside>
    </>
  )
}