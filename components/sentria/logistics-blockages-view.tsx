"use client"

import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Anchor,
  ArrowRight,
  Boxes,
  Check,
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

/* ------------------------------------------------------------------ */
/*  Stage primitives — the reusable vocabulary building blocks         */
/* ------------------------------------------------------------------ */

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
  /** The evidence types SentrIA always looks for at this stage. */
  signalDna: string[]
}

const PRIMITIVES: Record<PrimitiveId, PrimitiveDef> = {
  fournisseurs: { name: "Fournisseurs", icon: Factory, signalDna: ["Fiabilité fournisseur", "Délai de production"] },
  stock: { name: "Stock", icon: Boxes, signalDna: ["Niveau de stock", "Rotation"] },
  entrepot: { name: "Entrepôt", icon: Warehouse, signalDna: ["Taux d'occupation", "Capacité de traitement"] },
  transport: { name: "Transport", icon: Truck, signalDna: ["Capacité transporteur", "Retards constatés"] },
  douane: { name: "Douane", icon: FileWarning, signalDna: ["Complétude documentaire", "Délai de dédouanement"] },
  client: { name: "Client", icon: UsersRound, signalDna: ["Délai promis", "Commandes prioritaires"] },
  arrivee: { name: "Arrivée", icon: Anchor, signalDna: ["ETA navire", "Fenêtre de déchargement"] },
  quai: { name: "Quai", icon: MapPin, signalDna: ["Disponibilité quai", "Temps d'attente"] },
  cour: { name: "Cour", icon: PackageOpen, signalDna: ["Temps d'immobilisation", "Frais de stockage cumulés"] },
  enlevement: { name: "Enlèvement", icon: Send, signalDna: ["Créneaux disponibles", "Délai avant surestarie"] },
  reception: { name: "Réception", icon: ClipboardCheck, signalDna: ["Conformité livraison", "Délai de contrôle"] },
  stockage: { name: "Stockage", icon: Boxes, signalDna: ["Taux d'occupation", "Zones saturées"] },
  preparation: { name: "Préparation", icon: ClipboardList, signalDna: ["Temps de picking", "Taux d'erreur"] },
  expedition: { name: "Expédition", icon: Send, signalDna: ["Créneaux transporteur", "Volume à expédier"] },
  commande: { name: "Commande", icon: ClipboardCheck, signalDna: ["Volume entrant", "Priorité client"] },
  emballage: { name: "Emballage", icon: PackageOpen, signalDna: ["Capacité ligne", "Taux de rebut"] },
  depart: { name: "Départ", icon: Send, signalDna: ["Créneaux de départ", "Taux de remplissage"] },
  stockageFroid: { name: "Stockage froid", icon: Snowflake, signalDna: ["Écart de température", "Durée hors plage"] },
  transportRefrigere: { name: "Transport réfrigéré", icon: Thermometer, signalDna: ["Continuité du froid", "Alertes capteur IoT"] },
  livraison: { name: "Livraison", icon: DoorOpen, signalDna: ["Fenêtre de livraison", "Produits sensibles concernés"] },
}

/* ------------------------------------------------------------------ */
/*  Ops-type → composition recipe                                      */
/* ------------------------------------------------------------------ */

export type OpsType = "port" | "entrepot" | "transport" | "expedition" | "froid" | "multi"

