"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  Fuel,
  Inbox,
  MoreHorizontal,
  Package,
  Radar,
  Search,
  Sparkles,
  UserRound,
  Waypoints,
  Wrench,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCompanyIdentity } from "@/lib/company"
import {
  AVAILABILITY_LABEL,
  fetchAssignments,
  fetchContractors,
  saveAssignment,
  type Assignment,
  type Contractor,
} from "@/lib/crm"
import { formatMoney, useLocale, type Currency } from "@/lib/locale"
import { localized, useTx, type Localized, type Tx, resolve } from "@/lib/i18n"

type Recommendation = {
  id: string
  equipment: string
  sector?: string | null
  severity: "WARNING" | "CRITICAL" | string
  date: string
  message: string
  risk_score?: number | null
  alert_key?: string | null
  recommended_action: string
  action_category: string
  /* Set only by deriveRecommendations, which knows the chain. The
     backend endpoint cannot produce these, so every one is optional and
     the card renders what it has. */
  stageName?: string
  downstream?: number
  alertCount?: number
  exposureEUR?: number
  score?: number
  reasoning?: string | null
}

type Status = "todo" | "in_progress" | "done"

type Priority = "low" | "medium" | "high" | "critical"

/** One card's state. The field names are the server's column names on
 *  purpose: a translation layer between "assignee" here and
 *  "contractor_id" there would be one more place to get it wrong. */
type TaskMeta = {
  status: Status
  contractor_id: string | null
  deadline: string | null
  priority: Priority
}

type Card = {
  id: string
  rec: Recommendation
  task: TaskMeta
}

type RecommendationsBoardProps = {
  recommendations: Recommendation[]
  opsType?: string | null
}

/** Which cards the pill row is showing. Every one of these is counted
 *  from the cards themselves, so a pill can never claim a number the
 *  board does not hold. */
type Filter = "all" | "critical" | "unassigned"

const COLUMNS: {
  id: Status
  label: Localized
  /** Shown in the column's empty state rather than permanently under the
   *  heading. Three standing subtitles on a board whose headings already
   *  read "To do / In progress / Resolved" is decoration; the same
   *  sentence is worth reading once, in the space where there is
   *  otherwise nothing to look at. */
  empty: Localized
}[] = [
  {
    id: "todo",
    label: localized("À traiter", "To do"),
    empty: localized(
      "Rien de détecté qui ne soit déjà pris en charge.",
      "Nothing detected that is not already being handled."
    ),
  },
  {
    id: "in_progress",
    label: localized("En cours", "In progress"),
    empty: localized(
      "Personne n'a encore pris de priorité en main.",
      "Nobody has picked up a priority yet."
    ),
  },
  {
    id: "done",
    label: localized("Résolu", "Resolved"),
    empty: localized(
      "Aucune situation traitée pour l'instant.",
      "No situation has been handled yet."
    ),
  },
]

const OPS_TYPE_LABEL: Record<string, Localized> = {
  port: localized("Port & conteneurs", "Port & containers"),
  entrepot: localized("Entrepôt & manutention", "Warehouse & handling"),
  transport: localized("Transport & distribution", "Transport & distribution"),
  expedition: localized("Expédition", "Dispatch"),
  froid: localized("Chaîne du froid", "Cold chain"),
  multi: localized("Opérations logistiques", "Logistics operations"),
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  maintenance: Wrench,
  fuel: Fuel,
  delay: Clock3,
  stock: Package,
  cold_chain: Package,
  expiry: Package,
  capacity: Cpu,
  predictive: Radar,
  other: Sparkles,
}

const CATEGORY_LABEL: Record<string, Localized> = {
  maintenance: localized("Maintenance", "Maintenance"),
  fuel: localized("Carburant", "Fuel"),
  delay: localized("Retard", "Delay"),
  stock: localized("Stock", "Stock"),
  cold_chain: localized("Chaîne du froid", "Cold chain"),
  expiry: localized("Expiration", "Expiry"),
  capacity: localized("Capacité", "Capacity"),
  predictive: localized("Prédictif", "Predictive"),
  other: localized("Autre", "Other"),
}

const PRIORITY_LABEL: Record<Priority, Localized> = {
  low: localized("Faible", "Low"),
  medium: localized("Moyenne", "Medium"),
  high: localized("Haute", "High"),
  critical: localized("Critique", "Critical"),
}

/** One hue per category and per priority, so the chip row reads at a
 *  glance instead of as a wall of identical grey pills.
 *
 *  Same formula as TONE above: a low-opacity tint plus a solid dot carry
 *  the colour, the text stays --foreground. That keeps every combination
 *  at the same contrast as plain foreground-on-card regardless of which
 *  hue is picked, and avoids the dark: variant pitfall noted above (a
 *  flat class with no theme branch, so "system" theme cannot desync it).
 */
