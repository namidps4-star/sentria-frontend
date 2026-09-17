"use client"

import { Search, Bell, Menu, ChevronDown, X } from "lucide-react"

const FOCUS_RING =
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export function Topbar({
  title,
  subtitle,
  onMenu,
  search,
  onSearch,
  unreadCount = 0,
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
}) {
  const hasUnread = unreadCount > 0
  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background/80 px-4 py-3.5 backdrop-blur-md lg:px-8">
      <button
        onClick={onMenu}
        type="button"
        className={"flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card lg:hidden" + FOCUS_RING}
        aria-label="Ouvrir le menu"
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
          placeholder="Rechercher un actif, une alerte…"
          aria-label="Rechercher un actif ou une alerte"
          className="h-10 w-64 rounded-xl border border-border bg-card pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 lg:w-72"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label="Effacer la recherche"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <button
        type="button"
        className={"relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted" + FOCUS_RING}
        aria-label={
          hasUnread
            ? `Notifications, ${unreadCount} alerte${
                unreadCount > 1 ? "s" : ""
              } critique${unreadCount > 1 ? "s" : ""}`
            : "Notifications, aucune alerte critique"
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

      <button
        type="button"
        aria-label="Compte de Jean K."
        aria-haspopup="menu"
        className={"flex items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-muted" + FOCUS_RING}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">
          JK
        </span>
        <span className="hidden text-sm font-medium sm:block">Jean K.</span>
        <ChevronDown
          className="hidden h-4 w-4 text-muted-foreground sm:block"
          aria-hidden="true"
        />
      </button>
    </header>
  )
}  





