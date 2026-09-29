import type { Sector } from "@/lib/priorities"
import { localized, type Localized } from "@/lib/i18n"

/** The subscription plans and what each one allows.
 *
 *  The same rules live in the API (pipeline/plans.py in the backend):
 *  this file decides what the app offers, the API decides what it
 *  accepts. Keep the two in step. */

export type PlanId = "decouverte" | "pro" | "business" | "entreprise"

export const PLAN_ORDER: PlanId[] = ["decouverte", "pro", "business", "entreprise"]

export const PLAN_NAMES: Record<PlanId, string> = {
  decouverte: "Découverte",
  pro: "Pro",
  business: "Business",
  entreprise: "Entreprise",
}

export const TRIAL_DAYS = 14

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_ORDER as string[]).includes(value)
}

export function atLeast(plan: PlanId, minimum: PlanId): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(minimum)
}

/** The plan in force: the paid one, or Business while the trial runs. */
export function effectivePlan(plan: PlanId, trialEndsAt: string | null, now = Date.now()): PlanId {
  const trialing = trialEndsAt !== null && Date.parse(trialEndsAt) > now
  return trialing && !atLeast(plan, "business") ? "business" : plan
}

export function trialDaysLeft(trialEndsAt: string | null, now = Date.now()): number {
  if (!trialEndsAt) return 0
  const ms = Date.parse(trialEndsAt) - now
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0
}

/* ------------------------------------------------------------------ */
/*  Which departments one company can run together (Business and up)   */
/* ------------------------------------------------------------------ */

/** Departments that really run together in one company, per sector. Any
 *  two or more departments from the same group may be combined; a
 *  sector with no group (industry) is one department only. */
export const DEPARTMENT_GROUPS: Partial<Record<Sector, string[][]>> = {
  // A hospital has its own pharmacy and lab. A pharma wholesaler sells
  // to them: a separate business.
  health: [["clinique-hopital", "pharmacie", "laboratoire"]],
  // Cooperatives and large farms store their own harvest; the farms are
  // the coop's members, not the coop.
  agriculture: [
    ["cooperative-agricole", "silo-stockage"],
    ["exploitation-agricole", "silo-stockage"],
  ],
  // Integrated utilities produce and distribute.
  energy: [["centrale-production", "distribution-energetique"]],
  // Wholesalers that supply their own shops.
  commerce: [["grossiste-distributeur", "chaine-magasins", "supermarche-hypermarche"]],
  // Hauliers that rent out idle trucks.
  transportation: [["transporteur-routier", "location-vehicules"]],
  // One operator often runs the whole chain.
  logistics: [[
    "port-conteneurs",
    "entrepot-manutention",
    "transport-distribution",
    "preparation-expedition",
    "chaine-froid",
    "plusieurs-activites",
  ]],
}

/** Whether these departments of one sector can be run together at all. */
export function isAllowedCombo(sector: string, departments: string[]): boolean {
  const unique = Array.from(new Set(departments))
  if (unique.length <= 1) return true
  const groups = DEPARTMENT_GROUPS[sector as Sector] ?? []
  return groups.some((group) => unique.every((id) => group.includes(id)))
}

/** The departments that can still be added to `chosen` in this sector. */
export function combinableWith(sector: string, chosen: string[]): Set<string> {
  const out = new Set<string>()
  for (const group of DEPARTMENT_GROUPS[sector as Sector] ?? []) {
    if (chosen.every((id) => group.includes(id))) group.forEach((id) => out.add(id))
  }
  return out
}

export type PlanCheck =
  | { ok: true }
  | { ok: false; code: "plan_sectors" | "plan_departments" | "plan_combo"; needs: PlanId }

