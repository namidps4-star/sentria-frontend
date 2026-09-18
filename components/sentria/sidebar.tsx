"use client"

import type { ViewKey } from "./types"
import { useT, type MessageKey } from "@/lib/i18n"
import {
  LayoutDashboard,
  Factory,
  Sparkles,
  FileBarChart,
  CreditCard,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  UsersRound,
} from "lucide-react"

interface SidebarProps {
  active: ViewKey
  onNavigate: (view: ViewKey) => void
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

type SidebarItem = {
  id: ViewKey
  /* A message key, not a label. The sidebar was the last place holding
     its own copy of every view name. */
  label: MessageKey
  icon: React.ElementType
  green?: boolean
}

const sections: {
  title: MessageKey
  items: SidebarItem[]
}[] = [
  {
    title: "sidebar.section.operations",
    items: [
      {
        id: "dashboard",
        label: "nav.dashboard",
        icon: LayoutDashboard,
      },
      {
        id: "sites",
        label: "nav.sites",
        icon: Factory,
      },
      {
        id: "contractors",
        label: "nav.contractors",
        icon: UsersRound,
      },
    ],
  },
  {
    title: "sidebar.section.intelligence",
    items: [
      {
        id: "ask",
        label: "nav.ask",
        icon: Bot,
        green: true,
      },
      {
        id: "report",
        label: "nav.report",
        icon: FileBarChart,
      },
    ],
  },
  {
    title: "sidebar.section.studio",
    items: [
      {
        id: "pricing",
        label: "nav.pricing",
        icon: CreditCard,
      },
      {
        id: "profile",
        label: "nav.profile",
        icon: User,
      },
      {
        id: "settings",
        label: "nav.settings",
        icon: Settings,
      },
    ],
  },
]

const SIDEBAR_FOCUS =
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"

export function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const t = useT()

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label={t("sidebar.close")}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed z-50",
          "left-2 top-2 bottom-2",
          "lg:left-3 lg:top-3 lg:bottom-3",
          collapsed ? "w-[68px]" : "w-[250px]",
          "rounded-[28px]",
          "bg-sidebar",
          "border border-sidebar-border",
          "shadow-lg",
          "transition-all duration-300",
          open
            ? "translate-x-0"
            : "-translate-x-[120%] lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-visible rounded-[28px]">
          {/* LOGO */}
          <div
            className={[
              "flex h-[76px] shrink-0 items-center",
              collapsed ? "justify-center px-2" : "px-4",
            ].join(" ")}
          >
            {!collapsed && (
              <div className="flex items-center gap-3">
                <img
                  src="/logo-mark.png"
                  alt="SentrIA"
                  className="h-8 w-8 object-contain"
                />

                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-sidebar-foreground">
                    SentrIA
                  </span>

                  <span className="text-[10px] text-sidebar-foreground/40">
                    {t("brand.tagline")}
                  </span>
                </div>
              </div>
            )}

            {collapsed && (
              <img
                src="/logo-mark.png"
                alt="SentrIA"
                className="h-8 w-8 object-contain"
              />
            )}

            {!collapsed && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={t("sidebar.collapse")}
                className={"ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/50 transition hover:bg-accent/10 hover:text-accent" + SIDEBAR_FOCUS}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* NAVIGATION */}
          <nav className="flex flex-1 flex-col overflow-visible px-3 py-3">
            {sections.map((section, sectionIndex) => (
              <div key={section.title}>
                {sectionIndex > 0 && (
                  <div className="my-4 h-px w-full bg-white/15" />
                )}

                {!collapsed && (
                  <div className="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-sidebar-foreground/40">
                    {t(section.title)}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const isActive = active === item.id
                    const Icon = item.icon

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNavigate(item.id)
                          onClose()
                        }}
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "group relative flex h-11 w-full items-center rounded-xl transition-all duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                          collapsed
                            ? "justify-center px-0"
                            : "gap-3 px-3 text-left",
                          isActive
                            ? item.green
                              ? "bg-accent/10 text-accent"
                              : "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/65 hover:bg-accent/10 hover:text-accent",
                        ].join(" ")}
                      >
                        <Icon
                          className={[
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            isActive && item.green
                              ? "text-accent"
                              : "",
                            !isActive
                              ? "group-hover:text-accent"
                              : "",
                          ].join(" ")}
                          strokeWidth={1.8}
                        />

                        {/* NORMAL LABEL */}
                        {!collapsed && (
                          <span className="truncate text-sm font-medium">
                            {t(item.label)}
                          </span>
                        )}

                        {/* HOVER LABEL WHEN COLLAPSED */}
                        {collapsed && (
                          <span
                            className={[
                              "pointer-events-none absolute left-full top-1/2 z-[100]",
                              "ml-3 -translate-y-1/2 translate-x-1",
                              "whitespace-nowrap rounded-lg",
                              "border border-sidebar-border",
                              "bg-sidebar px-3 py-2",
                              "text-xs font-medium text-sidebar-foreground",
                              "shadow-lg",
                              "opacity-0",
                              "transition-all duration-150",
                              "group-hover:translate-x-0",
                              "group-hover:opacity-100",
                            ].join(" ")}
                          >
                            {t(item.label)}
                          </span>
                        )}

                        {/* ASK SENTRIA SPARKLE */}
                        {item.id === "ask" && !collapsed && (
                          <Sparkles className="ml-auto h-3.5 w-3.5 text-accent" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* SENTRIA ACTIVE CARD */}
            {!collapsed && (
              <div className="mt-auto pt-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
                      <Bot className="h-4 w-4 text-accent" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-medium text-sidebar-foreground">
                        {t("brand.status.title")}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-sidebar-foreground/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {t("brand.status.subtitle")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </nav>

          {/* COLLAPSED TOGGLE */}
          {collapsed && (
            <div className="shrink-0 border-t border-white/10 p-3">
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={t("sidebar.expand")}
                className={"flex h-10 w-full items-center justify-center rounded-xl text-sidebar-foreground/50 transition hover:bg-accent/10 hover:text-accent" + SIDEBAR_FOCUS}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}