const CATEGORY_TONE: Record<string, { pill: string; dot: string }> = {
  maintenance: { pill: "bg-blue-500/12 text-foreground", dot: "bg-blue-500" },
  fuel: { pill: "bg-orange-500/12 text-foreground", dot: "bg-orange-500" },
  delay: { pill: "bg-amber-500/12 text-foreground", dot: "bg-amber-500" },
  stock: { pill: "bg-purple-500/12 text-foreground", dot: "bg-purple-500" },
  cold_chain: { pill: "bg-cyan-500/12 text-foreground", dot: "bg-cyan-500" },
  expiry: { pill: "bg-rose-500/12 text-foreground", dot: "bg-rose-500" },
  capacity: { pill: "bg-indigo-500/12 text-foreground", dot: "bg-indigo-500" },
  predictive: {
    pill: "bg-fuchsia-500/12 text-foreground",
    dot: "bg-fuchsia-500",
  },
  other: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
}

const PRIORITY_TONE: Record<Priority, { pill: string; dot: string }> = {
  critical: { pill: "bg-destructive/12 text-foreground", dot: "bg-destructive" },
  high: { pill: "bg-orange-500/12 text-foreground", dot: "bg-orange-500" },
  medium: { pill: "bg-warning/15 text-foreground", dot: "bg-warning" },
  low: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
}

const COLUMN_TONE: Record<Status, { pill: string; dot: string }> = {
  todo: { pill: "bg-warning/15 text-foreground", dot: "bg-warning" },
  in_progress: { pill: "bg-brand/20 text-foreground", dot: "bg-brand" },
  done: { pill: "bg-emerald-500/12 text-foreground", dot: "bg-emerald-500" },
}

/** Triage order inside a column. Without it the operator can set a card
 *  to critical and watch it stay eighth in the list, which makes the
 *  control look broken. */
const PRIORITY_RANK: Record<Priority, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
}

/* Where the board used to keep its assignments.
 *
 * It is a migration source now, not a store. Every assignment lived in
 * the administrator's own browser, which meant assigning a task to a
 * contractor and the contractor never seeing it. The rows are pushed to
 * the server once, then this key is dropped. */
const LEGACY_STORAGE_KEY = "sentria_recommendation_tasks_v2"

function getRecommendationId(rec: Recommendation): string {
  return rec.id
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function loadLegacyTaskMap(): Record<string, TaskMeta> {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    return parsed as Record<string, TaskMeta>
  } catch {
    return {}
  }
}

function clearLegacyTaskMap() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Ignore localStorage errors.
  }
}

/** The state a card has before anyone has touched it. Priority is
 *  seeded from the severity so a critical card does not sit in the
 *  board as "medium" until somebody sets it. */
function defaultTask(rec: Recommendation): TaskMeta {
  return {
    status: "todo",
    contractor_id: null,
    deadline: null,
    priority: getDefaultPriority(rec),
  }
}

const STATUSES: Status[] = ["todo", "in_progress", "done"]
const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"]

/** Narrow a value that came from the server or from an older build's
 *  localStorage, rather than asserting it.
 *
 *  `(row.status ?? "todo") as Status` was a lie: any other string passed
 *  straight through and every catalogue lookup keyed on it then missed.
 *  That used to render as nothing; once the catalogues held fr/en pairs it
 *  threw on the missing pair and took the board down. */
function asStatus(value: unknown): Status {
  return STATUSES.includes(value as Status) ? (value as Status) : "todo"
}

function asPriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority)
    ? (value as Priority)
    : "medium"
}

function taskMapFrom(rows: Assignment[]): Record<string, TaskMeta> {
  const map: Record<string, TaskMeta> = {}

  for (const row of rows) {
    if (!row?.task_key) continue

    map[row.task_key] = {
      status: asStatus(row.status),
      contractor_id: row.contractor_id ?? null,
      deadline: row.deadline ?? null,
      priority: asPriority(row.priority),
    }
  }

  return map
}

