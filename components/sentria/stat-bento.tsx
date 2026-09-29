"use client"

import type { LucideIcon } from "lucide-react"

import { useTx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type Primary = {
  label: string
  value: string
  caption?: string
  icon: LucideIcon
  /** A share of `value` (0 to 1), drawn as a bar with its own label. */
  progress?: { share: number; label: string }
}

type Dark = { label: string; value: string; icon: LucideIcon }

type Soft = { label: string; value: string }

/** A header's numbers as a bento: one lime card with a progress bar,
 *  today's date, one dark card, and quiet grey pills. */
export function StatBento({
  primary,
  dark,
  soft = [],
  className,
}: {
  primary: Primary
  dark: Dark
  soft?: Soft[]
  className?: string
}) {
  const tx = useTx()
  const PrimaryIcon = primary.icon
  const DarkIcon = dark.icon
  const share = primary.progress ? Math.min(1, Math.max(0, primary.progress.share)) : 0
  const percent = Math.round(share * 100)

  const now = new Date()
  const locale = tx("fr-FR", "en-GB")
  const weekday = now.toLocaleDateString(locale, { weekday: "short" })
  const month = now.toLocaleDateString(locale, { month: "short" })

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]",
        className
      )}
    >
      {/* Lime: the headline number and how far along it is. */}
      <div className="flex flex-col justify-between rounded-[26px] bg-brand p-5 text-[#141414] sm:row-span-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold text-[#141414]/70">{primary.label}</p>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141414] text-brand">
            <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-3">
          <p className="font-heading text-5xl font-black leading-none tracking-tight tabular-nums">
            {primary.value}
          </p>
          {primary.caption && (
            <p className="mt-1.5 text-xs text-[#141414]/70">{primary.caption}</p>
          )}
        </div>

        {primary.progress && (
          <div className="mt-4">
            <div
              className="h-2 overflow-hidden rounded-full bg-[#141414]/15"
              role="progressbar"
              aria-label={primary.progress.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="h-full rounded-full bg-[#141414] transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
              <span>{primary.progress.label}</span>
              <span className="tabular-nums">{percent} %</span>
            </div>
          </div>
        )}
      </div>

      {/* Today, as in the reference: a black day circle on a white pill. */}
      <div className="flex items-center gap-3 rounded-full border border-border bg-card p-1.5 pr-5 shadow-sm">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#141414] font-heading text-lg font-bold text-white tabular-nums">
          {now.getDate()}
        </span>
        <span className="text-sm font-semibold leading-tight">
          <span className="capitalize">{weekday}</span>,
          <br />
          <span className="capitalize text-muted-foreground">{month}</span>
        </span>
      </div>

      {/* Dark: the number that needs attention. */}
      <div className="flex items-center justify-between gap-3 rounded-[26px] bg-[#141414] px-5 py-3 text-white">
        <div>
          <p className="text-[11px] font-semibold text-white/60">{dark.label}</p>
          <p className="font-heading text-3xl font-black leading-none tabular-nums">{dark.value}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-[#141414]">
          <DarkIcon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      {/* Grey pills: the quieter numbers. */}
      {soft.slice(0, 2).map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex items-center justify-between gap-3 rounded-full bg-muted px-5 py-3",
            soft.length === 1 && "sm:col-span-2"
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
          <p className="font-heading text-xl font-bold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  )
}
