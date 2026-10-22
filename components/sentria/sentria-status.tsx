"use client"

/* The status bubble at the foot of the sidebar. It says only what the data
   says: how long ago the account's newest data arrived, a warning when a
   sector went quiet, and nothing when the stamps cannot tell (L4). It used to
   claim "Intelligence online" whatever the data was. */

import { Bot } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { agoLabel } from "@/lib/relative-time"
import { cn } from "@/lib/utils"

import { useAccountFreshness } from "./account-freshness"

type Look = "fresh" | "stale" | "unknown"

export function SentriaStatus({ collapsed = false }: { collapsed?: boolean }) {
  const tx = useTx()
  const assessment = useAccountFreshness()
  const look: Look = assessment.kind

  const oldest = assessment.stale.reduce((max, s) => Math.max(max, s.ageDays), 0)

  const title =
    look === "fresh"
      ? tx("SentrIA surveille", "SentrIA is watching")
      : look === "stale"
        ? tx(`Données vieilles de ${oldest} jours`, `Data is ${oldest} days old`)
        : "SentrIA"

  const sub =
    look === "fresh" && assessment.newest
      ? tx(
          `Données mises à jour ${agoLabel(assessment.newest.lastUploadAt, tx)}`,
          `Data updated ${agoLabel(assessment.newest.lastUploadAt, tx)}`
        )
      : look === "stale"
        ? tx("Importez un nouveau fichier", "Upload a new file")
        : tx("Âge des données inconnu", "Data age unknown")

  const dot =
    look === "fresh" ? "bg-accent" : look === "stale" ? "bg-[var(--tag-watch-bg)]" : "bg-white/40"

  const pulse = (
    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
      {look !== "unknown" && (
        <span className={cn("absolute inset-0 rounded-full opacity-40 motion-safe:animate-ping", dot)} />
      )}
      <span className={cn("relative h-2.5 w-2.5 rounded-full", dot)} />
    </span>
  )

  if (collapsed) {
    return (
      <div
        role="status"
        data-testid="sentria-status"
        data-look={look}
        title={`${title}. ${sub}`}
        className="relative mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground"
      >
        <Bot className="h-[18px] w-[18px]" aria-hidden="true" />
        <span className="absolute -right-0.5 -top-0.5 rounded-full bg-sidebar p-[3px]">{pulse}</span>
      </div>
    )
  }

  return (
    <div
      role="status"
      data-testid="sentria-status"
      data-look={look}
      className="flex items-center gap-3 rounded-3xl bg-white/[0.07] p-3 [@media(max-height:700px)]:gap-2.5 [@media(max-height:700px)]:p-2"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground [@media(max-height:700px)]:h-9 [@media(max-height:700px)]:w-9">
        <Bot className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>

      <div className="min-w-0">
        <div className="truncate text-[14px] font-bold leading-tight text-sidebar-foreground">{title}</div>

        <div className="mt-0.5 flex items-center gap-2 text-[12px] leading-tight text-sidebar-foreground/70">
          {pulse}
          <span className="truncate">{sub}</span>
        </div>
      </div>
    </div>
  )
}
