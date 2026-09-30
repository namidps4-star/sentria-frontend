"use client"

import { useEffect, useState } from "react"

import { API_BASE, apiFetch } from "@/lib/api"
import { useTx } from "@/lib/i18n"
import { Mail } from "@/lib/icons"
import { cn } from "@/lib/utils"

/** GET /reports/weekly: the numbers the weekly email is built from
 *  (Sentria pipeline/weekly_report.py), so the page and the email agree. */
export type WeekSummary = {
  alerts: number
  critical: number
  warning: number
  previous_alerts: number
  delta: number
  trend: "up" | "down" | "flat"
  resolved: number
  top_offender: { equipment: string; count: number } | null
  email?: { enabled: boolean; configured: boolean }
}

export const WEEKLY_REPORT_KEY = "sentria_weekly_report"

/** This week in four numbers, and the switch for the Monday email. */
export function WeekCard() {
  const tx = useTx()
  const [week, setWeek] = useState<WeekSummary | null>(null)
  const [emailOn, setEmailOn] = useState(false)

  useEffect(() => {
    try {
      setEmailOn(localStorage.getItem(WEEKLY_REPORT_KEY) === "on")
    } catch {
      /* Storage blocked: shown off. */
    }
    apiFetch(`${API_BASE}/reports/weekly`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.alerts === "number") setWeek(d as WeekSummary)
      })
      .catch(() => {
        /* No card rather than a card of guesses. */
      })
  }, [])

  if (!week) return null

  const toggleEmail = () => {
    const next = !emailOn
    setEmailOn(next)
    try {
      localStorage.setItem(WEEKLY_REPORT_KEY, next ? "on" : "off")
    } catch {
      /* Storage blocked: lasts for this visit. */
    }
  }

  const change =
    week.trend === "flat"
      ? tx("comme la semaine d'avant", "same as the week before")
      : week.previous_alerts === 0
        ? tx("aucune la semaine d'avant", "none the week before")
        : tx(
            `${week.delta > 0 ? "+" : "−"}${Math.abs(week.delta)} vs semaine d'avant`,
            `${week.delta > 0 ? "+" : "−"}${Math.abs(week.delta)} vs the week before`
          )

  const cells = [
    {
      label: tx("Nouvelles critiques", "New critical"),
      value: week.critical,
      note: tx("alertes critiques sur 7 jours", "critical alerts in 7 days"),
      tone: week.critical > 0 ? "danger" : "success",
    },
    {
      label: tx("Priorités traitées", "Priorities handled"),
      value: week.resolved,
      note: tx("passées en « Résolu »", "moved to Resolved"),
      tone: week.resolved > 0 ? "success" : null,
    },
    {
      label: tx("Alertes cette semaine", "Alerts this week"),
      value: week.alerts,
      note: change,
      tone: week.trend === "up" ? "warning" : week.trend === "down" ? "success" : null,
    },
    {
      label: tx("À surveiller", "Keep an eye on"),
      value: week.top_offender ? week.top_offender.equipment : "—",
      note: week.top_offender
        ? tx(`${week.top_offender.count} alertes cette semaine`, `${week.top_offender.count} alerts this week`)
        : tx("aucun équipement répété", "no repeat asset"),
      tone: null,
    },
  ] as const

  const status = !emailOn
    ? tx("Recevez ce résumé par e-mail chaque lundi.", "Get this summary by email every Monday.")
    : week.email?.configured
      ? tx("Envoyé par e-mail chaque lundi.", "Emailed to you every Monday.")
      : tx(
          "Activé. L'envoi démarre dès que l'e-mail est configuré côté SentrIA.",
          "On. Sending starts as soon as email is set up on SentrIA's side."
        )

  return (
    <section className="rounded-[28px] bg-card p-5 shadow-sm" aria-labelledby="week-title" data-testid="week-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="week-title" className="font-heading text-xl font-semibold tracking-tight">
            {tx("Cette semaine", "This week")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tx("7 derniers jours, tous départements", "Last 7 days, all departments")}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <p className="max-w-[16rem] text-right text-[11px] leading-4 text-muted-foreground">{status}</p>
          <button
            type="button"
            role="switch"
            aria-checked={emailOn}
            onClick={toggleEmail}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              emailOn ? "bg-[var(--ink)] text-white" : "bg-muted hover:bg-muted/70"
            )}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {tx("E-mail du lundi", "Monday email")}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-border lg:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">{cell.label}</p>
            <p
              className="mt-1 truncate font-heading text-2xl font-bold tabular-nums tracking-tight"
              style={cell.tone ? { color: `var(--tag-${cell.tone}-fg)` } : undefined}
              title={String(cell.value)}
            >
              {cell.value}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={cell.note}>
              {cell.note}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
