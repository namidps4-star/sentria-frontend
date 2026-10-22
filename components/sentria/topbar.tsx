"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Bell, Menu, X, ArrowRight } from "@/lib/icons"

import { useT, useTx } from "@/lib/i18n"
import { agoLabel } from "@/lib/relative-time"
import { sectorLabel } from "@/lib/priorities"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

import { AccountMenu } from "./account-menu"
import { WorkspaceContext } from "./workspace-context"

/** One critical alert waiting in the bell: a task nobody has marked
 *  handled yet, keyed like the tracking board's cards. */
export type Notification = {
  key: string
  equipment: string
  message: string
  date: string
  sector: string | null
}

const FOCUS_RING =
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/** Sector tag colours: pastel tokens, neutral for a sector with none. */
function sectorTag(sector: string): string {
  if (sector === "health") return "bg-[var(--tag-success-bg)] text-[var(--tag-success-fg)]"
  if (sector === "industry") return "bg-[var(--tag-warning-bg)] text-[var(--tag-warning-fg)]"
  if (sector === "logistics") return "bg-[var(--tag-info-bg)] text-[var(--tag-info-fg)]"
  return "bg-[var(--tag-neutral-bg)] text-[var(--tag-neutral-fg)]"
}

export function Topbar({
  title,
  subtitle,
  onMenu,
  search,
  onSearch,
  unreadCount = 0,
  ring = 0,
  notifications = [],
  notificationsUnknown = false,
  onNotificationsOpen,
  onOpenTracking,
  onOpenSites,
}: {
  title: string
  subtitle: string
  onMenu: () => void
  search: string
  onSearch: (v: string) => void
  /** Critical alerts awaiting attention. The dot and the button's
   *  accessible name both come from this, so neither can claim unread
   *  items that do not exist. */
  unreadCount?: number
  /** How many times the bell has rung: a critical alert nobody has seen
   *  arrived. Each change replays the ring (the icon remounts on it). */
  ring?: number
  /** Open critical alerts, newest first. */
  notifications?: Notification[]
  /** The last read did not answer (L4): an empty list is not "all clear". */
  notificationsUnknown?: boolean
  /** Called when the list opens: what it shows is now read. */
  onNotificationsOpen?: () => void
  onOpenTracking?: () => void
  /** The company menu's sites open the Sites page. */
  onOpenSites?: () => void
}) {
  const t = useT()
  const tx = useTx()

  const [bellOpen, setBellOpen] = useState(false)
  // Sector chip in the list: "" is all of them.
  const [bellSector, setBellSector] = useState("")
  const bell = usePresence(bellOpen, "--dropdown-close-dur")
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bellOpen) return

    function onPointer(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setBellOpen(false)
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setBellOpen(false)
    }

    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)

    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [bellOpen])

  function toggleBell() {
    if (!bellOpen) {
      onNotificationsOpen?.()
      setBellSector("")
    }
    setBellOpen(!bellOpen)
  }

  function openTracking() {
    setBellOpen(false)
    onOpenTracking?.()
  }

  const hasUnread = unreadCount > 0

  const sectorCounts = Array.from(
    notifications.reduce((m, n) => (n.sector ? m.set(n.sector, (m.get(n.sector) ?? 0) + 1) : m), new Map<string, number>())
  )
  const shown = bellSector ? notifications.filter((n) => n.sector === bellSector) : notifications

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-canvas/80 px-4 py-3.5 backdrop-blur-md lg:px-8">
      <button
        onClick={onMenu}
        type="button"
        className={"flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card lg:hidden" + FOCUS_RING}
        aria-label={t("topbar.menu.open")}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="shrink-0 truncate font-heading text-lg font-bold tracking-tight md:text-xl">{title}</h1>
          <WorkspaceContext />
        </div>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Search */}
      <div className="relative hidden md:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("topbar.search.placeholder")}
          aria-label={t("topbar.search.label")}
          className="h-10 w-64 rounded-xl border border-border bg-card pl-9 pr-8 text-sm outline-none [&::-webkit-search-cancel-button]:hidden transition-colors placeholder:text-muted-foreground focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 lg:w-72"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label={t("topbar.search.clear")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* A slot the page fills with its own action (the dashboard's
          upload icon). Empty on other pages. */}
      <div id="topbar-actions" className="flex items-center empty:hidden" />

      <div ref={bellRef} className="relative">
      <button
        type="button"
        onClick={toggleBell}
        aria-expanded={bellOpen}
        aria-haspopup="dialog"
        className={"relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted" + FOCUS_RING}
        aria-label={
          /* Three keys rather than one string with the agreement built
             in by concatenation. "1 alertes critiques" was the French
             bug this shape prevents, and English needs its own rule
             anyway. */
          !hasUnread
            ? t("topbar.notifications.none")
            : unreadCount === 1
              ? t("topbar.notifications.one")
              : t("topbar.notifications.many", { count: unreadCount })
        }
      >
        <Bell
          key={ring}
          data-bell-ring={ring}
          className={cn("h-[18px] w-[18px]", ring > 0 && "t-bell-ring")}
          aria-hidden="true"
        />

        {hasUnread && (
          <span
            className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card"
            aria-hidden="true"
          />
        )}
      </button>

      {bell.present && (
        <div
          role="dialog"
          aria-label={tx("Alertes critiques", "Critical alerts")}
          data-origin="top-right"
          className={cn("absolute right-0 top-full z-40 mt-2 w-[23rem] max-w-[calc(100vw-2rem)] max-sm:fixed max-sm:inset-x-4 max-sm:w-auto max-sm:max-w-none squircle rounded-[30px] border border-border bg-card p-2.5 shadow-xl t-dropdown", bell.className)}
        >
          <div className="squircle rounded-[22px] bg-accent px-[18px] pb-4 pt-[18px] text-accent-foreground">
            <div className="flex items-center gap-3">
              <span data-bell-count="" className="font-heading text-[38px] font-bold leading-none">
                {notifications.length}
              </span>
              <span className="text-sm font-bold leading-tight">
                {notifications.length === 1
                  ? tx("alerte critique à traiter", "critical alert to handle")
                  : tx("alertes critiques à traiter", "critical alerts to handle")}
              </span>
            </div>

            {sectorCounts.length > 1 && (
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {[["", notifications.length] as const, ...sectorCounts].map(([id, count]) => (
                  <button
                    key={id || "all"}
                    type="button"
                    data-bell-chip={id || "all"}
                    aria-pressed={bellSector === id}
                    onClick={() => setBellSector(id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                      bellSector === id
                        ? "bg-accent-foreground text-accent"
                        : "bg-accent-foreground/10 hover:bg-accent-foreground/20"
                    )}
                  >
                    {id ? sectorLabel(id, tx) : tx("Tout", "All")} {count}
                  </button>
                ))}
              </div>
            )}
          </div>

          {notificationsUnknown && (
            <p
              data-bell-unknown=""
              className="mx-2 mb-1 rounded-xl border border-[var(--tag-warning-bd)] bg-[var(--tag-warning-bg)] px-3 py-2 text-xs text-[var(--tag-warning-fg)]"
            >
              {tx(
                "Non mesuré : les alertes n'ont pas pu être vérifiées. Cette liste peut ne pas être à jour.",
                "Not measured: the alerts could not be checked. This list may be out of date."
              )}
            </p>
          )}

          {notifications.length === 0 ? (
            notificationsUnknown ? null : (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                {tx(
                  "Aucune alerte critique en attente.",
                  "No critical alert waiting."
                )}
              </p>
            )
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {shown.slice(0, 8).map((n) => (
                <li key={n.key}>
                  <button
                    type="button"
                    onClick={openTracking}
                    className={"flex w-full items-center gap-3 rounded-[20px] bg-muted px-4 py-3.5 text-left transition-colors hover:bg-muted/70" + FOCUS_RING}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[var(--tag-critical-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--tag-critical-fg)]">
                          {tx("Critique", "Critical")}
                        </span>
                        {n.sector && (
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", sectorTag(n.sector))}>
                            {sectorLabel(n.sector, tx)}
                          </span>
                        )}
                        <span className="ml-1 text-xs font-semibold text-muted-foreground">
                          {agoLabel(n.date, tx)}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-base font-bold leading-snug">
                        {n.message || n.equipment}
                      </span>
                    </span>
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-card" aria-hidden="true">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={openTracking}
            className={"mt-2 flex w-full items-center justify-center rounded-full border border-border px-3 py-3 text-sm font-bold transition-colors hover:bg-muted" + FOCUS_RING}
          >
            {tx("Tout voir dans le suivi", "See all in tracking")}
          </button>
        </div>
      )}
      </div>

      <AccountMenu onOpenSites={onOpenSites} />
    </header>
  )
}  





