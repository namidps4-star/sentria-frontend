"use client"

<<<<<<< HEAD
import { Search, Bell, Menu, ChevronDown } from "lucide-react"
=======
import { Search, Bell, Menu, ChevronDown, X } from "lucide-react"
>>>>>>> feature/layout

export function Topbar({
  title,
  subtitle,
  onMenu,
<<<<<<< HEAD
=======
  search,
  onSearch,
>>>>>>> feature/layout
}: {
  title: string
  subtitle: string
  onMenu: () => void
<<<<<<< HEAD
=======
  search: string
  onSearch: (v: string) => void
>>>>>>> feature/layout
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background/80 px-4 py-3.5 backdrop-blur-md lg:px-8">
      <button
        onClick={onMenu}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
<<<<<<< HEAD
        <h1 className="truncate font-heading text-lg font-bold tracking-tight md:text-xl">
          {title}
        </h1>
=======
        <h1 className="truncate font-heading text-lg font-bold tracking-tight md:text-xl">{title}</h1>
>>>>>>> feature/layout
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
<<<<<<< HEAD
          placeholder="Rechercher un actif, une alerte…"
          className="h-10 w-64 rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring lg:w-72"
        />
=======
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Rechercher un actif, une alerte…"
          className="h-10 w-64 rounded-xl border border-border bg-card pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring lg:w-72"
        />
        {search && (
          <button
            onClick={() => onSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
>>>>>>> feature/layout
      </div>

      <button
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
      </button>

      <button className="flex items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-muted">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">
<<<<<<< HEAD
          AM
=======
          JK
>>>>>>> feature/layout
        </span>
        <span className="hidden text-sm font-medium sm:block">Jean K.</span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </button>
    </header>
  )
}
