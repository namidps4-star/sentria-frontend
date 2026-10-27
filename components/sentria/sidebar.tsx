"use client"

import { useIsEmployee } from "@/lib/role"
import { SITES_CHANGED_EVENT } from "@/lib/active-site"
import { useCallback, useEffect, useRef, useState } from "react"

import type { ViewKey } from "./types"
import { StatusTag, type TagTone } from "./status-tag"
import { requestImportOpen } from "@/lib/import-request"
import { SentriaStatus } from "./sentria-status"
import { SupportDialog } from "./support-dialog"
import { useT, useTx, type MessageKey } from "@/lib/i18n"
import { readSectors } from "@/lib/activities"
import { PLAN_NAMES, PLAN_UPDATED_EVENT, readAccountPlan, type PlanId } from "@/lib/plans"
import { useSites } from "@/lib/sites"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"
import {
  ArrowLeftRight,
  LayoutDashboard,
  SquareKanban,
  CalendarDays,
  Factory,
  Sparkles,
  FileBarChart,
  CreditCard,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  Truck,
  UsersRound,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Sprout,
  Zap,
  Building2,
  type LucideIcon,
} from "@/lib/icons"

/** The plan tag under the user's name: the same pastel pill as the app's
 *  status tags (Critical, Warning), one tone and one icon per plan. */
const TIER_TAG: Record<PlanId, { tone: TagTone; icon: LucideIcon }> = {
  decouverte: { tone: "neutral", icon: Sprout },
  pro: { tone: "info", icon: Zap },
  business: { tone: "brand", icon: Sparkles },
  entreprise: { tone: "success", icon: Building2 },
}

interface SidebarProps {
  active: ViewKey
  onNavigate: (view: ViewKey) => void
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  /** The signed-in user, shown above the sign-out button: their name
   *  when they gave one at sign-up, else their email. */
  email?: string
  name?: string
  /** Chosen at sign-up (migrations/006), shown as @username. */
  username?: string | null
  onSignOut?: () => void
  /** SentrIA staff: adds the Admin page. */
  isAdmin?: boolean
  /** Opens the first-use tour again (ONB-GUIDE), from the Help dialog. */
  onStartTour?: () => void
  /** Branch swaps (F-BRANCHSWAP): a row under Operations while this site has a swap to send. `open` is how many still need someone. */
  swaps?: { open: number; total: number; onOpen: () => void }
}

