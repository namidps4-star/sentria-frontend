"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Anchor,
  ArrowLeft,
  BarChart3,
  Boxes,
  Clock3,
  Container,
  Gauge,
  Snowflake,
  Truck,
  Warehouse,
  Wrench,
  AlertTriangle,
} from "lucide-react"

const API = "https://sentria-8btn.onrender.com"

const OPS_TYPE_LABEL: Record<string, string> = {
  port: "Port & conteneurs",
  entrepot: "Entrepôt & manutention",
  transport: "Transport & distribution",
  expedition: "Préparation & expédition",
  froid: "Chaîne du froid",
  multi: "Plusieurs activités",
}

type Alert = {
  id?: string | number
  asset_id?: string
  message?: string
  sector?: string
  severity?: string
  created_at?: string
  timestamp?: string
}

type Props = {
  onBack?: () => void
}

const OPS_META: Record<
  string,
  {
    icon: typeof Anchor
    cards: {
      title: string
      value: string
      subtitle: string
      icon: typeof Anchor
    }[]
  }
> = {
  port: {
    icon: Anchor,
    cards: [
      {
        title: "Conteneurs bloqués",
        value: "6",
        subtitle: "Arrêt immédiat",
        icon: Container,
      },
      {
        title: "Attente au quai",
        value: "5",
        subtitle: "File conteneurs",
        icon: Clock3,
      },
      {
        title: "Grues & engins actifs",
        value: "491",
        subtitle: "Terminal",
        icon: Gauge,
      },
      {
        title: "Alertes hydrauliques",
        value: "5",
        subtitle: "Grues",
        icon: Wrench,
      },
    ],
  },

  entrepot: {
    icon: Warehouse,
    cards: [
      {
        title: "Blocages entrepôt",
        value: "6",
        subtitle: "À traiter",
        icon: Boxes,
      },
      {
        title: "Attente manutention",
        value: "5",
        subtitle: "File active",
        icon: Clock3,
      },
      {
        title: "Équipements actifs",
        value: "491",
        subtitle: "Opérations",
        icon: Gauge,
      },
      {
        title: "Alertes maintenance",
        value: "5",
        subtitle: "À surveiller",
        icon: Wrench,
      },
    ],
  },

  transport: {
    icon: Truck,
    cards: [
      {
        title: "Livraisons bloquées",
        value: "6",
        subtitle: "Action immédiate",
        icon: Truck,
      },
      {
        title: "Temps d'attente",
        value: "5",
        subtitle: "Flotte",
        icon: Clock3,
      },
      {
        title: "Véhicules actifs",
        value: "491",
        subtitle: "En circulation",
        icon: Gauge,
      },
      {
        title: "Alertes flotte",
        value: "5",
        subtitle: "À surveiller",
        icon: AlertTriangle,
      },
    ],
  },

  expedition: {
    icon: Boxes,
    cards: [
      {
        title: "Commandes bloquées",
        value: "6",
        subtitle: "À traiter",
        icon: Boxes,
      },
      {
        title: "Attente expédition",
        value: "5",
        subtitle: "File active",
        icon: Clock3,
      },
      {
        title: "Postes actifs",
        value: "491",
        subtitle: "Préparation",
        icon: Gauge,
      },
      {
        title: "Alertes opérationnelles",
        value: "5",
        subtitle: "À surveiller",
        icon: AlertTriangle,
      },
    ],
  },

  froid: {
    icon: Snowflake,
    cards: [
      {
        title: "Alertes température",
        value: "6",
        subtitle: "Action immédiate",
        icon: Snowflake,
      },
      {
        title: "Attente quai",
        value: "5",
        subtitle: "Chaîne du froid",
        icon: Clock3,
      },
      {
        title: "Équipements actifs",
        value: "491",
        subtitle: "Installations",
        icon: Gauge,
      },
      {
        title: "Alertes maintenance",
        value: "5",
        subtitle: "À surveiller",
        icon: Wrench,
      },
    ],
  },

  multi: {
    icon: Boxes,
    cards: [
      {
        title: "Blocages critiques",
        value: "6",
        subtitle: "Action immédiate",
        icon: Boxes,
      },
      {
        title: "Temps d'attente",
        value: "5",
        subtitle: "Opérations",
        icon: Clock3,
      },
      {
        title: "Équipements actifs",
        value: "491",
        subtitle: "Toutes activités",
        icon: Gauge,
      },
      {
        title: "Alertes actives",
        value: "5",
        subtitle: "À surveiller",
        icon: AlertTriangle,
      },
    ],
  },
}

