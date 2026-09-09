"use client"

import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Anchor,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  DoorOpen,
  Factory,
  FileWarning,
  MapPin,
  PackageCheck,
  PackageOpen,
  Radar,
  Send,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Truck,
  UsersRound,
  Warehouse,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

type PrimitiveId =
  | "fournisseurs"
  | "stock"
  | "entrepot"
  | "transport"
  | "douane"
  | "client"
  | "arrivee"
  | "quai"
  | "cour"
  | "enlevement"
  | "reception"
  | "stockage"
  | "preparation"
  | "expedition"
  | "commande"
  | "emballage"
  | "depart"
  | "stockageFroid"
  | "transportRefrigere"
  | "livraison"

type StageStatus = "good" | "watch" | "risk"
type DataState = "template" | "live"

interface PrimitiveDef {
  name: string
  icon: LucideIcon
  signalDna: string[]
}

const PRIMITIVES: Record<PrimitiveId, PrimitiveDef> = {
  fournisseurs: {
    name: "Fournisseurs",
    icon: Factory,
    signalDna: ["Fiabilité fournisseur", "Délai de production"],
  },
  stock: {
    name: "Stock",
    icon: Boxes,
    signalDna: ["Niveau de stock", "Rotation"],
  },
  entrepot: {
    name: "Entrepôt",
    icon: Warehouse,
    signalDna: ["Taux d'occupation", "Capacité de traitement"],
  },
  transport: {
    name: "Transport",
    icon: Truck,
    signalDna: ["Capacité transporteur", "Retards constatés"],
  },
  douane: {
    name: "Douane",
    icon: FileWarning,
    signalDna: ["Complétude documentaire", "Délai de dédouanement"],
  },
  client: {
    name: "Client",
    icon: UsersRound,
    signalDna: ["Délai promis", "Commandes prioritaires"],
  },
  arrivee: {
    name: "Arrivée",
    icon: Anchor,
    signalDna: ["ETA navire", "Fenêtre de déchargement"],
  },
  quai: {
    name: "Quai",
    icon: MapPin,
    signalDna: ["Disponibilité quai", "Temps d'attente"],
  },
  cour: {
    name: "Cour",
    icon: PackageOpen,
    signalDna: ["Temps d'immobilisation", "Frais de stockage cumulés"],
  },
  enlevement: {
    name: "Enlèvement",
    icon: Send,
    signalDna: ["Créneaux disponibles", "Délai avant surestarie"],
  },
  reception: {
    name: "Réception",
    icon: ClipboardCheck,
    signalDna: ["Conformité livraison", "Délai de contrôle"],
  },
  stockage: {
    name: "Stockage",
    icon: Boxes,
    signalDna: ["Taux d'occupation", "Zones saturées"],
  },
  preparation: {
    name: "Préparation",
    icon: ClipboardList,
    signalDna: ["Temps de picking", "Taux d'erreur"],
  },
  expedition: {
    name: "Expédition",
    icon: Send,
    signalDna: ["Créneaux transporteur", "Volume à expédier"],
  },
  commande: {
    name: "Commande",
    icon: ClipboardCheck,
    signalDna: ["Volume entrant", "Priorité client"],
  },
  emballage: {
    name: "Emballage",
    icon: PackageOpen,
    signalDna: ["Capacité ligne", "Taux de rebut"],
  },
  depart: {
    name: "Départ",
    icon: Send,
    signalDna: ["Créneaux de départ", "Taux de remplissage"],
  },
  stockageFroid: {
    name: "Stockage froid",
    icon: Snowflake,
    signalDna: ["Écart de température", "Durée hors plage"],
  },
  transportRefrigere: {
    name: "Transport réfrigéré",
    icon: Thermometer,
    signalDna: ["Continuité du froid", "Alertes capteur IoT"],
  },
  livraison: {
    name: "Livraison",
    icon: DoorOpen,
    signalDna: ["Fenêtre de livraison", "Produits sensibles concernés"],
  },
}

export type OpsType =
  | "port"
  | "entrepot"
  | "transport"
  | "expedition"
  | "froid"
  | "multi"

interface Signal {
  label: string
  value: string
  width: string
  tone: "risk" | "watch"
}

interface ProjectionStep {
  time: string
  detail: string
  tone?: "amber" | "rose"
}

interface Breakpoint {
  primitiveId: PrimitiveId
  title: string
  risk: number
  impact: string
  tone: "watch" | "risk"
}

interface Flagship {
  title: string
  subtitle: string
  riskPercent: number
  globalRisk: number
  signals: [Signal, Signal, Signal]
  narrative: string
  projection: ProjectionStep[]
  costEstimate: string
  recommendation: {
    title: string
    detail: string
    beforeRisk: number
    afterRisk: number
  }
  footerNote: string
}

