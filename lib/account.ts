import type { SupabaseClient, User } from "@supabase/supabase-js"

import { ADMIN_KEY, PLAN_KEY, PLAN_UPDATED_EVENT, TRIAL_KEY, isPlanId } from "@/lib/plans"

/** The account (S-3 step 1).
 *
 *  Each user has one row in `accounts` (supabase/001_accounts.sql). Its
 *  `profile` holds the same values the app has always kept in
 *  localStorage: the views keep reading localStorage, which is filled
 *  from the account at sign-in, saved back to it while the app runs, and
 *  wiped at sign-out so the next person on this browser starts clean. */

/** The values that belong to the account. Everything else in
 *  localStorage (the theme, for one) belongs to the browser. */
export const ACCOUNT_KEYS = [
  "sentria_onboarded",
  "sentria_company_name",
  "sentria_timezone",
  "sentria_country",
  "sentria_currency",
  "sentria_language",
  "sentria_sector",
  "sentria_sectors",
  "sentria_business_type",
  "sentria_departments",
  "sentria_equipment",
  "sentria_monitoring",
  "sentria_ops_types",
  "sentria_ops_type",
  "sentria_data_sources",
  "sentria_configure_later",
  "sentria_cost_rates",
  "sentria_actions_log",
  // The wholesalers the pharmacy orders from (lib/wholesalers.ts).
  "sentria_wholesalers",
  // "on" when the weekly email is wanted (Settings; read by the API's
  // POST /reports/weekly/send).
  "sentria_weekly_report",
] as const

/** Per-user values that are not worth saving but must not be shown to
 *  the next person who signs in on this browser. */
const LOCAL_ONLY_USER_KEYS = [
  "sentria_notifications_seen_at",
  "sentria_recommendation_tasks_v2",
  // Texts drafted when a contractor was removed (lib/sms-drafts.ts).
  "sentria_sms_drafts",
  // Read from the account's own columns at sign-in, never saved back:
  // only an admin (or, later, payment) changes a plan.
  PLAN_KEY,
  TRIAL_KEY,
  ADMIN_KEY,
  "sentria_account_dirty",
]

/** Whose values localStorage holds. */
export const ACCOUNT_OWNER_KEY = "sentria_account_owner"

/** "1" while a change made by a view has not reached the account yet. A page
 *  that loads while it is set keeps this browser's values instead of the
 *  saved ones, so a reload a moment after an edit does not undo it. */
export const ACCOUNT_DIRTY_KEY = "sentria_account_dirty"

/** Sent by a view that has just written an account value, so the save does
 *  not wait for the next 2 second look. */
export const ACCOUNT_CHANGED_EVENT = "sentria-account-changed"

/** Say that an account value has just changed in localStorage. */
export function requestAccountSave() {
  try {
    localStorage.setItem(ACCOUNT_DIRTY_KEY, "1")
  } catch {
    /* storage blocked: the 2 second look still tries */
  }
  window.dispatchEvent(new Event(ACCOUNT_CHANGED_EVENT))
}

/** Kept after sign-out: the sign-in screen stays in the user's language. */
const KEPT_AFTER_SIGN_OUT = new Set<string>(["sentria_language"])

export type Profile = Record<string, string>

export function readProfile(): Profile {
  const profile: Profile = {}

  for (const key of ACCOUNT_KEYS) {
    const value = localStorage.getItem(key)
    if (value !== null) profile[key] = value
  }

  return profile
}

/** Removes this browser's copy of the account. */
export function clearLocalAccount() {
  for (const key of [...ACCOUNT_KEYS, ...LOCAL_ONLY_USER_KEYS]) {
    if (!KEPT_AFTER_SIGN_OUT.has(key)) localStorage.removeItem(key)
  }

  localStorage.removeItem(ACCOUNT_OWNER_KEY)
}

function writeProfile(profile: Profile) {
  for (const key of ACCOUNT_KEYS) {
    const value = profile[key]
    if (typeof value === "string") localStorage.setItem(key, value)
  }
}

function asProfile(value: unknown): Profile {
  const profile: Profile = {}

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of ACCOUNT_KEYS) {
      const v = (value as Record<string, unknown>)[key]
      if (typeof v === "string") profile[key] = v
    }
  }

  return profile
}

/** Loads the signed-in user's account into localStorage, creating the
 *  row on first sign-in. Throws when the account can't be read, so the
 *  app never runs on someone else's leftover values. */