interface Signal {
  label: string
  value: string
  width: string // literal tailwind class, e.g. "w-[82%]"
  tone: string // literal tailwind class, e.g. "bg-rose-500"
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
  recommendation: { title: string; detail: string; beforeRisk: number; afterRisk: number }
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
    chain: ["fournisseurs", "stock", "entrepot", "transport", "douane", "client"],
    stageStatus: { entrepot: "watch", transport: "risk", douane: "watch" },
    flagship: {
      title: "Blocage probable dans 48 h",
      subtitle: "Transport · France → Espagne",
      riskPercent: 68,
      globalRisk: 34,
      signals: [
        { label: "Retards récents", value: "+23%", width: "w-[82%]", tone: "bg-rose-500" },
        { label: "Capacité transport", value: "−14%", width: "w-[42%]", tone: "bg-amber-500" },
        { label: "Volume demain", value: "+31%", width: "w-[91%]", tone: "bg-rose-500" },
      ],
      narrative: "Ces signaux convergent vers une surcharge probable demain matin. 11 commandes prioritaires sont concernées.",
      projection: [
        { time: "Maintenant", detail: "flux sous tension" },
        { time: "+24 h", detail: "surcharge", tone: "amber" },
        { time: "+48 h", detail: "17 commandes impactées", tone: "rose" },
      ],
      costEstimate: "4 800 €",
      recommendation: {
        title: "Réallouer 6 expéditions au transporteur B.",
        detail: "Je protégerais d'abord les expéditions critiques. Le vrai point de rupture est le transport, pas le stock.",
        beforeRisk: 68,
        afterRisk: 21,
      },
      footerNote: "17 commandes peuvent être protégées en agissant avant demain matin.",
    },
    breakpoints: [
      { primitiveId: "transport", title: "Retard probable", risk: 68, impact: "17 commandes", tone: "risk" },
      { primitiveId: "stock", title: "Stock de sécurité atteint", risk: 42, impact: "41 h restantes", tone: "watch" },
      { primitiveId: "douane", title: "Documents incomplets", risk: 31, impact: "3 expéditions", tone: "watch" },
    ],
  },
  port: {
    chain: ["arrivee", "quai", "douane", "cour", "enlevement"],
    stageStatus: { quai: "watch", cour: "risk", douane: "watch" },
    flagship: {
      title: "Conteneur immobilisé en cour",
      subtitle: "Port & conteneurs · Import Asie → Le Havre",
      riskPercent: 71,
      globalRisk: 38,
      signals: [
        { label: "Temps d'immobilisation", value: "96 h", width: "w-[88%]", tone: "bg-rose-500" },
        { label: "Frais de stockage cumulés", value: "+540 €", width: "w-[65%]", tone: "bg-amber-500" },
        { label: "Créneaux d'enlèvement dispo", value: "−30%", width: "w-[35%]", tone: "bg-amber-500" },
      ],
      narrative: "Le conteneur MSKU-2201 approche du seuil de surestarie. 3 commandes clients en dépendent directement.",
      projection: [
        { time: "Maintenant", detail: "conteneur en cour, non enlevé" },
        { time: "+24 h", detail: "seuil de surestarie atteint", tone: "amber" },
        { time: "+48 h", detail: "facturation surestarie déclenchée", tone: "rose" },
      ],
      costEstimate: "1 200 €",
      recommendation: {
        title: "Réserver un créneau d'enlèvement prioritaire aujourd'hui.",
        detail: "Le dédouanement est déjà validé — le blocage est purement logistique, sur la cour.",
        beforeRisk: 71,
        afterRisk: 18,
      },
      footerNote: "3 commandes clients peuvent être protégées en enlevant le conteneur avant demain.",
    },
    breakpoints: [
      { primitiveId: "cour", title: "Conteneur immobile", risk: 71, impact: "1 conteneur", tone: "risk" },
      { primitiveId: "douane", title: "Dossier en attente de validation", risk: 34, impact: "2 expéditions", tone: "watch" },
      { primitiveId: "quai", title: "Créneau de déchargement serré", risk: 28, impact: "1 navire", tone: "watch" },
    ],
  },
  entrepot: {
    chain: ["reception", "stockage", "preparation", "expedition"],
    stageStatus: { stockage: "risk", preparation: "watch" },
    flagship: {
      title: "Zone de picking saturée",
      subtitle: "Entrepôt & stockage · Zone B",
      riskPercent: 64,
      globalRisk: 33,
      signals: [
        { label: "Taux d'occupation zone B", value: "+27%", width: "w-[86%]", tone: "bg-rose-500" },
        { label: "Temps de picking moyen", value: "+18%", width: "w-[58%]", tone: "bg-amber-500" },
        { label: "Commandes en attente", value: "64", width: "w-[70%]", tone: "bg-amber-500" },
      ],
      narrative: "La saturation de la zone B ralentit la préparation. 9 commandes du jour risquent de dépasser leur créneau d'expédition.",
      projection: [
        { time: "Maintenant", detail: "zone B au-delà de sa capacité cible" },
        { time: "+12 h", detail: "file de préparation allongée", tone: "amber" },
        { time: "+24 h", detail: "expéditions du jour manquées", tone: "rose" },
      ],
      costEstimate: "2 100 €",
      recommendation: {
        title: "Basculer 40% du picking de la zone B vers la zone A.",
        detail: "La zone A a de la capacité disponible ce créneau — c'est la répartition, pas l'effectif, qui bloque.",
        beforeRisk: 64,
        afterRisk: 19,
      },
      footerNote: "9 commandes peuvent être expédiées à l'heure en rééquilibrant les zones.",
    },
    breakpoints: [
      { primitiveId: "stockage", title: "Zone de picking saturée", risk: 64, impact: "9 commandes", tone: "risk" },
      { primitiveId: "preparation", title: "Temps de picking en hausse", risk: 39, impact: "64 commandes", tone: "watch" },
      { primitiveId: "expedition", title: "Créneau transporteur serré", risk: 26, impact: "2 expéditions", tone: "watch" },
    ],
  },
  expedition: {
    chain: ["commande", "preparation", "emballage", "depart"],
    stageStatus: { preparation: "risk", emballage: "watch" },
    flagship: {
      title: "Délai de préparation qui dérape",
      subtitle: "Expédition & envoi · Ligne 2",
      riskPercent: 59,
      globalRisk: 30,
      signals: [
        { label: "Retard de préparation", value: "+34%", width: "w-[80%]", tone: "bg-rose-500" },
        { label: "Taux de rebut emballage", value: "+9%", width: "w-[40%]", tone: "bg-amber-500" },
        { label: "Commandes urgentes", value: "22", width: "w-[55%]", tone: "bg-amber-500" },
      ],
      narrative: "Le retard s'accumule depuis ce matin sur la ligne 2. 22 commandes urgentes risquent de manquer le départ de 17h.",
      projection: [
        { time: "Maintenant", detail: "ligne 2 en retard de 40 min" },
        { time: "+3 h", detail: "file d'attente avant emballage", tone: "amber" },
        { time: "+6 h", detail: "départ de 17h manqué", tone: "rose" },
      ],
      costEstimate: "1 650 €",
      recommendation: {
        title: "Prioriser les 22 commandes urgentes sur la ligne 1.",
        detail: "La ligne 1 a un créneau libre maintenant — retarder les commandes non urgentes évite de manquer le départ.",
        beforeRisk: 59,
        afterRisk: 16,
      },
      footerNote: "22 commandes urgentes peuvent partir à l'heure en priorisant la ligne 1.",
    },
    breakpoints: [
      { primitiveId: "preparation", title: "Retard de préparation", risk: 59, impact: "22 commandes", tone: "risk" },
      { primitiveId: "emballage", title: "Taux de rebut en hausse", risk: 33, impact: "1 ligne", tone: "watch" },
      { primitiveId: "depart", title: "Créneau de départ serré", risk: 24, impact: "1 transporteur", tone: "watch" },
    ],
  },
  froid: {
    chain: ["reception", "stockageFroid", "transportRefrigere", "livraison"],
    stageStatus: { transportRefrigere: "risk", stockageFroid: "watch" },
    flagship: {
      title: "Rupture de chaîne du froid détectée",
      subtitle: "Chaîne du froid · Camion réfrigéré #12",
      riskPercent: 76,
      globalRisk: 41,
      signals: [
        { label: "Écart de température", value: "+4.2°C", width: "w-[90%]", tone: "bg-rose-500" },
        { label: "Durée hors plage", value: "38 min", width: "w-[62%]", tone: "bg-amber-500" },
        { label: "Produits sensibles concernés", value: "120 kg", width: "w-[70%]", tone: "bg-rose-500" },
      ],
      narrative: "Le capteur IoT du camion #12 signale une sortie de plage de température depuis 38 minutes. 120 kg de produits sensibles sont concernés.",
      projection: [
        { time: "Maintenant", detail: "écart de température en cours" },
        { time: "+30 min", detail: "seuil critique produit atteint", tone: "amber" },
        { time: "+1 h", detail: "lot non conforme à la livraison", tone: "rose" },
      ],
      costEstimate: "3 400 €",
      recommendation: {
        title: "Dérouter le camion #12 vers le point de contrôle le plus proche.",
        detail: "Le groupe froid montre un signe de défaillance — un contrôle immédiat évite la perte du lot.",
        beforeRisk: 76,
        afterRisk: 22,
      },
      footerNote: "120 kg de produits sensibles peuvent être sauvés en agissant dans les 30 prochaines minutes.",
    },
    breakpoints: [
      { primitiveId: "transportRefrigere", title: "Écart de température", risk: 76, impact: "120 kg", tone: "risk" },
      { primitiveId: "stockageFroid", title: "Durée hors plage en hausse", risk: 44, impact: "1 camion", tone: "watch" },
      { primitiveId: "reception", title: "Contrôle à la réception requis", risk: 22, impact: "1 lot", tone: "watch" },
    ],
  },
}

