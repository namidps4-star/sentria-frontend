"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Bell, Menu, ChevronDown, X, User, ArrowRight } from "lucide-react"

import { formatInCompanyZone, initialsOf, useCompanyIdentity } from "@/lib/company"
import { useT, useTx } from "@/lib/i18n"
import { sectorLabel } from "@/lib/priorities"

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
  notifications = [],
  onNotificationsOpen,
  onOpenTracking,
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
  /** Open critical alerts, newest first. */
  notifications?: Notification[]
  /** Called when the list opens: what it shows is now read. */
  onNotificationsOpen?: () => void
  onOpenTracking?: () => void
}) {
  const t = useT()
  const tx = useTx()

  const [bellOpen, setBellOpen] = useState(false)
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
    if (!bellOpen) onNotificationsOpen?.()
    setBellOpen(!bellOpen)
  }

  function openTracking() {
    setBellOpen(false)
    onOpenTracking?.()
  }

  const hasUnread = unreadCount > 0

  /* This button used to read "Jean K.", a person nobody had entered, on
     every page of the product. The account it stands for is the company
     from onboarding, so that is what it names, and it says nothing at
     all when there is no name rather than inventing one. */
  const { name: companyName } = useCompanyIdentity()

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background/80 px-4 py-3.5 backdrop-blur-md lg:px-8">
      <button
        onClick={onMenu}
        type="button"
        className={"flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card lg:hidden" + FOCUS_RING}
        aria-label={t("topbar.menu.open")}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-lg font-bold tracking-tight md:text-xl">{title}</h1>
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
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />

        {hasUnread && (
          <span
            className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card"
            aria-hidden="true"
          />
        )}
      </button>

      {bellOpen && (
        <div
          role="dialog"
          aria-label={tx("Alertes critiques", "Critical alerts")}
          className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-2 shadow-xl"
        >
          <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tx("Alertes critiques à traiter", "Critical alerts to handle")}
          </p>

          {notifications.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {tx(
                "Aucune alerte critique en attente.",
                "No critical alert waiting."
              )}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 8).map((n) => (
                <li key={n.key}>
                  <button
                    type="button"
                    onClick={openTracking}
                    className="w-full rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {n.equipment}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatInCompanyZone(n.date, tx)}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {n.sector ? `${sectorLabel(n.sector, tx)} · ` : ""}
                      {n.message}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={openTracking}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90"
          >
            {tx("Ouvrir le suivi", "Open tracking")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      </div>

      <button
        type="button"
        aria-label={
          companyName
            ? t("topbar.account.of", { name: companyName })
            : t("topbar.account")
        }
        aria-haspopup="menu"
        className={"flex items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-muted" + FOCUS_RING}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">
          {companyName ? (
            initialsOf(companyName)
          ) : (
            <User className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>

        {companyName && (
          <span className="hidden max-w-[12rem] truncate text-sm font-medium sm:block">
            {companyName}
          </span>
        )}

        <ChevronDown
          className="hidden h-4 w-4 text-muted-foreground sm:block"
          aria-hidden="true"
        />
      </button>
    </header>
  )
}  





