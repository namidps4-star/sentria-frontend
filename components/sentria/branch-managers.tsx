"use client"

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"

import { ArrowRight, ArrowUpRight, Check, Loader2, Mail, MapPin, MoreHorizontal, Phone, Plus, Trash2 } from "@/lib/icons"

import { branchCode, buildBoard, shortAmount, stakeOf, type BranchLine, type BranchSite } from "@/lib/branch-board"
import type { Swap } from "@/lib/branch-swaps"
import { AVAILABILITY_LABEL, type Availability, type Contractor } from "@/lib/crm"
import { resolve, useTx, type Tx } from "@/lib/i18n"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

import { PhoneField } from "./phone-field"
import { SectorTag } from "./sector-tag"
import { StatusTag, type TagTone } from "./status-tag"

/* The Field team page for a company with several branches (F-BRANCHBOARD):
 * a big banner pinned at the top (who runs the branches, in numbers), one card
 * per person in their branch's colour, and a lime band for the branches nobody
 * runs. The add form is a sheet that hangs from the banner's bottom edge, so
 * it opens below the banner and never over it. The view owns the data and the
 * saves; this draws them. */

const AVAILABILITY_ORDER: Availability[] = ["available", "busy", "off"]
const AVAILABILITY_TAG: Record<Availability, TagTone> = { available: "success", busy: "warning", off: "danger" }

/** The amber the banner's "needs a manager" labels use: the banner is dark in every theme. */
const NEEDS_MANAGER = "text-[oklch(0.85_0.13_75)]"

type Filter = "all" | Availability | "nomanager"

function names(list: string[], tx: Tx): string {
  if (list.length <= 1) return list.join("")

  return `${list.slice(0, -1).join(", ")} ${tx("et", "and")} ${list[list.length - 1]}`
}

function tint(line: Pick<BranchLine, "hue"> | null): CSSProperties {
  return { "--b": line ? `var(--branch-${line.hue})` : "var(--muted)" } as CSSProperties
}

export type ManagerForm = { name: string; phone: string; email: string; site_id: string }

/** The add form: the view keeps its values and its save, the board draws it. */
export type ManagerSheet = {
  open: boolean
  form: ManagerForm
  busy: boolean
  /** Save was pressed: show a bad phone number even if the field was never left. */
  tried: boolean
  onChange: (patch: Partial<ManagerForm>) => void
  onSubmit: () => void
  onClose: () => void
}

export type BranchManagersProps = {
  sites: BranchSite[]
  contractors: Contractor[]
  loaded: boolean
  /** The swaps each branch sends, or null while they are not read (or could not be). */
  swaps: Record<string, Swap[]> | null
  /** An employee's own read of the swaps coming in (F-SWAPIN); undefined for the boss, who reads them off every branch. */
  incoming?: Record<string, Swap[]> | null
  canSeeAmounts: boolean
  sheet: ManagerSheet
  /** Notices that belong under the banner: a refused save, the drafted texts. */
  children?: ReactNode
  onAdd: (siteId?: string) => void
  onSetAvailability: (person: Contractor, value: Availability) => void
  onRemove: (person: Contractor) => void
  onMoveToSite: (person: Contractor, siteId: string) => void
  onOpenBranch: (siteId: string) => void
  /** An employee reads the board: no add, no edit, no branch to open (F-TEAMROLES). */
  readOnly: boolean
}

