"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Bell, Menu, X, ArrowRight, TriangleAlert } from "@/lib/icons"

import { formatInCompanyZone } from "@/lib/company"
import { useT, useTx } from "@/lib/i18n"
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
          className={cn("absolute right-0 top-full z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] max-sm:fixed max-sm:inset-x-4 max-sm:w-auto max-sm:max-w-none squircle rounded-[26px] border border-border bg-card p-2 shadow-xl t-dropdown", bell.className)}
        >
          <div className="squircle flex items-center gap-3 rounded-[20px] bg-foreground px-4 py-3.5 text-background">
            <span data-bell-count="" className="font-heading text-3xl font-bold leading-none text-accent">
              {notifications.length}
            </span>
            <span className="text-sm font-semibold leading-tight">
              {notifications.length === 1
                ? tx("chose demande votre action", "thing needs your action")
                : tx("choses demandent votre action", "things need your action")}
            </span>
          </div>

          {sectorCounts.length > 1 && (
            <div className="flex flex-wrap gap-1.5 px-1.5 pb-1 pt-2.5">
              {[["", notifications.length] as const, ...sectorCounts].map(([id, count]) => (
                <button
                  key={id || "all"}
                  type="button"
                  data-bell-chip={id || "all"}
                  aria-pressed={bellSector === id}
                  onClick={() => setBellSector(id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                    bellSector === id
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-muted text-foreground hover:bg-muted/70"
                  )}
                >
                  {id ? sectorLabel(id, tx) : tx("Tout", "All")}
                  <span className="ml-1.5 opacity-70">{count}</span>
                </button>
              ))}
            </div>
          )}

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
            <ul className="mt-1 max-h-80 overflow-y-auto">
              {shown.slice(0, 8).map((n) => (
                <li key={n.key}>
                  <button
                    type="button"
                    onClick={openTracking}
                    className="flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tag-danger-bg)] text-[var(--tag-danger-fg)]">
                      <TriangleAlert className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-[15px] font-semibold leading-snug">
                        {n.message || n.equipment}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                        {n.message ? `${n.equipment} · ` : ""}
                        {n.sector ? `${sectorLabel(n.sector, tx)} · ` : ""}
                        {formatInCompanyZone(n.date, tx)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={openTracking}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 pb-1.5 pt-2.5 text-[13px] font-bold transition-opacity hover:opacity-70"
          >
            {tx("Tout voir dans le suivi", "See all in tracking")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      </div>

      <AccountMenu onOpenSites={onOpenSites} />
    </header>
  )
}  





