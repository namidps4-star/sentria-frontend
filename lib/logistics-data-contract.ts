/**
 * Required data contract for LogisticsBlockagesView.
 *
 * This is what your backend (ERP / TMS / IoT / CSV ingestion) needs to
 * produce so the view can move from onboarding "template" placeholders
 * to real "live" data, stage by stage.
 *
 * One LogisticsSnapshot = everything needed to render the view for a
 * single customer at a single point in time.
 */

export type OpsType = "port" | "entrepot" | "transport" | "expedition" | "froid" | "multi"
export type StageStatus = "good" | "watch" | "risk"

/** A single evidence metric shown when a stage is the flagship focus. */
export interface StageMetric {
  label: string // e.g. "Écart de température"
  value: string // display value, already formatted, e.g. "+4.2°C"
  percent: number // 0-100, drives the progress bar width
  tone: "good" | "watch" | "risk"
}

/** Per-stage data — one entry per primitive in the customer's flow chain. */
export interface StageData {
  primitiveId: string // REQUIRED — must match a key in PRIMITIVES (e.g. "transportRefrigere")
  status: StageStatus // REQUIRED
  isLive: boolean // REQUIRED — false until this stage's real signal source is connected
  metrics: StageMetric[] // REQUIRED (can be empty []) — only rendered when this stage is in focus
}

export interface ProjectionStep {
  timeOffset: string // REQUIRED — "Maintenant" | "+24 h" | "+30 min" ...
  detail: string // REQUIRED
  severity?: "amber" | "rose" // OPTIONAL — omit for the "Maintenant" baseline step
}

export interface Recommendation {
  title: string // REQUIRED
  detail: string // REQUIRED
  riskBefore: number // REQUIRED — 0-100
  riskAfter: number // REQUIRED — 0-100
}

/** The single highest-priority event driving the "Avant le blocage" card. */
export interface FlagshipEvent {
  primitiveId: string // REQUIRED — which stage this event is anchored to
  title: string // REQUIRED
  subtitle: string // REQUIRED
  riskPercent: number // REQUIRED — 0-100
  narrative: string // REQUIRED
  projection: ProjectionStep[] // REQUIRED — at least 1 step (the baseline)
  costEstimateEUR: number // REQUIRED
  recommendation: Recommendation // REQUIRED
  footerNote: string // REQUIRED
}

export interface BreakpointData {
  primitiveId: string // REQUIRED
  title: string // REQUIRED
  risk: number // REQUIRED — 0-100
  impact: string // REQUIRED — human-readable, e.g. "17 commandes"
}

export interface LogisticsSnapshot {
  opsType: OpsType // REQUIRED
  selectedOpsTypesForMulti?: OpsType[] // REQUIRED only when opsType === "multi"
  globalRiskScore: number // REQUIRED — 0-100, drives the header gauge
  stages: StageData[] // REQUIRED — order defines the flow-chain rendering order
  flagshipEvent: FlagshipEvent // REQUIRED
  breakpoints: BreakpointData[] // REQUIRED — typically top 3, sorted by risk desc
}

/* ------------------------------------------------------------------ */
/*  Dummy payload — "Chaîne du froid" customer, mid-integration        */
/*  (reception + stockageFroid + transportRefrigere are live;          */
/*   livraison hasn't been connected yet, so it stays "template")      */
/* ------------------------------------------------------------------ */