/** Can this plan hold these sectors and departments? */
export function checkPlan(plan: PlanId, departments: Record<string, string[]>): PlanCheck {
  const sectors = Object.keys(departments).filter((s) => departments[s]?.length)

  if (sectors.length > 1 && !atLeast(plan, "entreprise")) {
    return { ok: false, code: "plan_sectors", needs: "entreprise" }
  }

  for (const sector of sectors) {
    const list = Array.from(new Set(departments[sector]))
    if (list.length <= 1) continue
    if (!atLeast(plan, "entreprise") && !isAllowedCombo(sector, list)) {
      return { ok: false, code: "plan_combo", needs: "entreprise" }
    }
    if (!atLeast(plan, "business")) {
      return { ok: false, code: "plan_departments", needs: "business" }
    }
  }

  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  Prices                                                             */
/* ------------------------------------------------------------------ */

/** Monthly prices per currency: [Pro, Business]. Set per market, not
 *  converted: a price that is fair in Paris is not in Lagos. A currency
 *  missing here is billed in US dollars. Annual = 10 months. */
export const PRICES: Record<string, [number, number]> = {
  XOF: [15_000, 45_000],
  XAF: [15_000, 45_000],
  NGN: [20_000, 60_000],
  GHS: [250, 750],
  KES: [2_500, 7_500],
  TZS: [50_000, 150_000],
  CDF: [50_000, 150_000],
  MAD: [250, 750],
  EUR: [29, 89],
  USD: [29, 89],
  GBP: [25, 79],
  BRL: [129, 399],
}

export const PRICE_FALLBACK_CURRENCY = "USD"

/** { amount, currency } for a plan per month, or null for free / quote. */
export function monthlyPrice(plan: PlanId, currencyCode: string): { amount: number; currency: string } | null {
  if (plan === "decouverte" || plan === "entreprise") return null
  const currency = PRICES[currencyCode] ? currencyCode : PRICE_FALLBACK_CURRENCY
  const [pro, business] = PRICES[currency]
  return { amount: plan === "pro" ? pro : business, currency }
}

/* ------------------------------------------------------------------ */
/*  What each plan includes (only what the product does today)         */
/* ------------------------------------------------------------------ */

export type PlanLimits = {
  sectors: Localized
  departments: Localized
  sitesUsers: Localized
  alerts: Localized
  ask: Localized
  history: Localized
  tracking: boolean
  ml: boolean
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  decouverte: {
    sectors: localized("1 secteur", "1 sector"),
    departments: localized("1 département", "1 department"),
    sitesUsers: localized("1 site · 1 utilisateur", "1 site · 1 user"),
    alerts: localized("Alertes dans l'app", "In-app alerts"),
    ask: localized("Ask SentrIA · 20 questions/mois", "Ask SentrIA · 20 questions/month"),
    history: localized("Historique 30 jours", "30-day history"),
    tracking: false,
    ml: false,
  },
  pro: {
    sectors: localized("1 secteur", "1 sector"),
    departments: localized("1 département", "1 department"),
    sitesUsers: localized("1 site · 3 utilisateurs", "1 site · 3 users"),
    alerts: localized("Alertes app + SMS", "App + SMS alerts"),
    ask: localized("Ask SentrIA illimité", "Unlimited Ask SentrIA"),
    history: localized("Historique 12 mois", "12-month history"),
    tracking: true,
    ml: false,
  },
  business: {
    sectors: localized("1 secteur", "1 sector"),
    departments: localized("Plusieurs départements liés", "Several linked departments"),
    sitesUsers: localized("3 sites · 10 utilisateurs", "3 sites · 10 users"),
    alerts: localized("Alertes app + SMS", "App + SMS alerts"),
    ask: localized("Ask SentrIA illimité", "Unlimited Ask SentrIA"),
    history: localized("Historique 24 mois", "24-month history"),
    tracking: true,
    ml: true,
  },
  entreprise: {
    sectors: localized("Plusieurs secteurs", "Several sectors"),
    departments: localized("Tous les départements", "All departments"),
    sitesUsers: localized("Sites et utilisateurs illimités", "Unlimited sites and users"),
    alerts: localized("Alertes app + SMS", "App + SMS alerts"),
    ask: localized("Ask SentrIA illimité", "Unlimited Ask SentrIA"),
    history: localized("Historique illimité", "Unlimited history"),
    tracking: true,
    ml: true,
  },
}

/* ------------------------------------------------------------------ */
/*  The account's plan, as loaded at sign-in (lib/account.ts)          */
/* ------------------------------------------------------------------ */

export const PLAN_KEY = "sentria_plan"
export const TRIAL_KEY = "sentria_trial_ends_at"
export const PLAN_UPDATED_EVENT = "sentria_plan_updated"

export type AccountPlan = { plan: PlanId; trialEndsAt: string | null; effective: PlanId }

export function readAccountPlan(): AccountPlan {
  let plan: PlanId = "decouverte"
  let trialEndsAt: string | null = null
  try {
    const stored = localStorage.getItem(PLAN_KEY)
    if (isPlanId(stored)) plan = stored
    trialEndsAt = localStorage.getItem(TRIAL_KEY)
  } catch {
    /* no storage: the free plan */
  }
  return { plan, trialEndsAt, effective: effectivePlan(plan, trialEndsAt) }
}

/* ------------------------------------------------------------------ */
/*  The account's departments (saved by the onboarding)                */
/* ------------------------------------------------------------------ */

/** {sector: [department ids]} the company runs, as the onboarding saved
 *  it. Accounts from before it fall back to their one activity. */
export const DEPARTMENTS_KEY = "sentria_departments"

export function readDepartments(): Record<string, string[]> {
  try {
    const saved = JSON.parse(localStorage.getItem(DEPARTMENTS_KEY) || "null")
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      const out: Record<string, string[]> = {}
      for (const [sector, list] of Object.entries(saved)) {
        if (Array.isArray(list)) out[sector] = list.filter((d): d is string => typeof d === "string")
      }
      return out
    }
  } catch {
    /* fall through */
  }

  try {
    const sector = localStorage.getItem("sentria_sector")
    const activity = localStorage.getItem("sentria_business_type")
    if (sector && sector !== "all" && activity) return { [sector]: [activity] }
  } catch {
    /* no storage */
  }

  return {}
}

/** The sectors the plan lets the account use: the first one only,
 *  unless the plan is Entreprise. */
export function sectorsForPlan(sectors: string[], plan: PlanId): string[] {
  return atLeast(plan, "entreprise") ? sectors : sectors.slice(0, 1)
}

/** The departments of `sector` the account may upload for: those it
 *  runs, plus any the plan lets it add to them. */
export function departmentsForPlan(
  sector: string,
  all: string[],
  held: string[],
  plan: PlanId
): string[] {
  if (atLeast(plan, "entreprise")) return all
  if (held.length === 0) return all
  return all.filter((id) => checkPlan(plan, { [sector]: [...held, id] }).ok)
}