/** "Plusieurs activités" is a real union of the customer's selected ops types — not a fallback. */
function composeMultiConfig(selected: Exclude<OpsType, "multi">[]): OpsTypeConfig {
  if (selected.length === 0) return OPS_TYPE_CONFIGS.transport

  const chain: PrimitiveId[] = []
  const stageStatus: Partial<Record<PrimitiveId, StageStatus>> = {}
  for (const type of selected) {
    const cfg = OPS_TYPE_CONFIGS[type]
    for (const id of cfg.chain) if (!chain.includes(id)) chain.push(id)
    Object.assign(stageStatus, cfg.stageStatus)
  }

  const flagshipType = selected.reduce((worst, type) =>
    OPS_TYPE_CONFIGS[type].flagship.riskPercent > OPS_TYPE_CONFIGS[worst].flagship.riskPercent ? type : worst
  , selected[0])

  const breakpointMap = new Map<PrimitiveId, Breakpoint>()
  for (const type of selected) {
    for (const bp of OPS_TYPE_CONFIGS[type].breakpoints) {
      const existing = breakpointMap.get(bp.primitiveId)
      if (!existing || bp.risk > existing.risk) breakpointMap.set(bp.primitiveId, bp)
    }
  }
  const breakpoints = [...breakpointMap.values()].sort((a, b) => b.risk - a.risk).slice(0, 3)

  return { chain, stageStatus, flagship: OPS_TYPE_CONFIGS[flagshipType].flagship, breakpoints }
}