function formatDeadline(deadline: string | null, tx: Tx) {
  if (!deadline) {
    return null
  }

  const date = new Date(`${deadline}T23:59:59`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toLocaleDateString(tx("fr-FR", "en-GB"), {
    day: "2-digit",
    month: "short",
  })
}

function isDeadlineOverdue(deadline: string | null) {
  if (!deadline) {
    return false
  }

  const deadlineDate = new Date(`${deadline}T23:59:59`)

  return deadlineDate.getTime() < Date.now()
}

function getDefaultPriority(rec: Recommendation): Priority {
  if (rec.severity === "CRITICAL") {
    return "critical"
  }

  if (
    rec.risk_score !== null &&
    rec.risk_score !== undefined &&
    rec.risk_score >= 70
  ) {
    return "high"
  }

  return "medium"
}

/* --------------------------------------------------------------------------
 * The severity palette.
 *
 * One tinted pill per card and nothing else. The board used to wash the
 * whole card in the severity colour, which meant twelve competing
 * backgrounds, no neutral surface left to rest on, and a "critical" that
 * stopped reading as critical because everything around it was shouting
 * too. Colour is now spent where it carries a decision.
 *
 * Both tones are tokens, never Tailwind's palette: the `dark:` variant
 * keys off the .dark class, and THEME_INIT_SCRIPT leaves that class off
 * when the theme is "system", so a `dark:text-amber-400` would stay
 * light-mode bronze for anyone following their OS.
 *
 * The ink is --foreground, not the tone colour. `text-destructive` on
 * `bg-destructive/10` measures 4.01:1 in light and 4.13:1 in dark, and
 * this label is 11px semibold, so it is not large text and 4.5:1 applies.
 * Tint plus a full-saturation dot puts the hue where it cannot fail a
 * contrast check, and the word says the severity regardless.
 * -------------------------------------------------------------------------- */

const TONE = {
  critical: {
    pill: "bg-destructive/12 text-foreground",
    dot: "bg-destructive",
    word: localized("Critique", "Critical"),
  },
  warning: {
    pill: "bg-warning/15 text-foreground",
    dot: "bg-warning",
    word: localized("Attention", "Warning"),
  },
} as const

function toneOf(rec: Recommendation) {
  return rec.severity === "CRITICAL" ? TONE.critical : TONE.warning
}

function riskOf(rec: Recommendation): number | null {
  const score = rec.risk_score

  if (score === null || score === undefined || !Number.isFinite(score)) {
    return null
  }

  return Math.round(score)
}

/* --------------------------------------------------------------------------
 * Small shared pieces.
 * -------------------------------------------------------------------------- */

/** A metadata chip.
 *
 *  `whitespace-nowrap` on the chip with `min-w-0 truncate` on the label
 *  is the pair that keeps a compact label on one line: the chip never
 *  breaks mid-phrase, and an unusually long category shortens instead of
 *  wrapping the row to a second line.
 */
function Chip({
  icon: Icon,
  tone = "neutral",
  pillClassName,
  dotClassName,
  children,
}: {
  icon?: LucideIcon
  tone?: "neutral" | "brand"
  /** Overrides the neutral/brand tone above with a specific hue, e.g.
   *  from CATEGORY_TONE or PRIORITY_TONE. */
  pillClassName?: string
  /** Adds a small solid dot before the label, in the same hue. */
  dotClassName?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium",
        pillClassName ??
          (tone === "brand"
            ? "bg-brand/20 text-foreground"
            : "bg-muted text-muted-foreground")
      )}
    >
      {dotClassName && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClassName)}
          aria-hidden="true"
        />
      )}
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

/** The assignee cluster: a real person or an honest gap.
 *
 *  The reference board puts a stack of faces here. This one puts the one
 *  contractor who owns the job, and when there is nobody it says so
 *  rather than showing a placeholder face — an avatar nobody is behind is
 *  the single most misleading thing a board can draw. */
function Owner({
  assignee,
  tx,
}: {
  assignee: Contractor | undefined
  tx: Tx
}) {
  if (!assignee) {
    return (
      <>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/25 text-muted-foreground">
          <UserRound className="h-3 w-3" aria-hidden="true" />
        </span>

        <span className="truncate text-xs text-muted-foreground">
          {tx("Assigner", "Assign")}
        </span>
      </>
    )
  }

  return (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
        {getInitials(assignee.name)}
      </span>

      <span className="truncate text-xs font-medium">{assignee.name}</span>
    </>
  )
}

/* --------------------------------------------------------------------------
 * The detail dialog.
 *
 * This used to be a panel positioned `absolute inset-x-2 bottom-2` inside
 * the card, so it covered the card it was describing, clipped against the
 * column on a short card, and had room for controls but not for the
 * evidence. Everything the backend computed — the finding, the reasoning
 * behind the score, the exposure — was carried in the props and never
 * drawn anywhere.
 *
 * As a dialog it has the room, and it doubles as the pointer-free way to
 * move a card between columns, which WCAG 2.2 requires of any board whose
 * other route is dragging.
 * -------------------------------------------------------------------------- */

