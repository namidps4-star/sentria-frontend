"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { inAccountScope, readSectors } from "@/lib/activities"
import { API_BASE, apiFetch } from "@/lib/api"
import { taskKeyFor } from "@/lib/crm"
import { useTx } from "@/lib/i18n"
import { withOurSector } from "@/lib/sector"

import { RecommendationsBoard } from "./recommendations-board-view"

type ApiRecommendation = {
  equipment: string
  sector?: string | null
  business_type?: string | null
  severity: string
  date: string
  message: string
  risk_score?: number | null
  alert_key?: string | null
  recommended_action: string
  action_category: string
  reasoning?: string | null
}

/* The tracking board for every department (P-TRACK, B-15). The logistics
   board inside the dashboard derives its cards from the chain; this one
   takes every recommendation the account's sectors and activity produce.

   Each card's id is its task key (taskKeyFor), the key the dashboard's
   "Mark handled" and the calendar use, so a task closed anywhere shows
   as done here. Repeat alerts on the same equipment for the same issue
   are one task: the most recent one stands for it. */
export function TrackingView() {
  const tx = useTx()
  const lang = tx("fr", "en")

  const [recommendations, setRecommendations] = useState<ApiRecommendation[]>([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [sectors, setSectors] = useState<string[]>([])
  const [businessType, setBusinessType] = useState<string | null>(null)

  useEffect(() => {
    setSectors(readSectors())

    try {
      setBusinessType(localStorage.getItem("sentria_business_type"))
    } catch {
      setBusinessType(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    setFailed(false)

    apiFetch(`${API_BASE}/recommendations?limit=100&lang=${lang}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (cancelled) return

        setRecommendations(
          Array.isArray(d?.recommendations)
            ? d.recommendations.map(withOurSector)
            : []
        )
      })
      .catch((error) => {
        console.error("Failed to load recommendations for tracking:", error)
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [lang])

  const cards = useMemo(() => {
    const byTask = new Map<string, ApiRecommendation & { id: string }>()

    for (const rec of inAccountScope(recommendations, sectors, businessType)) {
      // Rows without an alert_key fall back to the id the dashboard and
      // the calendar give them, so "Mark handled" still lands here.
      const fallbackId = [
        rec.alert_key ?? "",
        rec.equipment,
        rec.date,
        rec.action_category,
        rec.recommended_action,
      ].join("::")
      const id = taskKeyFor({ ...rec, id: fallbackId })
      const seen = byTask.get(id)

      if (!seen || (rec.date ?? "") > (seen.date ?? "")) {
        byTask.set(id, { ...rec, id })
      }
    }

    return Array.from(byTask.values())
  }, [recommendations, sectors, businessType])

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {tx("Chargement du suivi…", "Loading tracking…")}
      </div>
    )
  }

  if (failed) {
    return (
      <div className="rounded-3xl border border-destructive/40 bg-card p-6 text-sm text-destructive">
        {tx(
          "Les recommandations n'ont pas pu être chargées. Réessayez dans un instant.",
          "The recommendations could not be loaded. Try again in a moment."
        )}
      </div>
    )
  }

  return <RecommendationsBoard recommendations={cards} />
}
