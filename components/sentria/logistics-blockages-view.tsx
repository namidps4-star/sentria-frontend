"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Package,
  PackageSearch,
  Radar,
  Recycle,
  Shield,
  Snowflake,
  Truck,
  Warehouse,
  AlertTriangle,
  CircleAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"

type OpsType =
  | "port"
  | "entrepot"
  | "transport"
  | "expedition"
  | "froid"
  | "multi"

type Alert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
}

const OPS_TYPES: {
  id: OpsType
  label: string
  description: string
  icon: typeof Anchor
}[] = [
  {
    id: "port",
    label: "Port & conteneurs",
    description:
      "Quais, conteneurs, grues, engins de manutention et files d'attente.",
    icon: Anchor,
  },
  {
    id: "entrepot",
    label: "Entrepôt & manutention",
    description:
      "Zones de stockage, chariots, préparation et flux internes.",
    icon: Warehouse,
  },
  {
    id: "transport",
    label: "Transport & distribution",
    description:
      "Flotte, véhicules, tournées, livraisons et retards.",
    icon: Truck,
  },
  {
    id: "expedition",
    label: "Préparation & expédition",
    description:
      "Commandes, préparation, emballage et départ des marchandises.",
    icon: PackageSearch,
  },
  {
    id: "froid",
    label: "Chaîne du froid",
    description:
      "Température, équipements frigorifiques et continuité du froid.",
    icon: Snowflake,
  },
  {
    id: "multi",
    label: "Plusieurs activités",
    description:
      "Une surveillance transversale de plusieurs activités logistiques.",
    icon: Recycle,
  },
]

const OPS_TYPE_LABEL: Record<OpsType, string> = {
  port: "Port & conteneurs",
  entrepot: "Entrepôt & manutention",
  transport: "Transport & distribution",
  expedition: "Préparation & expédition",
  froid: "Chaîne du froid",
  multi: "Plusieurs activités",
}

const OPS_META: Record<
  OpsType,
  {
    title: string
    subtitle: string
    kpis: {
      label: string
      description: string
      icon: typeof Package
    }[]
    signals: string[]
  }
