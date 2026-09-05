
"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import type { ViewKey } from "./types"

interface AppShellProps {
  children: React.ReactNode
  activeView: ViewKey
  onNavigate: (view: ViewKey) => void
  search?: string
  onSearchChange?: (value: string) => void
}

export function AppShell({
  children,
  activeView,
  onNavigate,
  search = "",
  onSearchChange,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-white p-0 lg:p-4">
      <div className="relative min-h-screen bg-white lg:min-h-[calc(100vh-2rem)]">
        <Sidebar
          active={activeView}
          onNavigate={onNavigate}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={() =>
            setCollapsed((current) => !current)
          }
        />

        <div
          className={[
            "min-h-screen transition-all duration-300",
            "lg:min-h-[calc(100vh-2rem)]",
            "lg:py-4 lg:pr-4",
            collapsed
              ? "lg:ml-[84px]"
              : "lg:ml-[260px]",
          ].join(" ")}
        >
          <div className="flex min-h-screen flex-col overflow-hidden bg-background lg:h-[calc(100vh-4rem)] lg:min-h-0 lg:rounded-[32px] lg:border lg:border-border lg:shadow-sm">
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
                  aria-label="Open sidebar"
                >
                  <span className="flex flex-col gap-1">
                    <span className="h-px w-4 bg-current" />
                    <span className="h-px w-4 bg-current" />
                    <span className="h-px w-4 bg-current" />
                  </span>
                </button>

                <div>
                  <h1 className="font-heading text-base font-bold">
                    SentrIA
                  </h1>

                  <p className="hidden text-xs text-muted-foreground sm:block">
                    Industrial Intelligence
                  </p>
                </div>
              </div>

              {onSearchChange && (
                <div className="hidden w-full max-w-sm md:block">
                  <input
                    value={search}
                    onChange={(event) =>
                      onSearchChange(event.target.value)
                    }
                    placeholder="Rechercher..."
                    className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-accent"
                  />
                </div>
              )}
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
