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
  { key: "all",            label: "Tous"         },
  { key: "industry",       label: "Industrie"    },
  { key: "health",         label: "Santé"        },
  { key: "agriculture",    label: "Agriculture"  },
  { key: "transportation", label: "Transport"    },
  { key: "logistics",      label: "Logistique"   },
  { key: "energy",         label: "Énergie"      },
]

const SECTOR_META: Record<string, {
  kpis: (alerts: Alert[]) => { label: string; value: string; delta: string; up: boolean; spark: number[] }[]
  chartTitle: string
  barLabels: string[]
  barData: (alerts: Alert[]) => number[]
}> = {
  all: {
    kpis: (a) => [
      { label: "Actifs en alerte",  value: String(new Set(a.map(x => x.equipment)).size), delta: "Live",        up: true,                                   spark: [4,6,5,8,7,9,11] },
      { label: "Alertes critiques", value: String(a.filter(x => x.severity === "CRITICAL").length), delta: a.filter(x=>x.severity==="CRITICAL").length > 0 ? "À traiter" : "OK", up: a.filter(x=>x.severity==="CRITICAL").length===0, spark: [9,8,7,8,6,5,4] },
      { label: "Warnings",          value: String(a.filter(x => x.severity === "WARNING").length),  delta: "Surveillance", up: true,                         spark: [8,7,9,6,8,10,12] },
      { label: "Total alertes",     value: String(a.length), delta: "Toutes sources", up: true,                                                              spark: [2,3,3,4,5,5,6] },
    ],
    chartTitle: "Évolution des alertes",
    barLabels: ["CRIT", "WARN", "INFO"],
    barData: (a) => [a.filter(x=>x.severity==="CRITICAL").length, a.filter(x=>x.severity==="WARNING").length, 0],
  },
  industry: {
    kpis: (a) => [
      { label: "Machines en panne imminente", value: String(a.filter(x=>x.severity==="CRITICAL").length), delta: "Arrêt immédiat", up: false, spark: [2,4,3,6,5,8,7] },
      { label: "Usure élevée",                value: String(a.filter(x=>x.severity==="WARNING").length),  delta: "Surveiller",    up: true,  spark: [4,5,6,5,7,8,9] },
      { label: "Machines surveillées",        value: String(new Set(a.map(x=>x.equipment)).size), delta: "Live", up: true, spark: [5,6,5,7,6,8,9] },
      { label: "Total alertes",               value: String(a.length), delta: "Session", up: true, spark: [2,3,3,4,5,5,6] },
    ],
    chartTitle: "Alertes machines — 7 jours",
    barLabels: ["Panne", "Usure", "Torque"],
    barData: (a) => [
      a.filter(x=>x.message.includes("failure") || x.message.includes("panne")).length,
      a.filter(x=>x.message.includes("wear") || x.message.includes("usure")).length,
      a.filter(x=>x.message.includes("torque") || x.message.includes("Torque")).length,
    ],
  },
  health: {
    kpis: (a) => [
      { label: "Ruptures critiques",    value: String(a.filter(x=>x.severity==="CRITICAL").length), delta: "Commander maintenant", up: false, spark: [3,2,4,5,3,4,6] },
      { label: "Stocks bas",            value: String(a.filter(x=>x.severity==="WARNING").length),  delta: "À surveiller",        up: true,  spark: [2,3,3,4,5,4,5] },
      { label: "Médicaments concernés", value: String(new Set(a.map(x=>x.equipment)).size), delta: "Produits", up: true, spark: [1,2,2,3,3,4,4] },
      { label: "Alertes chaîne froid",  value: String(a.filter(x=>x.message.includes("froid") || x.message.includes("cold")).length), delta: "Urgence", up: false, spark: [0,0,1,0,1,1,2] },
    ],
    chartTitle: "Alertes stocks — 7 jours",
    barLabels: ["Rupture", "Stock bas", "Froid", "Expiry"],
    barData: (a) => [
      a.filter(x=>x.message.includes("Rupture") || x.message.includes("reorder")).length,
      a.filter(x=>x.message.includes("bas") || x.message.includes("low")).length,
      a.filter(x=>x.message.includes("froid") || x.message.includes("cold")).length,
      a.filter(x=>x.message.includes("expir")).length,
    ],
  },
  agriculture: {
    kpis: (a) => [
      { label: "Pertes probables",   value: String(a.filter(x=>x.severity==="CRITICAL").length), delta: "Livraison urgente", up: false, spark: [1,2,2,3,4,3,5] },
      { label: "Retards détectés",   value: String(a.filter(x=>x.message.includes("retard") || x.message.includes("delay")).length), delta: "Camions", up: false, spark: [0,1,1,2,2,3,3] },
      { label: "Produits en risque", value: String(new Set(a.map(x=>x.equipment)).size), delta: "Actifs", up: true, spark: [2,2,3,3,4,4,5] },
      { label: "Alertes temp.",      value: String(a.filter(x=>x.message.includes("temp") || x.message.includes("Temp")).length), delta: "Stockage", up: false, spark: [0,0,1,1,1,2,2] },
    ],
    chartTitle: "Alertes récoltes — 7 jours",
    barLabels: ["Perte", "Retard", "Temp.", "Stock"],
    barData: (a) => [
      a.filter(x=>x.message.includes("perte") || x.message.includes("loss")).length,
      a.filter(x=>x.message.includes("retard") || x.message.includes("delay")).length,
      a.filter(x=>x.message.includes("temp") || x.message.includes("Temp")).length,
      a.filter(x=>x.message.includes("stock")).length,
    ],
  },
  transportation: {
    kpis: (a) => [
      { label: "Camions critiques", value: String(a.filter(x=>x.severity==="CRITICAL").length), delta: "Immobiliser", up: false, spark: [1,2,1,3,2,4,3] },
      { label: "Révisions dues",    value: String(a.filter(x=>x.message.includes("service") || x.message.includes("révision")).length), delta: "Planifier", up: false, spark: [2,2,3,3,4,4,5] },
      { label: "Camions surveillés",value: String(new Set(a.map(x=>x.equipment)).size), delta: "Flotte", up: true, spark: [3,4,4,5,5,6,7] },
      { label: "Alertes moteur",    value: String(a.filter(x=>x.message.includes("moteur") || x.message.includes("engine")).length), delta: "Urgence", up: false, spark: [0,0,1,1,1,2,2] },
    ],
    chartTitle: "Alertes flotte — 7 jours",
    barLabels: ["Moteur", "Huile", "Carburant", "Pneus"],
    barData: (a) => [
      a.filter(x=>x.message.includes("moteur") || x.message.includes("engine")).length,
      a.filter(x=>x.message.includes("huile") || x.message.includes("oil")).length,
      a.filter(x=>x.message.includes("carburant") || x.message.includes("fuel")).length,
      a.filter(x=>x.message.includes("pneu") || x.message.includes("tire")).length,
    ],
  },
  logistics: {
    kpis: (a) => [
      { label: "Équipements bloqués", value: String(a.filter(x=>x.severity==="CRITICAL").length), delta: "Arrêt immédiat", up: false, spark: [1,2,2,3,3,4,5] },
      { label: "Files d'attente",     value: String(a.filter(x=>x.message.includes("attente") || x.message.includes("wait")).length), delta: "Conteneurs", up: false, spark: [2,3,3,4,4,5,6] },
      { label: "Équipements actifs",  value: String(new Set(a.map(x=>x.equipment)).size), delta: "Port", up: true, spark: [4,5,5,6,6,7,8] },
      { label: "Alertes pression",    value: String(a.filter(x=>x.message.includes("pression") || x.message.includes("pressure")).length), delta: "Hydraulique", up: false, spark: [0,1,1,1,2,2,3] },
    ],
    chartTitle: "Alertes port — 7 jours",
    barLabels: ["Cycles", "Attente", "Pression", "Carburant"],
    barData: (a) => [
      a.filter(x=>x.message.includes("cycle")).length,
      a.filter(x=>x.message.includes("attente") || x.message.includes("wait")).length,
      a.filter(x=>x.message.includes("pression") || x.message.includes("pressure")).length,
      a.filter(x=>x.message.includes("carburant") || x.message.includes("fuel")).length,
    ],
  },
  energy: {
    kpis: (a) => [
      { label: "Générateurs critiques", value: String(a.filter(x=>x.severity==="CRITICAL").length), delta: "Intervenir", up: false, spark: [1,2,2,3,3,4,5] },
      { label: "Carburant bas",         value: String(a.filter(x=>x.message.includes("carburant") || x.message.includes("fuel")).length), delta: "Réapprovisionner", up: false, spark: [2,2,3,3,4,4,5] },
      { label: "Générateurs surveillés",value: String(new Set(a.map(x=>x.equipment)).size), delta: "Actifs", up: true, spark: [3,4,4,5,5,6,7] },
      { label: "Alertes surchauffe",    value: String(a.filter(x=>x.message.includes("surchauffe") || x.message.includes("overheat")).length), delta: "Température", up: false, spark: [0,0,1,1,2,2,3] },
    ],
    chartTitle: "Alertes énergie — 7 jours",
    barLabels: ["Carburant", "Surchauffe", "Huile", "Surcharge"],
    barData: (a) => [
      a.filter(x=>x.message.includes("carburant") || x.message.includes("fuel")).length,
      a.filter(x=>x.message.includes("surchauffe") || x.message.includes("overheat")).length,
      a.filter(x=>x.message.includes("huile") || x.message.includes("oil")).length,
      a.filter(x=>x.message.includes("surcharge") || x.message.includes("overload")).length,
    ],
  },
}

