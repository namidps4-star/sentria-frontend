"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Check, ChevronDown, MapPin, Plus, User } from "@/lib/icons"
import { initialsOf, useCompanyIdentity } from "@/lib/company"
import { useT, useTx } from "@/lib/i18n"
import { requestAddSiteOnOpen } from "@/lib/active-site"
import { activityLabel } from "@/lib/activities"
import { chooseSite, useSites } from "@/lib/sites"
import { usePresence } from "@/lib/use-presence"
import { SECTORS } from "./onboarding-modal"
import { cn } from "@/lib/utils"

const FOCUS_RING =
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/** The company button in the top bar (F-SITESCOPE).
 *
 *  With one site or none it is the plain company button: a single-site
 *  business sees nothing about sites. With two or more, held by the API, it
 *  names the site the app is showing ("COMPANY · SITE", a pin and the site's
 *  name) and rolls down every site with its alerts, so the person always
 *  knows which one site's data is on screen and can change it on purpose.
 *  The sites held only in the account profile (the API has no table yet)
 *  cut nothing, so they get no switcher. */
export function AccountMenu({ onOpenSites }: { onOpenSites?: () => void }) {
  const t = useT()
  const tx = useTx()
  const { name: companyName } = useCompanyIdentity()
  const { mode, sites, activeId, activeDepartment } = useSites()

  const sectorLabel = (id: string) => {
    const found = SECTORS.find((s) => s.id === id)

    return found ? tx(found.label.fr, found.label.en) : id
  }

  const switcher = mode === "server" && sites.length >= 2
  const active = sites.find((site) => site.id === activeId) ?? null

  // The site whose departments are rolled out (the one shown, when it opens).
  const [rolled, setRolled] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const menu = usePresence(open && switcher, "--dropdown-close-dur")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)

    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const departmentName = (sector: string, id: string) => activityLabel(sector, id, tx) ?? id
  // The department shown on the button, only for a site that runs several.
  const shownDepartment =
    active && active.departments.length >= 2
      ? departmentName(active.sector, activeDepartment ?? active.departments[0])
      : null

  const label = companyName ? t("topbar.account.of", { name: companyName }) : t("topbar.account")
  const face = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">
        {companyName ? initialsOf(companyName) : <User className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>

      {companyName && !switcher && (
        <span className="hidden max-w-[12rem] truncate text-sm font-medium sm:block">{companyName}</span>
      )}

      {companyName && switcher && (
        <span className="hidden min-w-0 max-w-[13rem] text-left sm:block">
          <span data-testid="account-menu-line" className="block truncate text-[10px] font-semibold uppercase leading-3 tracking-wider text-muted-foreground">
            {companyName} · {tx("Site", "Site")}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold leading-4">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span data-testid="account-menu-active" className="truncate">{active?.name ?? ""}</span>
            {shownDepartment && (
              <span data-testid="account-menu-department" className="hidden truncate text-xs font-normal text-muted-foreground md:inline">
                · {shownDepartment}
              </span>
            )}
          </span>
        </span>
      )}
    </>
  )

  if (!switcher) {
    return (
      <div
        role="group"
        aria-label={label}
        className="flex items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-2.5"
      >
        {face}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) setRolled(activeId)
          setOpen(!open)
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={active ? `${label}, ${tx("site", "site")} ${active.name}` : label}
        data-testid="account-menu-button"
        className={"flex items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-muted" + FOCUS_RING}
      >
        {face}

        <ChevronDown
          className={cn("hidden h-4 w-4 text-muted-foreground transition-transform sm:block", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {menu.present && (
        <div
          role="menu"
          aria-label={tx("Mes sites", "My sites")}
          data-testid="account-menu"
          data-origin="top-right"
          className={cn("absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-2 shadow-xl t-dropdown", menu.className)}
        >
          <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tx("Site affiché", "Viewing site")}
          </p>

          <ul className="max-h-72 overflow-y-auto">
            {sites.map((site) => {
              const current = site.id === activeId
              const several = site.configured && site.departments.length >= 2
              const isRolled = several && rolled === site.id

              return (
                <li key={site.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={current}
                    aria-expanded={several ? isRolled : undefined}
                    data-testid="account-menu-site"
                    data-active={current ? "" : undefined}
                    onClick={() => {
                      if (several) {
                        // A site that runs several departments rolls them out:
                        // the site opens on its first, or the one picked below.
                        setRolled(isRolled ? null : site.id)
                        if (!current) chooseSite(site.id)
                        return
                      }

                      chooseSite(site.id)
                      setOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted" + FOCUS_RING,
                      current && "bg-accent/20"
                    )}
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{site.name}</span>
                      <span data-testid="account-menu-sector" className="block truncate text-xs text-muted-foreground">
                        {sectorLabel(site.sector)}
                        {site.location ? ` · ${site.location}` : ""}
                      </span>
                    </span>
                    <span data-testid="account-menu-count" className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {site.alerts ?? 0}
                    </span>
                    {several ? (
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isRolled && "rotate-180")} aria-hidden="true" />
                    ) : (
                      current && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  {isRolled && (
                    <ul data-testid="account-menu-departments" className="mb-1 ml-6 mt-0.5 border-l border-border pl-2">
                      {site.departments.map((department) => {
                        const picked = current && (activeDepartment ?? site.departments[0]) === department

                        return (
                          <li key={department}>
                            <button
                              type="button"
                              role="menuitemradio"
                              aria-checked={picked}
                              data-testid="account-menu-department-item"
                              data-department={department}
                              onClick={() => {
                                chooseSite(site.id, department)
                                setOpen(false)
                              }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted" + FOCUS_RING,
                                picked && "bg-accent/20 font-semibold"
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">{departmentName(site.sector, department)}</span>
                              {picked && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            role="menuitem"
            data-testid="account-menu-add"
            onClick={() => {
              requestAddSiteOnOpen()
              setOpen(false)
              onOpenSites?.()
            }}
            className={"mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted" + FOCUS_RING}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {tx("Ajouter un site", "Add a site")}
          </button>

          <button
            type="button"
            role="menuitem"
            data-testid="account-menu-manage"
            onClick={() => {
              setOpen(false)
              onOpenSites?.()
            }}
            className={"mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90" + FOCUS_RING}
          >
            {tx("Gérer les sites", "Manage sites")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