interface OpsTypeConfig {
  chain: PrimitiveId[]
  stageStatus: Partial<Record<PrimitiveId, StageStatus>>
  flagship: Flagship
  breakpoints: Breakpoint[]
}

const OPS_TYPE_CONFIGS: Record<Exclude<OpsType, "multi">, OpsTypeConfig> = {
  transport: {
    chain: [
      "fournisseurs",
      "stock",
      "entrepot",
      "transport",
      "douane",
      "client",
    ],
    stageStatus: {
      entrepot: "watch",
      transport: "risk",
      douane: "watch",
    },
    flagship: {
      title: "Blocage probable dans 48 h",
      subtitle: "Transport · France → Espagne",
      riskPercent: 68,
      globalRisk: 34,
      signals: [
        {
          label: "Retards récents",
          value: "+23%",
          width: "82%",
          tone: "risk",
        },
        {
          label: "Capacité transport",
          value: "−14%",
          width: "42%",
          tone: "watch",
        },
        {
          label: "Volume demain",
          value: "+31%",
          width: "91%",
          tone: "risk",
        },
      ],
      narrative:
        "Ces signaux convergent vers une surcharge probable demain matin. 11 commandes prioritaires sont concernées.",
      projection: [
        {
          time: "Maintenant",
          detail: "flux sous tension",
        },
        {
          time: "+24 h",
          detail: "surcharge",
          tone: "amber",
        },
        {
          time: "+48 h",
          detail: "17 commandes impactées",
          tone: "rose",
        },
      ],
      costEstimate: "4 800 €",
      recommendation: {
        title: "Réallouer 6 expéditions au transporteur B.",
        detail:
          "Je protégerais d'abord les expéditions critiques. Le vrai point de rupture est le transport, pas le stock.",
        beforeRisk: 68,
        afterRisk: 21,
      },
      footerNote:
        "17 commandes peuvent être protégées en agissant avant demain matin.",
    },
    breakpoints: [
      {
        primitiveId: "transport",
        title: "Retard probable",
        risk: 68,
        impact: "17 commandes",
        tone: "risk",
      },
      {
        primitiveId: "stock",
        title: "Stock de sécurité atteint",
        risk: 42,
        impact: "41 h restantes",
        tone: "watch",
      },
      {
        primitiveId: "douane",
        title: "Documents incomplets",
        risk: 31,
        impact: "3 expéditions",
        tone: "watch",
      },
    ],
  },

  port: {
    chain: ["arrivee", "quai", "douane", "cour", "enlevement"],
    stageStatus: {
      quai: "watch",
      cour: "risk",
      douane: "watch",
    },
    flagship: {
      title: "Conteneur immobilisé en cour",
      subtitle: "Port & conteneurs · Import Asie → Le Havre",
      riskPercent: 71,
      globalRisk: 38,
      signals: [
        {
          label: "Temps d'immobilisation",
          value: "96 h",
          width: "88%",
          tone: "risk",
        },
        {
          label: "Frais de stockage cumulés",
          value: "+540 €",
          width: "65%",
          tone: "watch",
        },
        {
          label: "Créneaux d'enlèvement dispo",
          value: "−30%",
          width: "35%",
          tone: "watch",
        },
      ],
      narrative:
        "Le conteneur MSKU-2201 approche du seuil de surestarie. 3 commandes clients en dépendent directement.",
      projection: [
        {
          time: "Maintenant",
          detail: "conteneur en cour, non enlevé",
        },
        {
          time: "+24 h",
          detail: "seuil de surestarie atteint",
          tone: "amber",
        },
        {
          time: "+48 h",
          detail: "facturation surestarie déclenchée",
          tone: "rose",
        },
      ],
      costEstimate: "1 200 €",
      recommendation: {
        title: "Réserver un créneau d'enlèvement prioritaire aujourd'hui.",
        detail:
          "Le dédouanement est déjà validé — le blocage est purement logistique, sur la cour.",
        beforeRisk: 71,
        afterRisk: 18,
      },
      footerNote:
        "3 commandes clients peuvent être protégées en enlevant le conteneur avant demain.",
    },
    breakpoints: [
      {
        primitiveId: "cour",
        title: "Conteneur immobile",
        risk: 71,
        impact: "1 conteneur",
        tone: "risk",
      },
      {
        primitiveId: "douane",
        title: "Dossier en attente de validation",
        risk: 34,
        impact: "2 expéditions",
        tone: "watch",
      },
      {
        primitiveId: "quai",
        title: "Créneau de déchargement serré",
        risk: 28,
        impact: "1 navire",
        tone: "watch",
      },
    ],
  },

  entrepot: {
    chain: ["reception", "stockage", "preparation", "expedition"],
    stageStatus: {
      stockage: "risk",
      preparation: "watch",
    },
    flagship: {
      title: "Zone de picking saturée",
      subtitle: "Entrepôt & stockage · Zone B",
      riskPercent: 64,
      globalRisk: 33,
      signals: [
        {
          label: "Taux d'occupation zone B",
          value: "+27%",
          width: "86%",
          tone: "risk",
        },
        {
          label: "Temps de picking moyen",
          value: "+18%",
          width: "58%",
          tone: "watch",
        },
        {
          label: "Commandes en attente",
          value: "64",
          width: "70%",
          tone: "watch",
        },
      ],
      narrative:
        "La saturation de la zone B ralentit la préparation. 9 commandes du jour risquent de dépasser leur créneau d'expédition.",
      projection: [
        {
          time: "Maintenant",
          detail: "zone B au-delà de sa capacité cible",
        },
        {
          time: "+12 h",
          detail: "file de préparation allongée",
          tone: "amber",
        },
        {
          time: "+24 h",
          detail: "expéditions du jour manquées",
          tone: "rose",
        },
      ],
      costEstimate: "2 100 €",
      recommendation: {
        title: "Basculer 40% du picking de la zone B vers la zone A.",
        detail:
          "La zone A a de la capacité disponible ce créneau — c'est la répartition, pas l'effectif, qui bloque.",
        beforeRisk: 64,
        afterRisk: 19,
      },
      footerNote:
        "9 commandes peuvent être expédiées à l'heure en rééquilibrant les zones.",
    },
    breakpoints: [
      {
        primitiveId: "stockage",
        title: "Zone de picking saturée",
        risk: 64,
        impact: "9 commandes",
        tone: "risk",
      },
      {
        primitiveId: "preparation",
        title: "Temps de picking en hausse",
        risk: 39,
        impact: "64 commandes",
        tone: "watch",
      },
      {
        primitiveId: "expedition",
        title: "Créneau transporteur serré",
        risk: 26,
        impact: "2 expéditions",
        tone: "watch",
      },
    ],
  },

  expedition: {
    chain: ["commande", "preparation", "emballage", "depart"],
    stageStatus: {
      preparation: "risk",
      emballage: "watch",
    },
    flagship: {
      title: "Délai de préparation qui dérape",
      subtitle: "Expédition & envoi · Ligne 2",
      riskPercent: 59,
      globalRisk: 30,
      signals: [
        {
          label: "Retard de préparation",
          value: "+34%",
          width: "80%",
          tone: "risk",
        },
        {
          label: "Taux de rebut emballage",
          value: "+9%",
          width: "40%",
          tone: "watch",
        },
        {
          label: "Commandes urgentes",
          value: "22",
          width: "55%",
          tone: "watch",
        },
      ],
      narrative:
        "Le retard s'accumule depuis ce matin sur la ligne 2. 22 commandes urgentes risquent de manquer le départ de 17h.",
      projection: [
        {
          time: "Maintenant",
          detail: "ligne 2 en retard de 40 min",
        },
        {
          time: "+3 h",
          detail: "file d'attente avant emballage",
          tone: "amber",
        },
        {
          time: "+6 h",
          detail: "départ de 17h manqué",
          tone: "rose",
        },
      ],
      costEstimate: "1 650 €",
      recommendation: {
        title: "Prioriser les 22 commandes urgentes sur la ligne 1.",
        detail:
          "La ligne 1 a un créneau libre maintenant — retarder les commandes non urgentes évite de manquer le départ.",
        beforeRisk: 59,
        afterRisk: 16,
      },
      footerNote:
        "22 commandes urgentes peuvent partir à l'heure en priorisant la ligne 1.",
    },
    breakpoints: [
      {
        primitiveId: "preparation",
        title: "Retard de préparation",
        risk: 59,
        impact: "22 commandes",
        tone: "risk",
      },
      {
        primitiveId: "emballage",
        title: "Taux de rebut en hausse",
        risk: 33,
        impact: "1 ligne",
        tone: "watch",
      },
      {
        primitiveId: "depart",
        title: "Créneau de départ serré",
        risk: 24,
        impact: "1 transporteur",
        tone: "watch",
      },
    ],
  },

  froid: {
    chain: [
      "reception",
      "stockageFroid",
      "transportRefrigere",
      "livraison",
    ],
    stageStatus: {
      transportRefrigere: "risk",
      stockageFroid: "watch",
    },
    flagship: {
      title: "Rupture de chaîne du froid détectée",
      subtitle: "Chaîne du froid · Camion réfrigéré #12",
      riskPercent: 76,
      globalRisk: 41,
      signals: [
        {
          label: "Écart de température",
          value: "+4.2°C",
          width: "90%",
          tone: "risk",
        },
        {
          label: "Durée hors plage",
          value: "38 min",
          width: "62%",
          tone: "watch",
        },
        {
          label: "Produits sensibles concernés",
          value: "120 kg",
          width: "70%",
          tone: "risk",
        },
      ],
      narrative:
        "Le capteur IoT du camion #12 signale une sortie de plage de température depuis 38 minutes. 120 kg de produits sensibles sont concernés.",
      projection: [
        {
          time: "Maintenant",
          detail: "écart de température en cours",
        },
        {
          time: "+30 min",
          detail: "seuil critique produit atteint",
          tone: "amber",
        },
        {
          time: "+1 h",
          detail: "lot non conforme à la livraison",
          tone: "rose",
        },
      ],
      costEstimate: "3 400 €",
      recommendation: {
        title:
          "Dérouter le camion #12 vers le point de contrôle le plus proche.",
        detail:
          "Le groupe froid montre un signe de défaillance — un contrôle immédiat évite la perte du lot.",
        beforeRisk: 76,
        afterRisk: 22,
      },
      footerNote:
        "120 kg de produits sensibles peuvent être sauvés en agissant dans les 30 prochaines minutes.",
    },
    breakpoints: [
      {
        primitiveId: "transportRefrigere",
        title: "Écart de température",
        risk: 76,
        impact: "120 kg",
        tone: "risk",
      },
      {
        primitiveId: "stockageFroid",
        title: "Durée hors plage en hausse",
        risk: 44,
        impact: "1 camion",
        tone: "watch",
      },
      {
        primitiveId: "reception",
        title: "Contrôle à la réception requis",
        risk: 22,
        impact: "1 lot",
        tone: "watch",
      },
    ],
  },
}