const stateStyle = {
  good: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", ring: "border-emerald-500/25 bg-emerald-500/10" },
  watch: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", ring: "border-amber-500/25 bg-amber-500/10" },
  risk: { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400", ring: "border-rose-500/25 bg-rose-500/10" },
}

const stateLabel: Record<StageStatus, string> = { good: "Fluide", watch: "Sous tension", risk: "Rupture" }

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface LogisticsBlockagesViewProps {
  /** Which ops type the customer picked in onboarding. Defaults to "transport" (previous hardcoded behavior). */
  opsType?: OpsType
  /** When opsType === "multi", the actual set of activities the customer selected. */
  selectedOpsTypesForMulti?: Exclude<OpsType, "multi">[]
  /** Primitive ids whose signal source is actually connected (ERP / IoT / CSV). Everything else renders as "template". */
  liveStageIds?: PrimitiveId[]
}

export function LogisticsBlockagesView({
  opsType = "transport",
  selectedOpsTypesForMulti = [],
  liveStageIds = [],
}: LogisticsBlockagesViewProps) {
  const config = opsType === "multi" ? composeMultiConfig(selectedOpsTypesForMulti) : OPS_TYPE_CONFIGS[opsType]

  const stages = config.chain.map((id) => ({
    id,
    ...PRIMITIVES[id],
    status: config.stageStatus[id] ?? ("good" as StageStatus),
    dataState: (liveStageIds.includes(id) ? "live" : "template") as DataState,
  }))

  const defaultSelected = stages.find((s) => s.status === "risk")?.id ?? stages[0].id

  const [selected, setSelected] = useState<PrimitiveId>(defaultSelected)
  const [applied, setApplied] = useState(false)

  // Re-derive the default focus stage whenever the composition itself changes
  // (e.g. the customer changes their onboarding selection while this view stays mounted).
  useEffect(() => {
    setSelected(defaultSelected)
    setApplied(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opsType, JSON.stringify(selectedOpsTypesForMulti)])

  const selectedStage = stages.find((stage) => stage.id === selected) ?? stages[0]
  const SelectedIcon = selectedStage.icon
  const { flagship } = config

  const riskColor = flagship.globalRisk >= 50 ? "#f43f5e" : flagship.globalRisk >= 30 ? "#f59e0b" : "#10b981"
  const riskLabel = flagship.globalRisk >= 50 ? "Critique" : flagship.globalRisk >= 30 ? "Sous tension" : "Sous contrôle"

  const focusMessage =
    selectedStage.status === "risk"
      ? `${selectedStage.name} est votre point de rupture probable.`
      : selectedStage.status === "watch"
        ? `${selectedStage.name} est sous tension, à surveiller.`
        : `${selectedStage.name} est stable. SentrIA continue de le surveiller.`

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15"><Radar className="h-3.5 w-3.5" /></span>
              SentrIA Flow
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Votre flux, avant qu&apos;il ne casse.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Suivez la santé de chaque étape. SentrIA vous montre le prochain point de rupture et la décision qui protège vos opérations.</p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 px-4 py-3">
            <div
              className="relative grid h-12 w-12 place-items-center rounded-full"
              style={{ background: `conic-gradient(${riskColor} 0deg ${(flagship.globalRisk / 100) * 360}deg, #e5e7eb ${(flagship.globalRisk / 100) * 360}deg 360deg)` }}
            >
              <div className="grid h-9 w-9 place-items-center rounded-full bg-card text-sm font-bold">{flagship.globalRisk}</div>
            </div>
            <div><p className="text-xs font-medium text-muted-foreground">Risque global</p><p className="text-sm font-semibold">{riskLabel} <span className="text-muted-foreground">/ 100</span></p></div>
          </div>
        </div>

        <div className="relative mt-8 overflow-x-auto pb-1">
          <div className="flex items-center justify-between gap-1 px-2" style={{ minWidth: Math.max(stages.length * 120, 480) }}>
            {stages.map((stage, index) => {
              const Icon = stage.icon
              const style = stateStyle[stage.status]
              const isSelected = selected === stage.id
              const isTemplate = stage.dataState === "template"
              return (
                <div className="flex flex-1 items-center" key={stage.id}>
                  <button onClick={() => setSelected(stage.id)} className="group flex w-24 flex-col items-center gap-2 text-center" aria-pressed={isSelected}>
                    <span className={cn("grid h-12 w-12 place-items-center rounded-2xl border transition-all", style.ring, isSelected && "scale-110 shadow-lg shadow-black/5", isTemplate && "border-dashed opacity-60")}>
                      <Icon className={cn("h-5 w-5", style.text)} />
                    </span>
                    <span className="text-[11px] font-semibold text-foreground">{stage.name}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />{stateLabel[stage.status]}</span>
                    {isTemplate && (
                      <span className="flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground/70">
                        <Clock3 className="h-2.5 w-2.5" /> à confirmer
                      </span>
                    )}
                  </button>
                  {index < stages.length - 1 && <div className={cn("mx-1 h-1 flex-1 rounded-full", stage.status === "risk" ? "bg-gradient-to-r from-rose-300 to-amber-300" : "bg-emerald-200 dark:bg-emerald-900/60")} />}
                </div>
              )
            })}
          </div>
        </div>
        <div className="relative mt-6 flex items-center gap-3 rounded-2xl border border-rose-500/15 bg-rose-500/[0.06] p-3 text-sm">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-500 text-white"><SelectedIcon className="h-4 w-4" /></span>
          <p>{focusMessage}</p>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.8fr)]">
        <section className="overflow-hidden rounded-[2rem] border border-rose-500/20 bg-card shadow-sm">
          <div className="border-b border-border p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-400"><CircleAlert className="h-4 w-4" /> Avant le blocage</div>
                <h3 className="text-2xl font-semibold tracking-tight">{flagship.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{flagship.subtitle}</p>
              </div>
              <span className="rounded-full bg-rose-500/10 px-3 py-1.5 text-sm font-bold text-rose-700 dark:text-rose-400">{flagship.riskPercent}% de risque</span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {flagship.signals.map((signal) => (
                <div key={signal.label} className="rounded-2xl bg-muted/60 p-3">
                  <div className="flex items-baseline justify-between gap-2"><span className="text-xs text-muted-foreground">{signal.label}</span><span className="text-sm font-bold">{signal.value}</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><div className={cn("h-full rounded-full", signal.tone, signal.width)} /></div>
                </div>
              ))}
            </div>
            <p className="mt-5 border-l-2 border-rose-400 pl-3 text-sm leading-6 text-muted-foreground">{flagship.narrative}</p>
          </div>

          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[.7fr_1.3fr]">
            <div className="rounded-2xl bg-muted/55 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">Si rien ne change</p>
              <div className="mt-5 space-y-3 border-l border-dashed border-border pl-4 text-sm">
                {flagship.projection.map((step) => (
                  <p key={step.time} className="relative">
                    {step.tone && <span className={cn("absolute -left-[21px] top-1 h-2 w-2 rounded-full", step.tone === "amber" ? "bg-amber-500" : "bg-rose-500")} />}
                    <span className="font-semibold">{step.time}</span><span className="ml-2 text-muted-foreground">{step.detail}</span>
                  </p>
                ))}
              </div>
              <p className="mt-5 text-lg font-semibold">{flagship.costEstimate} <span className="text-sm font-normal text-muted-foreground">de coût potentiel</span></p>
            </div>
            <div className={cn("rounded-2xl border p-5 transition-colors", applied ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border-emerald-500/20 bg-emerald-500/[0.04]")}>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-emerald-700 dark:text-emerald-400">SentrIA propose</p>
                  <h4 className="mt-1 font-semibold">{flagship.recommendation.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{flagship.recommendation.detail}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-muted-foreground">Risque</p><p className="mt-1 font-bold text-rose-600 line-through decoration-rose-300">{flagship.recommendation.beforeRisk}%</p></div>
                <div className="pt-5 text-muted-foreground"><ArrowRight className="mx-auto h-4 w-4" /></div>
                <div><p className="text-xs text-muted-foreground">Après action</p><p className="mt-1 font-bold text-emerald-600">{flagship.recommendation.afterRisk}%</p></div>
              </div>
              <button onClick={() => setApplied(!applied)} className={cn("mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all", applied ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground hover:opacity-90")}>
                <span>{applied ? "Protection activée" : "Éviter ce blocage"}</span>{applied ? <Check className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-[2rem] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Points de rupture</p><h3 className="mt-1 text-lg font-semibold">À protéger maintenant</h3></div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted"><Radar className="h-4 w-4" /></span>
          </div>
          <div className="mt-5 space-y-3">
            {config.breakpoints.map((point) => {
              const active = point.primitiveId === selected
              const primitive = PRIMITIVES[point.primitiveId]
              return (
                <button key={point.primitiveId} onClick={() => setSelected(point.primitiveId)} className={cn("w-full rounded-2xl border p-4 text-left transition-all", active ? "border-primary bg-muted/70 shadow-sm" : "border-border hover:border-muted-foreground/30 hover:bg-muted/40")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", point.tone === "risk" ? "bg-rose-500" : "bg-amber-500")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2"><p className="font-semibold">{primitive.name}</p><p className={cn("text-sm font-bold", point.tone === "risk" ? "text-rose-600" : "text-amber-600")}>{point.risk}%</p></div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{point.title}</p>
                      <p className="mt-2 text-xs font-medium text-foreground">{point.impact}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-muted/60 p-4">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            <p className="text-xs leading-5 text-muted-foreground">{flagship.footerNote}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

