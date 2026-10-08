import type { ReactNode } from "react"
import {
  CircleAlert,
  CircleArrowOutUpRight,
  CircleCheck,
  CircleX,
  Clock3,
  Sparkles,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from "@/lib/icons"

import type { Tx } from "@/lib/i18n"
import { formatAmount } from "@/lib/locale"
import { useCanSeeAmounts } from "@/lib/use-plan"
import { demotion, demotionSentence } from "@/lib/demotion"
import { valueAtRisk, type AlertParams } from "@/lib/value-at-risk"
import { cn } from "@/lib/utils"

/** The app's status tags: a pastel pill with a circled icon (tokens in
 *  app/globals.css, deepened for dark mode).
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
    tag: "border-[var(--tag-warning-bd)] bg-[var(--tag-warning-bg)] text-[var(--tag-warning-fg)]",
    icon: CircleAlert,
  },
  info: {
    tag: "border-[var(--tag-info-bd)] bg-[var(--tag-info-bg)] text-[var(--tag-info-fg)]",
    icon: CircleArrowOutUpRight,
  },
  success: {
    tag: "border-[var(--tag-success-bd)] bg-[var(--tag-success-bg)] text-[var(--tag-success-fg)]",
    icon: CircleCheck,
  },
  danger: {
    tag: "border-[var(--tag-danger-bd)] bg-[var(--tag-danger-bg)] text-[var(--tag-danger-fg)]",
    icon: CircleX,
  },
  neutral: {
    tag: "border-[var(--tag-neutral-bd)] bg-[var(--tag-neutral-bg)] text-[var(--tag-neutral-fg)]",
    icon: Clock3,
  },
  brand: {
    tag: "border-[var(--tag-brand-bd)] bg-[var(--tag-brand-bg)] text-[var(--tag-brand-fg)]",
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
        // Fill, deeper edge, a faint top highlight and a small drop shadow.
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-semibold leading-none",
        "shadow-[inset_0_1px_0_var(--tag-hi),0_1px_2px_rgb(0_0_0/0.08),0_2px_6px_-2px_rgb(0_0_0/0.12)]",
        TONES[tone].tag,
        SIZES[size].tag,
        className
      )}
    >
      {Icon && <Icon className={cn("shrink-0", SIZES[size].icon)} strokeWidth={2.25} aria-hidden="true" />}
      <span>{children}</span>
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

/** The money an alert puts at risk (F-MONEY), shown beside its severity.
 *  Nothing when the alert carries no amount. */
export function ValueTag({
  params,
  tx,
  size = "sm",
  className,
}: {
  params: AlertParams
  tx: Tx
  size?: keyof typeof SIZES
  className?: string
}) {
  const canSee = useCanSeeAmounts()
  const risk = valueAtRisk(params)
  if (!risk || !canSee) return null

  const amount = formatAmount(risk.value, risk.currency, tx)
  const label = risk.estimate
    ? tx("Ventes en jeu (estimation) : ", "Sales at risk (estimate): ")
    : tx("Valeur en jeu : ", "Value at risk: ")

  return (
    <span title={`${label}${amount}`} className="inline-flex">
      <StatusTag tone="neutral" size={size} icon={Wallet} className={cn("tabular-nums", className)}>
        <span className="sr-only">{label}</span>
        {risk.estimate ? "≈ " : ""}
        {amount}
      </StatusTag>
    </span>
  )
}

/** Shown when SentrIA lowered an alert because it keeps being dismissed
 *  (F-SUPPRESS). Nothing when it did not. */
export function DemotedTag({
  params,
  tx,
  size = "sm",
  className,
}: {
  params: AlertParams
  tx: Tx
  size?: keyof typeof SIZES
  className?: string
}) {
  const info = demotion(params)
  if (!info) return null

  const sentence = demotionSentence(info, tx)

  return (
    <span title={sentence} className="inline-flex">
      <StatusTag tone="neutral" size={size} icon={TrendingDown} className={className}>
        <span className="sr-only">{sentence} </span>
        <span aria-hidden="true">{tx("Abaissée", "Lowered")}</span>
      </StatusTag>
    </span>
  )
}