function composeMultiConfig(
  selected: Exclude<OpsType, "multi">[],
): OpsTypeConfig {
  if (selected.length === 0) return OPS_TYPE_CONFIGS.transport

  const chain: PrimitiveId[] = []
  const stageStatus: Partial<Record<PrimitiveId, StageStatus>> = {}

  for (const type of selected) {
    const cfg = OPS_TYPE_CONFIGS[type]

    for (const id of cfg.chain) {
      if (!chain.includes(id)) chain.push(id)
    }

    Object.assign(stageStatus, cfg.stageStatus)
  }

  const flagshipType = selected.reduce(
    (worst, type) =>
      OPS_TYPE_CONFIGS[type].flagship.riskPercent >
      OPS_TYPE_CONFIGS[worst].flagship.riskPercent
        ? type
        : worst,
    selected[0],
  )

  const breakpointMap = new Map<PrimitiveId, Breakpoint>()

  for (const type of selected) {
    for (const bp of OPS_TYPE_CONFIGS[type].breakpoints) {
      const existing = breakpointMap.get(bp.primitiveId)

      if (!existing || bp.risk > existing.risk) {
        breakpointMap.set(bp.primitiveId, bp)
      }
    }
  }

  const breakpoints = [...breakpointMap.values()]
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 3)

  return {
    chain,
    stageStatus,
    flagship: OPS_TYPE_CONFIGS[flagshipType].flagship,
    breakpoints,
  }
}