export function LogisticsBlockagesView({ onBack }: Props) {
  const [opsType, setOpsType] = useState("port")
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedOpsType = localStorage.getItem("sentria_ops_type")

    if (storedOpsType && OPS_TYPE_LABEL[storedOpsType]) {
      setOpsType(storedOpsType)
    }

    async function loadAlerts() {
      try {
        const response = await fetch(`${API}/alerts`)

        if (!response.ok) {
          throw new Error("Impossible de récupérer les alertes")
        }

        const data = await response.json()

        if (Array.isArray(data)) {
          setAlerts(data)
        } else if (Array.isArray(data?.alerts)) {
          setAlerts(data.alerts)
        }
      } catch {
        setAlerts([])
      } finally {
        setLoading(false)
      }
    }

    loadAlerts()
  }, [])

  const meta = useMemo(() => {
    return OPS_META[opsType] || OPS_META.port
  }, [opsType])

  const Icon = meta.icon

  const displayedAlerts = alerts
    .filter((alert) => {
      if (!alert.sector) return true
      return alert.sector === "logistics" || alert.sector === "logistique"
    })
    .slice(0, 10)

  function goBack() {
    if (onBack) {
      onBack()
      return
    }

    window.history.back()
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <button
          onClick={goBack}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>

        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>

              <span className="text-sm font-medium text-primary">
                Logistique
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight">
              Vue globale de vos opérations critiques
            </h1>

            <p className="mt-2 text-muted-foreground">
              Surveillance des blocages et des opérations logistiques en temps
              réel.
            </p>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3 text-right shadow-sm">
            <p className="text-xs text-muted-foreground">Vue adaptée</p>
            <p className="mt-1 font-semibold">
              {OPS_TYPE_LABEL[opsType] || "Port & conteneurs"}
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {meta.cards.map((card) => {
            const CardIcon = card.icon

            return (
              <div
                key={card.title}
                className="rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {card.title}
                    </p>

                    <p className="mt-3 text-3xl font-semibold tracking-tight">
                      {card.value}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.subtitle}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <CardIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Activité quai et conteneurs · 7 jours
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Évolution des opérations critiques.
                </p>
              </div>

              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex h-64 items-end gap-3">
              {[42, 58, 46, 72, 61, 84, 67, 92, 74, 88, 69, 78].map(
                (height, index) => (
                  <div
                    key={index}
                    className="flex flex-1 items-end"
                  >
                    <div
                      className="w-full rounded-t-md bg-primary/20"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                )
              )}
            </div>

            <div className="mt-4 flex justify-between text-xs text-muted-foreground">
              <span>J-6</span>
              <span>J-5</span>
              <span>J-4</span>
              <span>J-3</span>
              <span>J-2</span>
              <span>J-1</span>
              <span>Aujourd'hui</span>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">Répartition</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Principaux indicateurs opérationnels.
              </p>
            </div>

            <div className="space-y-5">
              {[
                ["Cycles grue", "38%"],
                ["Attente quai", "27%"],
                ["Pression", "21%"],
                ["Carburant", "14%"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: value }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Alertes · Logistique
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Alertes liées à vos opérations logistiques.
              </p>
            </div>

            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Chargement des alertes...
            </div>
          ) : displayedAlerts.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucune alerte disponible.
            </div>
          ) : (
            <div className="divide-y">
              {displayedAlerts.map((alert, index) => (
                <div
                  key={alert.id ?? `${alert.asset_id}-${index}`}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {alert.asset_id || "Actif logistique"}
                    </p>

                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {alert.message || "Alerte opérationnelle"}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                    {alert.severity || "WARNING"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}