function DetailDialog({
  card,
  contractors,
  contractorsLoaded,
  currency,
  onPatch,
  onClose,
}: {
  card: Card
  contractors: Contractor[]
  contractorsLoaded: boolean
  currency: Currency
  onPatch: (patch: Partial<TaskMeta>) => void
  onClose: () => void
}) {
  const tx = useTx()
  const px = (text: Localized | undefined) => resolve(text, tx)

  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<Element | null>(null)

  const { rec, task } = card
  const tone = toneOf(rec)
  const risk = riskOf(rec)
  const Icon = CATEGORY_ICON[rec.action_category] ?? Sparkles

  useEffect(() => {
    returnFocusRef.current = document.activeElement

    closeRef.current?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation()
        onClose()
      }
    }

    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow

      const target = returnFocusRef.current

      if (target instanceof HTMLElement) target.focus()
    }
  }, [onClose])

  const fieldClass =
    "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-ring"

  const labelClass =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="priority-detail-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
      >
        {/* Header ------------------------------------------------------- */}
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div className="min-w-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold",
                tone.pill
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", tone.dot)}
                aria-hidden="true"
              />
              {px(tone.word)}
              {risk !== null && (
                <span className="tabular-nums opacity-70">
                  {tx(`· risque ${risk}`, `· risk ${risk}`)}
                </span>
              )}
            </span>

            <h2
              id="priority-detail-title"
              className="mt-2.5 font-heading text-xl font-bold leading-tight tracking-tight"
            >
              {rec.equipment}
            </h2>

            {rec.stageName && (
              <p className="mt-1 text-sm text-muted-foreground">
                {rec.stageName}
              </p>
            )}
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={tx("Fermer", "Close")}
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* What the backend computed ------------------------------------ */}
        <div className="space-y-5 border-b border-border p-5 sm:p-6">
          <div>
            <p className={labelClass}>
              {tx("Action recommandée", "Recommended action")}
            </p>
            <p className="text-sm leading-6">{rec.recommended_action}</p>
          </div>

          {rec.message && (
            <div>
              <p className={labelClass}>{tx("Constat", "Finding")}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {rec.message}
              </p>
            </div>
          )}

          {rec.reasoning && (
            <div>
              <p className={labelClass}>
                {tx("Pourquoi ce rang", "Why it ranks here")}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {rec.reasoning}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip
              icon={Icon}
              pillClassName={
                (CATEGORY_TONE[rec.action_category] ?? CATEGORY_TONE.other)
                  .pill
              }
              dotClassName={
                (CATEGORY_TONE[rec.action_category] ?? CATEGORY_TONE.other)
                  .dot
              }
            >
              {px(
                CATEGORY_LABEL[rec.action_category] ?? CATEGORY_LABEL.other
              )}
            </Chip>

            {(rec.alertCount ?? 0) > 1 && (
              <Chip>
                {tx(
                  `${rec.alertCount} signaux`,
                  `${rec.alertCount} signals`
                )}
              </Chip>
            )}

            {(rec.downstream ?? 0) > 0 && (
              <Chip icon={Waypoints} tone="brand">
                {/* Singular when there is one. "1 stages downstream" is
                    the kind of wrong that makes a product feel machine
                    written. */}
                {rec.downstream === 1
                  ? tx("1 étape en aval", "1 stage downstream")
                  : tx(
                      `${rec.downstream} étapes en aval`,
                      `${rec.downstream} stages downstream`
                    )}
              </Chip>
            )}

            {(rec.exposureEUR ?? 0) > 0 && (
              <Chip>
                {tx(
                  `${formatMoney(rec.exposureEUR!, currency, tx)} exposés`,
                  `${formatMoney(rec.exposureEUR!, currency, tx)} exposed`
                )}
              </Chip>
            )}
          </div>
        </div>

        {/* What the operator decides ------------------------------------ */}
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <p className={labelClass}>{tx("Statut", "Status")}</p>

            {/* The pointer-free route between columns. Dragging is the
                fast one; this is the one that works with a keyboard, a
                screen reader, or a finger on a phone. */}
            <div
              role="group"
              aria-label={tx("Statut", "Status")}
              className="flex items-center gap-1 rounded-xl bg-muted p-1"
            >
              {COLUMNS.map((column) => {
                const active = task.status === column.id

                return (
                  <button
                    key={column.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPatch({ status: column.id })}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors",
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {px(column.label)}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="priority-detail-owner" className={labelClass}>
              {tx("Responsable", "Owner")}
            </label>

            {/* Each option carries what the person said about themselves
                and how much they are already holding, because "available"
                next to "4 open" is the case worth seeing before handing
                them a fifth. */}
            <select
              id="priority-detail-owner"
              value={task.contractor_id ?? ""}
              onChange={(event) =>
                onPatch({ contractor_id: event.target.value || null })
              }
              className={fieldClass}
            >
              <option value="">{tx("Non assigné", "Unassigned")}</option>

              {contractors.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {" · "}
                  {px(AVAILABILITY_LABEL[person.availability]) ||
                    person.availability}
                  {person.open_assignments > 0 &&
                    tx(
                      ` · ${person.open_assignments} en cours`,
                      ` · ${person.open_assignments} open`
                    )}
                </option>
              ))}
            </select>

            {contractors.length === 0 && (
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {contractorsLoaded
                  ? tx(
                      "Aucun intervenant enregistré. Ajoutez-les depuis Intervenants.",
                      "No contractor on file. Add them from Contractors."
                    )
                  : tx(
                      "Chargement des intervenants…",
                      "Loading contractors…"
                    )}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="priority-detail-deadline"
                className={labelClass}
              >
                {tx("Échéance", "Due date")}
              </label>

              <input
                id="priority-detail-deadline"
                type="date"
                value={task.deadline ?? ""}
                onChange={(event) =>
                  onPatch({ deadline: event.target.value || null })
                }
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor="priority-detail-priority"
                className={labelClass}
              >
                {tx("Priorité", "Priority")}
              </label>

              <select
                id="priority-detail-priority"
                value={task.priority}
                onChange={(event) =>
                  onPatch({ priority: asPriority(event.target.value) })
                }
                className={fieldClass}
              >
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {px(PRIORITY_LABEL[value])}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
          >
            <Check className="h-4 w-4" />
            {tx("Terminé", "Done")}
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * The board.
 * -------------------------------------------------------------------------- */

export function RecommendationsBoard({
  recommendations,
  opsType,
}: RecommendationsBoardProps) {
  const tx = useTx()

  /** Resolve a module-level pair. */
  const px = (text: Localized | undefined) => resolve(text, tx)

  /* The company name is the partition these rows live under. It is read
     after mount, like every other stored value in the app, so the first
     client render cannot disagree with the server markup. */
  const { name: companyName } = useCompanyIdentity()

  /* Exposure is the operator's own rate times a real overrun, so the
     symbol is theirs too. It read euros for everyone before. */
  const { currency } = useLocale()

  const [taskMap, setTaskMap] = useState<Record<string, TaskMeta>>({})
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loaded, setLoaded] = useState(false)

  /* Two separate failures, because they need different words. One means
     the board is showing nothing when there may be something; the other
     means a change the administrator just made did not stick. */
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!companyName) {
      setLoaded(true)
      return
    }

    let cancelled = false

    async function load() {
      const [stored, people] = await Promise.all([
        fetchAssignments(companyName),
        fetchContractors(companyName),
      ])

      if (cancelled) return

      if (people.ok) setContractors(people.data)

      if (!stored.ok) {
        setLoadError(px(stored.detail))
        setLoaded(true)
        return
      }

      setLoadError(null)

      const map = taskMapFrom(stored.data)

      /* One-shot rescue of the assignments that were stranded in this
         browser before there was a server to hold them. Only when the
         server has none: if it already has rows, they are the truth and
         a stale local copy must not overwrite them. */
      const legacy = loadLegacyTaskMap()
      const legacyKeys = Object.keys(legacy)

      if (stored.data.length === 0 && legacyKeys.length > 0) {
        const pushed: string[] = []

        for (const key of legacyKeys) {
          const task = legacy[key]

          const result = await saveAssignment(companyName, {
            task_key: key,
            status: asStatus(task.status),
            priority: asPriority(task.priority),
            deadline: task.deadline ?? null,
            /* The old shape called this "assignee" and its values were
               never real contractor ids, so they cannot be carried over
               without inventing a link. Status, priority and deadline
               are real; the assignment has to be made again. */
            contractor_id: null,
          })

          if (result.ok) pushed.push(key)
        }

        if (cancelled) return

        if (pushed.length === legacyKeys.length) {
          clearLegacyTaskMap()
        }

        for (const key of pushed) {
          map[key] = {
            status: asStatus(legacy[key].status),
            priority: asPriority(legacy[key].priority),
            deadline: legacy[key].deadline ?? null,
            contractor_id: null,
          }
        }

        console.info(
          `[SentrIA] Migrated ${pushed.length}/${legacyKeys.length} board ` +
            "assignments out of localStorage and onto the server."
        )
      }

      setTaskMap(map)
      setLoaded(true)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [companyName])

  async function refreshContractors() {
    if (!companyName) return

    const people = await fetchContractors(companyName)

    if (people.ok) setContractors(people.data)
  }

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")

  const cards: Card[] = useMemo(() => {
    return recommendations.map((rec) => {
      const id = getRecommendationId(rec)
      const stored = taskMap[id]

      return {
        id,
        rec,
        task: stored ?? defaultTask(rec),
      }
    })
  }, [recommendations, taskMap])

  const criticalCount = cards.filter(
    (card) => card.rec.severity === "CRITICAL"
  ).length

  const unassignedCount = cards.filter(
    (card) => !card.task.contractor_id
  ).length

  const totalExposure = cards.reduce(
    (sum, card) => sum + (card.rec.exposureEUR ?? 0),
    0
  )

  /** Everything on the card that a person might type to find it again:
   *  the asset, where it sits in the chain, what to do about it, and who
   *  is holding it. Built in the reader's language, because the category
   *  they would search for is the one they can see. */
  function haystack(card: Card): string {
    const assignee = contractors.find(
      (person) => person.id === card.task.contractor_id
    )

    return [
      card.rec.equipment,
      card.rec.stageName ?? "",
      card.rec.recommended_action,
      card.rec.message,
      px(CATEGORY_LABEL[card.rec.action_category] ?? CATEGORY_LABEL.other),
      px(PRIORITY_LABEL[card.task.priority]),
      assignee?.name ?? "",
    ]
      .join(" ")
      .toLowerCase()
  }

  const trimmedQuery = query.trim().toLowerCase()

  const visible = useMemo(() => {
    let out = cards

    if (filter === "critical") {
      out = out.filter((card) => card.rec.severity === "CRITICAL")
    } else if (filter === "unassigned") {
      out = out.filter((card) => !card.task.contractor_id)
    }

    if (trimmedQuery) {
      out = out.filter((card) => haystack(card).includes(trimmedQuery))
    }

    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, filter, trimmedQuery, contractors, tx])

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: tx("Toutes", "All"), count: cards.length },
    { id: "critical", label: tx("Critiques", "Critical"), count: criticalCount },
    {
      id: "unassigned",
      label: tx("Non assignées", "Unassigned"),
      count: unassignedCount,
    },
  ]

  /** Apply a change, then persist it.
   *
   *  Optimistic, because waiting on a round trip before moving a card
   *  makes the board feel broken. But a rejected save is rolled back and
   *  said out loud: a board that keeps a change the server refused is
   *  lying about the state of the operation, which is worse than a board
   *  that feels slow.
   */
  function updateTask(id: string, patch: Partial<TaskMeta>) {
    const card = cards.find((entry) => entry.id === id)

    if (!card) return

    const before = taskMap[id]
    const next: TaskMeta = { ...card.task, ...patch }

    setTaskMap((current) => ({ ...current, [id]: next }))

    if (!companyName) {
      setSaveError(
        tx(
          "Aucun nom d'entreprise renseigné : la modification ne peut pas être enregistrée. Renseignez-le dans les Paramètres.",
          "No company name is set, so the change cannot be saved. Set it in Settings."
        )
      )
      return
    }

    saveAssignment(companyName, { task_key: id, ...next }).then((result) => {
      if (result.ok) {
        setSaveError(null)

        /* The open-task counts next to each contractor are derived from
           these rows, so they move whenever one does. */
        if ("contractor_id" in patch || "status" in patch) {
          refreshContractors()
        }

        return
      }

      setSaveError(px(result.detail))

      setTaskMap((current) => {
        const rolledBack = { ...current }

        if (before) rolledBack[id] = before
        else delete rolledBack[id]

        return rolledBack
      })
    })
  }

  function moveTo(id: string, status: Status) {
    if (!id) {
      return
    }

    updateTask(id, { status })
  }

  function handleDragStart(e: React.DragEvent<HTMLElement>, id: string) {
    e.stopPropagation()

    e.dataTransfer.setData("text/plain", id)
    e.dataTransfer.effectAllowed = "move"

    setDraggingId(id)
  }

  function handleDrop(e: React.DragEvent<HTMLElement>, status: Status) {
    e.preventDefault()
    e.stopPropagation()

    const id = e.dataTransfer.getData("text/plain")

    if (!id) {
      setDraggingId(null)
      setDragOverColumn(null)
      return
    }

    if (cards.some((card) => card.id === id)) {
      moveTo(id, status)
    }

    setDraggingId(null)
    setDragOverColumn(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  const opsMeta = opsType ? OPS_TYPE_LABEL[opsType] : undefined
  const opsLabel = opsMeta ? px(opsMeta) : undefined

  const editingCard = editingId
    ? cards.find((card) => card.id === editingId)
    : undefined

  /* The dialog is mounted from the board, not from inside a card. Rendered
     in the card it covered the card, and a short card clipped it against
     the column. */
  useEffect(() => {
    if (editingId && !cards.some((card) => card.id === editingId)) {
      setEditingId(null)
    }
  }, [editingId, cards])

  if (recommendations.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-brand-foreground" />
        {tx(
          "Aucune priorité urgente pour ce secteur pour le moment. Tout est sous contrôle ici.",
          "No urgent priority for this sector right now. Everything here is under control."
        )}
      </div>
    )
  }

  const stats: { label: string; value: string }[] = [
    { label: tx("Priorités", "Priorities"), value: String(cards.length) },
    { label: tx("Critiques", "Critical"), value: String(criticalCount) },
  ]

  if (totalExposure > 0) {
    stats.push({
      label: tx("Exposition", "Exposure"),
      value: formatMoney(totalExposure, currency, tx),
    })
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      {/* ------------------------------------------------------------------
          Title band: what this is, and the three numbers that describe it.
          ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {opsLabel ?? tx("Opérations", "Operations")}
          </p>

          <h3 className="mt-1.5 font-heading text-2xl font-bold tracking-tight">
            {tx("Priorités du moment", "What matters now")}
          </h3>
        </div>

        <dl className="flex shrink-0 items-end gap-5 sm:gap-7">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                index > 0 && "border-l border-border pl-5 sm:pl-7"
              )}
            >
              <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="mt-1 font-heading text-2xl font-bold leading-none tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ------------------------------------------------------------------
          Toolbar: find a card, then narrow the board.
          ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 border-t border-border px-5 py-3.5 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="relative min-w-0 md:max-w-xs md:flex-1">
          <label htmlFor="board-search" className="sr-only">
            {tx("Rechercher une priorité", "Search a priority")}
          </label>

          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />

          <input
            id="board-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tx(
              "Équipement, action, responsable…",
              "Asset, action, owner…"
            )}
            className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          />
        </div>

        {/* Dark active pill, brand count badge, every number counted from
            the cards on screen. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => {
            const active = filter === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}

                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    active
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* One atomic sentence rather than four competing live regions, so a
          screen reader hears what the board holds instead of a bare number
          every time a card moves. */}
      <p className="sr-only" role="status" aria-live="polite">
        {tx(
          `${visible.length} priorité(s) affichée(s) sur ${cards.length}, dont ${criticalCount} critique(s) et ${unassignedCount} non assignée(s).`,
          `${visible.length} of ${cards.length} priorities shown, ${criticalCount} critical, ${unassignedCount} unassigned.`
        )}
      </p>

      {/* Nothing here is silent. A board that cannot read its assignments
          and a board that has none look identical, and a change that did
          not reach the server must not sit on screen looking saved. */}
      {loadError && (
        <p className="mx-5 mb-1 rounded-2xl border border-dashed border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground md:mx-6">
          <span className="font-semibold text-foreground">
            {tx("Assignations non chargées.", "Assignments not loaded.")}
          </span>{" "}
          {loadError}{" "}
          {tx(
            "Les cartes ci-dessous sont réelles, mais leur statut et leur responsable ne sont pas ceux enregistrés.",
            "The cards below are real, but their status and owner are not the saved ones."
          )}
        </p>
      )}

      {saveError && (
        <p
          role="alert"
          className="mx-5 mb-1 rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-xs leading-5 md:mx-6"
        >
          <span className="font-semibold text-destructive">
            {tx("Modification non enregistrée.", "Change not saved.")}
          </span>{" "}
          {saveError}{" "}
          {tx(
            "La carte a été remise dans son état précédent.",
            "The card has been put back the way it was."
          )}
        </p>
      )}

      {/* ------------------------------------------------------------------
          The columns, in a recessed trough.

          --background is darker than --card in light mode and darker again
          in dark mode, so the trough reads as inset and the white cards lift
          out of it under either theme. A trough tinted with --muted would
          have inverted in the dark.
          ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-3 border-t border-border bg-background p-3 md:grid-cols-3 md:gap-4 md:p-4">
        {COLUMNS.map((column, columnIndex) => {
          const columnCards = visible
            .filter((card) => card.task.status === column.id)
            .sort(
              (a, b) =>
                PRIORITY_RANK[b.task.priority] - PRIORITY_RANK[a.task.priority]
            )

          const columnExposure = columnCards.reduce(
            (sum, card) => sum + (card.rec.exposureEUR ?? 0),
            0
          )

          const isDropTarget = dragOverColumn === column.id

          return (
            <section
              key={column.id}
              aria-label={px(column.label)}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                setDragOverColumn(column.id)
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                setDragOverColumn(column.id)
              }}
              onDrop={(e) => handleDrop(e, column.id)}
              className={cn(
                "flex min-h-[280px] flex-col rounded-2xl p-1.5 transition-colors",
                isDropTarget && draggingId
                  ? "bg-brand/10 ring-2 ring-brand"
                  : "ring-1 ring-transparent"
              )}
            >
              {/* Column head: the name, how many, and what it is worth. */}
              <div className="mb-2.5 flex items-center justify-between gap-2 px-2 pt-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <h4
                    className={cn(
                      "inline-flex min-w-0 items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[12px] font-semibold",
                      COLUMN_TONE[column.id].pill
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        COLUMN_TONE[column.id].dot
                      )}
                      aria-hidden="true"
                    />
                    {px(column.label)}
                  </h4>

                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {columnCards.length}
                  </span>
                </div>

                {columnExposure > 0 && (
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {formatMoney(columnExposure, currency, tx)}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2.5">
                {columnCards.length === 0 && (
                  <div
                    className={cn(
                      "flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-10 text-center transition-colors",
                      isDropTarget && draggingId
                        ? "border-brand bg-card"
                        : "border-border"
                    )}
                  >
                    <Inbox
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />

                    <p className="text-[11px] leading-4 text-muted-foreground">
                      {trimmedQuery || filter !== "all"
                        ? tx(
                            "Rien ne correspond dans cette colonne.",
                            "Nothing matches in this column."
                          )
                        : px(column.empty)}
                    </p>
                  </div>
                )}

                {columnCards.map(({ id, rec, task }) => {
                  const Icon = CATEGORY_ICON[rec.action_category] ?? Sparkles
                  const tone = toneOf(rec)
                  const risk = riskOf(rec)
                  const isDragging = draggingId === id
                  const overdue = isDeadlineOverdue(task.deadline)

                  const assignee = contractors.find(
                    (person) => person.id === task.contractor_id
                  )

                  const signals = rec.alertCount ?? 0

                  const subtitle = [
                    rec.stageName,
                    signals > 1
                      ? tx(`${signals} signaux`, `${signals} signals`)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")

                  return (
                    <article
                      key={id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, id)}
                      onDragEnd={handleDragEnd}
                      aria-labelledby={`board-card-${id}`}
                      className={cn(
                        "group relative cursor-grab rounded-2xl border border-border bg-card p-3.5 shadow-sm",
                        "transition-[box-shadow,border-color,transform] duration-200 ease-out",
                        "hover:border-foreground/15 hover:shadow-md active:cursor-grabbing",
                        isDragging &&
                          "scale-[1.02] opacity-95 shadow-xl ring-2 ring-brand"
                      )}
                    >
                      {/* Row 1 — who owns it, and how bad it is. */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(id)}
                          className="flex min-w-0 items-center gap-2 rounded-full text-left transition-opacity hover:opacity-70"
                        >
                          <Owner assignee={assignee} tx={tx} />
                        </button>

                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold",
                            tone.pill
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              tone.dot
                            )}
                            aria-hidden="true"
                          />
                          {px(tone.word)}
                          {risk !== null && (
                            <span className="tabular-nums opacity-70">
                              {risk}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Row 2 — the asset, and where it sits in the chain. */}
                      <h5
                        id={`board-card-${id}`}
                        className="mt-3 text-[15px] font-semibold leading-tight tracking-tight"
                      >
                        {rec.equipment}
                      </h5>

                      {subtitle && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {subtitle}
                        </p>
                      )}

                      {/* Row 3 — what to do about it. */}
                      <p className="mt-2.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                        {rec.recommended_action}
                      </p>

                      {/* Row 4 — three chips at most. The board carried five
                          before, which turned the busiest cards into a wall
                          of grey boxes and hid the one chip that mattered. */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Chip
                          icon={Icon}
                          pillClassName={
                            (
                              CATEGORY_TONE[rec.action_category] ??
                              CATEGORY_TONE.other
                            ).pill
                          }
                          dotClassName={
                            (
                              CATEGORY_TONE[rec.action_category] ??
                              CATEGORY_TONE.other
                            ).dot
                          }
                        >
                          {px(
                            CATEGORY_LABEL[rec.action_category] ??
                              CATEGORY_LABEL.other
                          )}
                        </Chip>

                        <Chip
                          pillClassName={
                            (
                              PRIORITY_TONE[task.priority] ??
                              PRIORITY_TONE.medium
                            ).pill
                          }
                          dotClassName={
                            (
                              PRIORITY_TONE[task.priority] ??
                              PRIORITY_TONE.medium
                            ).dot
                          }
                        >
                          {px(
                            PRIORITY_LABEL[task.priority] ??
                              PRIORITY_LABEL.medium
                          )}
                        </Chip>

                        {(rec.downstream ?? 0) > 0 && (
                          <Chip icon={Waypoints} tone="brand">
                            {tx(
                              `${rec.downstream} en aval`,
                              `${rec.downstream} downstream`
                            )}
                          </Chip>
                        )}
                      </div>

                      {/* Row 5 — by when, and for how much. */}
                      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-border pt-3">
                        <button
                          type="button"
                          onClick={() => setEditingId(id)}
                          className={cn(
                            "-ml-1 flex shrink-0 items-center gap-1.5 rounded-lg px-1 py-0.5 text-[11px] transition-colors hover:bg-muted",
                            overdue
                              ? "font-semibold text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          <CalendarDays
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />

                          {task.deadline
                            ? formatDeadline(task.deadline, tx)
                            : tx("Échéance", "Due date")}
                        </button>

                        {(rec.exposureEUR ?? 0) > 0 && (
                          <span className="truncate text-[11px] font-semibold tabular-nums">
                            {tx(
                              `${formatMoney(
                                rec.exposureEUR!,
                                currency,
                                tx
                              )} exposés`,
                              `${formatMoney(
                                rec.exposureEUR!,
                                currency,
                                tx
                              )} exposed`
                            )}
                          </span>
                        )}
                      </div>

                      {/* The card's controls, floating on its top edge so
                          they never sit on top of the content the way the
                          old bottom-right pair did. Hidden until hover or
                          focus; a pointer-free route to all three lives in
                          the detail dialog, which the owner row and the due
                          date both open. */}
                      <div className="pointer-events-none absolute -top-2.5 right-3 flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 opacity-0 shadow-md transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label={tx(
                            "Déplacer vers la colonne précédente",
                            "Move to the previous column"
                          )}
                          disabled={columnIndex === 0}
                          onClick={() => {
                            if (columnIndex > 0) {
                              moveTo(id, COLUMNS[columnIndex - 1].id)
                            }
                          }}
                          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-25"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          aria-label={tx(
                            "Déplacer vers la colonne suivante",
                            "Move to the next column"
                          )}
                          disabled={columnIndex === COLUMNS.length - 1}
                          onClick={() => {
                            if (columnIndex < COLUMNS.length - 1) {
                              moveTo(id, COLUMNS[columnIndex + 1].id)
                            }
                          }}
                          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-25"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>

                        <span
                          className="mx-0.5 h-3.5 w-px bg-border"
                          aria-hidden="true"
                        />

                        <button
                          type="button"
                          onClick={() => setEditingId(id)}
                          aria-label={tx(
                            `Détails de la priorité ${rec.equipment}`,
                            `Priority detail for ${rec.equipment}`
                          )}
                          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {editingCard && (
        <DetailDialog
          card={editingCard}
          contractors={contractors}
          contractorsLoaded={loaded}
          currency={currency}
          onPatch={(patch) => updateTask(editingCard.id, patch)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
