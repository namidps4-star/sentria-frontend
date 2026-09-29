import type { ReactNode } from "react"
import {
  CircleAlert,
  CircleArrowOutUpRight,
  CircleCheck,
  CircleX,
  Clock3,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import type { Tx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** The app's status tags: a tinted, glossy pill with a circled icon.
 *
 *  warning  pending, needs attention   (amber)
 *  info     in progress, submitted     (blue)
 *  success  done, ready, included      (green)
 *  danger   critical, failed, refused  (red)
 *  neutral  waiting, expired, soon     (grey)
 *  brand    SentrIA's own marks        (lime)
 */
export type TagTone = "warning" | "info" | "success" | "danger" | "neutral" | "brand"

const TONES: Record<TagTone, { tag: string; icon: LucideIcon }> = {
  warning: {
    // The app's --warning token: a muted honey, not a bright yellow.
    tag: "border-warning/35 bg-warning/10 text-warning",
    icon: CircleAlert,
  },
  info: {
    tag: "border-blue-400/70 bg-blue-100 text-blue-700 dark:border-blue-400/40 dark:bg-blue-400/15 dark:text-blue-300",
    icon: CircleArrowOutUpRight,
  },
  success: {
    tag: "border-green-500/60 bg-green-100 text-green-700 dark:border-green-400/40 dark:bg-green-400/15 dark:text-green-300",
    icon: CircleCheck,
  },
  danger: {
    tag: "border-red-400/70 bg-red-100 text-red-700 dark:border-red-400/40 dark:bg-red-400/15 dark:text-red-300",
    icon: CircleX,
  },
  neutral: {
    tag: "border-zinc-400/60 bg-zinc-100 text-zinc-700 dark:border-zinc-400/40 dark:bg-zinc-400/15 dark:text-zinc-200",
    icon: Clock3,
  },
  brand: {
    tag: "border-lime-500/70 bg-lime-100 text-lime-800 dark:border-lime-400/40 dark:bg-lime-400/15 dark:text-lime-300",
    icon: Sparkles,
  },
}

const SIZES = {
  xs: { tag: "gap-1 px-2 py-0.5 text-[10px]", icon: "h-3 w-3" },
  sm: { tag: "gap-1.5 px-2.5 py-1 text-xs", icon: "h-3.5 w-3.5" },
  md: { tag: "gap-2 px-3.5 py-1.5 text-sm", icon: "h-4 w-4" },
} as const

export function StatusTag({
  tone,
  size = "sm",
  icon,
  className,
  children,
}: {
  tone: TagTone
  size?: keyof typeof SIZES
  /** Another icon, or false for none. */
  icon?: LucideIcon | false
  className?: string
  children: ReactNode
}) {
  const Icon = icon === false ? null : icon ?? TONES[tone].icon

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center overflow-hidden whitespace-nowrap rounded-full border font-semibold leading-none",
        // The gloss: a light top highlight, a hairline inner edge and a
        // soft drop shadow.
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_2px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.3)]",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/55 before:to-transparent dark:before:from-white/10",
        TONES[tone].tag,
        SIZES[size].tag,
        className
      )}
    >
      {Icon && <Icon className={cn("relative shrink-0", SIZES[size].icon)} strokeWidth={2.25} aria-hidden="true" />}
      <span className="relative">{children}</span>
    </span>
  )
}

/** An alert's severity, in the reader's language. */
export function SeverityTag({
  severity,
  tx,
  size = "sm",
  className,
}: {
  severity: string | null | undefined
  tx: Tx
  size?: keyof typeof SIZES
  className?: string
}) {
  const value = String(severity ?? "").toUpperCase()

  if (value === "CRITICAL") {
    return (
      <StatusTag tone="danger" size={size} className={className}>
        {tx("Critique", "Critical")}
      </StatusTag>
    )
  }

  if (value === "WARNING") {
    return (
      <StatusTag tone="warning" size={size} className={className}>
        {tx("Attention", "Warning")}
      </StatusTag>
    )
  }

  return (
    <StatusTag tone="neutral" size={size} className={className}>
      {value || "—"}
    </StatusTag>
  )
}
