"use client"

import { useState, type CSSProperties } from "react"

import { ArrowRight, ArrowUpRight, MapPin, MoreHorizontal, Phone, Plus, Trash2 } from "@/lib/icons"

import { branchCode, buildBoard, shortAmount, stakeOf, type BranchLine, type BranchSite } from "@/lib/branch-board"
import type { Swap } from "@/lib/branch-swaps"
import { AVAILABILITY_LABEL, type Availability, type Contractor } from "@/lib/crm"
import { resolve, useTx, type Tx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { SectorTag } from "./sector-tag"
import { StatusTag, type TagTone } from "./status-tag"

/* The Field team page for a company with several branches (F-BRANCHBOARD):
 * a black banner (who runs the branches, in numbers), one card per person in
 * their branch's colour, and a lime band for the branches nobody runs. The
 * view owns the data and the saves; this draws them. */

const AVAILABILITY_ORDER: Availability[] = ["available", "busy", "off"]
const AVAILABILITY_TAG: Record<Availability, TagTone> = { available: "success", busy: "warning", off: "danger" }

type Filter = "all" | Availability | "nomanager"

function names(list: string[], tx: Tx): string {
  if (list.length <= 1) return list.join("")

  return `${list.slice(0, -1).join(", ")} ${tx("et", "and")} ${list[list.length - 1]}`
}

function tint(line: Pick<BranchLine, "hue"> | null): CSSProperties {
  return { "--b": line ? `var(--branch-${line.hue})` : "var(--muted)" } as CSSProperties
}

export type BranchManagersProps = {
  sites: BranchSite[]
  contractors: Contractor[]
  loaded: boolean
  /** The swaps each branch sends, or null while they are not read (or could not be). */
  swaps: Record<string, Swap[]> | null
  canSeeAmounts: boolean
  onAdd: (siteId?: string) => void
  onSetAvailability: (person: Contractor, value: Availability) => void
  onRemove: (person: Contractor) => void
  onMoveToSite: (person: Contractor, siteId: string) => void
  onOpenBranch: (siteId: string) => void
}

export function BranchManagers(props: BranchManagersProps) {
  const { sites, contractors, loaded, swaps, canSeeAmounts, onAdd } = props
  const tx = useTx()
  const [filter, setFilter] = useState<Filter>("all")
  const board = buildBoard(sites, contractors, swaps)
  const swapsWaiting = swaps ? Object.values(swaps).reduce((sum, list) => sum + list.length, 0) : null
  const maxOpen = Math.max(1, ...contractors.map((c) => c.open_assignments))
  const everyone = [...board.lines.flatMap((l) => l.people.map((p) => ({ person: p, line: l as BranchLine | null }))), ...board.unfiled.map((p) => ({ person: p, line: null as BranchLine | null }))]
  const shown = everyone.filter(({ person }) => filter === "all" || (filter !== "nomanager" && person.availability === filter))
  const showStrip = board.missing.length > 0 && (filter === "all" || filter === "nomanager")

  function pill(active: boolean) {
    return cn(
      "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"
    )
  }

  return (
    <div className="space-y-5" data-testid="branch-board">
      {/* BANNER */}
      <div
        data-testid="branch-banner"
        className="squircle t-enter flex flex-col gap-5 rounded-3xl bg-sidebar-shell p-6 text-sidebar-foreground md:flex-row md:items-center md:justify-between md:p-8"
      >
        <div className="min-w-0">
          <SectorTag size="md" />
          <h2 className="mt-3 text-balance font-heading text-2xl font-bold leading-tight md:text-3xl">
            {tx("Qui dirige chaque agence ?", "Who runs each branch?")}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-y-4">
          {[
            { label: tx("Agences couvertes", "Branches covered"), value: loaded ? `${board.covered} / ${sites.length}` : "–", id: "covered" },
            { label: tx("Sans responsable", "No manager"), value: loaded ? String(board.missing.length) : "–", id: "missing" },
            { label: tx("Transferts en attente", "Swaps waiting"), value: swapsWaiting === null ? "–" : String(swapsWaiting), id: "swaps" },
          ].map((stat) => (
            <div key={stat.id} data-testid={`banner-${stat.id}`} className="border-l border-sidebar-foreground/15 px-5">
              <p className="font-heading text-3xl font-extrabold leading-none tabular-nums">{stat.value}</p>
              <p className="mt-1.5 text-xs text-sidebar-foreground/60">{stat.label}</p>
            </div>
          ))}

          <button
            type="button"
            data-testid="add-manager"
            onClick={() => onAdd()}
            className="ml-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {tx("Ajouter un responsable d'agence", "Add a branch manager")}
          </button>
        </div>
      </div>

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
              swapsRead={swaps !== null}
              canSeeAmounts={canSeeAmounts}
              sites={sites}
              onSetAvailability={props.onSetAvailability}
              onRemove={props.onRemove}
              onMoveToSite={props.onMoveToSite}
              onOpenBranch={props.onOpenBranch}
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
              {tx("Ajoutez un responsable à chacune : elle rejoint le réseau.", "Add a manager to each and they join the network.")}
            </p>
          </div>

          <button
            type="button"
            data-testid="add-managers"
            onClick={() => onAdd(board.missing[0]?.siteId)}
            className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-3 text-sm font-semibold text-[#f4f4ee] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {tx("Ajouter des responsables", "Add managers")}
          </button>
        </div>
      )}
    </div>
  )
}

function PersonCard({
  person,
  line,
  maxOpen,
  swapsRead,
  canSeeAmounts,
  sites,
  onSetAvailability,
  onRemove,
  onMoveToSite,
  onOpenBranch,
}: {
  person: Contractor
  line: BranchLine | null
  maxOpen: number
  swapsRead: boolean
  canSeeAmounts: boolean
  sites: BranchSite[]
  onSetAvailability: BranchManagersProps["onSetAvailability"]
  onRemove: BranchManagersProps["onRemove"]
  onMoveToSite: BranchManagersProps["onMoveToSite"]
  onOpenBranch: BranchManagersProps["onOpenBranch"]
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
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          aria-expanded={menu}
          aria-label={tx(`Options pour ${person.name}`, `Options for ${person.name}`)}
          className="ml-auto rounded-full p-1 hover:bg-[#141414]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
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
          <button
            type="button"
            data-testid="open-branch"
            onClick={() => onOpenBranch(line.siteId)}
            aria-label={tx(`Ouvrir ${line.name}`, `Open ${line.name}`)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ffffffd0] text-[#141414] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
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
      {line ? <SwapStub line={line} stake={stake} swapsRead={swapsRead} canSeeAmounts={canSeeAmounts} /> : <div className="pb-[18px]" />}
    </li>
  )
}

function SwapStub({ line, stake, swapsRead, canSeeAmounts }: { line: BranchLine; stake: ReturnType<typeof stakeOf>; swapsRead: boolean; canSeeAmounts: boolean }) {
  const tx = useTx()
  const live = swapsRead && stake.count > 0

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
          {swapsRead ? tx("Aucun transfert en attente", "No swaps waiting") : tx("Transferts non chargés", "Swaps not loaded")}
        </p>
      )}
    </div>
  )
}