> = {
  port: {
    title: "Blocages port & conteneurs",
    subtitle:
      "Identifiez les files d'attente, les conteneurs immobilisés et les équipements susceptibles de ralentir le terminal.",
    kpis: [
      {
        label: "Conteneurs bloqués",
        description: "Conteneurs immobilisés ou en anomalie.",
        icon: Package,
      },
      {
        label: "Attente au quai",
        description: "Files d'attente et temps d'attente détectés.",
        icon: Clock3,
      },
      {
        label: "Équipements à risque",
        description: "Grues et engins pouvant provoquer un arrêt.",
        icon: Radar,
      },
    ],
    signals: [
      "Attente anormalement longue",
      "Cycle de manutention ralenti",
      "Pression hydraulique anormale",
      "Équipement immobilisé",
      "Risque de congestion du terminal",
    ],
  },

  entrepot: {
    title: "Blocages entrepôt & manutention",
    subtitle:
      "Surveillez les zones saturées, les retards de préparation et les équipements qui peuvent interrompre le flux.",
    kpis: [
      {
        label: "Zones bloquées",
        description: "Zones ou flux actuellement perturbés.",
        icon: Warehouse,
      },
      {
        label: "Commandes en retard",
        description: "Commandes susceptibles de manquer leur départ.",
        icon: Clock3,
      },
      {
        label: "Équipements à risque",
        description: "Chariots et équipements de manutention.",
        icon: Radar,
      },
    ],
    signals: [
      "Zone de stockage saturée",
      "Commande en retard",
      "Cycle de préparation ralenti",
      "Capacité dépassée",
      "Équipement de manutention indisponible",
    ],
  },

  transport: {
    title: "Blocages transport & distribution",
    subtitle:
      "Anticipez les immobilisations, les retards de tournée et les problèmes pouvant bloquer les livraisons.",
    kpis: [
      {
        label: "Véhicules bloqués",
        description: "Véhicules présentant une anomalie critique.",
        icon: Truck,
      },
      {
        label: "Retards",
        description: "Retards pouvant perturber les tournées.",
        icon: Clock3,
      },
      {
        label: "Flotte à risque",
        description: "Véhicules nécessitant une attention.",
        icon: Radar,
      },
    ],
    signals: [
      "Véhicule immobilisé",
      "Retard de livraison",
      "Entretien en retard",
      "Niveau de carburant critique",
      "Risque de rupture de tournée",
    ],
  },

  expedition: {
    title: "Blocages préparation & expédition",
    subtitle:
      "Détectez les commandes, postes de préparation et expéditions susceptibles de rester bloqués.",
    kpis: [
      {
        label: "Commandes bloquées",
        description: "Commandes qui ne peuvent pas avancer.",
        icon: PackageSearch,
      },
      {
        label: "Préparations en retard",
        description: "Commandes dépassant leur délai prévu.",
        icon: Clock3,
      },
      {
        label: "Postes à risque",
        description: "Postes pouvant ralentir les expéditions.",
        icon: Radar,
      },
    ],
    signals: [
      "Commande bloquée",
      "Préparation en retard",
      "Manque de stock",
      "Poste de préparation saturé",
      "Départ d'expédition menacé",
    ],
  },

  froid: {
    title: "Blocages chaîne du froid",
    subtitle:
      "Surveillez les ruptures de température et les équipements frigorifiques pouvant interrompre le flux.",
    kpis: [
      {
        label: "Ruptures du froid",
        description: "Équipements ou marchandises hors seuil.",
        icon: Snowflake,
      },
      {
        label: "Alertes température",
        description: "Températures proches ou hors limites.",
        icon: AlertTriangle,
      },
      {
        label: "Équipements à risque",
        description: "Groupes froid et équipements surveillés.",
        icon: Radar,
      },
    ],
    signals: [
      "Température hors seuil",
      "Rupture de chaîne du froid",
      "Pression anormale",
      "Équipement frigorifique en anomalie",
      "Risque de perte produit",
    ],
  },

  multi: {
    title: "Blocages logistiques",
    subtitle:
      "Vue transversale des risques pouvant perturber vos différentes activités logistiques.",
    kpis: [
      {
        label: "Blocages critiques",
        description: "Situations nécessitant une intervention immédiate.",
        icon: CircleAlert,
      },
      {
        label: "Files d'attente",
        description: "Flux présentant un ralentissement.",
        icon: Clock3,
      },
      {
        label: "Équipements à risque",
        description: "Équipements pouvant provoquer un arrêt.",
        icon: Radar,
      },
    ],
    signals: [
      "Blocage opérationnel",
      "File d'attente anormale",
      "Équipement indisponible",
      "Retard critique",
      "Capacité dépassée",
    ],
  },
}

