"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Menu, Plus, X } from "@/lib/icons"
import type { Tx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type SheetTab = {
  id: string
  label: string
  /** Open alerts in this department. */
  count?: number
  /** Critical ones among them: the badge turns red. */
  critical?: number
}

/** A department the company could add next to the ones it runs (a
 *  hospital's own lab, say). Locked when the plan doesn't allow it. */
export type SheetTabSuggestion = {
  id: string
  label: string
  locked?: boolean
}

/** The departments as spreadsheet-style tabs pinned to the bottom of the
 *  page, like the sheet tabs in Google Sheets. The strip scrolls when the
 *  tabs don't fit, and it always says so: arrows light up on the side that
 *  has more, the edge fades, and the menu on the left lists every tab. */
export function SheetTabs({
  tabs,
  activeId,
  onSelect,
  label,
  tx,
  suggestions = [],
  onAdd,
  onSeePlans,
}: {
  tabs: SheetTab[]
  activeId: string | null
  onSelect: (id: string) => void
  label: string
  tx: Tx
  /** Linked departments not run yet, shown as "+ Laboratory" after the tabs. */
  suggestions?: SheetTabSuggestion[]
  onAdd?: (id: string) => void
  onSeePlans?: () => void
}) {
  const strip = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ left: false, right: false })
  const [menuOpen, setMenuOpen] = useState(false)
  // The locked department whose "Business plan" note is open.
  const [offer, setOffer] = useState<SheetTabSuggestion | null>(null)

  const measure = useCallback(() => {
    const el = strip.current
    if (!el) return
    setMore({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    })
  }, [])

  useLayoutEffect(() => {
    measure()
    const el = strip.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, tabs.length])

  // Bring the chosen tab into view (after a pick from the menu, or on load).
  // Only the strip scrolls: scrollIntoView could move the page as well.
  useEffect(() => {
    const box = strip.current
    const el = box?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(activeId ?? "")}"]`)
    if (!box || !el) return
    const left = el.offsetLeft // the strip is the offset parent
    const right = left + el.offsetWidth
    if (left < box.scrollLeft) box.scrollLeft = left - 8
    else if (right > box.scrollLeft + box.clientWidth) box.scrollLeft = right - box.clientWidth + 8
  }, [activeId])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", close)
    }
  }, [menuOpen])

  const scrollBy = (dir: -1 | 1) => {
    const el = strip.current
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: "smooth" })
  }

  // Arrow keys move between tabs, as a tab list should.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === activeId)
    const next =
      e.key === "ArrowRight" ? tabs[Math.min(tabs.length - 1, i + 1)]
      : e.key === "ArrowLeft" ? tabs[Math.max(0, i - 1)]
      : e.key === "Home" ? tabs[0]
      : e.key === "End" ? tabs[tabs.length - 1]
      : null
    if (!next) return
    e.preventDefault()
    onSelect(next.id)
    requestAnimationFrame(() =>
      strip.current?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(next.id)}"]`)?.focus()
    )
  }

  const hidden = more.left || more.right

  return (
    <div className="sticky -bottom-4 z-20 -mx-4 -mb-4 flex items-stretch gap-1 border-t border-border bg-deep-bar px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:-bottom-8 lg:-mx-8 lg:-mb-8 lg:px-4">
      {/* Every tab, even the ones scrolled out of sight. */}
      <div ref={menuRef} className="relative flex items-start pt-1.5">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={tx(`Tous les départements (${tabs.length})`, `All departments (${tabs.length})`)}
          title={tx("Tous les départements", "All departments")}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            menuOpen && "bg-card text-foreground"
          )}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          <span className="tabular-nums">{tabs.length}</span>
          <span className="hidden sm:inline">{tabs.length > 1 ? tx("départements", "departments") : tx("département", "department")}</span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label={label}
            className="absolute bottom-full left-0 mb-2 w-64 animate-in fade-in slide-in-from-bottom-1 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl duration-150"
          >
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            {tabs.map((t) => {
              const active = t.id === activeId
              return (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onSelect(t.id)
                    setMenuOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    active ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  <Check className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "invisible")} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                  <CountBadge tab={t} tx={tx} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-start gap-0.5 pt-1.5">
        {(["left", "right"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => scrollBy(side === "left" ? -1 : 1)}
            disabled={!more[side]}
            aria-label={side === "left" ? tx("Onglets précédents", "Previous tabs") : tx("Onglets suivants", "More tabs")}
            className="flex h-9 w-7 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:text-muted-foreground/30"
          >
            {side === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <div
          ref={strip}
          onScroll={measure}
          className="relative flex items-start gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            // The edge that hides tabs fades out.
            maskImage: hidden
              ? `linear-gradient(to right, ${more.left ? "transparent, black 32px" : "black, black"}, ${more.right ? "black calc(100% - 32px), transparent" : "black, black"})`
              : undefined,
          }}
        >
          <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex shrink-0 items-start gap-1">
          {tabs.map((t) => {
            const active = t.id === activeId
            return (
              <button
                key={t.id}
                data-tab={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onSelect(t.id)}
                className={cn(
                  // Hangs from the bar's top edge, like a sheet tab.
                  "relative -mt-px flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-b-xl border border-t-0 px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active
                    ? "border-border bg-card font-semibold text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-accent" aria-hidden="true" />
                )}
                {t.label}
                <CountBadge tab={t} tx={tx} />
              </button>
            )
          })}
          </div>

          {/* Departments that run with these, not added yet. */}
          {suggestions.length > 0 && (
            <div role="group" aria-label={tx("Ajouter un département", "Add a department")} className="flex shrink-0 items-center gap-1 pl-1 pt-1.5">
              {suggestions.map((sug) => (
                <button
                  key={sug.id}
                  type="button"
                  data-add={sug.id}
                  onClick={() => (sug.locked ? setOffer(sug) : onAdd?.(sug.id))}
                  aria-label={
                    sug.locked
                      ? tx(`Ajouter ${sug.label} (offre Business)`, `Add ${sug.label} (Business plan)`)
                      : tx(`Ajouter ${sug.label}`, `Add ${sug.label}`)
                  }
                  className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-foreground/25 px-3.5 text-sm text-muted-foreground transition-colors hover:border-foreground/50 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {sug.label}
                  {sug.locked && (
                    <span className="rounded-full bg-[var(--tag-info-bg)] px-1.5 text-[10px] font-semibold text-[var(--tag-info-fg)]">
                      Business
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {offer && (
        <div
          role="dialog"
          aria-label={tx(`Ajouter ${offer.label}`, `Add ${offer.label}`)}
          className="absolute bottom-full right-2 mb-2 w-72 animate-in fade-in slide-in-from-bottom-1 rounded-2xl bg-card p-4 shadow-xl duration-150 lg:right-4"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{tx(`Ajouter ${offer.label}`, `Add ${offer.label}`)}</p>
            <button
              type="button"
              onClick={() => setOffer(null)}
              aria-label={tx("Fermer", "Close")}
              className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {tx(
              "Suivre plusieurs départements liés ensemble (une clinique avec son laboratoire et sa pharmacie) fait partie de l'offre Business.",
              "Running several linked departments together (a clinic with its own lab and pharmacy) is part of the Business plan."
            )}
          </p>
          {onSeePlans && (
            <button
              type="button"
              onClick={() => {
                setOffer(null)
                onSeePlans()
              }}
              className="mt-3 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-[#141414] hover:opacity-90"
            >
              {tx("Voir les offres", "See the plans")}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function CountBadge({ tab, tx }: { tab: SheetTab; tx: Tx }) {
  if (!tab.count) return null
  const critical = (tab.critical ?? 0) > 0
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
        critical ? "bg-[var(--tag-danger-bg)] text-[var(--tag-danger-fg)]" : "bg-muted text-muted-foreground"
      )}
      aria-label={
        critical
          ? tx(`${tab.count} alertes, dont ${tab.critical} critiques`, `${tab.count} alerts, ${tab.critical} critical`)
          : tx(`${tab.count} alertes`, `${tab.count} alerts`)
      }
    >
      {tab.count}
    </span>
  )
}