export function BranchManagers(props: BranchManagersProps) {
  const { sites, contractors, loaded, swaps, incoming, canSeeAmounts, sheet, onAdd, readOnly } = props
  const tx = useTx()
  const [filter, setFilter] = useState<Filter>("all")
  const board = buildBoard(sites, contractors, swaps, incoming)
  // The branches read here: all of them for the boss, the employee's own for an employee.
  const readLines = board.lines.filter((line) => line.read)
  const swapsWaiting = readLines.length > 0 ? readLines.reduce((sum, line) => sum + line.send.length + (incoming === undefined ? 0 : line.receive.length), 0) : null
  const maxOpen = Math.max(1, ...contractors.map((c) => c.open_assignments))
  const everyone = [...board.lines.flatMap((l) => l.people.map((p) => ({ person: p, line: l as BranchLine | null }))), ...board.unfiled.map((p) => ({ person: p, line: null as BranchLine | null }))]
  const shown = everyone.filter(({ person }) => filter === "all" || (filter !== "nomanager" && person.availability === filter))
  const showStrip = board.missing.length > 0 && (filter === "all" || filter === "nomanager")
  const presence = usePresence(sheet.open, "--modal-close-dur")

  function pill(active: boolean) {
    return cn(
      "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"
    )
  }

  const touched = Boolean(sheet.form.name.trim() || sheet.form.phone.trim() || sheet.form.email.trim())

  return (
    <div className="space-y-5" data-testid="branch-board">
      {/* BANNER: pinned. The page scrolls under it, and the form hangs from its bottom edge. */}
      <div data-testid="branch-pin" className="sticky -top-4 z-30 -mx-4 -mt-4 bg-canvas px-4 pb-3 pt-4 lg:-top-8 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pb-4 lg:pt-8">
        <div
          data-testid="branch-banner"
          className="squircle t-enter grid gap-x-10 gap-y-5 rounded-[34px] bg-sidebar-shell p-5 text-sidebar-foreground sm:gap-y-6 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-8"
        >
          <div className="min-w-0">
            <SectorTag size="md" />
            <h2 className="mt-3 text-balance font-heading text-[28px] font-semibold leading-[1.05] tracking-tight lg:text-[38px]">
              {tx("Qui dirige chaque agence ?", "Who runs each branch?")}
            </h2>

            <ul data-testid="branch-meter" className="mt-5 grid max-w-[640px] grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-x-2 gap-y-3 sm:mt-6 lg:mt-7">
              {board.lines.map((line) => {
                const missing = loaded && line.people.length === 0

                return (
                  <li key={line.siteId} data-testid="meter-segment" data-missing={missing} style={tint(line)} className="min-w-0">
                    <span
                      className={cn(
                        "block h-2 rounded-full",
                        missing ? "border-[1.5px] border-dashed border-sidebar-foreground/45" : loaded ? "bg-[var(--b)]" : "bg-sidebar-foreground/15"
                      )}
                    />
                    <span className={cn("mt-2 block truncate text-xs max-sm:sr-only", missing ? NEEDS_MANAGER : "text-sidebar-foreground/65")} title={line.name}>
                      {line.name}
                      {missing && <span className="sr-only">{tx(", sans responsable", ", no manager")}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:items-end lg:gap-6">
            <div className="flex">
              {[
                { label: tx("Agences couvertes", "Branches covered"), value: loaded ? `${board.covered} / ${sites.length}` : "–", id: "covered", warn: false },
                { label: tx("Sans responsable", "No manager"), value: loaded ? String(board.missing.length) : "–", id: "missing", warn: loaded && board.missing.length > 0 },
                { label: tx("Transferts en attente", "Swaps waiting"), value: swapsWaiting === null ? "–" : String(swapsWaiting), id: "swaps", warn: false },
              ].map((stat) => (
                <div key={stat.id} data-testid={`banner-${stat.id}`} className="min-w-0 border-l border-sidebar-foreground/15 px-4 first:border-l-0 first:pl-0 lg:px-5 lg:first:pl-5">
                  <p className={cn("font-heading text-2xl font-semibold leading-none tabular-nums lg:text-[30px]", stat.warn && NEEDS_MANAGER)}>{stat.value}</p>
                  <p className="mt-2 text-xs text-sidebar-foreground/60">{stat.label}</p>
                </div>
              ))}
            </div>

            {!readOnly && (
              <button
                type="button"
                data-testid="add-manager"
                onClick={() => onAdd()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 sm:h-[52px] text-[15px] font-semibold text-accent-foreground transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {tx("Ajouter un responsable d'agence", "Add a branch manager")}
              </button>
            )}
          </div>
        </div>

        {presence.present && !readOnly && (
          <>
            <div
              data-testid="manager-scrim"
              aria-hidden="true"
              onMouseDown={() => {
                if (!touched) sheet.onClose()
              }}
              className={cn("fixed inset-0 -z-10 bg-black/35 t-modal-backdrop", presence.className)}
            />
            <AddManagerSheet sheet={sheet} board={board.lines} className={presence.className} />
          </>
        )}
      </div>

      {props.children}

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setFilter("all")} className={pill(filter === "all")}>
          {tx("Toutes", "All")}
          <span className="ml-1.5 text-[10px] opacity-60">{sites.length}</span>
        </button>
        {AVAILABILITY_ORDER.map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={pill(filter === value)}>
            {resolve(AVAILABILITY_LABEL[value], tx)}
          </button>
        ))}
        {board.missing.length > 0 && (
          <button type="button" data-testid="filter-nomanager" onClick={() => setFilter("nomanager")} className={cn(pill(filter === "nomanager"), "sm:ml-auto")}>
            {tx(`${board.missing.length} sans responsable`, `${board.missing.length} need a manager`)}
          </button>
        )}
      </div>

      {/* PEOPLE */}
      {shown.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] items-stretch gap-4">
          {shown.map(({ person, line }) => (
            <PersonCard
              key={person.id}
              person={person}
              line={line}
              maxOpen={maxOpen}
              canSeeAmounts={canSeeAmounts}
              sites={sites}
              onSetAvailability={props.onSetAvailability}
              onRemove={props.onRemove}
              onMoveToSite={props.onMoveToSite}
              onOpenBranch={props.onOpenBranch}
              readOnly={props.readOnly}
            />
          ))}
        </ul>
      )}

      {loaded && shown.length === 0 && !showStrip && (
        <p className="squircle rounded-[28px] bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-sm">
          {tx("Personne ne correspond à ce filtre.", "Nobody matches this filter.")}
        </p>
      )}

      {/* BRANCHES NOBODY RUNS */}
      {showStrip && (
        <div data-testid="missing-strip" className="squircle flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[28px] bg-brand p-6 text-[#141414]">
          <div className="flex shrink-0">
            {board.missing.slice(0, 5).map((line, i) => (
              <span
                key={line.siteId}
                style={tint(line)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border-[2.5px] border-dashed border-[#141414] bg-[color-mix(in_oklch,var(--b)_70%,var(--brand))] text-[11px] font-extrabold",
                  i > 0 && "-ml-1"
                )}
              >
                {branchCode(line.name)}
              </span>
            ))}
          </div>

          <div className="min-w-[220px] flex-1">
            <p className="font-heading text-xl font-extrabold leading-tight">
              {tx(`${names(board.missing.map((l) => l.name), tx)} ne peuvent pas encore échanger`, `${names(board.missing.map((l) => l.name), tx)} cannot swap yet`)}
            </p>
            <p className="mt-1 text-sm text-[#141414]/75">
              {readOnly
                ? tx("Le propriétaire du compte ajoute les responsables.", "The account owner adds the managers.")
                : tx("Ajoutez un responsable à chacune : elle rejoint le réseau.", "Add a manager to each and they join the network.")}
            </p>
          </div>

          {!readOnly && (
            <button
              type="button"
              data-testid="add-managers"
              onClick={() => onAdd(board.missing[0]?.siteId)}
              className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-3 text-sm font-semibold text-[#f4f4ee] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {tx("Ajouter des responsables", "Add managers")}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PersonCard({
  person,
  line,
  maxOpen,
  canSeeAmounts,
  sites,
  onSetAvailability,
  onRemove,
  onMoveToSite,
  onOpenBranch,
  readOnly,
}: {
  person: Contractor
  line: BranchLine | null
  maxOpen: number
  canSeeAmounts: boolean
  sites: BranchSite[]
  onSetAvailability: BranchManagersProps["onSetAvailability"]
  onRemove: BranchManagersProps["onRemove"]
  onMoveToSite: BranchManagersProps["onMoveToSite"]
  onOpenBranch: BranchManagersProps["onOpenBranch"]
  readOnly: boolean
}) {
  const tx = useTx()
  const [menu, setMenu] = useState(false)
  const stake = line ? stakeOf(line) : { count: 0, value: null, currency: "" }
  const pct = Math.round((person.open_assignments / maxOpen) * 100)
  const role = person.role?.trim()
  const showRole = role && role.toLowerCase() !== "branch manager"

  return (
    <li
      data-testid="manager-card"
      data-branch={line?.name ?? ""}
      style={tint(line)}
      className={cn(
        "squircle relative flex flex-col gap-3 overflow-hidden rounded-[28px] p-[18px] pb-0 shadow-sm",
        line ? "bg-[color-mix(in_oklch,var(--b)_62%,var(--card))] text-[#141414]" : "bg-card text-card-foreground"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="pt-0.5 font-heading text-[18px] font-extrabold leading-tight">{person.name}</p>
          {showRole && <p className="mt-0.5 truncate text-xs opacity-65">{role}</p>}
        </div>
        <StatusTag tone={AVAILABILITY_TAG[person.availability]} size="sm" className="shrink-0">
          {resolve(AVAILABILITY_LABEL[person.availability], tx)}
        </StatusTag>
      </div>

      <div className="flex items-center gap-2 text-xs opacity-75">
        {person.phone ? (
          <a href={`tel:${person.phone}`} className="inline-flex min-w-0 items-center gap-1.5 hover:underline">
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{person.phone}</span>
          </a>
        ) : (
          <span className="truncate">{person.email ?? tx("Pas de numéro", "No number")}</span>
        )}
        <span aria-hidden="true">&bull;</span>
        <span className="shrink-0">{tx(`${person.open_assignments} en cours`, `${person.open_assignments} open`)}</span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-expanded={menu}
            aria-label={tx(`Options pour ${person.name}`, `Options for ${person.name}`)}
            className="ml-auto rounded-full p-1 hover:bg-[#141414]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {menu && (
        <div data-testid="manager-menu" className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#ffffff80] p-2">
          {AVAILABILITY_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={person.availability === value}
              onClick={() => onSetAvailability(person, value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                person.availability === value ? "bg-[#141414] text-[#f4f4ee]" : "text-[#141414]/70 hover:bg-[#141414]/10"
              )}
            >
              {resolve(AVAILABILITY_LABEL[value], tx)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onRemove(person)}
            aria-label={tx(`Retirer ${person.name}`, `Remove ${person.name}`)}
            className="ml-auto rounded-full p-1.5 text-[#141414]/70 hover:bg-[#141414]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#141414]/15" aria-hidden="true">
        <div className="h-full rounded-full bg-[#141414]" style={{ width: `${pct}%` }} />
      </div>

      {/* THE BRANCH */}
      {line ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#ffffff7a] py-2 pl-3 pr-2">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-[13px] font-bold leading-tight">{line.name}</p>
          </div>
          {/* The switch to a branch's dashboard is the boss's alone. */}
          {!readOnly && (
            <button
              type="button"
              data-testid="open-branch"
              onClick={() => onOpenBranch(line.siteId)}
              aria-label={tx(`Ouvrir ${line.name}`, `Open ${line.name}`)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ffffffd0] text-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : readOnly ? null : (
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <select
            data-testid="file-under-branch"
            value=""
            onChange={(event) => event.target.value && onMoveToSite(person, event.target.value)}
            className="min-w-0 flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{tx("Classer dans une agence", "File under a branch")}</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* THE SWAPS, as a tear-off stub */}
      {line ? <SwapStub line={line} stake={stake} canSeeAmounts={canSeeAmounts} /> : <div className="pb-[18px]" />}
    </li>
  )
}

function SwapStub({ line, stake, canSeeAmounts }: { line: BranchLine; stake: ReturnType<typeof stakeOf>; canSeeAmounts: boolean }) {
  const tx = useTx()
  const live = line.read && stake.count > 0

  return (
    <div data-testid="swap-stub" className="relative -mx-[18px] mt-auto">
      <div className="relative h-5" aria-hidden="true">
        <span className="absolute -left-2.5 top-0 h-5 w-5 rounded-full bg-canvas" />
        <span className="absolute -right-2.5 top-0 h-5 w-5 rounded-full bg-canvas" />
        <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-[#141414]/25" />
      </div>

      {live ? (
        <div className="flex items-center gap-3.5 bg-[#141414] px-[18px] pb-4 pt-3.5 text-xs font-bold text-[#f4f4ee]">
          <span className="inline-flex items-center gap-1.5" data-testid="stub-send">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            {line.send.length}
            <span className="font-medium opacity-55">{tx("à envoyer", "send")}</span>
          </span>
          <span className="inline-flex items-center gap-1.5" data-testid="stub-receive">
            <ArrowUpRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
            {line.receive.length}
            <span className="font-medium opacity-55">{tx("à recevoir", "receive")}</span>
          </span>
          {canSeeAmounts && stake.value !== null && (
            <span data-testid="stub-stake" className="ml-auto font-heading text-xl font-extrabold tabular-nums text-brand">
              {shortAmount(stake.value)}
              <span className="ml-1 text-[10px] font-bold opacity-70">{stake.currency}</span>
            </span>
          )}
        </div>
      ) : (
        <p className="bg-[#141414]/10 px-[18px] pb-4 pt-3.5 text-xs font-semibold opacity-65">
          {line.read ? tx("Aucun transfert en attente", "No swaps waiting") : tx("Transferts non chargés", "Swaps not loaded")}
        </p>
      )}
    </div>
  )
}

function AddManagerSheet({ sheet, board, className }: { sheet: ManagerSheet; board: BranchLine[]; className: string }) {
  const tx = useTx()
  const { form } = sheet
  const ready = form.name.trim().length > 0 && form.site_id !== "" && !sheet.busy
  const row = "flex min-h-[54px] items-center gap-3.5"
  const label = "flex w-[92px] shrink-0 items-center gap-2 text-[13px] font-medium"
  const bare = "min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-0"

  function keys(event: KeyboardEvent) {
    if (event.key === "Escape") sheet.onClose()
  }

  // The sheet hangs from the pinned banner, so its room is what is left of the screen below it:
  // a short screen scrolls the sheet, never the page behind it.
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    function fit() {
      const el = ref.current
      if (el) el.style.maxHeight = `${Math.max(240, window.innerHeight - el.getBoundingClientRect().top - 16)}px`
    }
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])

  return (
    <form
      ref={ref}
      data-testid="manager-sheet"
      role="dialog"
      aria-label={tx("Ajouter un responsable d'agence", "Add a branch manager")}
      onKeyDown={keys}
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) sheet.onSubmit()
      }}
      className={cn(
        "squircle t-modal absolute inset-x-4 top-full mx-auto w-[560px] max-w-[calc(100%-2rem)] origin-top overflow-y-auto rounded-[26px] border border-border bg-card text-card-foreground shadow-2xl lg:inset-x-8 lg:max-w-[calc(100%-4rem)]",
        className
      )}
    >
      <div className="px-6 pb-3.5 pt-5">
        <input
          data-testid="manager-name"
          autoFocus
          value={form.name}
          onChange={(event) => sheet.onChange({ name: event.target.value })}
          placeholder={tx("Nom du responsable", "Manager name")}
          aria-label={tx("Nom", "Name")}
          autoComplete="name"
          required
          className="w-full border-0 bg-transparent font-heading text-[22px] font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="divide-y divide-border border-t border-border px-6 py-1.5">
        <div className={cn(row, "max-sm:flex-col max-sm:items-start max-sm:gap-0 max-sm:pt-3")}>
          <span className={label}>
            <MapPin className="h-4 w-4 opacity-70" aria-hidden="true" />
            {tx("Agence", "Branch")}
          </span>
          <div
            data-testid="manager-branch"
            role="radiogroup"
            aria-label={tx("Agence", "Branch")}
            className="grid w-full grid-cols-2 gap-1 rounded-2xl bg-muted p-1 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))]"
          >
            {board.map((line) => {
              const on = form.site_id === line.siteId
              const manager = line.people[0]?.name.split(/\s+/)[0]
              const country = line.location ? line.location.split(",").pop()?.trim() : ""
              const missing = line.people.length === 0
              const detail = [country, manager ?? tx("Sans responsable", "No manager")].filter(Boolean).join(" · ")

              return (
                <button
                  key={line.siteId}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-testid="branch-option"
                  data-site={line.siteId}
                  onClick={() => sheet.onChange({ site_id: line.siteId })}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on
                      ? "bg-card text-foreground shadow-sm"
                      : missing
                        ? "bg-[oklch(0.96_0.06_85)] text-foreground hover:bg-[oklch(0.94_0.08_85)]"
                        : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn("text-sm font-bold", on && "text-foreground")}>{line.name}</span>
                  <span className={cn("text-[11px] leading-tight", missing ? "font-bold text-[oklch(0.5_0.13_60)]" : "text-muted-foreground")}>{detail}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className={row}>
          <span className={label}>
            <Phone className="h-4 w-4 opacity-70" aria-hidden="true" />
            {tx("Téléphone", "Phone")}
          </span>
          <div className="min-w-0 flex-1 py-2">
            <PhoneField value={form.phone} onChange={(phone) => sheet.onChange({ phone })} submitted={sheet.tried} hideLabel inputClassName={bare} />
          </div>
        </div>

        <div className={row}>
          <span className={label}>
            <Mail className="h-4 w-4 opacity-70" aria-hidden="true" />
            Email
          </span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => sheet.onChange({ email: event.target.value })}
            placeholder={tx("Facultatif", "Optional")}
            autoComplete="email"
            aria-label="Email"
            className={bare}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border py-3.5 pl-6 pr-4">
        <p className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
          {tx("Seuls les comptes de votre entreprise voient ces coordonnées.", "Only your company's accounts can see these contact details.")}
        </p>
        <button
          type="button"
          data-testid="manager-cancel"
          onClick={sheet.onClose}
          className="h-10 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tx("Annuler", "Cancel")}
        </button>
        <button
          type="submit"
          data-testid="manager-save"
          disabled={!ready}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {sheet.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          {tx("Ajouter le responsable", "Add manager")}
        </button>
      </div>
    </form>
  )
}