type Alert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
}

export function DashboardView() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [uploadSector, setUploadSector] = useState("industry")
  const [filterSector, setFilterSector] = useState("all")
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")

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
      const res = await fetch(`${API}/upload?sector=${uploadSector}&lang=fr`, {
        method: "POST",
        body: form,
      })
      const data = await res.json()
      setUploadMsg(data.message ?? "Fichier traité.")
      await new Promise(r => setTimeout(r, 2000))
      const r2 = await fetch(`${API}/alerts`)
      const d2 = await r2.json()
      setAlerts(Array.isArray(d2) ? d2 : [])
      setFilterSector(uploadSector)
    } catch {
      setUploadMsg("Erreur lors de l'upload.")
    } finally {
      setUploading(false)
      ;(e.target as HTMLInputElement).value = ""
    }
  }

  const filteredAlerts = filterSector === "all"
    ? alerts
    : alerts.filter(a => a.sector === filterSector)

  const meta = SECTOR_META[filterSector] ?? SECTOR_META.all
  const kpis = meta.kpis(filteredAlerts)
  const barData = meta.barData(filteredAlerts)

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="flex flex-col gap-4 rounded-3xl bg-foreground p-6 text-background md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Zap className="h-3.5 w-3.5" /> Temps réel
          </span>
          <h2 className="mt-3 text-balance font-heading text-2xl font-bold leading-tight md:text-3xl">
            Vue globale de vos opérations critiques.
          </h2>
          <p className="mt-2 text-pretty text-sm text-background/70">
            SentrIA surveille vos alertes en temps réel — machines, stocks, flottes, équipements — partout dans le monde.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]">
          Voir les alertes <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* Upload CSV */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-heading text-lg font-bold">Importer des données</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez un secteur puis importez votre CSV.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {SECTORS.filter(s => s.key !== "all").map((s) => (
              <button
                key={s.key}
                onClick={() => setUploadSector(s.key)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                  uploadSector === s.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
            <Upload className="h-4 w-4" />
            {uploading ? "Traitement…" : "Importer CSV"}
            <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
        {uploadMsg && <p className="mt-3 text-sm font-medium text-green-600">{uploadMsg}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          Secteur : <span className="font-semibold text-foreground">{SECTORS.find(s => s.key === uploadSector)?.label}</span>
        </p>
      </div>

      {/* Sector filter */}
      <div className="flex flex-wrap gap-2">
        {SECTORS.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterSector(s.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors capitalize",
              filterSector === s.key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            {s.label}
            <span className="ml-1.5 text-[10px] opacity-60">
              {s.key === "all" ? alerts.length : alerts.filter(a => a.sector === s.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* KPIs — change per sector */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{k.label}</span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                k.up ? "bg-accent/25 text-accent-foreground" : "bg-destructive/10 text-destructive",
              )}>
                {k.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {k.delta}
              </span>
            </div>
            <p className="mt-3 font-heading text-3xl font-bold tracking-tight">{k.value}</p>
            <Sparkline data={k.spark} className={cn("mt-2 h-9 w-full", k.up ? "text-accent" : "text-destructive")} />
          </div>
        ))}
      </div>

      {/* Charts — change per sector */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold">{meta.chartTitle}</h3>
              <p className="text-sm text-muted-foreground">7 derniers jours</p>
            </div>
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Options">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
          <AreaChart
            data={[24,30,28,42,38,55,49,62,58,71,68, filteredAlerts.length || 10]}
            className="mt-6 h-52 w-full"
          />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent-foreground" />
            <h3 className="font-heading text-lg font-bold">Répartition</h3>
          </div>
          <p className="text-sm text-muted-foreground">{meta.barLabels.join(" · ")}</p>
          <BarChart
            data={barData}
            labels={meta.barLabels}
            className="mt-6"
            height={180}
          />
        </div>
      </div>

      {/* Alerts table */}
      <div className="rounded-3xl border border-border bg-card">
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            <h3 className="font-heading text-lg font-bold">
              Alertes — {SECTORS.find(s => s.key === filterSector)?.label}
            </h3>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90">
            Tout voir <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Actif</th>
                <th className="px-6 py-3 font-medium">Message</th>
                <th className="px-6 py-3 font-medium">Secteur</th>
                <th className="px-6 py-3 font-medium">Sévérité</th>
                <th className="px-6 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.slice(0, 20).map((alert, i) => (
                <tr key={i} className="border-b border-border last:border-0 transition-colors hover:bg-muted/50">
                  <td className="px-6 py-4 font-semibold">{alert.equipment}</td>
                  <td className="px-6 py-4 text-muted-foreground">{alert.message}</td>
                  <td className="px-6 py-4 text-muted-foreground capitalize">{alert.sector ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      alert.severity === "CRITICAL"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/15 text-amber-600",
                    )}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(alert.date).toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
              {filteredAlerts.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-muted-foreground" colSpan={5}>
                    Aucune alerte pour ce secteur. Importez un CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