export async function loadAccount(
  client: SupabaseClient,
  user: User
): Promise<{ username: string | null }> {
  // The richest row the database has. Each migration adds columns:
  // 006 username, 005 is_admin, 004 plan and trial. Before one is run,
  // its columns are simply not read.
  type Row = {
    profile?: unknown
    plan?: unknown
    trial_ends_at?: unknown
    is_admin?: unknown
    username?: unknown
  }

  const readRow = async (): Promise<{ data: Row | null; error: { message?: string } | null }> => {
    const missingColumn = (error: { message?: string } | null) =>
      Boolean(error && /username|is_admin|plan|trial_ends_at/.test(error.message ?? ""))

    const tiers = [
      "profile, plan, trial_ends_at, is_admin, username",
      "profile, plan, trial_ends_at, is_admin",
      "profile, plan, trial_ends_at",
    ]

    for (const columns of tiers) {
      const result = await client
        .from("accounts")
        .select(columns)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!missingColumn(result.error)) return { data: result.data as Row | null, error: result.error }
    }

    const result = await client
      .from("accounts")
      .select("profile")
      .eq("user_id", user.id)
      .maybeSingle()

    return { data: result.data as Row | null, error: result.error }
  }

  let { data, error } = await readRow()

  if (error) throw error

  if (!data) {
    // company_id, plan and trial are set by the database, never by the
    // browser.
    const { error: insertError } = await client
      .from("accounts")
      .insert({ user_id: user.id, profile: {} })

    if (insertError) throw insertError
    ;({ data, error } = await readRow())
    if (error) throw error
  }

  const saved = asProfile(data?.profile)
  const owner = localStorage.getItem(ACCOUNT_OWNER_KEY)
  const local = readProfile()

  if (owner !== user.id) {
    // Someone else's values, or none: start from this account only.
    clearLocalAccount()
    writeProfile(saved)
  } else if (!saved.sentria_onboarded && local.sentria_onboarded) {
    // This user's own setup that hadn't reached the server yet: keep it,
    // the sync sends it.
  } else if (localStorage.getItem(ACCOUNT_DIRTY_KEY) === "1") {
    // A change this browser made a moment ago and has not sent: keep it, the
    // sync sends it. Without this, a reload before the save reached the
    // server would put the old values back.
  } else {
    // Same user: the saved account wins (another device may have changed
    // it). Their browser-only values, like the bell's read state, stay.
    for (const key of ACCOUNT_KEYS) {
      if (!KEPT_AFTER_SIGN_OUT.has(key) || key in saved) localStorage.removeItem(key)
    }
    writeProfile(saved)
  }

  // The company typed at sign-up, until the onboarding sets one.
  const signedUpAs = user.user_metadata?.company_name

  if (!localStorage.getItem("sentria_company_name") && typeof signedUpAs === "string" && signedUpAs.trim()) {
    localStorage.setItem("sentria_company_name", signedUpAs.trim())
  }

  const row: Row = data ?? {}
  localStorage.setItem(PLAN_KEY, isPlanId(row.plan) ? row.plan : "decouverte")

  // Shows the Admin page. The API checks the flag itself on every admin
  // call, so editing this in the browser opens nothing.
  if (row.is_admin === true) localStorage.setItem(ADMIN_KEY, "true")
  else localStorage.removeItem(ADMIN_KEY)

  if (typeof row.trial_ends_at === "string") {
    localStorage.setItem(TRIAL_KEY, row.trial_ends_at)
  } else {
    localStorage.removeItem(TRIAL_KEY)
  }

  window.dispatchEvent(new Event(PLAN_UPDATED_EVENT))

  localStorage.setItem(ACCOUNT_OWNER_KEY, user.id)

  return { username: typeof row.username === "string" && row.username ? row.username : null }
}

/** Saves localStorage's account values whenever they change. The views
 *  write localStorage directly in many places, so this watches it rather
 *  than asking each of them to save. Returns stop(), which also sends
 *  what hasn't been sent yet. */
export function syncAccount(client: SupabaseClient, userId: string) {
  // What the account is known to hold. A change still marked as unsent at
  // start-up is not known to be there, so the first look sends it.
  let sent = localStorage.getItem(ACCOUNT_DIRTY_KEY) === "1" ? "" : JSON.stringify(readProfile())
  let retryAt = 0
  let inFlight: Promise<void> | null = null

  const send = (): Promise<void> => {
    if (inFlight) return inFlight
    if (localStorage.getItem(ACCOUNT_OWNER_KEY) !== userId) return Promise.resolve()

    const profile = readProfile()
    const snapshot = JSON.stringify(profile)

    if (snapshot === sent) return Promise.resolve()

    inFlight = (async () => {
      try {
        const { error } = await client
          .from("accounts")
          .update({ profile, updated_at: new Date().toISOString() })
          .eq("user_id", userId)

        if (error) throw error

        sent = snapshot
        // Nothing changed while it was in flight: the account is up to date.
        if (JSON.stringify(readProfile()) === snapshot) localStorage.removeItem(ACCOUNT_DIRTY_KEY)
      } catch (error) {
        console.error("The account could not be saved:", error)
        retryAt = Date.now() + 30_000
      } finally {
        inFlight = null
      }
    })()

    return inFlight
  }

  const tick = () => {
    if (Date.now() >= retryAt) void send()
  }

  const onHide = () => {
    if (document.visibilityState === "hidden") void send()
  }

  // A view just wrote a value: save now, and once more if it changed again
  // while the first save was on its way.
  const flush = () => void send()

  const onChanged = () => {
    retryAt = 0
    const first = send()
    void first.then(() => send())
  }

  const timer = window.setInterval(tick, 2000)
  document.addEventListener("visibilitychange", onHide)
  window.addEventListener("pagehide", flush)
  window.addEventListener(ACCOUNT_CHANGED_EVENT, onChanged)

  return async function stop() {
    window.clearInterval(timer)
    document.removeEventListener("visibilitychange", onHide)
    window.removeEventListener("pagehide", flush)
    window.removeEventListener(ACCOUNT_CHANGED_EVENT, onChanged)
    retryAt = 0
    await send()
  }
}
