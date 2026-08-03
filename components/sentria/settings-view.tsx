"use client"

import { useState } from "react"
import { Globe, Bell, Moon, Check, Building2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

const LANGUAGES = [
  { code: "fr", label: "Français", region: "France · Afrique" },
  { code: "en", label: "English", region: "Global" },
  { code: "es", label: "Español", region: "Amériques" },
  { code: "pt", label: "Português", region: "Brésil" },
  { code: "ar", label: "العربية", region: "Maghreb" },
  { code: "sw", label: "Kiswahili", region: "Afrique de l'Est" },
]

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        on ? "bg-accent" : "bg-muted",
      )}
      role="switch"
      aria-checked={on}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

export function SettingsView() {
  const [lang, setLang] = useState("fr")
  const [toggles, setToggles] = useState({ alerts: true, weekly: false, dark: false })
  const t = (k: keyof typeof toggles) => setToggles((s) => ({ ...s, [k]: !s[k] }))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Language */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Globe className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-heading text-lg font-bold">Langue & région</h3>
            <p className="text-sm text-muted-foreground">L'interface s'adapte à votre territoire.</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {LANGUAGES.map((l) => {
            const active = lang === l.code
            return (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-3.5 text-left transition-colors",
                  active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-ring",
                )}
              >
                <div>
                  <p className="font-semibold">{l.label}</p>
                  <p className={cn("text-xs", active ? "text-background/70" : "text-muted-foreground")}>
                    {l.region}
                  </p>
                </div>
                {active && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Notifications & appearance */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-heading text-lg font-bold">Préférences</h3>
        <div className="mt-4 divide-y divide-border">
          {[
            { icon: Bell, key: "alerts" as const, title: "Alertes en temps réel", desc: "Recevoir les signaux critiques instantanément." },
            { icon: Mail, key: "weekly" as const, title: "Rapport hebdomadaire", desc: "Synthèse e-mail tous les lundis." },
            { icon: Moon, key: "dark" as const, title: "Mode sombre", desc: "Basculer le thème de l'interface." },
          ].map((row) => {
            const Icon = row.icon
            return (
              <div key={row.key} className="flex items-center gap-3 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.desc}</p>
                </div>
                <Toggle on={toggles[row.key]} onChange={() => t(row.key)} />
              </div>
            )
          })}
        </div>
      </section>

      {/* Organization */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-heading text-lg font-bold">Organisation</h3>
            <p className="text-sm text-muted-foreground">Espace de travail partagé.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Nom de l'organisation</span>
            <input
              defaultValue="Observatoire Territorial Global"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Fuseau horaire</span>
            <select className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring">
              <option>GMT (Dakar, Abidjan)</option>
              <option>CET (Paris, Lyon)</option>
              <option>BRT (São Paulo)</option>
              <option>EAT (Nairobi)</option>
            </select>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted">
            Annuler
          </button>
          <button className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90">
            Enregistrer
          </button>
        </div>
      </section>
    </div>
  )
}
