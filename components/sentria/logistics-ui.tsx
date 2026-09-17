"use client"

import type { LucideIcon } from "lucide-react"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  OPS_LABELS,
  type OpsType,
  type StageStatus,
} from "@/lib/logistics-signals"

/* --------------------------------------------------------------------------
 * Shared chrome for the four logistics priority views, so a stat tile,
 * an evidence bar and an empty state look identical across them. Dense
 * spacing on purpose: these are operational screens read at a glance,
 * not marketing pages.
 * -------------------------------------------------------------------------- */

export const TONE_TEXT: Record<StageStatus, string> = {
  good: "text-muted-foreground",
  watch: "text-foreground",
  risk: "text-destructive",
}

export const TONE_BAR: Record<StageStatus, string> = {
  good: "bg-muted-foreground/30",
  watch: "bg-brand",
  risk: "bg-destructive",
}

export const TONE_CHIP: Record<StageStatus, string> = {
  good: "border-border bg-muted/50 text-muted-foreground",
  watch: "border-brand/40 bg-brand/15 text-foreground",
  risk: "border-destructive/30 bg-destructive/10 text-destructive",
}

/** Header band naming the activity and the measured risk. */
export function ViewHeader({
  eyebrow,
  opsType,
  title,
  lede,
  risk,
  riskLabel = "Risque mesuré",
  icon: Icon,
}: {
  eyebrow: string
  opsType?: OpsType
  title: string
  lede: string
  risk: number
  riskLabel?: string
  icon: LucideIcon
}) {
  return (
    <section className="rounded-3xl bg-sidebar p-6 text-sidebar-foreground sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {eyebrow}
            </span>

            {opsType && (
              <span className="inline-flex items-center rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1 text-xs font-medium text-sidebar-foreground/80">
                {OPS_LABELS[opsType]}
              </span>
            )}
          </div>

          <h2 className="mt-4 text-balance font-heading text-2xl font-bold leading-[1.1] sm:text-3xl">
            {title}
          </h2>

          <p className="mt-2 text-pretty text-sm leading-6 text-sidebar-foreground/70">
            {lede}
          </p>
        </div>

        <RiskDial value={risk} label={riskLabel} />
      </div>
    </section>
  )
}

/** Risk as a ring plus the number and a word, so it is readable without
 *  interpreting the arc. */
export function RiskDial({
  value,
  label,
}: {
  value: number
  label: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const dash = (clamped / 100) * circumference

  const word =
    clamped === 0
      ? "Aucun"
      : clamped >= 70
        ? "Élevé"
        : clamped >= 40
          ? "Modéré"
          : "Faible"

  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            strokeWidth="7"
            className="stroke-sidebar-accent"
          />

          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className={
              clamped >= 70
                ? "stroke-destructive"
                : clamped > 0
                  ? "stroke-brand"
                  : "stroke-sidebar-accent"
            }
          />
        </svg>

        <span className="absolute inset-0 flex items-center justify-center font-heading text-xl font-bold tabular-nums">
          {clamped}
        </span>
      </div>

      <div className="text-xs">
        <p className="font-semibold uppercase tracking-wide text-sidebar-foreground/50">
          {label}
        </p>

        <p className="mt-1 text-base font-bold">{word}</p>

        <p className="mt-0.5 text-sidebar-foreground/50">sur 100</p>
      </div>
    </div>
  )
}

/** Dense KPI tile. `note` carries where the number came from. */
export function StatTile({
  label,
  value,
  unit,
  note,
  tone = "good",
  icon: Icon,
}: {
  label: string
  value: string
  unit?: string
  note?: string
  tone?: StageStatus
  icon?: LucideIcon
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>

        {Icon && (
          <Icon
            className={cn("h-4 w-4 shrink-0", TONE_TEXT[tone])}
            aria-hidden="true"
          />
        )}
      </div>

      <p
        className={cn(
          "mt-2 font-heading text-2xl font-bold tabular-nums tracking-tight",
          tone === "risk" ? "text-destructive" : "text-foreground"
        )}
      >
        {value}

        {unit && (
          <span className="ml-1 text-sm font-semibold text-muted-foreground">
            {unit}
          </span>
        )}
      </p>

      {note && (
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  )
}

/** One measured signal: what it is, what it read, how far along its scale. */
export function EvidenceBar({
  label,
  value,
  percent,
  tone,
  source,
}: {
  label: string
  value: string
  percent: number
  tone: StageStatus
  source?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </p>

        <p
          className={cn(
            "shrink-0 text-sm font-bold tabular-nums",
            tone === "risk" ? "text-destructive" : "text-foreground"
          )}
        >
          {value}
        </p>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", TONE_BAR[tone])}
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>

      {source && (
        <p className="mt-1 truncate text-[10px] text-muted-foreground">
          {source}
        </p>
      )}
    </div>
  )
}

export function SectionTitle({
  children,
  note,
}: {
  children: React.ReactNode
  note?: string
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-heading text-lg font-bold">{children}</h3>

      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/** Shown when no alert in this activity feeds this view. Says what is
 *  missing rather than drawing zeros that look like good news. */
export function NoSignal({
  title,
  detail,
  expected,
}: {
  title: string
  detail: string
  expected?: string
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>

      <h3 className="mt-4 font-heading text-lg font-bold">{title}</h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {detail}
      </p>

      {expected && (
        <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-muted-foreground">
          {expected}
        </p>
      )}
    </div>
  )
}
