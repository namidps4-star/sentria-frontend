"use client"

/* The status bubble at the foot of the sidebar, with Robo's face. It says only
   what the data says: how long ago the account's newest data arrived, a
   warning when a sector went quiet, and nothing when the stamps cannot tell
   (L4). Click it and Robo pops out to explain, with the same facts. */

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { X } from "@/lib/icons"
import { readSectors, activityLabel } from "@/lib/activities"
import { assessFreshness, useFreshness } from "@/lib/freshness"
import { useTx } from "@/lib/i18n"
import { sectorLabel } from "@/lib/priorities"
import { agoLabel } from "@/lib/relative-time"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

import { RoboBody, RoboHead, type Mood } from "./robo-mood"

const MOOD_COLOR: Record<Mood, string> = {
  fresh: "var(--brand)",
  stale: "var(--tag-watch-bg)",
  unknown: "#b8b8b3",
}

export function SentriaStatus({
  collapsed = false,
  onUpload,
}: {
  collapsed?: boolean
  /** Robo's Upload a file: the page opens the import panel. */
  onUpload?: () => void
}) {
  const tx = useTx()
  const { data } = useFreshness()
  const [sectors, setSectors] = useState<string[]>([])

  useEffect(() => {
    setSectors(readSectors())
  }, [])

  const assessment = assessFreshness(data, sectors)
  const mood: Mood = assessment.kind
  const color = MOOD_COLOR[mood]

  const oldest = assessment.stale.reduce((max, s) => Math.max(max, s.ageDays), 0)
  const limit = data.staleAfterDays

  const title =
    mood === "fresh"
      ? tx("SentrIA surveille", "SentrIA is watching")
      : mood === "stale"
        ? tx(`Données vieilles de ${oldest} jours`, `Data is ${oldest} days old`)
        : "SentrIA"

  const sub =
    mood === "fresh" && assessment.newest
      ? tx(
          `Données mises à jour ${agoLabel(assessment.newest.lastUploadAt, tx)}`,
          `Data updated ${agoLabel(assessment.newest.lastUploadAt, tx)}`
        )
      : mood === "stale"
        ? tx("Importez un nouveau fichier", "Upload a new file")
        : tx("Âge des données inconnu", "Data age unknown")

  /* ------------------------------ the pop-out ------------------------------ */

  const [open, setOpen] = useState(false)
  const popover = usePresence(open, "--dropdown-close-dur")
  const button = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)

  const close = useCallback((giveFocusBack = true) => {
    setOpen(false)
    if (giveFocusBack) button.current?.focus()
  }, [])

  function toggle() {
    if (open) return close(false)

    const rect = button.current?.getBoundingClientRect()

    if (rect && window.innerWidth >= 768) {
      setPos({ left: Math.round(rect.right + 14), bottom: Math.max(12, Math.round(window.innerHeight - rect.bottom - 4)) })
    } else {
      setPos(null)
    }

    setOpen(true)
  }

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node

      if (card.current?.contains(target) || button.current?.contains(target)) return

      close(false)
    }

    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onDown)
    primary.current?.focus()

    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onDown)
    }
  }, [open, close])

  /* What Robo says, from the same stamps. Never a guess. */
  const staleFirst = assessment.stale[0]
  const dateOf = (iso: string) =>
    new Date(iso).toLocaleDateString(tx("fr-FR", "en-GB"), { day: "numeric", month: "short" })
  const sectorName = (key: string) => sectorLabel(key, tx) || key

  const headline =
    mood === "fresh"
      ? tx("Tout va bien, vos données sont à jour", "All good, your data is fresh")
      : mood === "stale"
        ? tx("Hmm, c'est devenu silencieux", "Hmm, it has gone quiet")
        : tx("Je ne peux pas le dire encore", "I cannot tell yet")

  const message =
    mood === "fresh" && assessment.newest
      ? tx(
          `Votre dernier fichier est arrivé ${agoLabel(assessment.newest.lastUploadAt, tx)}. Je le surveille. Si un secteur reste silencieux plus de ${limit} jours, je vous le dirai ici et sur le tableau de bord.`,
          `Your newest file came in ${agoLabel(assessment.newest.lastUploadAt, tx)}. I am watching it. If a sector goes quiet for more than ${limit} days, I will tell you here and on the dashboard.`
        )
      : mood === "stale" && staleFirst
        ? tx(
            `${sectorName(staleFirst.sector)} n'a reçu aucun fichier depuis ${staleFirst.ageDays} jours (le dernier date du ${dateOf(staleFirst.lastUploadAt)}). Ce que vous voyez date de ce moment-là, et un zéro n'est pas une mesure. Importez un fichier et je mets tout à jour.`,
            `${sectorName(staleFirst.sector)} has had no new file for ${staleFirst.ageDays} days (the last one was on ${dateOf(staleFirst.lastUploadAt)}). What you see is as of then, and a zero is not a measurement. Upload a file and I will refresh everything.`
          )
        : tx(
            "Je n'ai pas de date pour vos données, donc je ne devine pas. Importez un fichier et je commence à compter leur fraîcheur.",
            "I do not have a date for your data, so I will not guess. Upload a file and I will start counting how fresh it is."
          )

  const facts: { label: string; value: string }[] = []

  if (mood === "fresh") {
    const rows = data.entries
      .filter((entry) => sectors.includes(entry.sector))
      .sort((a, b) => b.last_upload_at.localeCompare(a.last_upload_at))
    const newest = rows[0]

    for (const entry of rows.slice(0, 3)) {
      const department = entry.scope ? activityLabel(entry.sector, entry.scope, tx) : null

      facts.push({
        label: `${sectorName(entry.sector)}${department ? ` · ${department}` : ""}`,
        value: agoLabel(entry.last_upload_at, tx),
      })
    }

    if (newest) {
      facts.push({ label: tx("Lignes lues", "Rows read"), value: String(newest.rows_processed) })
      facts.push({ label: tx("Alertes levées", "Alerts raised"), value: String(newest.alerts_fired) })
    }
  } else if (mood === "stale") {
    for (const entry of assessment.stale) {
      facts.push({ label: sectorName(entry.sector), value: tx(`il y a ${entry.ageDays} jours`, `${entry.ageDays} days ago`) })
    }

    facts.push({ label: tx("Limite avant alerte", "Limit before a warning"), value: tx(`${limit} jours`, `${limit} days`) })
  }

  /* ------------------------------- the bubble ------------------------------ */

  const dot = (
    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
      {mood !== "unknown" && (
        <span className="absolute inset-0 rounded-full opacity-40 motion-safe:animate-ping" style={{ background: color }} />
      )}
      <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    </span>
  )

  const face = (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 [@media(max-height:820px)]:h-9 [@media(max-height:820px)]:w-9">
      <RoboHead mood={mood} className="h-8 w-8 [@media(max-height:820px)]:h-6 [@media(max-height:820px)]:w-6" />
    </span>
  )

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="sentria-status"
        data-look={mood}
        title={collapsed ? `${title}. ${sub}` : undefined}
        aria-label={`${title}. ${sub}`}
        className={cn(
          "flex items-center rounded-3xl text-left text-sidebar-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open ? "bg-white/15" : "bg-white/[0.07] hover:bg-white/10",
          collapsed ? "mx-auto h-12 w-12 justify-center p-0" : "w-full gap-3 p-3 [@media(max-height:820px)]:gap-2.5 [@media(min-height:701px)_and_(max-height:820px)]:p-2 [@media(max-height:700px)]:p-1.5"
        )}
        style={open ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
      >
        {face}

        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold leading-tight">{title}</span>
            <span className="mt-0.5 flex items-center gap-2 text-[12px] leading-tight text-sidebar-foreground/70">
              {dot}
              <span className="truncate">{sub}</span>
            </span>
          </span>
        )}
      </button>

      {popover.present &&
        createPortal(
          <div
            ref={card}
            role="dialog"
            aria-label="Robo"
            data-testid="robo-popover"
            data-mood={mood}
            data-origin="bottom-left"
            style={pos ? { left: pos.left, bottom: pos.bottom } : undefined}
            className={cn(
              "t-dropdown squircle fixed z-[80] rounded-[30px] bg-sidebar p-5 pt-6 text-sidebar-foreground shadow-2xl ring-1 ring-white/10",
              pos ? "w-[22rem]" : "inset-x-4 bottom-4",
              popover.className
            )}
          >
            <RoboBody
              mood={mood}
              className="pointer-events-none absolute -top-16 left-3 h-[120px] w-[100px] animate-[robo-pop_0.35s_ease-out_both] md:-left-14"
            />

            <button
              type="button"
              onClick={() => close()}
              aria-label={tx("Fermer", "Close")}
              className="absolute right-3.5 top-3.5 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/10 text-sidebar-foreground/70 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <p className="ml-24 text-[11px] font-extrabold uppercase tracking-[0.12em] md:ml-12" style={{ color }}>
              Robo
            </p>

            <h4 className="mt-2 text-xl font-bold leading-tight tracking-tight">{headline}</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-sidebar-foreground/80">{message}</p>

            {facts.length > 0 && (
              <ul className="mt-3.5 flex flex-col gap-1.5" data-testid="robo-facts">
                {facts.map((fact) => (
                  <li key={fact.label} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-2 text-[13px]">
                    <span className="min-w-0 truncate font-semibold">{fact.label}</span>
                    <span className="ml-auto shrink-0 font-bold" style={{ color }}>
                      {fact.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {mood === "fresh" ? (
                <button
                  ref={primary}
                  type="button"
                  onClick={() => close()}
                  className="inline-flex min-h-11 items-center rounded-full px-5 text-[13px] font-bold text-[#161614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ background: color }}
                >
                  {tx("Compris", "Got it")}
                </button>
              ) : (
                <>
                  <button
                    ref={primary}
                    type="button"
                    data-testid="robo-upload"
                    onClick={() => {
                      close(false)
                      onUpload?.()
                    }}
                    className="inline-flex min-h-11 items-center rounded-full px-5 text-[13px] font-bold text-[#161614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ background: color }}
                  >
                    {tx("Importer un fichier", "Upload a file")}
                  </button>
                  <button
                    type="button"
                    onClick={() => close()}
                    className="inline-flex min-h-11 items-center rounded-full bg-white/10 px-4 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {tx("Pas maintenant", "Not now")}
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