const stateStyle = {
  good: {
    dot: "bg-[#a7ff00]",
    text: "text-[#a7ff00]",
    ring: "border-[#a7ff00]/25 bg-[#a7ff00]/[0.08]",
  },
  watch: {
    dot: "bg-[#ffb648]",
    text: "text-[#ffb648]",
    ring: "border-[#ffb648]/25 bg-[#ffb648]/[0.08]",
  },
  risk: {
    dot: "bg-[#ff5d5d]",
    text: "text-[#ff6969]",
    ring: "border-[#ff5d5d]/25 bg-[#ff5d5d]/[0.08]",
  },
} as const

const stateLabel: Record<StageStatus, string> = {
  good: "Fluide",
  watch: "Sous tension",
  risk: "Rupture",
}

function PortYardPreview({
  containerRef,
  hoursImmobile,
}: {
  containerRef: string
  hoursImmobile: string
}) {
  const cols = 7
  const rows = 3
  const total = rows * cols
  const blockedIndex = 10

  const watchIndexes = useMemo(() => [2, 5, 16], [])

  const [statuses, setStatuses] = useState<
    ("idle" | "good" | "watch" | "risk")[]
  >(() => Array(total).fill("idle"))

  const [showTag, setShowTag] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    for (let i = 0; i < total; i++) {
      timers.push(
        setTimeout(() => {
          setStatuses((current) => {
            const next = [...current]
            next[i] = "good"
            return next
          })
        }, 20 * i),
      )
    }

    const base = total * 20

    timers.push(
      setTimeout(() => {
        setStatuses((current) => {
          const next = [...current]

          watchIndexes.forEach((i) => {
            next[i] = "watch"
          })

          return next
        })
      }, base + 350),
    )

    timers.push(
      setTimeout(() => {
        setStatuses((current) => {
          const next = [...current]
          next[blockedIndex] = "risk"
          return next
        })
      }, base + 1100),
    )

    timers.push(
      setTimeout(() => setShowTag(true), base + 1500),
    )

    return () => timers.forEach(clearTimeout)
  }, [watchIndexes])

  const toneClass = {
    idle: "",
    good: "text-[#a7ff00]",
    watch: "text-[#ffb648]",
    risk: "text-[#ff5d5d]",
  } as const

  const faceClass = {
    idle: "border-white/0 bg-transparent",
    good: "border-[#a7ff00]/20 bg-[#a7ff00]/[0.08]",
    watch: "border-[#ffb648]/45 bg-[#ffb648]/[0.15]",
    risk: "border-[#ff5d5d] bg-[#ff5d5d]/[0.28]",
  } as const

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a121a]">
      <style>{`
        @keyframes sentria-crate-settle {
          from {
            transform: translateZ(-50px) rotateX(15deg);
            opacity: 0;
          }
          to {
            transform: translateZ(0) rotateX(0deg);
            opacity: 1;
          }
        }

        @keyframes sentria-yard-breathe {
          0%, 100% {
            transform: rotateX(52deg) rotateZ(-6deg) translateY(0);
          }
          50% {
            transform: rotateX(52deg) rotateZ(-6deg) translateY(-3px);
          }
        }

        @keyframes sentria-crate-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 currentColor;
          }
          50% {
            box-shadow: 0 0 0 7px transparent;
          }
        }
      `}</style>

      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
          Vue cour · en direct
        </p>

        <div className="flex items-center gap-3 text-[9px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#a7ff00]" />
            Fluide
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffb648]" />
            Sous tension
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff5d5d]" />
            Rupture
          </span>
        </div>
      </div>

      <div className="relative px-6 py-8 [perspective:1300px]">
        <div
          className="mx-auto grid w-fit gap-2.5 [transform-style:preserve-3d]"
          style={{
            gridTemplateColumns: `repeat(${cols}, 38px)`,
            animation:
              "sentria-yard-breathe 6.5s ease-in-out infinite",
          }}
        >
          {statuses.map((status, i) => {
            const isIdle = status === "idle"
            const isRisk = status === "risk"

            return (
              <div
                key={i}
                className={cn(
                  "relative h-7 w-9",
                  toneClass[status],
                )}
                style={{
                  transformStyle: "preserve-3d",
                  opacity: isIdle ? 0 : 1,
                  animation: isIdle
                    ? undefined
                    : "sentria-crate-settle 0.35s ease-out forwards",
                  transform: isRisk
                    ? "translateZ(12px)"
                    : "translateZ(0)",
                  transition: "transform 0.4s ease-out",
                }}
              >
                <div
                  className={cn(
                    "absolute inset-0 rounded-[3px] border",
                    faceClass[status],
                  )}
                  style={{
                    transform: "translateZ(7px)",
                    animation:
                      status === "risk"
                        ? "sentria-crate-pulse 1.3s ease-out infinite"
                        : status === "watch"
                          ? "sentria-crate-pulse 1.7s ease-out infinite"
                          : undefined,
                  }}
                />

                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-1.5 rounded-b-[3px]",
                    status === "risk"
                      ? "bg-[#ff5d5d]/70"
                      : status === "watch"
                        ? "bg-[#ffb648]/60"
                        : status === "good"
                          ? "bg-[#a7ff00]/40"
                          : "bg-transparent",
                  )}
                  style={{
                    transform:
                      "rotateX(-90deg) translateZ(-3.5px)",
                    transformOrigin: "bottom",
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div
        className={cn(
          "mx-4 mb-4 flex items-start gap-3 rounded-xl border border-l-2 border-white/[0.08] border-l-[#ff5d5d] bg-[#111b25] px-3.5 py-3 transition-all duration-500",
          showTag
            ? "translate-y-0 opacity-100"
            : "translate-y-1 opacity-0",
        )}
      >
        <span className="whitespace-nowrap font-mono text-[10px] text-white/40">
          {containerRef}
        </span>

        <p className="text-xs leading-5 text-white/65">
          Immobile depuis{" "}
          <span className="font-semibold text-[#ff6969]">
            {hoursImmobile}
          </span>
          . Point de rupture identifié sur cette cour.
        </p>
      </div>
    </div>
  )
}

interface LogisticsBlockagesViewProps {
  opsType?: OpsType
  selectedOpsTypesForMulti?: Exclude<OpsType, "multi">[]
  liveStageIds?: PrimitiveId[]
}

export function LogisticsBlockagesView({
  opsType = "transport",
  selectedOpsTypesForMulti = [],
  liveStageIds = [],
}: LogisticsBlockagesViewProps) {
  const config =
    opsType === "multi"
      ? composeMultiConfig(selectedOpsTypesForMulti)
      : OPS_TYPE_CONFIGS[opsType]

  const stages = config.chain.map((id) => ({
    id,
    ...PRIMITIVES[id],
    status:
      config.stageStatus[id] ?? ("good" as StageStatus),
    dataState: (
      liveStageIds.includes(id) ? "live" : "template"
    ) as DataState,
  }))

  const defaultSelected =
    stages.find((s) => s.status === "risk")?.id ??
    stages[0].id

  const [selected, setSelected] =
    useState<PrimitiveId>(defaultSelected)

  const [applied, setApplied] = useState(false)

  const [expandedBreakpoint, setExpandedBreakpoint] =
    useState<PrimitiveId | null>(null)

  useEffect(() => {
    setSelected(defaultSelected)
    setApplied(false)
    setExpandedBreakpoint(null)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opsType,
    JSON.stringify(selectedOpsTypesForMulti),
  ])

  const selectedStage =
    stages.find((stage) => stage.id === selected) ??
    stages[0]

  const SelectedIcon = selectedStage.icon
  const { flagship } = config

  const riskLabel =
    flagship.globalRisk >= 50
      ? "Critique"
      : flagship.globalRisk >= 30
        ? "Sous tension"
        : "Sous contrôle"

  const focusMessage =
    selectedStage.status === "risk"
      ? `${selectedStage.name} est votre point de rupture probable.`
      : selectedStage.status === "watch"
        ? `${selectedStage.name} est sous tension, à surveiller.`
        : `${selectedStage.name} est stable. SentrIA continue de le surveiller.`

  return (
    <div className="relative mx-auto max-w-[1500px] overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#071019] text-white shadow-[0_30px_90px_rgba(0,0,0,0.25)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(167,255,0,0.09),transparent_26%),radial-gradient(circle_at_0%_30%,rgba(36,91,128,0.08),transparent_30%)]" />

      <div className="relative p-4 sm:p-6 lg:p-8">
        <section>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#a7ff00]/20 bg-[#a7ff00]/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a7ff00]">
                <Radar className="h-3.5 w-3.5" />
                SentrIA Flow
              </div>

              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl lg:text-[46px] lg:leading-[1.05]">
                Votre flux, avant qu&apos;il ne casse.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
                Suivez la santé de chaque étape. SentrIA vous montre le prochain point de rupture et la décision qui protège vos opérations.
              </p>
            </div>

            <div className="flex w-full max-w-sm items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#0c151e] px-4 py-3.5 shadow-[0_15px_40px_rgba(0,0,0,0.16)] xl:w-auto">
              <div
                className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(#a7ff00 0deg ${
                    (flagship.globalRisk / 100) * 360
                  }deg, rgba(255,255,255,0.08) ${
                    (flagship.globalRisk / 100) * 360
                  }deg 360deg)`,
                }}
              >
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[#0c151e] text-base font-bold text-white">
                  {flagship.globalRisk}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
                  Risque global
                </p>

                <p className="mt-1 text-sm font-semibold text-white">
                  {riskLabel}{" "}
                  <span className="font-normal text-white/30">
                    / 100
                  </span>
                </p>
              </div>

              <div className="ml-auto hidden h-8 w-8 place-items-center rounded-full border border-white/[0.08] text-white/40 sm:grid">
                <ArrowRight className="h-3.5 w-3.5 -rotate-45" />
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto pb-2">
            <div className="flex min-w-[760px] items-start gap-1 px-1">
              {stages.map((stage, index) => {
                const Icon = stage.icon
                const style = stateStyle[stage.status]
                const isSelected = selected === stage.id
                const isTemplate =
                  stage.dataState === "template"

                return (
                  <div
                    className="flex min-w-0 flex-1 items-start"
                    key={stage.id}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(stage.id)}
                      aria-pressed={isSelected}
                      className="group flex min-w-[92px] flex-1 cursor-pointer flex-col items-center gap-2 text-center"
                    >
                      <span
                        className={cn(
                          "relative grid h-12 w-12 place-items-center rounded-2xl border transition-all duration-200",
                          style.ring,
                          isSelected &&
                            "scale-110 border-white/50 bg-white/[0.07] shadow-[0_0_30px_rgba(167,255,0,0.08)]",
                          isTemplate &&
                            "border-dashed opacity-70",
                        )}
                      >
                        {isSelected && (
                          <span className="absolute -inset-1 rounded-[18px] border border-[#a7ff00]/20" />
                        )}

                        <Icon
                          className={cn(
                            "relative h-5 w-5",
                            style.text,
                          )}
                          strokeWidth={1.7}
                        />
                      </span>

                      <span className="text-[11px] font-semibold text-white/80">
                        {stage.name}
                      </span>

                      <span className="flex items-center gap-1.5 text-[9px] text-white/35">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            style.dot,
                          )}
                        />
                        {stateLabel[stage.status]}
                      </span>

                      {isTemplate && (
                        <span className="flex items-center gap-1 text-[8px] text-white/20">
                          <Clock3 className="h-2.5 w-2.5" />
                          à confirmer
                        </span>
                      )}
                    </button>

                    {index < stages.length - 1 && (
                      <div className="mt-6 h-px flex-1 bg-gradient-to-r from-white/10 via-white/[0.06] to-white/10">
                        <div
                          className={cn(
                            "h-px w-full",
                            stage.status === "risk"
                              ? "bg-gradient-to-r from-[#ff5d5d]/60 to-[#ffb648]/40"
                              : "bg-[#a7ff00]/20",
                          )}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#0c151e] px-4 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#a7ff00] text-[#0b1308] shadow-[0_0_24px_rgba(167,255,0,0.18)]">
              <SelectedIcon className="h-4 w-4" />
            </span>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/85">
                {focusMessage}
              </p>

              <p className="mt-0.5 text-[10px] text-white/30">
                Source de données :{" "}
                {selectedStage.dataState === "live"
                  ? "connectée"
                  : "modèle à confirmer"}
              </p>
            </div>

            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-white/25" />
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.72fr)]">
          <section className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0b141d] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="border-b border-white/[0.07] p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ff5d5d]/15 bg-[#ff5d5d]/[0.06] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.17em] text-[#ff7373]">
                    <CircleAlert className="h-3.5 w-3.5" />
                    Avant le blocage
                  </div>

                  <h3 className="text-2xl font-semibold tracking-[-0.025em] text-white sm:text-[28px]">
                    {flagship.title}
                  </h3>

                  <p className="mt-1 text-xs text-white/35">
                    {flagship.subtitle}
                  </p>
                </div>

                <span className="rounded-full border border-[#ff5d5d]/20 bg-[#ff5d5d]/[0.08] px-3.5 py-2 text-xs font-bold text-[#ff7474]">
                  {flagship.riskPercent}% de risque
                </span>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {flagship.signals.map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-2xl border border-white/[0.06] bg-[#101b25] p-4"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-white/35">
                        {signal.label}
                      </span>

                      <span className="text-sm font-bold text-white">
                        {signal.value}
                      </span>
                    </div>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          signal.tone === "risk"
                            ? "bg-[#ff5d5d]"
                            : "bg-[#ffb648]",
                        )}
                        style={{
                          width: signal.width,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-5 rounded-2xl border border-white/[0.05] bg-white/[0.025] px-4 py-3.5 text-sm leading-6 text-white/45">
                {flagship.narrative}
              </p>

              {selectedStage.id === "cour" && (
                <div className="mt-5">
                  <PortYardPreview
                    containerRef="MSKU-2201"
                    hoursImmobile={
                      flagship.signals[0]?.value ?? "96 h"
                    }
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-[.72fr_1.28fr]">
              <div className="rounded-2xl border border-white/[0.07] bg-[#071019] p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
                  Si rien ne change
                </p>

                <div className="mt-5 space-y-4 border-l border-dashed border-white/10 pl-4 text-xs">
                  {flagship.projection.map((step) => (
                    <div
                      key={step.time}
                      className="relative"
                    >
                      {step.tone && (
                        <span
                          className={cn(
                            "absolute -left-[21px] top-1 h-2 w-2 rounded-full ring-4 ring-[#071019]",
                            step.tone === "amber"
                              ? "bg-[#ffb648]"
                              : "bg-[#ff5d5d]",
                          )}
                        />
                      )}

                      <span className="font-semibold text-white">
                        {step.time}
                      </span>

                      <span className="ml-2 text-white/35">
                        {step.detail}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-6 text-2xl font-semibold tracking-tight text-white">
                  {flagship.costEstimate}{" "}
                  <span className="text-xs font-normal text-white/25">
                    de coût potentiel
                  </span>
                </p>
              </div>

              <div
                className={cn(
                  "rounded-2xl border p-5 transition-all duration-200",
                  applied
                    ? "border-[#a7ff00]/45 bg-[#a7ff00]/[0.08] shadow-[0_0_40px_rgba(167,255,0,0.06)]"
                    : "border-[#a7ff00]/20 bg-[#a7ff00]/[0.035]",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#a7ff00] text-[#0b1308]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>

                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a7ff00]">
                      SentrIA propose
                    </p>

                    <h4 className="mt-1 text-sm font-semibold leading-5 text-white">
                      {flagship.recommendation.title}
                    </h4>

                    <p className="mt-1 text-xs leading-5 text-white/40">
                      {flagship.recommendation.detail}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 items-center gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-white/30">
                      Risque
                    </p>

                    <p className="mt-1 text-lg font-bold text-[#ff6969] line-through decoration-[#ff6969]/50">
                      {flagship.recommendation.beforeRisk}%
                    </p>
                  </div>

                  <ArrowRight className="mx-auto h-4 w-4 text-white/20" />

                  <div>
                    <p className="text-[10px] text-white/30">
                      Après action
                    </p>

                    <p className="mt-1 text-lg font-bold text-[#a7ff00]">
                      {flagship.recommendation.afterRisk}%
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setApplied(!applied)}
                  className={cn(
                    "mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all duration-200",
                    applied
                      ? "bg-[#a7ff00] text-[#0b1308] shadow-[0_0_30px_rgba(167,255,0,0.15)]"
                      : "bg-white text-[#071019] hover:bg-[#a7ff00]",
                  )}
                >
                  <span>
                    {applied
                      ? "Protection activée"
                      : "Éviter ce blocage"}
                  </span>

                  {applied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </section>

          <aside className="rounded-[24px] border border-white/[0.08] bg-[#0b141d] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.16)] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
                  Points de rupture
                </p>

                <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">
                  À protéger maintenant
                </h3>
              </div>

              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                <Radar className="h-4 w-4 text-[#a7ff00]" />
              </span>
            </div>

            <div className="mt-5 space-y-2.5">
              {config.breakpoints.map((point) => {
                const active =
                  point.primitiveId === selected

                const isOpen =
                  expandedBreakpoint ===
                  point.primitiveId

                const primitive =
                  PRIMITIVES[point.primitiveId]

                const PrimitiveIcon =
                  primitive.icon

                const isRisk =
                  point.tone === "risk"

                return (
                  <div
                    key={point.primitiveId}
                    className={cn(
                      "overflow-hidden rounded-2xl border transition-all duration-200",
                      active
                        ? "border-white/20 bg-white/[0.035]"
                        : "border-white/[0.06] bg-transparent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(point.primitiveId)

                        setExpandedBreakpoint(
                          isOpen
                            ? null
                            : point.primitiveId,
                        )
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                          isRisk
                            ? "border-[#ff5d5d]/15 bg-[#ff5d5d]/[0.08] text-[#ff6969]"
                            : "border-[#ffb648]/15 bg-[#ffb648]/[0.08] text-[#ffb648]",
                        )}
                      >
                        <PrimitiveIcon className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-semibold text-white/85">
                            {primitive.name}
                          </p>

                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em]",
                              isRisk
                                ? "bg-[#ff5d5d]/10 text-[#ff6969]"
                                : "bg-[#ffb648]/10 text-[#ffb648]",
                            )}
                          >
                            {isRisk
                              ? "Risque"
                              : "À surveiller"}
                          </span>
                        </div>

                        <p className="mt-0.5 truncate text-[10px] text-white/30">
                          {point.title}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "text-sm font-bold",
                          isRisk
                            ? "text-[#ff6969]"
                            : "text-[#ffb648]",
                        )}
                      >
                        {point.risk}%
                      </span>

                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-white/20 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-white/[0.06] bg-white/[0.018] p-4">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-white/30">
                            Impact estimé
                          </span>

                          <span className="font-semibold text-white/75">
                            {point.impact}
                          </span>
                        </div>

                        <div>
                          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/25">
                            SentrIA surveille ici
                          </p>

                          <ul className="mt-2 space-y-1.5">
                            {primitive.signalDna.map(
                              (signal) => (
                                <li
                                  key={signal}
                                  className="flex items-center gap-2 text-[10px] text-white/55"
                                >
                                  <span
                                    className={cn(
                                      "h-1 w-1 rounded-full",
                                      isRisk
                                        ? "bg-[#ff5d5d]"
                                        : "bg-[#ffb648]",
                                    )}
                                  />

                                  {signal}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#a7ff00]/10 bg-[#a7ff00]/[0.05] p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#a7ff00]/10 text-[#a7ff00]">
                <PackageCheck className="h-4 w-4" />
              </span>

              <p className="text-[10px] leading-5 text-white/40">
                {flagship.footerNote}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}