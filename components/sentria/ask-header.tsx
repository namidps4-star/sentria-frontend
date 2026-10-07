"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "@/lib/icons"

import { enterAt } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { SectorTag } from "./sector-tag"

export type AskHeaderRow = {
  label: string
  value: string
  icon?: LucideIcon
  /** Tints the value: danger (brick red), warning (amber). */
  tone?: "danger" | "warning"
}

/** A view's header in the Ask SentrIA layout, as on Calendar: a lime card
 *  (what this view is, how far along), a grey panel (the question, a line
 *  in a chat bubble, then the view's own controls) and a black card (the
 *  numbers, the one that matters most in large). */
export function AskHeader({
  icon: Icon,
  eyebrow,
  title,
  progress,
  action,
  heading,
  status,
  message,
  children,
  statsTitle,
  sectorTag,
  rows,
  big,
  className,
}: {
  icon: LucideIcon
  /** Small label under "SentrIA" in the lime card. */
  eyebrow: string
  /** The lime card's line, e.g. the question the view answers. */
  title: string
  progress?: { share: number; label: string; value: string }
  /** A round white button in the lime card (e.g. "add"). */
  action?: { label: string; icon: LucideIcon; onClick: () => void }
  heading: string
  status: string
  message: ReactNode
  /** Controls under the message: search, filters. */
  children?: ReactNode
  statsTitle: string
  /** Show the account's sector tag beside the title. */
  sectorTag?: boolean
  rows: AskHeaderRow[]
  big: { label: string; value: string }
  className?: string
}) {
  const share = progress ? Math.min(1, Math.max(0, progress.share)) : 0
  const percent = Math.round(share * 100)
  const ActionIcon = action?.icon

  return (
    <div
      className={cn(
        "grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_290px]",
        className
      )}
    >
      {/* ---------------------------------------------------------- LEFT */}
      <div className="t-enter rounded-[28px] bg-brand p-5 text-[#141414]" style={enterAt(0)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">SentrIA</span>
              <span className="block text-[11px] text-[#141414]/65">{eyebrow}</span>
            </span>
          </div>
          {action && ActionIcon && (
            <button
              type="button"
              onClick={action.onClick}
              aria-label={action.label}
              title={action.label}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#141414] shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]"
            >
              <ActionIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="mt-5 font-heading text-2xl font-semibold leading-tight tracking-tight">{title}</p>

        {progress && (
          <div className="mt-4">
            <div
              className="h-2 overflow-hidden rounded-full bg-white/70"
              role="progressbar"
              aria-label={progress.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="h-full rounded-full bg-[var(--ink)] transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
              <span>{progress.label}</span>
              <span className="tabular-nums">{progress.value}</span>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- CENTER */}
      <section className="t-enter flex min-w-0 flex-col rounded-[28px] bg-foreground/[0.055] p-5 sm:p-6" style={enterAt(0.4)}>
        <h2 className="font-heading text-3xl font-semibold leading-[1.05] tracking-tight">{heading}</h2>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-brand ring-2 ring-brand/30" aria-hidden="true" />
          {status}
        </p>

        <div className="mt-5 max-w-[85%] self-start rounded-[22px] bg-[var(--ink)] p-4 text-sm leading-relaxed text-white">
          {message}
        </div>

        {children && <div className="mt-4 flex flex-col gap-3">{children}</div>}
      </section>

      {/* --------------------------------------------------------- RIGHT */}
      <div className="t-enter rounded-[28px] bg-[var(--ink)] p-5 text-white lg:col-start-2 xl:col-start-auto" style={enterAt(0.8)}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-xl font-semibold tracking-tight">{statsTitle}</p>
          {sectorTag && <SectorTag />}
        </div>
        <dl className="mt-4 space-y-2.5 text-xs">
          {rows.map((row) => {
            const RowIcon = row.icon
            return (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-white/55">
                  {RowIcon && <RowIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {row.label}
                </dt>
                <dd
                  className={cn(
                    "font-semibold tabular-nums",
                    row.tone === "danger" && "text-[#ffb8bf]",
                    row.tone === "warning" && "text-[#ffd97a]"
                  )}
                >
                  {row.value}
                </dd>
              </div>
            )
          })}
        </dl>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-xs text-white/55">{big.label}</span>
          <span className="font-heading text-4xl font-bold leading-none text-brand tabular-nums">{big.value}</span>
        </div>
      </div>
    </div>
  )
}
