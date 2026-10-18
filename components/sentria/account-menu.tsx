"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, MapPin, Plus, User } from "@/lib/icons"
import { requestAddSiteOnOpen } from "@/lib/active-site"
import { activityLabel } from "@/lib/activities"
import { initialsOf, useCompanyIdentity } from "@/lib/company"
import { useT, useTx } from "@/lib/i18n"
import { useIsEmployee } from "@/lib/role"
import { chooseSite, useSites, type StoredSite } from "@/lib/sites"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"
import { SECTORS } from "./onboarding-modal"
import { SectorBadge } from "./sector-badge"

const FOCUS_RING =
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/** The company button in the top bar (F-SITESCOPE).
 *
 *  It rolls down the company's sites grouped by industry. Each site shows its
 *  alerts and, when it runs departments, one chip for each: a tap opens the
 *  dashboard for that industry and department. "Add a site" sits in the menu.
 *  With sites held by the API the button names the site shown ("COMPANY ·
 *  SITE", a pin, the site's name, its department). Sites held only in the
 *  account profile cut nothing, so there the menu lists them and opens the
 *  Sites page, and picking one switches nothing. */
export function AccountMenu({ onOpenSites }: { onOpenSites?: () => void }) {
  const t = useT()
  const tx = useTx()
  const { name: companyName } = useCompanyIdentity()
  const { ready, mode, sites, activeId, activeDepartment } = useSites()
  const employee = useIsEmployee()

  const server = mode === "server"
  const active = server ? (sites.find((site) => site.id === activeId) ?? null) : null

  const sectorLabel = (id: string) => {
    const found = SECTORS.find((s) => s.id === id)

    return found ? tx(found.label.fr, found.label.en) : id
  }
  const departmentName = (sector: string, id: string) => activityLabel(sector, id, tx) ?? id

  const [open, setOpen] = useState(false)
  const menu = usePresence(open, "--dropdown-close-dur")
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

  const label = companyName ? t("topbar.account.of", { name: companyName }) : t("topbar.account")
  const shownDepartment =
    active && active.departments.length >= 2
      ? departmentName(active.sector, activeDepartment ?? active.departments[0])
      : null

  // Sites grouped by industry, in the order each industry first appears.
  const groups: { sector: string; sites: StoredSite[] }[] = []

  for (const site of sites) {
    const group = groups.find((g) => g.sector === site.sector)

    if (group) group.sites.push(site)
    else groups.push({ sector: site.sector, sites: [site] })
  }

  function pick(site: StoredSite, department: string | null) {
    setOpen(false)

    if (server) chooseSite(site.id, department)
    else onOpenSites?.()
  }

  const face = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">
        {companyName ? initialsOf(companyName) : <User className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>

      {companyName && !active && (
        <span className="hidden max-w-[12rem] truncate text-sm font-medium sm:block">{companyName}</span>
      )}

      {companyName && active && (
        <span className="hidden min-w-0 max-w-[13rem] text-left sm:block">
          <span data-testid="account-menu-line" className="block truncate text-[10px] font-semibold uppercase leading-3 tracking-wider text-muted-foreground">
            {companyName} · {tx("Site", "Site")}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold leading-4">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span data-testid="account-menu-active" className="truncate">{active.name}</span>
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

  // An employee works on one site: the company, the site, no menu.
  if (!ready || employee) {
    return (
      <div role="group" aria-label={label} className="flex items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-2.5">
        {face}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={active ? `${label}, ${tx("site", "site")} ${active.name}` : label}
        data-testid="account-menu-button"
        className={"flex items-center gap-2 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-muted" + FOCUS_RING}
      >
        {face}

        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {menu.present && (
        <div
          role="menu"
          aria-label={tx("Mes sites", "My sites")}
          data-testid="account-menu"
          data-origin="top-right"
          className={cn("absolute right-0 top-full z-40 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-border bg-card p-2.5 shadow-xl t-dropdown", menu.className)}
        >
          {sites.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{tx("Aucun site pour l'instant.", "No sites yet.")}</p>
          ) : (
            <div className="max-h-[min(30rem,70vh)] overflow-y-auto px-0.5">
              {groups.map((group) => (
                <section key={group.sector} aria-label={sectorLabel(group.sector)}>
                  <h4 className="flex items-center gap-2 px-3 pb-1.5 pt-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    <SectorBadge sector={group.sector} size="sm" />
                    <span data-testid="account-menu-sector">{sectorLabel(group.sector)}</span>
                  </h4>

                  <ul>
                    {group.sites.map((site) => {
                      const current = server && site.id === activeId
                      const chips = server && site.configured && site.departments.length > 0

                      return (
                        <li key={site.id} className={cn("rounded-2xl p-3", current && "bg-accent/20 ring-[1.5px] ring-inset ring-foreground")}>
                          <button
                            type="button"
                            role="menuitem"
                            data-testid="account-menu-site"
                            data-active={current ? "" : undefined}
                            aria-current={current ? "true" : undefined}
                            onClick={() => pick(site, null)}
                            className={"flex w-full items-center gap-2 rounded-lg text-left" + FOCUS_RING}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold">{site.name}</span>
                              {site.location && <span className="block truncate text-xs text-muted-foreground">{site.location}</span>}
                            </span>
                            <span data-testid="account-menu-count" className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                              {site.alerts ?? 0}
                            </span>
                          </button>

                          {chips && (
                            <div data-testid="account-menu-departments" className="mt-2.5 flex flex-wrap gap-1.5">
                              {site.departments.map((department) => {
                                const picked = current && (activeDepartment ?? site.departments[0]) === department

                                return (
                                  <button
                                    key={department}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={picked}
                                    data-testid="account-menu-department-item"
                                    data-department={department}
                                    onClick={() => pick(site, department)}
                                    className={cn(
                                      "min-h-8 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors" + FOCUS_RING,
                                      picked
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border bg-card hover:bg-muted"
                                    )}
                                  >
                                    {departmentName(site.sector, department)}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <div className="mt-2 flex gap-2 border-t border-border pt-2.5">
            <button
              type="button"
              role="menuitem"
              data-testid="account-menu-add"
              onClick={() => {
                requestAddSiteOnOpen()
                setOpen(false)
                onOpenSites?.()
              }}
              className={"flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold transition-colors hover:bg-muted" + FOCUS_RING}
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
              className={"flex min-h-11 flex-1 items-center justify-center rounded-full bg-brand px-3 text-[13px] font-semibold text-brand-foreground transition-opacity hover:opacity-90" + FOCUS_RING}
            >
              {tx("Gérer les sites", "Manage sites")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
