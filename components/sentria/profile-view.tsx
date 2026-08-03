"use client"

import { MapPin, Mail, Shield, Pencil, Globe2, Radar, Bell } from "lucide-react"

const STATS = [
  { label: "Scans lancés", value: "1 942" },
  { label: "Zones suivies", value: "64" },
  { label: "Alertes traitées", value: "318" },
]

const ACTIVITY = [
  { icon: Radar, text: "Scan complet — Afrique de l'Ouest", time: "Il y a 2 h", dot: "bg-accent" },
  { icon: Bell, text: "Alerte critique acquittée — Nairobi", time: "Il y a 5 h", dot: "bg-destructive" },
  { icon: Globe2, text: "Nouvelle zone ajoutée — Montréal", time: "Hier", dot: "bg-foreground" },
]

export function ProfileView() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Identity card */}
      <div className="lg:col-span-1">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="h-24 bg-foreground" />
          <div className="px-6 pb-6">
            <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-accent text-2xl font-bold text-accent-foreground">
              AM
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-bold">Aïcha Mbaye</h2>
                <p className="text-sm text-muted-foreground">Analyste territoriale senior</p>
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted" aria-label="Modifier">
                <Pencil className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Mail className="h-4 w-4" /> aicha.mbaye@sentria.io
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <MapPin className="h-4 w-4" /> Dakar, Sénégal
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Shield className="h-4 w-4" /> Accès Pro · Multi-régions
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-3 text-center">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="font-heading text-lg font-bold">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Details + activity */}
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-heading text-lg font-bold">Domaines de couverture</h3>
          <p className="text-sm text-muted-foreground">Secteurs assignés à votre compte.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Énergie", "Eau", "Mobilité", "Agriculture", "Réseaux", "Santé", "Climat"].map((d) => (
              <span key={d} className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium">
                {d}
              </span>
            ))}
            <button className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground">
              + Ajouter
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-heading text-lg font-bold">Activité récente</h3>
          <div className="mt-4 space-y-1">
            {ACTIVITY.map((a, i) => {
              const Icon = a.icon
              return (
                <div key={i} className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-muted/50">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="flex-1 text-sm font-medium">{a.text}</p>
                  <span className="text-xs text-muted-foreground">{a.time}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
