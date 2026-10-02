import type { Sector } from "@/lib/priorities"
import { localized, type Localized } from "@/lib/i18n"

/** The subscription plans and what each one allows.
 *
 *  The numbers come from the API (GET /plans, defined once in
 *  pipeline/entitlements.py in the backend) and are applied here by
 *  applyEntitlements(), so what the app shows is what the API enforces.
 *  The values below are only the defaults used until that answer
 *  arrives (or when the API is unreachable): they mirror the backend. */

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

  if (sectors.length > 1 && !holdsSeveralSectors(plan)) {
    return { ok: false, code: "plan_sectors", needs: cheapestPlan((e) => e.sectors === null) }
  }

  for (const sector of sectors) {
    const list = Array.from(new Set(departments[sector]))
    if (list.length <= 1) continue
    const kind = ENTITLEMENTS[plan].departments
    if (kind !== "any" && !isAllowedCombo(sector, list)) {
      return { ok: false, code: "plan_combo", needs: cheapestPlan((e) => e.departments === "any") }
    }
    if (kind === "one") {
      return { ok: false, code: "plan_departments", needs: cheapestPlan((e) => e.departments !== "one") }
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

/** What a plan includes, as numbers and flags: the shape of one entry of
 *  GET /plans. null is "no limit". */
export type Entitlement = {
  sectors: number | null
  departments: "one" | "linked" | "any"
  sites: number | null
  users: number | null
  ask_per_month: number | null
  history_days: number | null
  sms: boolean
  tracking: boolean
  ml: boolean
}

/** The defaults, identical to pipeline/entitlements.py until /plans says
 *  otherwise. Edited in place by applyEntitlements(). */
export const ENTITLEMENTS: Record<PlanId, Entitlement> = {
  decouverte: { sectors: 1, departments: "one", sites: 1, users: 1, ask_per_month: 20, history_days: 30, sms: false, tracking: false, ml: false },
  pro: { sectors: 1, departments: "one", sites: 1, users: 3, ask_per_month: null, history_days: 365, sms: true, tracking: true, ml: false },
  business: { sectors: 1, departments: "linked", sites: 3, users: 10, ask_per_month: null, history_days: 730, sms: true, tracking: true, ml: true },
  entreprise: { sectors: null, departments: "any", sites: null, users: null, ask_per_month: null, history_days: null, sms: true, tracking: true, ml: true },
}

function holdsSeveralSectors(plan: PlanId): boolean {
  return ENTITLEMENTS[plan].sectors === null
}

/** The lowest plan whose entitlements satisfy `test`. */
function cheapestPlan(test: (e: Entitlement) => boolean): PlanId {
  return PLAN_ORDER.find((plan) => test(ENTITLEMENTS[plan])) ?? "entreprise"
}

/* ------------------------------------------------------------------ */
/*  What a plan can do (C-PRICE)                                       */
/* ------------------------------------------------------------------ */

/** A kind of value: detect, anticipate and estimate, coordinate. */
export type CapabilityTier = { key: string; label: Localized; summary: Localized }

/** One thing a plan can do, and the lowest plan that includes it. */
export type Capability = {
  key: string
  tier: string
  plan: PlanId
  /** False while it is on the roadmap: the page says "soon". */
  live: boolean
  label: Localized
}

/** From GET /plans (pipeline/entitlements.py CAPABILITIES), applied in place
 *  by applyEntitlements(). Empty until that answer arrives: there is no
 *  bundled copy, so the page draws nothing rather than a list that could
 *  disagree with what the API says. */
export const TIERS: CapabilityTier[] = []
export const CAPABILITIES: Capability[] = []

/** Does this plan include the capability? Every plan above its lowest one does. */
export function includesCapability(plan: PlanId, capability: Capability): boolean {
  return atLeast(plan, capability.plan)
}

const asText = (v: unknown): v is string => typeof v === "string" && v.trim() !== ""
const asLabel = (v: unknown): Localized | null => {
  const l = v as { fr?: unknown; en?: unknown } | null
  return l && asText(l.fr) && asText(l.en) ? localized(l.fr, l.en) : null
}

/** Reads the tiers and capabilities of a /plans answer. All or nothing: one
 *  malformed entry and none are applied, so the page never shows half a list. */
function asCapabilities(body: { tiers?: unknown; capabilities?: unknown } | null): { tiers: CapabilityTier[]; capabilities: Capability[] } | null {
  if (!Array.isArray(body?.tiers) || !Array.isArray(body?.capabilities)) return null

  const tiers: CapabilityTier[] = []
  for (const raw of body.tiers as Record<string, unknown>[]) {
    const label = asLabel(raw?.label)
    const summary = asLabel(raw?.summary)
    if (!raw || !asText(raw.key) || !label || !summary) return null
    tiers.push({ key: raw.key, label, summary })
  }

  const capabilities: Capability[] = []
  for (const raw of body.capabilities as Record<string, unknown>[]) {
    const label = asLabel(raw?.label)
    if (
      !raw || !asText(raw.key) || !isPlanId(raw.plan) || typeof raw.live !== "boolean" || !label ||
      !asText(raw.tier) || !tiers.some((t) => t.key === raw.tier)
    ) {
      return null
    }
    capabilities.push({ key: raw.key, tier: raw.tier, plan: raw.plan, live: raw.live, label })
  }

  return tiers.length > 0 && capabilities.length > 0 ? { tiers, capabilities } : null
}

export type PlanLimits = {
  sectors: Localized
  departments: Localized
  sitesUsers: Localized
  /** How many sites the plan allows. The number behind `sitesUsers`; use
   *  maxSitesFor() rather than reading it or repeating it. */
  maxSites: number
  alerts: Localized
  ask: Localized
  history: Localized
  tracking: boolean
  ml: boolean
}

/** The text of one plan's row in the pricing table, written from its
 *  numbers so a number can never disagree with its label. */
export function limitsFrom(e: Entitlement): PlanLimits {
  const sites = (n: number) => localized(`${n} site${n > 1 ? "s" : ""}`, `${n} site${n > 1 ? "s" : ""}`)
  const users = (n: number) => localized(`${n} utilisateur${n > 1 ? "s" : ""}`, `${n} user${n > 1 ? "s" : ""}`)

  const sitesUsers =
    e.sites === null && e.users === null
      ? localized("Sites et utilisateurs illimités", "Unlimited sites and users")
      : localized(
          `${e.sites === null ? "Sites illimités" : sites(e.sites).fr} · ${e.users === null ? "utilisateurs illimités" : users(e.users).fr}`,
          `${e.sites === null ? "Unlimited sites" : sites(e.sites).en} · ${e.users === null ? "unlimited users" : users(e.users).en}`
        )

  const months = e.history_days === null ? 0 : Math.round((e.history_days / 365) * 12)

  return {
    sectors:
      e.sectors === null
        ? localized("Plusieurs secteurs", "Several sectors")
        : localized(`${e.sectors} secteur${e.sectors > 1 ? "s" : ""}`, `${e.sectors} sector${e.sectors > 1 ? "s" : ""}`),
    departments:
      e.departments === "any"
        ? localized("Tous les départements", "All departments")
        : e.departments === "linked"
          ? localized("Plusieurs départements liés", "Several linked departments")
          : localized("1 département", "1 department"),
    sitesUsers,
    maxSites: e.sites ?? Infinity,
    alerts: e.sms ? localized("Alertes app + SMS", "App + SMS alerts") : localized("Alertes dans l'app", "In-app alerts"),
    ask:
      e.ask_per_month === null
        ? localized("Ask SentrIA illimité", "Unlimited Ask SentrIA")
        : localized(
            `Ask SentrIA · ${e.ask_per_month} questions/mois`,
            `Ask SentrIA · ${e.ask_per_month} questions/month`
          ),
    history:
      e.history_days === null
        ? localized("Historique illimité", "Unlimited history")
        : e.history_days < 365
          ? localized(`Historique ${e.history_days} jours`, `${e.history_days}-day history`)
          : localized(`Historique ${months} mois`, `${months}-month history`),
    tracking: e.tracking,
    ml: e.ml,
  }
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  decouverte: limitsFrom(ENTITLEMENTS.decouverte),
  pro: limitsFrom(ENTITLEMENTS.pro),
  business: limitsFrom(ENTITLEMENTS.business),
  entreprise: limitsFrom(ENTITLEMENTS.entreprise),
}

/** The most sites a plan allows: 1, 1, 3, then no cap. The one place the
 *  Sites page and the pricing table both read. */
export function maxSitesFor(plan: PlanId): number {
  return PLAN_LIMITS[plan].maxSites
}

const isCount = (v: unknown): v is number | null => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0)

function asEntitlement(value: unknown): Entitlement | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (
    !isCount(v.sectors) || !isCount(v.sites) || !isCount(v.users) || !isCount(v.ask_per_month) || !isCount(v.history_days) ||
    (v.departments !== "one" && v.departments !== "linked" && v.departments !== "any") ||
    typeof v.sms !== "boolean" || typeof v.tracking !== "boolean" || typeof v.ml !== "boolean"
  ) {
    return null
  }
  return v as unknown as Entitlement
}

