/**
 * Real data layer for the logistics priority views.
 *
 * Every number these views used to show was written by hand: fixed risk
 * percentages, fixed euro amounts, three hardcoded signal bars per ops
 * type, and a setInterval that nudged the figures every four seconds so
 * the page would look live. This module replaces all of it with values
 * derived from the alerts the backend actually produced.
 *
 * The rule here: if a number cannot be traced to an alert row, it does
 * not get rendered. Where a business assumption is unavoidable (what an
 * hour of immobilisation costs), the assumption is a named, editable
 * rate and the arithmetic is shown to the user rather than baked in.
 */

export type OpsType =
  | "port"
  | "entrepot"
  | "transport"
  | "expedition"
  | "froid"
  | "multi"

export type StageStatus = "good" | "watch" | "risk"

export type LogisticsAlert = {
  equipment: string
  message: string
  severity: "WARNING" | "CRITICAL" | string
  date: string
  sector?: string | null
  alert_key?: string | null
  risk_score?: number | null
  business_type?: string | null
}

/* ------------------------------------------------------------------ */
/*  Stage vocabulary                                                   */
/* ------------------------------------------------------------------ */

export type PrimitiveId =
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

export const PRIMITIVE_NAMES: Record<PrimitiveId, string> = {
  fournisseurs: "Fournisseurs",
  stock: "Stock",
  entrepot: "Entrepôt",
  transport: "Transport",
  douane: "Douane",
  client: "Client",
  arrivee: "Arrivée",
  quai: "Quai",
  cour: "Cour",
  enlevement: "Enlèvement",
  reception: "Réception",
  stockage: "Stockage",
  preparation: "Préparation",
  expedition: "Expédition",
  commande: "Commande",
  emballage: "Emballage",
  depart: "Départ",
  stockageFroid: "Stockage froid",
  transportRefrigere: "Transport réfrigéré",
  livraison: "Livraison",
}

/** The flow chain per ops type. Order is the physical order of the flow. */
export const OPS_CHAINS: Record<Exclude<OpsType, "multi">, PrimitiveId[]> = {
  transport: ["fournisseurs", "stock", "entrepot", "transport", "douane", "client"],
  port: ["arrivee", "quai", "douane", "cour", "enlevement"],
  entrepot: ["reception", "stockage", "preparation", "expedition"],
  expedition: ["commande", "preparation", "emballage", "depart"],
  froid: ["reception", "stockageFroid", "transportRefrigere", "livraison"],
}

export const OPS_LABELS: Record<OpsType, string> = {
  port: "Port & conteneurs",
  entrepot: "Entrepôt & stockage",
  transport: "Transport & distribution",
  expedition: "Expédition & envoi",
  froid: "Chaîne du froid",
  multi: "Plusieurs activités",
}

/** How to name the activity in a header.
 *
 *  With a set of two, "Plusieurs activités" says less than naming them,
 *  and a reefer terminal wants to see that both of its activities are
 *  being followed. Past three it stays a count, because the header is
 *  not the place for a five-item list. */
export function opsLabelFor(
  opsType: OpsType | undefined,
  selected: Exclude<OpsType, "multi">[] = []
): string | undefined {
  if (!opsType) return undefined

  if (opsType !== "multi") return OPS_LABELS[opsType]

  if (selected.length === 0) return OPS_LABELS.multi

  if (selected.length <= 3) {
    return selected.map((type) => OPS_LABELS[type]).join(" + ")
  }

  return `${selected.length} activités`
}

export function chainFor(
  opsType: OpsType | undefined,
  selectedForMulti: Exclude<OpsType, "multi">[] = []
): PrimitiveId[] {
  if (!opsType || opsType === "multi") {
    const sources =
      selectedForMulti.length > 0
        ? selectedForMulti
        : (Object.keys(OPS_CHAINS) as Exclude<OpsType, "multi">[])

    const chain: PrimitiveId[] = []

    for (const type of sources) {
      for (const id of OPS_CHAINS[type]) {
        if (!chain.includes(id)) chain.push(id)
      }
    }

    return chain
  }

  return OPS_CHAINS[opsType]
}

/* ------------------------------------------------------------------ */
/*  alert_key -> what it measures, and where in the flow it lands      */
/* ------------------------------------------------------------------ */

export type MetricKind =
  | "wait"
  | "mileage"
  | "berth"
  | "eta"
  | "discharge"
  | "demurrage"
  | "documents"
  | "dwell"
  | "inspection"
  | "temperature"
  | "cycles"
  | "pressure"
  | "fuel"
  | "service"
  | "risk"
  | "engine"
  | "oil"
  | "tires"

type MetricDef = {
  kind: MetricKind
  /** What the number in the message means. */
  label: string
  unit: string
  /** Where this signal sits in the flow, per ops type. */
  stage: Partial<Record<Exclude<OpsType, "multi">, PrimitiveId>>
  /** Any-ops-type fallback stage. */
  defaultStage: PrimitiveId
  /** Value at or above which the signal is a rupture rather than tension. */
  riskAt: number
  /** Ceiling used to turn the value into a 0-100 bar width. */
  scaleMax: number
}