export function LogisticsBlockagesView() {
  const [opsType, setOpsType] = useState<OpsType | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedOpsType =
      localStorage.getItem("sentria_ops_type") as OpsType | null

    if (
      savedOpsType &&
      OPS_TYPES.some((item) => item.id === savedOpsType)
    ) {
      setOpsType(savedOpsType)
    }

    fetch("https://sentria-8btn.onrender.com/alerts")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load alerts")
        }

        return response.json()
      })
      .then((data) => {
        setAlerts(Array.isArray(data) ? data : [])
      })
      .catch((error) => {
        console.error(
          "Failed to load logistics alerts:",
          error
        )
        setAlerts([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  function selectOpsType(id: OpsType) {
    setOpsType(id)

    localStorage.setItem("sentria_ops_type", id)

    window.dispatchEvent(
      new Event("sentria_ops_type_updated")
    )
  }

  const meta = opsType ? OPS_META[opsType] : null

  const logisticsAlerts = useMemo(() => {
    return alerts.filter(
      (alert) => alert.sector === "logistics"
    )
  }, [alerts])

  const criticalAlerts = logisticsAlerts.filter(
    (alert) => alert.severity === "CRITICAL"
  )

  const warningAlerts = logisticsAlerts.filter(
    (alert) => alert.severity === "WARNING"
  )

  const equipmentCount = new Set(
    logisticsAlerts.map((alert) => alert.equipment)
  ).size

  function matchesAny(
    message: string,
    words: string[]
  ) {
    const value = message.toLowerCase()

    return words.some((word) =>
      value.includes(word.toLowerCase())
    )
  }

  const waitingAlerts = logisticsAlerts.filter((alert) =>
    matchesAny(alert.message, [
      "attente",
      "wait",
      "retard",
      "delay",
      "queue",
      "file",
    ])
  )

  const blockageAlerts = logisticsAlerts.filter((alert) =>
    matchesAny(alert.message, [
      "bloqué",
      "bloque",
      "block",
      "immobil",
      "failure",
      "panne",
      "critical",
    ])
  )

  function goBack() {
    window.history.back()
  }

  return (
    <div className="min-h-full space-y-6">
      {/* HEADER */}
      <div className="rounded-3xl bg-foreground p-6 text-background md:p-8">
        <button
          type="button"
          onClick={goBack}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-background/20 px-4 py-2 text-sm font-medium text-background/80 transition-colors hover:bg-background/10 hover:text-background"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au dashboard
        </button>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Shield className="h-3.5 w-3.5" />
              Éviter les blocages
            </div>

            <h1 className="mt-4 font-heading text-2xl font-bold md:text-4xl">
              {meta?.title ?? "Prévention des blocages logistiques"}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-background/70 md:text-base">
              {meta?.subtitle ??
                "Choisissez votre activité opérationnelle pour adapter la surveillance aux risques qui peuvent bloquer vos flux."}
            </p>
          </div>

          {opsType && (
            <div className="shrink-0 rounded-2xl border border-background/15 bg-background/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-background/50">
                Activité sélectionnée
              </p>

              <p className="mt-1 text-sm font-semibold">
                {OPS_TYPE_LABEL[opsType]}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* OPS TYPE */}
      <section className="rounded-3xl border border-border bg-card p-6 md:p-7">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5" />

            <h2 className="font-heading text-lg font-bold">
              Type d'opérations
            </h2>
          </div>

          <p className="text-sm text-muted-foreground">
            Votre choix d'onboarding est conservé. Vous pouvez
            le modifier ici si votre activité change.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {OPS_TYPES.map((item) => {
            const Icon = item.icon
            const selected = opsType === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectOpsType(item.id)}
                className={cn(
                  "group relative rounded-2xl border p-4 text-left transition-all",
                  selected
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : "border-border bg-background hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-muted/50"
                )}
              >
                {selected && (
                  <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}

                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    selected
                      ? "bg-background/10"
                      : "bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <p className="mt-4 pr-7 font-semibold">
                  {item.label}
                </p>

                <p
                  className={cn(
                    "mt-1 text-xs leading-5",
                    selected
                      ? "text-background/65"
                      : "text-muted-foreground"
                  )}
                >
                  {item.description}
                </p>
              </button>
            )
          })}
        </div>
      </section>

      {/* NO OPS TYPE */}
      {!opsType && (
        <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>

            <div>
              <h3 className="font-heading font-bold">
                Type d'opérations non sélectionné
              </h3>

              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Sélectionnez votre activité ci-dessus pour
                personnaliser la vue des blocages.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* KPI */}
      {opsType && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Blocages critiques
                </span>

                <CircleAlert className="h-4 w-4 text-destructive" />
              </div>

              <p className="mt-3 font-heading text-3xl font-bold">
                {criticalAlerts.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                À traiter immédiatement
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Situations à surveiller
                </span>

                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>

              <p className="mt-3 font-heading text-3xl font-bold">
                {warningAlerts.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Risques détectés
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Files / retards
                </span>

                <Clock3 className="h-4 w-4 text-accent-foreground" />
              </div>

              <p className="mt-3 font-heading text-3xl font-bold">
                {waitingAlerts.length}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Signaux de ralentissement
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Équipements concernés
                </span>

                <Radar className="h-4 w-4 text-accent-foreground" />
              </div>

              <p className="mt-3 font-heading text-3xl font-bold">
                {equipmentCount}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Actifs avec alertes
              </p>
            </div>
          </div>

          {/* RISK SIGNALS */}
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />

                  <h2 className="font-heading text-lg font-bold">
                    Signaux à surveiller
                  </h2>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  Les principaux événements susceptibles de
                  provoquer un blocage pour{" "}
                  <span className="font-semibold text-foreground">
                    {OPS_TYPE_LABEL[opsType]}
                  </span>
                  .
                </p>
              </div>

              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold text-accent-foreground">
                <Check className="h-3 w-3" />
                Surveillance active
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {meta?.signals.map((signal) => (
                <div
                  key={signal}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <span className="text-sm font-medium">
                    {signal}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* LIVE ALERTS */}
          <section className="rounded-3xl border border-border bg-card">
            <div className="flex flex-col gap-3 p-6 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CircleAlert className="h-5 w-5" />

                  <h2 className="font-heading text-lg font-bold">
                    Blocages détectés
                  </h2>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  Alertes logistiques actuellement disponibles.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-destructive/10 px-3 py-1 text-[11px] font-semibold text-destructive">
                  {criticalAlerts.length} critique
                  {criticalAlerts.length > 1 ? "s" : ""}
                </span>

                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-600">
                  {warningAlerts.length} warning
                  {warningAlerts.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="border-t border-border p-8 text-center text-sm text-muted-foreground">
                Chargement des alertes…
              </div>
            ) : logisticsAlerts.length === 0 ? (
              <div className="border-t border-border p-8">
                <div className="mx-auto flex max-w-lg flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent-foreground">
                    <Check className="h-5 w-5" />
                  </div>

                  <h3 className="mt-4 font-heading text-base font-bold">
                    Aucun blocage détecté
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Aucun signal logistique n'est actuellement
                    remonté par SentrIA. Les nouvelles alertes
                    apparaîtront automatiquement ici.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">
                        Actif
                      </th>

                      <th className="px-6 py-3 font-medium">
                        Situation
                      </th>

                      <th className="px-6 py-3 font-medium">
                        Sévérité
                      </th>

                      <th className="px-6 py-3 font-medium">
                        Date
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {logisticsAlerts
                      .slice()
                      .sort((a, b) => {
                        if (
                          a.severity === "CRITICAL" &&
                          b.severity !== "CRITICAL"
                        ) {
                          return -1
                        }

                        if (
                          a.severity !== "CRITICAL" &&
                          b.severity === "CRITICAL"
                        ) {
                          return 1
                        }

                        return (
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime()
                        )
                      })
                      .slice(0, 20)
                      .map((alert, index) => {
                        const critical =
                          alert.severity === "CRITICAL"

                        const isBlockage =
                          blockageAlerts.includes(alert)

                        return (
                          <tr
                            key={`${alert.equipment}-${alert.date}-${index}`}
                            className="border-b border-border last:border-0 hover:bg-muted/40"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                  <Package className="h-4 w-4" />
                                </div>

                                <span className="font-semibold">
                                  {alert.equipment}
                                </span>
                              </div>
                            </td>

                            <td className="max-w-md px-6 py-4">
                              <div className="flex items-start gap-2">
                                {isBlockage && (
                                  <CircleAlert
                                    className={cn(
                                      "mt-0.5 h-4 w-4 shrink-0",
                                      critical
                                        ? "text-destructive"
                                        : "text-amber-600"
                                    )}
                                  />
                                )}

                                <span className="text-muted-foreground">
                                  {alert.message}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                                  critical
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-amber-500/15 text-amber-600"
                                )}
                              >
                                {alert.severity}
                              </span>
                            </td>

                            <td className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                              {new Date(
                                alert.date
                              ).toLocaleString("fr-FR")}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* HOW IT WORKS */}
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5" />

              <h2 className="font-heading text-lg font-bold">
                Prévention des blocages
              </h2>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              SentrIA utilise votre secteur, votre objectif
              « Éviter les blocages » et votre type d'opérations
              pour contextualiser les alertes.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                  <Radar className="h-4 w-4" />
                </div>

                <p className="mt-4 font-semibold">
                  01 · Détecter
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Les alertes et anomalies sont analysées en
                  continu.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                  <AlertTriangle className="h-4 w-4" />
                </div>

                <p className="mt-4 font-semibold">
                  02 · Prioriser
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Les risques de blocage sont classés selon leur
                  urgence.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                  <Shield className="h-4 w-4" />
                </div>

                <p className="mt-4 font-semibold">
                  03 · Agir
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Les situations critiques sont mises en avant
                  pour permettre une intervention rapide.
                </p>
              </div>
            </div>
          </section>

          {/* BACK */}
          <div className="flex justify-center pb-4">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au dashboard
            </button>
          </div>
        </>
      )}
    </div>
  )
}
