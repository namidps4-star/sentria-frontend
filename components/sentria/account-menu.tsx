"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight, MapPin, Plus, User } from "@/lib/icons"
import { requestAddSiteOnOpen } from "@/lib/active-site"
import { departmentIconKey, useSiteIcons, type SiteIconData } from "@/lib/site-icons"
import { SectorTile } from "./site-tiles"
import { activityLabel } from "@/lib/activities"
import { initialsOf, useCompanyIdentity } from "@/lib/company"
import { useT, useTx } from "@/lib/i18n"
import { useIsEmployee } from "@/lib/role"
import { chooseSite, useSites, type StoredSite } from "@/lib/sites"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"
import { SECTORS } from "./onboarding-modal"

const FOCUS_RING =
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/** A department's small glyph, in the colour of the pill's text. */
function DepartmentGlyph({ department, icons }: { department: string; icons: SiteIconData | null }) {
  const icon = icons?.[departmentIconKey(department)] ?? icons?.["dept:other"]

  return (
    <svg
      viewBox={icon?.viewBox ?? "0 0 24 24"}
      width={15}
      height={15}
      focusable="false"
      aria-hidden="true"
      data-department-icon={department}
      className="mr-1 inline-block align-[-2px]"
      dangerouslySetInnerHTML={{ __html: icon?.body ?? "" }}
    />
  )
}

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
  const departmentsCount = (n: number) => tx(`${n} département${n > 1 ? "s" : ""}`, `${n} department${n > 1 ? "s" : ""}`)
  const departmentName = (sector: string, id: string) => activityLabel(sector, id, tx) ?? id

  const [open, setOpen] = useState(false)
  // The glyphs load the first time the menu opens.
  const icons = useSiteIcons(open)
  // The sector opened into its own card (one at a time); it closes with the menu.
  const [expanded, setExpanded] = useState<string | null>(null)
  const menu = usePresence(open, "--dropdown-close-dur")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) setExpanded(null)
  }, [open])

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
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-bold text-brand-foreground">
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
        className={"flex items-center gap-2 rounded-xl border border-brand bg-brand/10 py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-brand/20" + FOCUS_RING}
      >
        {face}

        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {menu.present && (
        <div
          role="menu"
          aria-label={tx("Mes sites", "My sites")}
          data-testid="account-menu"
          data-origin="top-right"
          className={cn("absolute right-0 top-full z-40 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] squircle rounded-3xl border border-border bg-card p-2.5 shadow-xl t-dropdown", menu.className)}
        >
          {sites.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{tx("Aucun site pour l'instant.", "No sites yet.")}</p>
          ) : (
            <div className="space-y-2 px-0.5">
              {(() => {
                // The active site sits on top in lime; the rest follow as cards. One sector label carries the
                // test id for each industry, whichever card shows it first.
                const seenSector = new Set<string>()
                const sectorTid = (sector: string) => (seenSector.has(sector) ? undefined : (seenSector.add(sector), "account-menu-sector"))
                const others = sites.filter((site) => site.id !== active?.id)
                const count = (site: StoredSite, onLime = false) => (
                  <span
                    data-testid="account-menu-count"
                    className={cn(
                      "min-w-[1.9rem] shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-bold tabular-nums",
                      (site.alerts ?? 0) > 0
                        ? "bg-[var(--tag-danger-bg)] text-[var(--tag-danger-fg)]"
                        : onLime
                          ? "bg-white/70 text-[#141414]/70"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {site.alerts ?? "–"}
                  </span>
                )
                const chipsFor = (site: StoredSite, isCurrent: boolean) => {
                  if (!(server && site.configured && site.departments.length > 0)) return null

                  return (
                    <div data-testid="account-menu-departments" className="mt-2.5 flex flex-wrap gap-1.5">
                      {site.departments.map((department) => {
                        const picked = isCurrent && (activeDepartment ?? site.departments[0]) === department

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
                              picked ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted"
                            )}
                          >
                            <DepartmentGlyph department={department} icons={icons} />{departmentName(site.sector, department)}
                          </button>
                        )
                      })}
                    </div>
                  )
                }
                const siteButton = (site: StoredSite, isCurrent: boolean, sub?: React.ReactNode) => (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="account-menu-site"
                    data-active={isCurrent ? "" : undefined}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => pick(site, null)}
                    className={"flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left" + FOCUS_RING}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-bold">{site.name}</span>
                      {sub ?? (site.location && <span className="block truncate text-xs opacity-65">{site.location}</span>)}
                    </span>
                    {count(site, isCurrent)}
                  </button>
                )

                return (
                  <>
                    {active && (
                      <div className="squircle rounded-[28px] bg-brand p-4 text-brand-foreground" style={{ borderRadius: 28 }}>
                        <span className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-70">{tx("Site actif", "Active site")}</span>
                        <div className="mt-2 flex items-center gap-3">
                          <SectorTile sector={active.sector} icons={icons} />
                          {siteButton(
                            active,
                            true,
                            <span className="block truncate text-xs opacity-70">
                              <span data-testid={sectorTid(active.sector)}>{sectorLabel(active.sector)}</span>
                              {active.departments.length > 0 && ` · ${departmentsCount(active.departments.length)}`}
                            </span>
                          )}
                        </div>
                        {chipsFor(active, true)}
                      </div>
                    )}

                    {others.length > 0 && (
                      <p className="px-2 pb-0.5 pt-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        {active ? tx("Autres sites", "Other sites") : tx("Mes sites", "My sites")}
                      </p>
                    )}

                    {others.map((site, index) => {
                      const sectorSites = others.filter((other) => other.sector === site.sector)

                      if (expanded === site.sector) {
                        // The whole industry opens as one card, at the place of its first site.
                        if (others.findIndex((other) => other.sector === site.sector) !== index) return null

                        return (
                          <section
                            key={`sector-${site.sector}`}
                            aria-label={sectorLabel(site.sector)}
                            className="squircle rounded-[28px] bg-muted p-1.5"
                            style={{ borderRadius: 28 }}
                          >
                            <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-2">
                              <SectorTile sector={site.sector} icons={icons} />
                              <h4 data-testid={sectorTid(site.sector)} className="font-heading text-[15px] font-semibold">
                                {sectorLabel(site.sector)}
                              </h4>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {tx(`${sectorSites.length} site${sectorSites.length > 1 ? "s" : ""}`, `${sectorSites.length} site${sectorSites.length > 1 ? "s" : ""}`)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpanded(null)}
                                aria-expanded="true"
                                aria-label={tx(`Refermer ${sectorLabel(site.sector)}`, `Close ${sectorLabel(site.sector)}`)}
                                data-testid="account-menu-sector-toggle"
                                className={"flex h-8 w-8 items-center justify-center rounded-full bg-card" + FOCUS_RING}
                              >
                                <ChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" />
                              </button>
                            </div>

                            <ul className="space-y-1.5">
                              {sectorSites.map((one) => (
                                <li key={one.id} className="squircle rounded-[22px] bg-card p-3" style={{ borderRadius: 22 }}>
                                  <div className="flex items-center">{siteButton(one, false)}</div>
                                  {chipsFor(one, false)}
                                </li>
                              ))}
                            </ul>
                          </section>
                        )
                      }

                      return (
                        <div
                          key={site.id}
                          className="squircle flex items-center gap-3 rounded-[24px] bg-muted p-2.5"
                          style={{ borderRadius: 24 }}
                        >
                          <SectorTile sector={site.sector} icons={icons} />
                          <div className="flex min-w-0 flex-1 items-center">
                            {siteButton(
                              site,
                              false,
                              <span className="block truncate text-xs opacity-65">
                                <span data-testid={sectorTid(site.sector)}>{sectorLabel(site.sector)}</span>
                                {site.departments.length > 0 && ` · ${departmentsCount(site.departments.length)}`}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpanded(site.sector)}
                            aria-expanded="false"
                            aria-label={tx(`Ouvrir ${sectorLabel(site.sector)}`, `Open ${sectorLabel(site.sector)}`)}
                            data-testid="account-menu-sector-toggle"
                            className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card" + FOCUS_RING}
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      )
                    })}
                  </>
                )
              })()}
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