export const METRICS: Record<string, MetricDef> = {
  "logistics.wait.critical": {
    kind: "wait",
    label: "Temps d'immobilisation",
    unit: "h",
    stage: { port: "cour", entrepot: "stockage", froid: "stockageFroid", expedition: "preparation" },
    defaultStage: "transport",
    riskAt: 8,
    scaleMax: 48,
  },
  "logistics.wait.warning": {
    kind: "wait",
    label: "Temps d'attente",
    unit: "h",
    stage: { port: "quai", entrepot: "preparation", froid: "reception", expedition: "preparation" },
    defaultStage: "transport",
    riskAt: 8,
    scaleMax: 48,
  },
  "logistics.temperature.critical": {
    kind: "temperature",
    label: "Température relevée",
    unit: "°C",
    stage: { froid: "transportRefrigere", entrepot: "stockage", port: "cour" },
    defaultStage: "transport",
    riskAt: 8,
    scaleMax: 20,
  },
  "logistics.temperature.warning": {
    kind: "temperature",
    label: "Température relevée",
    unit: "°C",
    stage: { froid: "stockageFroid", entrepot: "stockage", port: "cour" },
    defaultStage: "transport",
    riskAt: 8,
    scaleMax: 20,
  },
  "logistics.cycles.critical": {
    kind: "cycles",
    label: "Cycles effectués",
    unit: "cycles",
    stage: { port: "quai", entrepot: "preparation", expedition: "emballage", froid: "stockageFroid" },
    defaultStage: "entrepot",
    riskAt: 1,
    scaleMax: 1,
  },
  "logistics.cycles.warning": {
    kind: "cycles",
    label: "Cycles effectués",
    unit: "cycles",
    stage: { port: "quai", entrepot: "preparation", expedition: "emballage", froid: "stockageFroid" },
    defaultStage: "entrepot",
    riskAt: 1,
    scaleMax: 1,
  },
  "logistics.pressure.critical": {
    kind: "pressure",
    label: "Pression hydraulique",
    unit: "bar",
    stage: { port: "quai", entrepot: "stockage", expedition: "emballage" },
    defaultStage: "entrepot",
    riskAt: 0,
    scaleMax: 300,
  },
  "logistics.fuel.warning": {
    kind: "fuel",
    label: "Carburant restant",
    unit: "%",
    stage: { port: "enlevement", entrepot: "expedition", froid: "transportRefrigere" },
    defaultStage: "transport",
    riskAt: 10,
    scaleMax: 100,
  },
  "logistics.service.warning": {
    kind: "service",
    label: "Jours sans entretien",
    unit: "j",
    stage: { port: "quai", entrepot: "stockage", expedition: "emballage", froid: "stockageFroid" },
    defaultStage: "entrepot",
    riskAt: 90,
    scaleMax: 180,
  },
  "logistics.risk.elevated": {
    kind: "risk",
    label: "Score de risque composite",
    unit: "/100",
    /* A whole-equipment composite rather than one metric, so it is
       pinned to each chain's own load-bearing stage. With an empty map
       it fell through to "transport", which is not in the port,
       warehouse, shipping or cold-chain chains, so every predictive
       alert on those was dropped from the flow. */
    stage: {
      port: "cour",
      entrepot: "stockage",
      expedition: "preparation",
      froid: "stockageFroid",
      transport: "transport",
    },
    defaultStage: "transport",
    riskAt: 70,
    scaleMax: 100,
  },
  /* Arrivée and Douane: the two stages that used to read "Aucun signal"
     permanently, because nothing in the pipeline produced a berthing or
     a declaration signal. */
  "port.arrival.berth_miss": {
    kind: "berth",
    label: "Créneau de quai dépassé",
    unit: "h",
    stage: { port: "arrivee" },
    defaultStage: "arrivee",
    riskAt: 0,
    scaleMax: 24,
  },
  "port.arrival.berth_tight": {
    kind: "berth",
    label: "Créneau de quai restant",
    unit: "h",
    stage: { port: "arrivee" },
    defaultStage: "arrivee",
    riskAt: 2,
    scaleMax: 12,
  },
  "port.arrival.eta_drift": {
    kind: "eta",
    label: "Décalage d'ETA",
    unit: "h",
    stage: { port: "arrivee" },
    defaultStage: "arrivee",
    riskAt: 12,
    scaleMax: 48,
  },
  "port.arrival.discharge_overrun": {
    kind: "discharge",
    label: "Déchargement hors créneau",
    unit: "h",
    stage: { port: "arrivee" },
    defaultStage: "arrivee",
    riskAt: 6,
    scaleMax: 24,
  },
  "port.customs.free_time_risk": {
    /* The one signal in the chain whose overrun has a real tariff behind
       it, so it is the one the cost view can price honestly. The message
       leads with the exposed hours for exactly that reason. */
    kind: "demurrage",
    label: "Surestarie exposée",
    unit: "h",
    stage: { port: "douane" },
    defaultStage: "douane",
    riskAt: 0,
    scaleMax: 72,
  },
  "port.customs.docs_missing": {
    kind: "documents",
    label: "Documents manquants",
    unit: "",
    stage: { port: "douane" },
    defaultStage: "douane",
    riskAt: 3,
    scaleMax: 5,
  },
  "port.customs.dwell_exceeded": {
    kind: "dwell",
    label: "Temps en douane",
    unit: "h",
    stage: { port: "douane" },
    defaultStage: "douane",
    riskAt: 36,
    scaleMax: 96,
  },
  "port.customs.inspection_hold": {
    kind: "inspection",
    label: "Franchise restante au contrôle",
    unit: "h",
    stage: { port: "douane" },
    defaultStage: "douane",
    riskAt: 24,
    scaleMax: 72,
  },
  "transport.service.critical_due": {
    kind: "mileage",
    label: "Km depuis l'entretien",
    unit: "km",
    stage: {},
    defaultStage: "transport",
    riskAt: 20000,
    scaleMax: 40000,
  },
  "transport.service.due": {
    kind: "mileage",
    label: "Km depuis l'entretien",
    unit: "km",
    stage: {},
    defaultStage: "transport",
    riskAt: 20000,
    scaleMax: 40000,
  },
  "transport.engine.overheat": {
    kind: "engine",
    label: "Température moteur",
    unit: "°C",
    stage: {},
    defaultStage: "transport",
    riskAt: 100,
    scaleMax: 140,
  },
  "transport.oil.critical_low": {
    kind: "oil",
    label: "Niveau d'huile",
    unit: "",
    stage: {},
    defaultStage: "transport",
    riskAt: 0,
    scaleMax: 100,
  },
  "transport.fuel_low": {
    kind: "fuel",
    label: "Carburant restant",
    unit: "%",
    stage: {},
    defaultStage: "transport",
    riskAt: 10,
    scaleMax: 100,
  },
  "transportation.tires.replacement_due": {
    kind: "tires",
    label: "Âge des pneus",
    unit: "mois",
    stage: {},
    defaultStage: "transport",
    riskAt: 48,
    scaleMax: 72,
  },
}