type SidebarItem = {
  id: ViewKey
  /* A message key, not a label. The sidebar was the last place holding
     its own copy of every view name. */
  label: MessageKey
  icon: React.ElementType
  green?: boolean
  /** Shown only to accounts that selected this sector. */
  sector?: string
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
        id: "tracking",
        label: "nav.tracking",
        icon: SquareKanban,
      },
      {
        id: "calendar",
        label: "nav.calendar",
        icon: CalendarDays,
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
      {
        id: "wholesalers",
        label: "nav.wholesalers",
        icon: Truck,
        sector: "health",
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
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-shell"

export function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
  collapsed,
  onToggleCollapse,
  email,
  name,
  username,
  onSignOut,
  isAdmin = false,
  onStartTour,
  swaps,
}: SidebarProps) {
  const t = useT()
  const held = useSites()
  const shownSite = held.sites.find((site) => site.id === held.activeId)

  /* The plan in force for this account (F-TIERTAG). Read after mount
     (it lives in localStorage) and again whenever it changes: here, via
     PLAN_UPDATED_EVENT, or in another tab, via "storage". */
  const [tier, setTier] = useState<PlanId | null>(null)
  useEffect(() => {
    const sync = () => setTier(readAccountPlan().effective)
    sync()
    window.addEventListener(PLAN_UPDATED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(PLAN_UPDATED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  /* Sign-out asks first (F-SIGNOUT): a misclick must not end the session.
     Only "confirm" calls onSignOut; cancel, Escape and a click outside the
     card leave the session untouched and give the focus back. */
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const signOutDialog = usePresence(confirmingSignOut, "--modal-close-dur")
  const signOutButton = useRef<HTMLButtonElement>(null)
  const cancelSignOut = useCallback(() => {
    setConfirmingSignOut(false)
    signOutButton.current?.focus()
  }, [])
  useEffect(() => {
    if (!confirmingSignOut) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelSignOut()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [confirmingSignOut, cancelSignOut])

  /* Help and feedback (F-SUPPORT): a form in a dialog, from any page. It
     says which page it was sent from, so the label is the one in the nav. */
  const tx = useTx()
  const [supportOpen, setSupportOpen] = useState(false)
  const supportButton = useRef<HTMLButtonElement>(null)
  const closeSupport = useCallback(() => {
    setSupportOpen(false)
    supportButton.current?.focus()
  }, [])
  const here = [...sections.flatMap((section) => section.items), { id: "admin", label: "nav.admin" } satisfies Pick<SidebarItem, "id" | "label">].find(
    (item) => item.id === active
  )

  /* The sectors the account selected (read after mount: they live in
     localStorage), again on each page change so a new choice shows up. */
  const [sectors, setSectors] = useState<string[]>([])
  useEffect(() => setSectors(readSectors()), [active])
  // A site brings its own sectors (lib/site-config.ts).
  useEffect(() => {
    const reread = () => setSectors(readSectors())

    window.addEventListener(SITES_CHANGED_EVENT, reread)

    return () => window.removeEventListener(SITES_CHANGED_EVENT, reread)
  }, [])

  const employee = useIsEmployee()

  const shown: typeof sections = sections.map((section) => ({
    ...section,
    // An employee works on the one site the boss gave them: no Sites page.
    items: section.items.filter((item) => !(employee && item.id === "sites") && (!item.sector || sectors.includes(item.sector) || item.id === active)),
  }))

  const visibleSections: typeof sections = isAdmin
    ? shown.map((section) =>
        section.title === "sidebar.section.studio"
          ? {
              ...section,
              items: [
                ...section.items,
                { id: "admin", label: "nav.admin", icon: ShieldCheck } satisfies SidebarItem,
              ],
            }
          : section
      )
    : shown

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
          "squircle rounded-[64px]",
          "bg-sidebar-shell",
          "border border-sidebar-border",
          "shadow-lg",
          "transition-all duration-300",
          open
            ? "translate-x-0"
            : "-translate-x-[120%] lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-visible rounded-[64px]">
          {/* LOGO */}
          <div
            className={[
              "flex h-[76px] shrink-0 items-center [@media(min-height:701px)_and_(max-height:820px)]:h-14 [@media(max-height:700px)]:h-10",
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
                  <span className="font-brand text-lg font-normal tracking-wide text-sidebar-foreground">
                    SentrIA
                  </span>

                  <span className="text-[10px] text-sidebar-foreground/60">
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

          {/* The site the app is showing: green, and the way back to the Sites page. */}
          {shownSite && !collapsed && (
            <button
              type="button"
              data-testid="sidebar-active-site"
              disabled={employee}
              onClick={() => onNavigate("sites")}
              className={"mx-3 mb-1 flex shrink-0 items-center gap-2.5 rounded-full bg-white/10 px-3 py-2 text-left text-sm font-semibold text-sidebar-foreground transition hover:bg-white/15 disabled:cursor-default disabled:hover:bg-white/10" + SIDEBAR_FOCUS}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500 ring-2 ring-green-500/30" aria-hidden="true" />
              <span className="min-w-0 truncate">{shownSite.name}</span>
            </button>
          )}

          {/* NAVIGATION */}
          {/* Every item stays on screen: on a short screen the rows, the
              gaps and the section titles shrink to fit (see the
              max-height rules below), so the list does not need to scroll.
              If the screen is so short that even the smallest rows do not
              fit, it still scrolls, with no scrollbar: a classic one is a
              pale bar with arrows on the dark sidebar. Collapsed, it stays
              unclipped: its labels pop out to the right. */}
          <nav
            className={[
              "flex flex-1 flex-col px-3 py-3 [@media(min-height:701px)_and_(max-height:820px)]:py-2 [@media(max-height:700px)]:py-0.5",
              collapsed
                ? "min-h-0 overflow-visible"
                : "min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            ].join(" ")}
          >
            {visibleSections.map((section, sectionIndex) => (
              <div key={section.title} className="flex min-h-0 shrink flex-col">
                {sectionIndex > 0 && (
                  <div className="my-4 h-px w-full shrink-0 bg-white/15 [@media(max-height:820px)]:my-2 [@media(max-height:700px)]:my-0.5" />
                )}

                {!collapsed && (
                  <div className="mb-2 shrink-0 px-3 text-[10px] font-semibold tracking-[0.16em] text-sidebar-foreground/60 [@media(max-height:700px)]:hidden">
                    {t(section.title)}
                  </div>
                )}

                <div className="flex min-h-0 shrink flex-col gap-1 [@media(min-height:701px)_and_(max-height:820px)]:gap-0.5 [@media(max-height:700px)]:gap-px">
                  {section.items.map((item) => {
                    const isActive = active === item.id
                    const Icon = item.icon

                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-nav={item.id}
                        onClick={() => {
                          onNavigate(item.id)
                          onClose()
                        }}
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "group relative flex h-11 min-h-[26px] w-full shrink items-center rounded-xl transition-all duration-200 [@media(max-height:820px)]:h-9",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-shell",
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
                              "bg-sidebar-shell px-3 py-2",
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

                  {/* Branch swaps: only while this site has stock to send to another branch. */}
                  {swaps && section.title === "sidebar.section.operations" && (
                    <button
                      type="button"
                      data-testid="swaps-open"
                      data-nav="swaps"
                      onClick={() => {
                        swaps.onOpen()
                        onClose()
                      }}
                      aria-haspopup="dialog"
                      aria-label={tx(
                        `Échanges entre pharmacies, ${swaps.open} à faire`,
                        `Branch swaps, ${swaps.open} to do`
                      )}
                      className={[
                        "group relative flex h-11 min-h-[26px] w-full shrink items-center rounded-xl text-sidebar-foreground/65 transition-all duration-200 hover:bg-accent/10 hover:text-accent [@media(max-height:820px)]:h-9",
                        collapsed ? "justify-center px-0" : "gap-3 px-3 text-left",
                        SIDEBAR_FOCUS,
                      ].join(" ")}
                    >
                      <ArrowLeftRight className="h-[18px] w-[18px] shrink-0 transition-colors group-hover:text-accent" strokeWidth={1.8} aria-hidden="true" />
                      {!collapsed && (
                        <span className="truncate text-sm font-medium">{tx("Échanges entre pharmacies", "Branch swaps")}</span>
                      )}
                      <span
                        data-testid="swaps-count"
                        className={[
                          "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-accent-foreground",
                          collapsed ? "absolute right-1 top-1 h-4 min-w-4 px-1 text-[10px]" : "ml-auto",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        {swaps.open}
                      </span>
                      {collapsed && (
                        <span className="pointer-events-none absolute left-full top-1/2 z-[100] ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-sidebar-border bg-sidebar-shell px-3 py-2 text-xs font-medium text-sidebar-foreground opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
                          {tx("Échanges entre pharmacies", "Branch swaps")}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </nav>

          {/* The status bubble sits outside the scrolling list, so it is on screen at every height. */}
          <div className="shrink-0 px-3 pb-3 [@media(min-height:701px)_and_(max-height:820px)]:pb-2 [@media(max-height:700px)]:pb-1">
            <SentriaStatus
              collapsed={collapsed}
              onUpload={() => {
                onNavigate("dashboard")
                requestImportOpen()
              }}
            />
          </div>

          {/* SIGN OUT */}
          {onSignOut && (
            <div className="shrink-0 border-t border-white/10 px-3 py-3 [@media(min-height:701px)_and_(max-height:820px)]:py-2 [@media(max-height:700px)]:py-0.5">
              {!collapsed && (name || username || email) && (
                <div className="mb-1 px-3 [@media(max-height:700px)]:hidden" title={email} data-testid="signed-in-user">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-xs font-semibold text-sidebar-foreground/80">
                      {name || (username ? `@${username}` : email)}
                    </span>
                    {tier && (
                      <span data-testid="plan-tag" className="inline-flex shrink-0">
                        <StatusTag tone={TIER_TAG[tier].tone} icon={TIER_TAG[tier].icon} size="xs">
                          {PLAN_NAMES[tier]}
                        </StatusTag>
                      </span>
                    )}
                  </div>
                  {name && (username || email) && (
                    <div className="truncate text-[11px] text-sidebar-foreground/45">
                      {username ? `@${username}` : email}
                    </div>
                  )}
                </div>
              )}

              <button
                ref={supportButton}
                type="button"
                onClick={() => setSupportOpen(true)}
                aria-label={collapsed ? tx("Aide et retours", "Help & feedback") : undefined}
                title={collapsed ? tx("Aide et retours", "Help & feedback") : undefined}
                data-support-open=""
                className={[
                  "mb-0.5 flex h-10 w-full items-center rounded-xl [@media(min-height:701px)_and_(max-height:820px)]:h-9 [@media(max-height:700px)]:h-[26px] text-sidebar-foreground/65 transition hover:bg-accent/10 hover:text-accent",
                  collapsed ? "justify-center" : "gap-3 px-3 text-left",
                  SIDEBAR_FOCUS,
                ].join(" ")}
              >
                <MessageSquare className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {!collapsed && (
                  <span className="text-sm font-medium">{tx("Aide et retours", "Help & feedback")}</span>
                )}
              </button>

              <button
                ref={signOutButton}
                type="button"
                onClick={() => setConfirmingSignOut(true)}
                aria-label={collapsed ? t("sidebar.signOut") : undefined}
                title={collapsed ? t("sidebar.signOut") : undefined}
                className={[
                  "flex h-10 w-full items-center rounded-xl [@media(min-height:701px)_and_(max-height:820px)]:h-9 [@media(max-height:700px)]:h-[26px] text-sidebar-foreground/65 transition hover:bg-accent/10 hover:text-accent",
                  collapsed ? "justify-center" : "gap-3 px-3 text-left",
                  SIDEBAR_FOCUS,
                ].join(" ")}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {!collapsed && (
                  <span className="text-sm font-medium">{t("sidebar.signOut")}</span>
                )}
              </button>
            </div>
          )}

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

      {/* Beside the <aside>, not inside it: its transform would make a
          fixed child position against the sidebar instead of the screen. */}
      <SupportDialog
        open={supportOpen}
        page={active}
        pageLabel={here ? t(here.label) : active}
        onClose={closeSupport}
        onStartTour={onStartTour ? () => { closeSupport(); onClose(); onStartTour() } : undefined}
      />

      {signOutDialog.present && (
        <div
          className={cn("fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 t-modal-backdrop", signOutDialog.className)}
          onClick={(event) => {
            if (event.target === event.currentTarget) cancelSignOut()
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sign-out-title"
            className={cn("squircle w-full max-w-[26rem] rounded-[48px] bg-card px-8 pb-7 pt-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08),0_40px_90px_rgba(0,0,0,0.3)] t-modal", signOutDialog.className)}
          >
            <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand/30" aria-hidden="true">
              <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-brand text-[#141414]">
                <LogOut className="h-7 w-7" strokeWidth={2.3} />
              </span>
            </span>

            <h3 id="sign-out-title" className="mt-6 font-heading text-[32px] font-extrabold leading-tight tracking-tight text-foreground">
              {t("sidebar.signOutConfirm")}
            </h3>

            <p className="mt-2 text-base leading-snug text-muted-foreground">{t("sidebar.signOutHint")}</p>

            {email && (
              <span className="mt-5 inline-flex max-w-full items-center gap-2.5 rounded-full bg-muted py-1.5 pl-1.5 pr-4" data-testid="sign-out-account">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[13px] font-extrabold uppercase text-brand" aria-hidden="true">
                  {(name || email).trim().charAt(0)}
                </span>
                <span className="truncate text-sm font-semibold text-foreground/80">{email}</span>
              </span>
            )}

            <div className="mt-6 grid gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmingSignOut(false)
                  onSignOut?.()
                }}
                className="inline-flex h-14 items-center justify-center rounded-full bg-brand text-[17px] font-extrabold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t("sidebar.signOut")}
              </button>

              <button
                type="button"
                autoFocus
                onClick={cancelSignOut}
                className="inline-flex h-14 items-center justify-center rounded-full bg-muted text-[17px] font-extrabold text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t("sidebar.staySignedIn")}
              </button>
            </div>

            <p className="mt-4 hidden text-[13px] text-muted-foreground sm:block">
              <kbd className="rounded-md border border-border px-1.5 py-0.5 font-sans text-xs font-bold">Esc</kbd> {t("sidebar.escToStay")}
            </p>
          </div>
        </div>
      )}
    </>
  )
}