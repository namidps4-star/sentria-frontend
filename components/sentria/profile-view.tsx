"use client"

import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  Pencil,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

const STATS = [
  {
    label: "Équipements surveillés",
    value: "42",
    icon: Activity,
  },
  {
    label: "Alertes analysées",
    value: "127",
    icon: Bell,
  },
  {
    label: "Alertes critiques",
    value: "8",
    icon: AlertTriangle,
  },
  {
    label: "Rapports générés",
    value: "24",
    icon: FileText,
  },
]

const SECTORS = [
  { name: "Industrie", count: 18 },
  { name: "Santé", count: 7 },
  { name: "Agriculture", count: 5 },
  { name: "Transport", count: 4 },
  { name: "Logistique", count: 3 },
  { name: "Énergie", count: 5 },
]

const ACTIVITY = [
  {
    icon: Bell,
    title: "Alerte critique détectée",
    description: "Machine CNC-04 · risque de panne",
    time: "Il y a 18 min",
    status: "critical",
  },
  {
    icon: FileText,
    title: "Rapport généré",
    description: "Analyse prédictive · Site principal",
    time: "Il y a 2 h",
    status: "success",
  },
  {
    icon: Sparkles,
    title: "Analyse IA terminée",
    description: "12 équipements analysés",
    time: "Il y a 5 h",
    status: "ai",
  },
  {
    icon: CheckCircle2,
    title: "Alerte acquittée",
    description: "Générateur EST-02 · intervention confirmée",
    time: "Hier",
    status: "normal",
  },
]

export function ProfileView() {
  return (
    <div className="space-y-6">

      {/* PROFILE HEADER */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">

        {/* Header */}
        <div className="relative h-28 bg-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(174,255,0,0.25),transparent_35%)]" />

          <div className="absolute bottom-4 left-6 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-background/50">
              SentrIA Account
            </span>
          </div>
        </div>

        {/* Profile content */}
        <div className="px-6 pb-6 pt-6">

          {/* Avatar */}
          <div className="relative w-fit">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-accent text-xl font-bold text-accent-foreground shadow-sm">
              AM
            </div>

            {/* Online indicator */}
            <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-card bg-green-500" />
          </div>

          {/* Identity */}
          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <div className="flex flex-wrap items-center gap-2">

                <h2 className="font-heading text-2xl font-bold tracking-tight">
                  Aïcha Mbaye
                </h2>

                <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                  Pro
                </span>

              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Responsable des opérations
              </p>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">

                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  SentrIA Operations
                </span>

                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  aicha.mbaye@sentria.io
                </span>

              </div>
            </div>

            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Pencil className="h-4 w-4" />
              Modifier le profil
            </button>

          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {STATS.map((stat) => {
          const Icon = stat.icon

          return (
            <div
              key={stat.label}
              className="rounded-3xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm"
            >

              <div className="flex items-center justify-between">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-4 w-4" />
                </div>

                <TrendingUp className="h-4 w-4 text-accent-foreground" />

              </div>

              <p className="mt-5 font-heading text-3xl font-bold tracking-tight">
                {stat.value}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {stat.label}
              </p>

            </div>
          )
        })}

      </div>

      {/* ACCOUNT + SECTORS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ACCOUNT */}
        <div className="rounded-3xl border border-border bg-card p-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <User className="h-4 w-4" />
            </div>

            <div>
              <h3 className="font-heading text-lg font-bold">
                Mon espace
              </h3>

              <p className="text-sm text-muted-foreground">
                Informations du compte
              </p>
            </div>

          </div>

          <div className="mt-6 space-y-5">

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Organisation
              </p>

              <p className="mt-1 text-sm font-semibold">
                SentrIA Operations
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Fonction
              </p>

              <p className="mt-1 text-sm font-semibold">
                Responsable des opérations
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Localisation
              </p>

              <p className="mt-1 text-sm font-semibold">
                Dakar, Sénégal
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Niveau d'accès
              </p>

              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1.5 text-xs font-semibold">
                <Shield className="h-3.5 w-3.5" />
                Administrateur
              </div>
            </div>

          </div>
        </div>

        {/* SECTORS */}
        <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">

          <div className="flex items-center justify-between">

            <div>
              <h3 className="font-heading text-lg font-bold">
                Secteurs actifs
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Environnements actuellement surveillés.
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <Zap className="h-4 w-4 text-accent-foreground" />
            </div>

          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">

            {SECTORS.map((sector) => (
              <div
                key={sector.name}
                className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted"
              >

                <div className="flex items-center gap-3">

                  <span className="h-2 w-2 rounded-full bg-accent" />

                  <span className="text-sm font-semibold">
                    {sector.name}
                  </span>

                </div>

                <span className="text-xs text-muted-foreground">
                  {sector.count}
                </span>

              </div>
            ))}

          </div>
        </div>

      </div>

      {/* RECENT ACTIVITY */}
      <div className="rounded-3xl border border-border bg-card p-6">

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h3 className="font-heading text-lg font-bold">
              Activité récente
            </h3>

            <p className="text-sm text-muted-foreground">
              Votre activité récente dans SentrIA.
            </p>
          </div>

          <button className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
            Voir toute l'activité →
          </button>

        </div>

        <div className="mt-5 divide-y divide-border">

          {ACTIVITY.map((item, index) => {
            const Icon = item.icon

            return (
              <div
                key={`${item.title}-${index}`}
                className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
              >

                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    item.status === "critical"
                      ? "bg-destructive/10 text-destructive"
                      : item.status === "ai"
                        ? "bg-accent/20 text-accent-foreground"
                        : "bg-muted text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">

                  <p className="truncate text-sm font-semibold">
                    {item.title}
                  </p>

                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {item.description}
                  </p>

                </div>

                <div className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <Clock3 className="h-3.5 w-3.5" />
                  {item.time}
                </div>

              </div>
            )
          })}

        </div>
      </div>

      {/* BOTTOM CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* SECURITY */}
        <div className="rounded-3xl border border-border bg-card p-6">

          <div className="flex items-start gap-4">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Shield className="h-4 w-4" />
            </div>

            <div>

              <h3 className="font-heading font-bold">
                Compte sécurisé
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Votre compte et vos données opérationnelles sont protégés.
              </p>

              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Sécurité active
              </div>

            </div>

          </div>
        </div>

        {/* AI */}
        <div className="rounded-3xl bg-foreground p-6 text-background">

          <div className="flex items-start gap-4">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
              <Sparkles className="h-4 w-4 text-accent-foreground" />
            </div>

            <div>

              <h3 className="font-heading font-bold">
                Intelligence SentrIA
              </h3>

              <p className="mt-1 text-sm text-background/60">
                Analyse prédictive et recommandations pour anticiper les risques opérationnels.
              </p>

            </div>

          </div>
        </div>

      </div>

    </div>
  )
}