export function metricFor(alert: LogisticsAlert): MetricDef | undefined {
  return alert.alert_key ? METRICS[alert.alert_key] : undefined
}

export function stageOf(
  alert: LogisticsAlert,
  opsType: OpsType | undefined,
  /** The chain the caller is rendering. Required to resolve a
   *  multi-activity operator correctly. */
  chain?: PrimitiveId[]
): PrimitiveId | undefined {
  const def = metricFor(alert)

  if (!def) return undefined

  if (opsType && opsType !== "multi") {
    return def.stage[opsType] ?? def.defaultStage
  }

  /* Multi-activity. The comment here used to say it picked the first
     mapping "that is actually in the composed chain", but it took
     Object.values(def.stage)[0] without looking at the chain at all. So
     a temperature reading for an operator running port and warehouse
     landed on transportRefrigere, a cold-chain stage they do not have,
     and was dropped from their flow entirely. Check the chain. */
  if (chain && chain.length > 0) {
    for (const candidate of Object.values(def.stage)) {
      if (candidate && chain.includes(candidate)) return candidate
    }

    if (chain.includes(def.defaultStage)) return def.defaultStage

    return undefined
  }

  return Object.values(def.stage)[0] ?? def.defaultStage
}

/** The measured value behind an alert.
 *
 *  Every logistics message puts its measurement first ("Conteneurs
 *  bloqués depuis 14h : ..."), so the number is read from there. The
 *  composite-score alert is the exception: its template is
 *  "Risque élevé (score {risk_score}/100)" and the backend never
 *  substitutes the placeholder, because fire() takes risk_score as a
 *  named parameter so it never reaches translate()'s kwargs, and
 *  translate() swallows the resulting KeyError and returns the raw
 *  template. Parsing that message yields 100, from "/100". The
 *  risk_score column is stored correctly, so read it instead and stay
 *  right whether or not the backend template is ever fixed. */
export function measuredValue(alert: LogisticsAlert): number | null {
  if (metricFor(alert)?.kind === "risk") {
    const stored = alert.risk_score

    if (typeof stored === "number" && Number.isFinite(stored)) {
      return Math.round(stored <= 1 ? stored * 100 : Math.min(stored, 100))
    }

    return null
  }

  const match = alert.message?.match(/-?\d+(?:[.,]\d+)?/)

  if (!match) return null

  const value = Number(match[0].replace(",", "."))

  return Number.isFinite(value) ? value : null
}

/** The part of the message after the last " : ", the backend's own
 *  instruction for this alert, used instead of an invented narrative. */
export function messageAdvice(alert: LogisticsAlert): string {
  const parts = (alert.message ?? "").split(" : ")

  return (parts.length > 1 ? parts[parts.length - 1] : "").trim()
}

/** The measured part of the message, before the first " : ". */
export function messageFinding(alert: LogisticsAlert): string {
  return (alert.message ?? "").split(" : ")[0].trim()
}

/* ------------------------------------------------------------------ */
/*  Derived signals                                                    */
/* ------------------------------------------------------------------ */

export function riskOf(alert: LogisticsAlert): number {
  const raw = alert.risk_score

  if (typeof raw === "number" && Number.isFinite(raw)) {
    /* The backend sends 0-100; a 0-1 score is normalized rather than
       rendered as "0%". */
    return Math.round(raw <= 1 ? raw * 100 : Math.min(raw, 100))
  }

  /* No score stored for this row. Severity is the only real signal
     left, so use it rather than pretending to a precise number. */
  return alert.severity === "CRITICAL" ? 75 : 45
}

export function hoursSince(iso: string): number | null {
  const then = new Date(iso).getTime()

  if (!Number.isFinite(then)) return null

  return Math.max(0, (Date.now() - then) / 36e5)
}

