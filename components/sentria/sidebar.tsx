"use client"

import {
  LayoutDashboard,
  Factory,
  Sparkles,
  CreditCard,
  User,
  Settings,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react"

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
}

const items: {
  id: ViewKey
  label: string
  icon: typeof LayoutDashboard
}[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "sites",
    label: "Sites",
    icon: Factory,
  },
  {
    id: "ask",
    label: "Ask SentrIA",
    icon: Sparkles,
  },
  {
    id: "report",
    label: "Rapport",
    icon: FileText,
  },
  {
    id: "pricing",
    label: "Abonnement",
    icon: CreditCard,
  },
  {
    id: "profile",
    label: "Profil",
    icon: User,
  },
  {
    id: "settings",
    label: "Paramètres",
    icon: Settings,
  },
]

export function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
}: SidebarProps) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed z-50",
          "left-4 top-4 bottom-4",
          "w-[240px]",
          "overflow-hidden",
          "rounded-[28px]",
          "border border-white/10",
          "bg-[#181818]",
          "shadow-2xl",
          "transition-transform duration-300",
          "lg:left-8 lg:top-8 lg:bottom-8",
          open
            ? "translate-x-0"
            : "-translate-x-[120%] lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-[72px] shrink-0 items-center px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-black">
                S
              </div>

              <span className="text-sm font-semibold text-white">
                SentrIA
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3">
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Navigation
            </div>

            <nav className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon
                const selected = active === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id)
                      onClose()
                    }}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5",
                      "text-sm transition-all duration-200",
                      selected
                        ? "bg-white text-black shadow-sm"
                        : "text-white/55 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />

                    <span className="truncate">
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="mt-auto p-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                SentrIA
              </div>

              <p className="text-xs leading-5 text-white/50">
                Intelligence opérationnelle augmentée par l’IA.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}