/** The backend spells the retail sector "retail", the app "commerce". */
const SECTOR_FROM_API: Record<string, string> = { retail: "commerce" }

/** Takes what GET /plans returned and makes the app follow it: the numbers,
 *  the pricing text and the department groups, in place. Anything that
 *  doesn't look right is ignored whole, so a bad answer can't break the
 *  app. Returns whether it was applied. */
export function applyEntitlements(payload: unknown): boolean {
  const body = payload as { entitlements?: Record<string, unknown>; department_groups?: unknown } | null
  const incoming = body?.entitlements
  if (!incoming || typeof incoming !== "object") return false

  const next = {} as Record<PlanId, Entitlement>
  for (const plan of PLAN_ORDER) {
    const e = asEntitlement(incoming[plan])
    if (!e) return false
    next[plan] = e
  }

  for (const plan of PLAN_ORDER) {
    Object.assign(ENTITLEMENTS[plan], next[plan])
    Object.assign(PLAN_LIMITS[plan], limitsFrom(next[plan]))
  }

  const caps = asCapabilities(payload as { tiers?: unknown; capabilities?: unknown } | null)
  if (caps) {
    TIERS.splice(0, TIERS.length, ...caps.tiers)
    CAPABILITIES.splice(0, CAPABILITIES.length, ...caps.capabilities)
  }

  const groups = body?.department_groups
  if (groups && typeof groups === "object" && !Array.isArray(groups)) {
    const rebuilt: Partial<Record<Sector, string[][]>> = {}
    for (const [key, list] of Object.entries(groups as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue
      rebuilt[(SECTOR_FROM_API[key] ?? key) as Sector] = list
        .filter((g): g is unknown[] => Array.isArray(g))
        .map((g) => g.filter((id): id is string => typeof id === "string"))
    }
    for (const key of Object.keys(DEPARTMENT_GROUPS)) delete DEPARTMENT_GROUPS[key as Sector]
    Object.assign(DEPARTMENT_GROUPS, rebuilt)
  }

  if (typeof window !== "undefined") window.dispatchEvent(new Event(PLAN_UPDATED_EVENT))
  return true
}

/* ------------------------------------------------------------------ */
/*  The account's plan, as loaded at sign-in (lib/account.ts)          */
/* ------------------------------------------------------------------ */

export const PLAN_KEY = "sentria_plan"
export const TRIAL_KEY = "sentria_trial_ends_at"
export const PLAN_UPDATED_EVENT = "sentria_plan_updated"
/** SentrIA staff (accounts.is_admin): full access and the Admin page. */
export const ADMIN_KEY = "sentria_is_admin"

export type AccountPlan = {
  plan: PlanId
  trialEndsAt: string | null
  effective: PlanId
  isAdmin: boolean
}

export function readAccountPlan(): AccountPlan {
  let plan: PlanId = "decouverte"
  let trialEndsAt: string | null = null
  let isAdmin = false
  try {
    const stored = localStorage.getItem(PLAN_KEY)
    if (isPlanId(stored)) plan = stored
    trialEndsAt = localStorage.getItem(TRIAL_KEY)
    isAdmin = localStorage.getItem(ADMIN_KEY) === "true"
  } catch {
    /* no storage: the free plan */
  }
  return {
    plan,
    trialEndsAt,
    // Admins get everything, whatever their own plan says.
    effective: isAdmin ? "entreprise" : effectivePlan(plan, trialEndsAt),
    isAdmin,
  }
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
  return holdsSeveralSectors(plan) ? sectors : sectors.slice(0, 1)
}

/** The departments of `sector` the account may upload for: those it
 *  runs, plus any the plan lets it add to them. */
export function departmentsForPlan(
  sector: string,
  all: string[],
  held: string[],
  plan: PlanId
): string[] {
  if (ENTITLEMENTS[plan].departments === "any") return all
  if (held.length === 0) return all
  return all.filter((id) => checkPlan(plan, { [sector]: [...held, id] }).ok)
}