export function severityRank(severity: string): number {
  return severity === "CRITICAL" ? 2 : 1
}

export type StageSignal = {
  label: string
  /** Formatted measurement, e.g. "14 h". */
  value: string
  /** 0-100, for the bar width. */
  percent: number
  tone: StageStatus
  equipment: string
  alertKey: string
}

export type StageState = {
  id: PrimitiveId
  name: string
  status: StageStatus
  /** Alerts the backend attributed to this stage. */
  alerts: LogisticsAlert[]
  /** Highest risk score among this stage's alerts, 0 when none. */
  risk: number
  signals: StageSignal[]
}

function formatMeasured(value: number, unit: string): string {
  const rounded =
    Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10

  return unit ? `${rounded.toLocaleString("fr-FR")} ${unit}`.trim() : String(rounded)
}

export function signalOf(alert: LogisticsAlert): StageSignal | null {
  const def = metricFor(alert)

  if (!def) return null

  const value = measuredValue(alert)

  if (value === null) return null

  const percent = Math.max(
    6,
    Math.min(100, Math.round((Math.abs(value) / def.scaleMax) * 100))
  )

  return {
    label: def.label,
    value: formatMeasured(value, def.unit),
    percent,
    tone: alert.severity === "CRITICAL" ? "risk" : "watch",
    equipment: alert.equipment,
    alertKey: alert.alert_key ?? "",
  }
}

/** Per-stage state for the whole flow chain, from real alerts only.
 *  A stage with no alerts is "good" because nothing was reported for
 *  it, and the caller is told how many alerts it has so it can say
 *  "aucun signal" rather than implying a verified clean reading. */
export function deriveStages(
  alerts: LogisticsAlert[],
  opsType: OpsType | undefined,
  selectedForMulti: Exclude<OpsType, "multi">[] = []
): StageState[] {
  const chain = chainFor(opsType, selectedForMulti)
  const byStage = new Map<PrimitiveId, LogisticsAlert[]>()

  for (const alert of alerts) {
    const stage = stageOf(alert, opsType, chain)

    if (!stage || !chain.includes(stage)) continue

    const bucket = byStage.get(stage)

    if (bucket) bucket.push(alert)
    else byStage.set(stage, [alert])
  }

  return chain.map((id) => {
    const stageAlerts = (byStage.get(id) ?? []).slice().sort(
      (a, b) =>
        severityRank(b.severity) - severityRank(a.severity) ||
        riskOf(b) - riskOf(a)
    )

    const critical = stageAlerts.some((a) => a.severity === "CRITICAL")

    const status: StageStatus =
      stageAlerts.length === 0 ? "good" : critical ? "risk" : "watch"

    const signals = stageAlerts
      .map(signalOf)
      .filter((s): s is StageSignal => s !== null)

    return {
      id,
      name: PRIMITIVE_NAMES[id],
      status,
      alerts: stageAlerts,
      risk: stageAlerts.length > 0 ? Math.max(...stageAlerts.map(riskOf)) : 0,
      signals,
    }
  })
}

/** The one alert driving the view: worst severity, then highest risk. */
export function leadAlert(alerts: LogisticsAlert[]): LogisticsAlert | null {
  if (alerts.length === 0) return null

  return alerts.slice().sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) ||
      riskOf(b) - riskOf(a) ||
      new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0]
}

/** Global risk across the flow: the worst stage, not an average, since
 *  a flow is only as healthy as its blocking stage. */
export function globalRisk(stages: StageState[]): number {
  const scored = stages.filter((s) => s.alerts.length > 0)

  if (scored.length === 0) return 0

  return Math.max(...scored.map((s) => s.risk))
}

/** How many separate pieces of equipment reported this alert pattern
 *  before. Feeds the confidence score's recurrence input. */
export function recurrenceOf(
  alert: LogisticsAlert,
  alerts: LogisticsAlert[]
): number {
  return alerts.filter(
    (a) => a.alert_key === alert.alert_key && a.equipment === alert.equipment
  ).length
}

/** How strongly a stage's signals agree: the share of its alerts that
 *  are CRITICAL. Feeds the confidence score's convergence input. */
export function convergenceOf(stage: StageState | undefined): number {
  if (!stage || stage.alerts.length === 0) return 0.5

  const critical = stage.alerts.filter((a) => a.severity === "CRITICAL").length

  return critical / stage.alerts.length
}

export type Breakpoint = {
  stage: PrimitiveId
  stageName: string
  title: string
  risk: number
  /** Real impact: how many distinct assets are behind this breakpoint. */
  equipmentCount: number
  equipment: string[]
  severity: string
  tone: "watch" | "risk"
}