export const DUMMY_FROID_SNAPSHOT: LogisticsSnapshot = {
  opsType: "froid",
  globalRiskScore: 41,
  stages: [
    { primitiveId: "reception", status: "good", isLive: true, metrics: [] },
    {
      primitiveId: "stockageFroid",
      status: "watch",
      isLive: true,
      metrics: [{ label: "Durée hors plage", value: "38 min", percent: 62, tone: "watch" }],
    },
    {
      primitiveId: "transportRefrigere",
      status: "risk",
      isLive: true,
      metrics: [
        { label: "Écart de température", value: "+4.2°C", percent: 90, tone: "risk" },
        { label: "Alertes capteur IoT", value: "3 dans l'heure", percent: 70, tone: "risk" },
      ],
    },
    { primitiveId: "livraison", status: "good", isLive: false, metrics: [] },
  ],
  flagshipEvent: {
    primitiveId: "transportRefrigere",
    title: "Rupture de chaîne du froid détectée",
    subtitle: "Chaîne du froid · Camion réfrigéré #12",
    riskPercent: 76,
    narrative:
      "Le capteur IoT du camion #12 signale une sortie de plage de température depuis 38 minutes. 120 kg de produits sensibles sont concernés.",
    projection: [
      { timeOffset: "Maintenant", detail: "écart de température en cours" },
      { timeOffset: "+30 min", detail: "seuil critique produit atteint", severity: "amber" },
      { timeOffset: "+1 h", detail: "lot non conforme à la livraison", severity: "rose" },
    ],
    costEstimateEUR: 3400,
    recommendation: {
      title: "Dérouter le camion #12 vers le point de contrôle le plus proche.",
      detail: "Le groupe froid montre un signe de défaillance — un contrôle immédiat évite la perte du lot.",
      riskBefore: 76,
      riskAfter: 22,
    },
    footerNote: "120 kg de produits sensibles peuvent être sauvés en agissant dans les 30 prochaines minutes.",
  },
  breakpoints: [
    { primitiveId: "transportRefrigere", title: "Écart de température", risk: 76, impact: "120 kg" },
    { primitiveId: "stockageFroid", title: "Durée hors plage en hausse", risk: 44, impact: "1 camion" },
    { primitiveId: "reception", title: "Contrôle à la réception requis", risk: 22, impact: "1 lot" },
  ],
}

/* ------------------------------------------------------------------ */
/*  Dummy payload — "Multi-activités" customer (port + froid)          */
/*  Nothing connected yet — everything is template, pure onboarding    */
/* ------------------------------------------------------------------ */

export const DUMMY_MULTI_SNAPSHOT: LogisticsSnapshot = {
  opsType: "multi",
  selectedOpsTypesForMulti: ["port", "froid"],
  globalRiskScore: 38,
  stages: [
    { primitiveId: "arrivee", status: "good", isLive: false, metrics: [] },
    { primitiveId: "quai", status: "watch", isLive: false, metrics: [] },
    { primitiveId: "douane", status: "watch", isLive: false, metrics: [] },
    { primitiveId: "cour", status: "risk", isLive: false, metrics: [] },
    { primitiveId: "enlevement", status: "good", isLive: false, metrics: [] },
    { primitiveId: "reception", status: "good", isLive: false, metrics: [] },
    { primitiveId: "stockageFroid", status: "watch", isLive: false, metrics: [] },
    { primitiveId: "transportRefrigere", status: "risk", isLive: false, metrics: [] },
    { primitiveId: "livraison", status: "good", isLive: false, metrics: [] },
  ],
  flagshipEvent: {
    primitiveId: "cour",
    title: "Conteneur immobilisé en cour",
    subtitle: "Port & conteneurs · Import Asie → Le Havre",
    riskPercent: 71,
    narrative: "Le conteneur MSKU-2201 approche du seuil de surestarie. 3 commandes clients en dépendent directement.",
    projection: [
      { timeOffset: "Maintenant", detail: "conteneur en cour, non enlevé" },
      { timeOffset: "+24 h", detail: "seuil de surestarie atteint", severity: "amber" },
      { timeOffset: "+48 h", detail: "facturation surestarie déclenchée", severity: "rose" },
    ],
    costEstimateEUR: 1200,
    recommendation: {
      title: "Réserver un créneau d'enlèvement prioritaire aujourd'hui.",
      detail: "Le dédouanement est déjà validé — le blocage est purement logistique, sur la cour.",
      riskBefore: 71,
      riskAfter: 18,
    },
    footerNote: "3 commandes clients peuvent être protégées en enlevant le conteneur avant demain.",
  },
  breakpoints: [
    { primitiveId: "cour", title: "Conteneur immobile", risk: 71, impact: "1 conteneur" },
    { primitiveId: "transportRefrigere", title: "Écart de température", risk: 76, impact: "120 kg" },
    { primitiveId: "douane", title: "Dossier en attente de validation", risk: 34, impact: "2 expéditions" },
  ],
}