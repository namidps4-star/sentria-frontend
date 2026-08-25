"use client"

import { useEffect, useState } from "react"
import {
  Activity, Cpu, TrendingUp, TrendingDown,
  ArrowUpRight, MoreHorizontal, Zap, Upload,
} from "lucide-react"
import { AreaChart, BarChart, Sparkline } from "./charts"
import { cn } from "@/lib/utils"

const API = "https://sentria-production.up.railway.app"

const SECTORS = [
  { key: "all", label: "Tous" },
  { key: "industry", label: "Industrie" },
  { key: "health", label: "Santé" },
  { key: "agriculture", label: "Agriculture" },
  { key: "transportation", label: "Transport" },
  { key: "logistics", label: "Logistique" },
  { key: "energy", label: "Énergie" },
]

type Alert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
}

export function DashboardView({ search = "" }: { search?: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [uploadSector, setUploadSector] = useState("industry")
  const [filterSector, setFilterSector] = useState("all")
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")

  // Active sectors from localStorage
  const [activeSectors, setActiveSectors] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["industry"]

    try {
      const stored = JSON.parse(
        localStorage.getItem("sentria_sectors") || '["industry"]'
      )

      return Array.isArray(stored) && stored.length > 0
        ? stored
        : ["industry"]
    } catch {
      return ["industry"]
    }
  })

  // Refresh when sectors are changed in settings
  useEffect(() => {
    const handler = () => {
      try {
        const stored = JSON.parse(
          localStorage.getItem("sentria_sectors") || '["industry"]'
        )

        setActiveSectors(
          Array.isArray(stored) && stored.length > 0
            ? stored
            : ["industry"]
        )
      } catch {
        setActiveSectors(["industry"])
      }
    }

    window.addEventListener("sentria_sectors_updated", handler)

    return () => {
      window.removeEventListener("sentria_sectors_updated", handler)
    }
  }, [])

  // Make sure selected upload/filter sector is still active
  useEffect(() => {
    if (!activeSectors.includes(uploadSector)) {
      setUploadSector(activeSectors[0] ?? "industry")
    }

    if (
      filterSector !== "all" &&
      !activeSectors.includes(filterSector)
    ) {
      setFilterSector("all")
    }
  }, [activeSectors, uploadSector, filterSector])

  useEffect(() => {
    fetch(`${API}/alerts`)
      .then((r) => r.json())
      .then((d) => setAlerts(Array.isArray(d) ? d : []))
      .catch(console.error)
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadMsg("")

    const form = new FormData()
    form.append("file", file)

    try {
      const res = await fetch(
        `${API}/upload?sector=${uploadSector}&lang=fr`,
        {
          method: "POST",
          body: form,
        }
      )

      const data = await res.json()
      setUploadMsg(data.message ?? "Fichier traité.")

      await new Promise((r) => setTimeout(r, 2000))

      const r2 = await fetch(`${API}/alerts`)
      const d2 = await r2.json()

      setAlerts(Array.isArray(d2) ? d2 : [])
      setFilterSector(uploadSector)
    } catch {
      setUploadMsg("Erreur lors de l'upload.")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const filteredAlerts = alerts
    .filter(
      (a) =>
        filterSector === "all" ||
        a.sector === filterSector
    )
    .filter((a) => {
      if (!search.trim()) return true

      const q = search.toLowerCase()

      return (
        a.equipment.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        (a.sector ?? "").toLowerCase().includes(q) ||
        a.severity.toLowerCase().includes(q)
      )
    })

  return (
    <div className="space-y-6">

      {/* Upload CSV */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-heading text-lg font-bold">
          Importer des données
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez un secteur puis importez votre CSV.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">

          {/* ONLY ACTIVE SECTORS */}
          <div className="flex flex-wrap gap-2">
            {SECTORS
              .filter(
                (s) =>
                  s.key !== "all" &&
                  activeSectors.includes(s.key)
              )
              .map((s) => (
                <button
                  key={s.key}
                  onClick={() => setUploadSector(s.key)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                    uploadSector === s.key
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-muted"
                  )}
                >
                  {s.label}
                </button>
              ))}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
            <Upload className="h-4 w-4" />

            {uploading
              ? "Traitement…"
              : "Importer CSV"}

            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {uploadMsg && (
          <p className="mt-3 text-sm font-medium text-green-600">
            {uploadMsg}
          </p>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Secteur :{" "}
          <span className="font-semibold text-foreground">
            {
              SECTORS.find(
                (s) => s.key === uploadSector
              )?.label
            }
          </span>
        </p>
      </div>

      {/* Sector filter — ONLY ACTIVE SECTORS */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterSector("all")}
          className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
            filterSector === "all"
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:bg-muted"
          )}
        >
          Tous
          <span className="ml-1.5 text-[10px] opacity-60">
            {alerts.length}
          </span>
        </button>

        {SECTORS
          .filter(
            (s) =>
              s.key !== "all" &&
              activeSectors.includes(s.key)
          )
          .map((s) => (
            <button
              key={s.key}
              onClick={() => setFilterSector(s.key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
                filterSector === s.key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:bg-muted"
              )}
            >
              {s.label}

              <span className="ml-1.5 text-[10px] opacity-60">
                {
                  alerts.filter(
                    (a) => a.sector === s.key
                  ).length
                }
              </span>
            </button>
          ))}
      </div>

      {/* Keep the rest of your existing DashboardView below this point */}
    </div>
  )
}