/** Real breakpoints: one per (stage, alert family), ranked by risk. */
export function deriveBreakpoints(
  stages: StageState[],
  limit = 4
): Breakpoint[] {
  const groups = new Map<string, Breakpoint>()

  for (const stage of stages) {
    for (const alert of stage.alerts) {
      const def = metricFor(alert)
      const key = `${stage.id}:${def?.kind ?? alert.alert_key ?? "autre"}`
      const existing = groups.get(key)
      const risk = riskOf(alert)

      if (existing) {
        existing.risk = Math.max(existing.risk, risk)

        if (!existing.equipment.includes(alert.equipment)) {
          existing.equipment.push(alert.equipment)
          existing.equipmentCount = existing.equipment.length
        }

        if (alert.severity === "CRITICAL") {
          existing.severity = "CRITICAL"
          existing.tone = "risk"
        }

        continue
      }

      groups.set(key, {
        stage: stage.id,
        stageName: stage.name,
        title: def?.label ?? messageFinding(alert),
        risk,
        equipmentCount: 1,
        equipment: [alert.equipment],
        severity: alert.severity,
        tone: alert.severity === "CRITICAL" ? "risk" : "watch",
      })
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.risk - a.risk)
    .slice(0, limit)
}

/* ------------------------------------------------------------------ */
/*  Projection: built from real timestamps, not invented milestones  */
/* ------------------------------------------------------------------ */

export type ProjectionStep = {
  when: string
  detail: string
  tone?: "watch" | "risk"
  /** True for the step describing the present, which is measured
   *  rather than projected. */
  measured?: boolean
}

/** A three-step projection anchored on the alert's own age and metric.
 *
 *  The old version hardcoded "+24 h" and "+48 h" per ops type. This one
 *  reads how long the condition has actually been open and projects the
 *  same rate forward, so the horizon moves with the data and the first
 *  step is a measurement rather than a guess. */
export function deriveProjection(
  alert: LogisticsAlert | null,
  stage: StageState | undefined
): ProjectionStep[] {
  if (!alert) return []

  const def = metricFor(alert)
  const value = measuredValue(alert)
  const age = hoursSince(alert.date)
  const openFor =
    age === null
      ? null
      : age < 1
        ? `depuis ${Math.max(1, Math.round(age * 60))} min`
        : `depuis ${Math.round(age)} h`

  const steps: ProjectionStep[] = [
    {
      when: "Constaté",
      detail:
        value !== null && def
          ? `${def.label} à ${formatMeasured(value, def.unit)}${
              openFor ? `, ${openFor}` : ""
            }`
          : sentenceCase(messageFinding(alert)),
      measured: true,
    },
  ]

  const otherStageAlerts = (stage?.alerts ?? []).filter((a) => a !== alert)

  if (otherStageAlerts.length > 0) {
    steps.push({
      when: "En parallèle",
      detail: `${countOf(
        otherStageAlerts.length,
        "autre signal",
        "autres signaux"
      )} sur ${stage?.name ?? "cette étape"}`,
      tone: "watch",
    })
  }

  /* The backend's own instruction is rendered once, in the
     recommendation block. Repeating it here as a projected consequence
     printed the same sentence twice on the same screen. */
  if (alert.severity === "CRITICAL") {
    steps.push({
      when: "Niveau",
      detail: "Seuil critique franchi, cette étape bloque le flux en aval.",
      tone: "risk",
    })
  }

  return steps
}

/* ------------------------------------------------------------------ */
/*  Cost exposure: real overruns, named rates, visible arithmetic    */
/* ------------------------------------------------------------------ */

/** What an hour past the threshold costs, per metric kind.
 *
 *  These are assumptions, not measurements, and they are the only
 *  assumptions in this module. The views render them as an editable
 *  rate next to the result so the figure is never presented as
 *  something the backend measured. */
/* Only the three signals with a genuine per-unit overrun are priced.
   Duty cycles were priced here too, from a threshold of zero, so a
   reading of "214/220 cycles" billed all 214 and dominated the total
   with 6 420 euros of exposure that nothing supported. Being near a
   cycle limit is a maintenance risk, not a billable overrun, so it
   belongs in the blockages view rather than in a euro figure. */
export type CostRates = Record<
  "wait" | "temperature" | "service" | "demurrage",
  number
>

export const DEFAULT_COST_RATES: CostRates = {
  wait: 45,
  temperature: 120,
  service: 15,
  demurrage: 6,
}

export const RATE_LABELS: Record<keyof CostRates, string> = {
  wait: "Immobilisation",
  temperature: "Écart de température",
  service: "Entretien différé",
  demurrage: "Surestarie",
}

/** The unit beside each rate, in the operator's own currency.
 *
 *  These were hardcoded with a euro sign while the rates themselves are
 *  numbers the operator types in the cost view. A Lagos terminal
 *  entering 45000 for immobilisation means naira, and stamping "€ / h"
 *  on it was simply false. No conversion happens here: the symbol
 *  labels their own figure. */
export function rateUnits(symbol: string): Record<keyof CostRates, string> {
  return {
    wait: `${symbol} / h au-delà de 8 h`,
    temperature: `${symbol} / °C au-delà de 8 °C`,
    service: `${symbol} / jour au-delà de 30 j`,
    /* Already the overrun past free time, so the threshold is zero: the
       backend did the comparison against the deadline. */
    demurrage: `${symbol} / h de surestarie exposée`,
  }
}

const RATE_THRESHOLDS: Record<keyof CostRates, number> = {
  wait: 8,
  temperature: 8,
  service: 30,
  demurrage: 0,
}

export type ExposureLine = {
  equipment: string
  stage: PrimitiveId | undefined
  stageName: string
  kind: keyof CostRates
  kindLabel: string
  /** The measured value from the alert. */
  measured: number
  unit: string
  /** How far past the threshold, the part that costs money. */
  overrun: number
  ratePerUnit: number
  exposure: number
  severity: string
  alertKey: string
}

/** The latest reading per asset and per metric.
 *
 *  Alerts accumulate: the same open condition is recorded again on every
 *  upload, so CHAMBRE-FROIDE-2 at 79 days without service appears once
 *  per file. Summing those rows triples an exposure that only exists
 *  once, and lists the same queue several times. Anything describing the
 *  situation as it stands now has to collapse to the newest row per
 *  asset and metric first. Counting how many alerts were recorded over a
 *  period is a different question and still uses every row. */
export function currentReadings(alerts: LogisticsAlert[]): LogisticsAlert[] {
  const latest = new Map<string, LogisticsAlert>()

  for (const alert of alerts) {
    const def = metricFor(alert)

    if (!def) continue

    const key = `${alert.equipment}:${def.kind}`
    const existing = latest.get(key)

    if (
      !existing ||
      new Date(alert.date).getTime() > new Date(existing.date).getTime()
    ) {
      latest.set(key, alert)
    }
  }

  return [...latest.values()]
}

export function deriveExposure(
  alerts: LogisticsAlert[],
  opsType: OpsType | undefined,
  rates: CostRates = DEFAULT_COST_RATES,
  selectedForMulti: Exclude<OpsType, "multi">[] = []
): ExposureLine[] {
  const chain = chainFor(opsType, selectedForMulti)
  const lines: ExposureLine[] = []

  for (const alert of currentReadings(alerts)) {
    const def = metricFor(alert)

    if (!def) continue

    const kind = def.kind

    if (
      kind !== "wait" &&
      kind !== "temperature" &&
      kind !== "service" &&
      kind !== "demurrage"
    ) {
      continue
    }

    const measured = measuredValue(alert)

    if (measured === null) continue

    const threshold = RATE_THRESHOLDS[kind]
    const overrun = Math.max(0, measured - threshold)

    if (overrun <= 0) continue

    const stage = stageOf(alert, opsType, chain)

    lines.push({
      equipment: alert.equipment,
      stage,
      stageName: stage ? PRIMITIVE_NAMES[stage] : "Hors chaîne",
      kind,
      kindLabel: def.label,
      measured,
      unit: def.unit,
      overrun: Math.round(overrun * 10) / 10,
      ratePerUnit: rates[kind],
      exposure: Math.round(overrun * rates[kind]),
      severity: alert.severity,
      alertKey: alert.alert_key ?? "",
    })
  }

  return lines.sort((a, b) => b.exposure - a.exposure)
}

/* ------------------------------------------------------------------ */
/*  Queues: real wait measurements                                   */
/* ------------------------------------------------------------------ */

export type QueueLine = {
  equipment: string
  hours: number
  severity: string
  stage: PrimitiveId | undefined
  stageName: string
  risk: number
  date: string
  advice: string
}

/** Everything the backend measured a wait time for, longest first. */
export function deriveQueues(
  alerts: LogisticsAlert[],
  opsType: OpsType | undefined,
  selectedForMulti: Exclude<OpsType, "multi">[] = []
): QueueLine[] {
  const chain = chainFor(opsType, selectedForMulti)
  const lines: QueueLine[] = []

  for (const alert of currentReadings(alerts)) {
    const def = metricFor(alert)

    if (!def || def.kind !== "wait") continue

    const hours = measuredValue(alert)

    if (hours === null) continue

    const stage = stageOf(alert, opsType, chain)

    lines.push({
      equipment: alert.equipment,
      hours,
      severity: alert.severity,
      stage,
      stageName: stage ? PRIMITIVE_NAMES[stage] : "Hors chaîne",
      risk: riskOf(alert),
      date: alert.date,
      advice: messageAdvice(alert),
    })
  }

  return lines.sort((a, b) => b.hours - a.hours)
}

/* ------------------------------------------------------------------ */
/*  Trend: real daily counts                                         */
/* ------------------------------------------------------------------ */

/** Alert counts per day over the last `days` days, oldest first. */
export function dailyCounts(
  alerts: LogisticsAlert[],
  days = 7,
  match?: (alert: LogisticsAlert) => boolean
): number[] {
  const counts = new Array(days).fill(0)
  const now = Date.now()

  for (const alert of alerts) {
    if (match && !match(alert)) continue

    const then = new Date(alert.date).getTime()

    if (!Number.isFinite(then)) continue

    const dayIndex = days - 1 - Math.floor((now - then) / 864e5)

    if (dayIndex >= 0 && dayIndex < days) counts[dayIndex] += 1
  }

  return counts
}

export function formatEuros(value: number): string {
  return Math.round(value).toLocaleString("fr-FR")
}

export function formatHours(hours: number): string {
  /* Round to whole minutes first and carry. Rounding the remainder on
     its own printed "21 h 60" for 21.996 hours. */
  const totalMinutes = Math.round(hours * 60)

  if (totalMinutes < 60) return `${totalMinutes} min`

  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return minutes === 0
    ? `${wholeHours} h`
    : `${wholeHours} h ${String(minutes).padStart(2, "0")}`
}

/** "09 : 20" style clock, for the flow card's headline figure. */
export function formatClock(hours: number): string {
  const total = Math.max(0, Math.round(hours * 60))
  const hh = Math.floor(total / 60)
  const mm = total % 60

  return `${String(hh).padStart(2, "0")} : ${String(mm).padStart(2, "0")}`
}

/** French plural helper. Written once because inlining
 *  `signal${n > 1 ? "aux" : ""}` produced "4 signalaux" on screen. */
export function plural(
  count: number,
  singular: string,
  pluralForm?: string
): string {
  if (count <= 1) return singular

  return pluralForm ?? `${singular}s`
}

/** "3 étapes", with the number. */
export function countOf(
  count: number,
  singular: string,
  pluralForm?: string
): string {
  return `${count} ${plural(count, singular, pluralForm)}`
}

/** Backend messages start lowercase because they are clause fragments.
 *  This makes one a sentence without touching the rest of the string. */
export function sentenceCase(text: string): string {
  if (!text) return text

  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const STATUS_WORDS: Record<StageStatus, string> = {
  good: "Aucun signal",
  watch: "Sous tension",
  risk: "Rupture",
}

/* ------------------------------------------------------------------ */
/*  Anticipation: measured lead time, not a claimed one              */
/* ------------------------------------------------------------------ */

/** A predictive alert is one the backend fired on its composite risk
 *  score before any single metric crossed its own threshold
 *  (logistics.risk.elevated). Those are the rows where SentrIA spoke
 *  first, so they are the only honest basis for a lead-time claim. */
export function isPredictive(alert: LogisticsAlert): boolean {
  return alert.alert_key === "logistics.risk.elevated"
}

export type AnticipationLine = {
  equipment: string
  /** When the predictive alert fired. */
  warnedAt: string
  warnedRisk: number
  /** The first threshold alert on the same equipment after the warning,
   *  when one exists. */
  confirmedAt: string | null
  confirmedBy: string | null
  confirmedSeverity: string | null
  /** Hours between the warning and the confirmation. Null while the
   *  condition has not been confirmed. */
  leadHours: number | null
  /** How long the warning has been open with no confirmation yet. */
  openHours: number | null
  stage: PrimitiveId | undefined
  stageName: string
}

/** Pair each predictive alert with the threshold alert that later
 *  confirmed it on the same equipment, and measure the gap. */
export function deriveAnticipation(
  alerts: LogisticsAlert[],
  opsType: OpsType | undefined,
  selectedForMulti: Exclude<OpsType, "multi">[] = []
): AnticipationLine[] {
  const chain = chainFor(opsType, selectedForMulti)
  const predictive = alerts.filter(isPredictive)
  const thresholdAlerts = alerts.filter((a) => !isPredictive(a) && metricFor(a))

  return predictive
    .map((warning) => {
      const warnedTime = new Date(warning.date).getTime()

      const confirmation = thresholdAlerts
        .filter((a) => a.equipment === warning.equipment)
        .filter((a) => {
          const time = new Date(a.date).getTime()

          return Number.isFinite(time) && time > warnedTime
        })
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )[0]

      const stage = confirmation
        ? stageOf(confirmation, opsType, chain)
        : stageOf(warning, opsType, chain)

      const leadHours = confirmation
        ? Math.max(
            0,
            (new Date(confirmation.date).getTime() - warnedTime) / 36e5
          )
        : null

      return {
        equipment: warning.equipment,
        warnedAt: warning.date,
        warnedRisk: riskOf(warning),
        confirmedAt: confirmation?.date ?? null,
        confirmedBy: confirmation ? metricFor(confirmation)?.label ?? null : null,
        confirmedSeverity: confirmation?.severity ?? null,
        leadHours,
        openHours: confirmation ? null : hoursSince(warning.date),
        stage,
        stageName: stage ? PRIMITIVE_NAMES[stage] : "Hors chaîne",
      }
    })
    .sort((a, b) => (b.leadHours ?? -1) - (a.leadHours ?? -1))
}

/* ------------------------------------------------------------------ */
/*  Recommendations: grouped by cause, ordered by leverage            */
/* ------------------------------------------------------------------ */

/** What the board renders. Shaped like the backend's /recommendations
 *  row so the existing board keeps working, plus the four fields the
 *  backend cannot produce because it does not know the chain. */
export type LogisticsRecommendation = {
  id: string
  equipment: string
  sector: string
  severity: string
  date: string
  message: string
  risk_score: number
  alert_key: string | null
  recommended_action: string
  action_category: string
  /** Where in the chain this sits. */
  stage: PrimitiveId
  stageName: string
  /** How many stages downstream wait on this one. This is the leverage:
   *  clearing Quai clears Cour and Enlèvement, clearing Enlèvement
   *  clears nothing. */
  downstream: number
  /** Signals folded into this one recommendation. */
  alertCount: number
  /** Euro exposure this asset carries, from deriveExposure, so the card
   *  can say what acting is worth rather than only how bad it is. */
  exposureEUR: number
  /** Measured risk plus the leverage bonus, which is what the list is
   *  ordered on. Printed on the card so the order is checkable. */
  score: number
  /** Why it is ranked where it is, in one sentence. */
  reasoning: string
}

/** What one unblocked downstream stage is worth, in risk points.
 *
 *  Leverage has to tilt close calls without overriding a real gap. The
 *  first version sorted on leverage before risk, which put a vessel at
 *  81 ahead of a crane at 95 about to stop the quay, because the vessel
 *  happened to sit one stage further upstream. Five points a stage means
 *  a three-stage advantage beats a fifteen-point risk gap and no more. */
export const LEVERAGE_POINTS_PER_STAGE = 5

const KIND_CATEGORY: Partial<Record<MetricKind, string>> = {
  wait: "delay",
  temperature: "cold_chain",
  cycles: "capacity",
  pressure: "maintenance",
  fuel: "fuel",
  service: "maintenance",
  mileage: "maintenance",
  risk: "predictive",
  engine: "maintenance",
  oil: "maintenance",
  tires: "maintenance",
  berth: "delay",
  eta: "delay",
  discharge: "capacity",
  demurrage: "delay",
  documents: "delay",
  dwell: "delay",
  inspection: "delay",
}

/** One recommendation per asset per stage, ranked by leverage.
 *
 *  The backend's /recommendations returns the worst N alerts
 *  independently of each other, because it has no idea the chain exists.
 *  On a port that meant GRUE-02 appearing three times, once for its
 *  pressure, once for its immobilisation and once for its cycles, as if
 *  they were three problems needing three decisions. And it ranked a
 *  blocked Enlèvement, which holds up nothing, level with a blocked
 *  Quai, which holds up everything after it.
 *
 *  So: fold an asset's signals at one stage into a single decision, and
 *  rank by what acting actually unblocks. Severity first, because a
 *  rupture outranks tension whatever its position; then leverage, the
 *  number of stages waiting downstream; then the measured risk. Every
 *  step of that is printed on the card, so the order is checkable. */
export function deriveRecommendations(
  alerts: LogisticsAlert[],
  opsType: OpsType | undefined,
  selectedForMulti: Exclude<OpsType, "multi">[] = [],
  rates: CostRates = DEFAULT_COST_RATES,
  limit = 12
): LogisticsRecommendation[] {
  const chain = chainFor(opsType, selectedForMulti)
  const stages = deriveStages(alerts, opsType, selectedForMulti)

  /* Euro exposure per asset AND stage. Keying it on the asset alone
     double-counted: GRUE-02 carries readings at both Quai and Cour, so
     its full 1 110 euros appeared on both cards as if acting on either
     saved the whole amount. deriveExposure already knows which stage
     each overrun sits on, so use it. */
  const exposureByAssetStage = new Map<string, number>()

  for (const line of deriveExposure(alerts, opsType, rates, selectedForMulti)) {
    if (!line.stage) continue

    const key = `${line.stage}:${line.equipment}`

    exposureByAssetStage.set(
      key,
      (exposureByAssetStage.get(key) ?? 0) + line.exposure
    )
  }

  const out: LogisticsRecommendation[] = []

  stages.forEach((stage, stageIndex) => {
    if (stage.alerts.length === 0) return

    const byAsset = new Map<string, LogisticsAlert[]>()

    for (const alert of stage.alerts) {
      const bucket = byAsset.get(alert.equipment)

      if (bucket) bucket.push(alert)
      else byAsset.set(alert.equipment, [alert])
    }

    const downstream = Math.max(0, chain.length - stageIndex - 1)

    for (const [equipment, assetAlerts] of byAsset) {
      const lead = leadAlert(assetAlerts)

      if (!lead) continue

      const advice = messageAdvice(lead)
      const def = metricFor(lead)
      const risk = Math.max(...assetAlerts.map(riskOf))
      const critical = assetAlerts.filter(
        (a) => a.severity === "CRITICAL"
      ).length
      const exposure =
        exposureByAssetStage.get(`${stage.id}:${equipment}`) ?? 0

      const findings =
        assetAlerts.length === 1
          ? messageFinding(lead)
          : `${countOf(assetAlerts.length, "signal", "signaux")} sur ${
              stage.name
            }, dont ${countOf(critical, "critique")}`

      const reasons: string[] = []

      if (critical > 0) reasons.push("seuil critique franchi")

      if (downstream > 0) {
        reasons.push(
          `débloque ${countOf(downstream, "étape")} en aval, +${
            downstream * LEVERAGE_POINTS_PER_STAGE
          } pts`
        )
      }

      reasons.push(`risque ${risk}/100`)

      if (exposure > 0) {
        /* No symbol here: the caller knows the operator's currency and
           appends it. Embedding one made every recommendation claim
           euros. */
        reasons.push(`${formatEuros(exposure)} exposés`)
      }

      const score =
        risk + downstream * LEVERAGE_POINTS_PER_STAGE

      out.push({
        id: `${stage.id}:${equipment}`,
        equipment,
        sector: "logistics",
        severity: critical > 0 ? "CRITICAL" : lead.severity,
        date: lead.date,
        message: findings,
        risk_score: risk,
        alert_key: lead.alert_key ?? null,
        recommended_action:
          sentenceCase(advice) ||
          `Traiter ${equipment} sur ${stage.name.toLowerCase()}.`,
        action_category: (def && KIND_CATEGORY[def.kind]) || "other",
        stage: stage.id,
        stageName: stage.name,
        downstream,
        alertCount: assetAlerts.length,
        exposureEUR: exposure,
        score,
        reasoning: reasons.join(" · "),
      })
    }
  })

  return out
    .sort(
      (a, b) =>
        severityRank(b.severity) - severityRank(a.severity) ||
        b.score - a.score ||
        b.exposureEUR - a.exposureEUR
    )
    .slice(0, limit)
}
