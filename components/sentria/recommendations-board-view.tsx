"use client"

import { AskHeader } from "./ask-header"
import { DispatchPanel } from "./dispatch-panel"
import { TaskTextButton } from "./task-text-button"
import { StatusTag, type TagTone } from "./status-tag"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ListChecks,
  TriangleAlert,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  Fuel,
  EyeOff,
  Inbox,
  Menu,
  MoreHorizontal,
  Package,
  Radar,
  RotateCcw,
  Search,
  Sparkles,
  SquareKanban,
  UserRound,
  Waypoints,
  Wrench,
  X,
} from "@/lib/icons"
import type { LucideIcon } from "@/lib/icons"
import { useArrivals } from "@/lib/use-arrivals"
import { useEnter } from "@/lib/use-presence"
import { enterAt } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { useCompanyIdentity } from "@/lib/company"
import {
  AVAILABILITY_LABEL,
  contractorIdsOf,
  fetchAssignments,
  fetchContractors,
  saveAssignment,
  type Assignment,
  type Contractor,
} from "@/lib/crm"
import { rankForDispatch } from "@/lib/dispatch"
import { sendAlertFeedback } from "@/lib/feedback"
import { formatMoney, useLocale, type Currency } from "@/lib/locale"
import { localized, useTx, type Localized, type Tx, resolve } from "@/lib/i18n"
import { sectorLabel } from "@/lib/priorities"

const NO_ROLE = "__no_role__"

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

const LAYOUT_KEY = "sentria_board_layout"

/** How often the board looks for tasks closed by a text reply (F-SMS2), while its tab is open. */
const REPLY_LOOK_MS = 20000

type Priority = "low" | "medium" | "high" | "critical"

/** One card's state. The field names are the server's column names on
 *  purpose: a translation layer between "assignee" here and
 *  "contractor_ids" there would be one more place to get it wrong. */
type TaskMeta = {
  status: Status
  /** Everyone on this task, in the order they were added. A crane
   *  driver and a customs agent are on the same container. */
  contractor_ids: string[]
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
  /** The data behind the board is old (L4): an empty board is then not
   *  "everything is under control". */
  unmeasured?: boolean
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
  delay: { pill: "bg-warning/12 text-foreground", dot: "bg-warning" },
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

const COLUMN_TONE: Record<Status, { pill: string; dot: string; tag: TagTone }> = {
  todo: { pill: "bg-warning/15 text-foreground", dot: "bg-warning", tag: "warning" },
  in_progress: { pill: "bg-brand/20 text-foreground", dot: "bg-brand", tag: "info" },
  done: { pill: "bg-emerald-500/12 text-foreground", dot: "bg-emerald-500", tag: "success" },
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
    contractor_ids: [],
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
    if (!row?.task_key || row.status === "dismissed") continue

    map[row.task_key] = {
      status: asStatus(row.status),
      contractor_ids: contractorIdsOf(row),
      deadline: row.deadline ?? null,
      priority: asPriority(row.priority),
    }
  }

  return map
}

/** The cards the user dismissed (F-SUPPRESS). They are not in the task
 *  map: a dismissed card leaves the board until it is restored. */
function dismissedFrom(rows: Assignment[]): Set<string> {
  const ids = new Set<string>()

  for (const row of rows) {
    if (row?.task_key && row.status === "dismissed") ids.add(row.task_key)
  }

  return ids
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
    tag: "danger" as TagTone,
  },
  warning: {
    pill: "bg-warning/15 text-foreground",
    dot: "bg-warning",
    word: localized("Attention", "Warning"),
    tag: "warning" as TagTone,
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

/** Who is on the card: the people, or an honest gap.
 *
 *  Every initial drawn here has a real contractor behind it. There is no
 *  placeholder face when nobody is assigned, because an avatar nobody is
 *  behind is the single most misleading thing a board can draw.
 *
 *  Four initials is the cap. Past that the stack stops being readable
 *  and the count carries it, and a task with five names on it is
 *  something the administrator should open anyway. */
const OWNER_FACES = 4

function Owner({
  assignees,
  tx,
}: {
  assignees: Contractor[]
  tx: Tx
}) {
  if (assignees.length === 0) {
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

  const shown = assignees.slice(0, OWNER_FACES)
  const hidden = assignees.length - shown.length

  return (
    <>
      {/* The stack is one image of a group, so it gets one label with
          every name in it rather than four unlabelled initials. */}
      <span
        className="flex shrink-0 items-center"
        role="img"
        aria-label={tx(
          `Assigné à ${assignees.map((person) => person.name).join(", ")}`,
          `Assigned to ${assignees.map((person) => person.name).join(", ")}`
        )}
      >
        {shown.map((person, index) => (
          <span
            key={person.id}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background",
              /* A ring in the card's own colour, so overlapping
                 initials stay separable instead of merging into one
                 dark blob. */
              "ring-2 ring-card",
              index > 0 && "-ml-2"
            )}
          >
            {/* One letter once they overlap. Two initials in a 24px
                circle with 8px hidden under the next one renders as a
                letter and a sliver of a letter, which looks like a
                rendering fault rather than a stack. The full names are
                on the group's label. */}
            {assignees.length > 1
              ? getInitials(person.name).slice(0, 1)
              : getInitials(person.name)}
          </span>
        ))}

        {hidden > 0 && (
          <span className="-ml-2 flex h-6 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground ring-2 ring-card">
            {`+${hidden}`}
          </span>
        )}
      </span>

      {/* One name reads better than "1 person". Past that the count is
          the only thing that fits in a card column. */}
      <span className="truncate text-xs font-medium">
        {assignees.length === 1
          ? assignees[0].name
          : tx(
              `${assignees.length} intervenants`,
              `${assignees.length} people`
            )}
      </span>
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

/** The assignee picker a card's owner button opens (B-16). It used to
 *  open the full detail dialog, so assigning someone meant finding the
 *  list inside it; the "…" button is the way to the detail. */
function AssignPopover({
  task,
  contractors,
  contractorsLoaded,
  onPatch,
  onClose,
}: {
  task: TaskMeta
  contractors: Contractor[]
  contractorsLoaded: boolean
  onPatch: (patch: Partial<TaskMeta>) => void
  onClose: () => void
}) {
  const tx = useTx()
  const ref = useRef<HTMLDivElement>(null)
  const enter = useEnter()

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)

    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={tx("Assigner la tâche", "Assign the task")}
      data-origin="top-left"
      className={cn("absolute left-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-border bg-card p-1.5 shadow-xl t-dropdown", enter)}
    >
      {contractors.length === 0 ? (
        <p className="px-2 py-2 text-xs leading-5 text-muted-foreground">
          {contractorsLoaded
            ? tx(
                "Aucun intervenant enregistré. Ajoutez-les depuis Intervenants.",
                "No contractor on file. Add them from Field team."
              )
            : tx("Chargement des intervenants…", "Loading contractors…")}
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto">
          {contractors.map((person) => {
            const picked = task.contractor_ids.includes(person.id)

            return (
              <label
                key={person.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                  picked && "bg-muted"
                )}
              >
                <input
                  type="checkbox"
                  checked={picked}
                  onChange={() =>
                    onPatch({
                      contractor_ids: picked
                        ? task.contractor_ids.filter((id) => id !== person.id)
                        : [...task.contractor_ids, person.id],
                    })
                  }
                  className="h-4 w-4 shrink-0 accent-foreground"
                />
                <span className="truncate">{person.name}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DetailDialog({
  card,
  contractors,
  contractorsLoaded,
  currency,
  onPatch,
  onDispatch,
  onDismiss,
  onClose,
}: {
  card: Card
  contractors: Contractor[]
  contractorsLoaded: boolean
  currency: Currency
  onPatch: (patch: Partial<TaskMeta>) => void
  onDispatch: (personId: string) => Promise<boolean>
  onDismiss: () => void
  onClose: () => void
}) {
  const tx = useTx()
  const px = (text: Localized | undefined) => resolve(text, tx)

  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<Element | null>(null)
  const enter = useEnter()

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
      className={cn("fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4 t-modal-backdrop", enter)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="priority-detail-title"
        className={cn("max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl t-modal", enter)}
      >
        {/* Header ------------------------------------------------------- */}
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div className="min-w-0">
            <StatusTag tone={tone.tag} size="sm">
              {px(tone.word)}
              {risk !== null && (
                <span className="tabular-nums opacity-70">
                  {tx(` · risque ${risk}`, ` · risk ${risk}`)}
                </span>
              )}
            </StatusTag>

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

          {/* Send someone (F-DISPATCH): only on a task that is still open. */}
          {(task.status === "todo" || task.status === "in_progress") && (
            <DispatchPanel
              taskKey={card.id}
              ranked={rankForDispatch(contractors, task.contractor_ids)}
              onDispatch={onDispatch}
            />
          )}

          {/* A checkbox list rather than a multiple <select>. A native
              multi-select needs ctrl-click to add a second name and
              silently drops the first if you plain-click, which is the
              wrong way round for a control whose whole point is holding
              several. Each row carries what the person said about
              themselves and how much they are already holding, because
              "available" next to "4 open" is the case worth seeing
              before handing them a fifth. */}
          <fieldset>
            <legend className={labelClass}>
              {tx("Intervenants", "Assigned to")}
            </legend>

            {contractors.length > 0 && (
              <div className="mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-border">
                {contractors.map((person) => {
                  const picked = task.contractor_ids.includes(person.id)

                  return (
                    <div key={person.id} className="border-b border-border last:border-0">
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-3 py-2.5",
                        "transition-colors hover:bg-muted",
                        "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset",
                        picked && "bg-muted"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() =>
                          onPatch({
                            contractor_ids: picked
                              ? task.contractor_ids.filter(
                                  (id) => id !== person.id
                                )
                              : [...task.contractor_ids, person.id],
                          })
                        }
                        className="h-4 w-4 shrink-0 accent-foreground"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {person.name}
                        </span>

                        <span className="block truncate text-xs text-muted-foreground">
                          {px(AVAILABILITY_LABEL[person.availability]) ||
                            person.availability}
                          {person.open_assignments > 0 &&
                            tx(
                              ` · ${person.open_assignments} en cours`,
                              ` · ${person.open_assignments} open`
                            )}
                        </span>
                      </span>
                    </label>

                    {/* A text about this task, for a person who is on it and
                        can be texted (F-SMS2). The task must be saved with
                        them first, which a tick does at once. */}
                    {picked && person.sms_ready === true && (
                      <div className={cn(picked && "bg-muted")}>
                        <TaskTextButton taskKey={card.id} contractorId={person.id} name={person.name} />
                      </div>
                    )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Says how many, because a scrolled list can hide a tick
                and "nobody" has to be distinguishable from "somebody
                further down". */}
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {contractors.length === 0
                ? contractorsLoaded
                  ? tx(
                      "Aucun intervenant enregistré. Ajoutez-les depuis Intervenants.",
                      "No contractor on file. Add them from Contractors."
                    )
                  : tx("Chargement des intervenants…", "Loading contractors…")
                : task.contractor_ids.length === 0
                  ? tx("Personne n'est assigné.", "Nobody is assigned.")
                  : tx(
                      `${task.contractor_ids.length} intervenant${task.contractor_ids.length === 1 ? "" : "s"} sur cette tâche.`,
                      `${task.contractor_ids.length} ${task.contractor_ids.length === 1 ? "person" : "people"} on this task.`
                    )}
            </p>
          </fieldset>

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

          {/* Not useful: set it aside. Dismissed again and again, SentrIA
              lowers this alert and says so (F-SUPPRESS). */}
          <button
            type="button"
            onClick={onDismiss}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
          >
            <EyeOff className="h-3.5 w-3.5" />
            {tx("Écarter : pas utile", "Dismiss: not useful")}
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
  unmeasured = false,
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
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [showDismissed, setShowDismissed] = useState(false)
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
      setDismissed(dismissedFrom(stored.data))

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
            contractor_ids: [],
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
            contractor_ids: [],
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

  /* A reply to a text ("1" handled, "9" dismiss) changes a task on the
     server, not in this browser (F-SMS2). Look again on a timer and when the
     tab comes back, and take over only what a reply can do: a task that
     became done or dismissed. Everything else stays as this browser has it,
     so an edit in progress is never overwritten. */
  const taskMapRef = useRef(taskMap)
  useEffect(() => {
    taskMapRef.current = taskMap
  })

  useEffect(() => {
    if (!loaded || !companyName) return

    let cancelled = false

    async function look() {
      if (document.visibilityState !== "visible") return

      const stored = await fetchAssignments(companyName)

      if (cancelled || !stored.ok) return

      const closed = stored.data.filter(
        (row) => row?.task_key && (row.status === "done" || row.status === "dismissed")
      )
      const mine = taskMapRef.current
      const moved = closed.filter((row) =>
        row.status === "dismissed" ? !!mine[row.task_key] : !!mine[row.task_key] && mine[row.task_key].status !== "done"
      )

      if (moved.length === 0) return

      setTaskMap((current) => {
        const next = { ...current }

        for (const row of moved) {
          if (!next[row.task_key]) continue

          if (row.status === "dismissed") delete next[row.task_key]
          else next[row.task_key] = { ...next[row.task_key], status: "done" }
        }

        return next
      })

      setDismissed((current) => {
        const add = moved.filter((row) => row.status === "dismissed").map((row) => row.task_key)

        return add.length > 0 ? new Set([...current, ...add]) : current
      })

      // The open-task counts next to each person are derived from these rows.
      refreshContractors()
    }

    const timer = window.setInterval(look, REPLY_LOOK_MS)
    document.addEventListener("visibilitychange", look)
    window.addEventListener("focus", look)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", look)
      window.removeEventListener("focus", look)
    }
    // refreshContractors only reads companyName, which is in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, companyName])

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")

  /* Board (columns to drag between) or List (one dense row per priority,
     easier to scan when there are many). Remembered on this browser. */
  const [layout, setLayout] = useState<"board" | "list">("board")
  useEffect(() => {
    try {
      if (localStorage.getItem(LAYOUT_KEY) === "list") setLayout("list")
    } catch {
      /* Storage blocked: stay on the board. */
    }
  }, [])
  const chooseLayout = (next: "board" | "list") => {
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      /* Storage blocked: the choice lasts until reload. */
    }
  }
  const [activeSector, setActiveSector] = useState<string | null>(null)
  const [activeRole, setActiveRole] = useState<string | null>(null)

  const cards: Card[] = useMemo(() => {
    return recommendations
      .filter((rec) => !dismissed.has(getRecommendationId(rec)))
      .map((rec) => {
        const id = getRecommendationId(rec)
        const stored = taskMap[id]

        return {
          id,
          rec,
          task: stored ?? defaultTask(rec),
        }
      })
  }, [recommendations, taskMap, dismissed])

  /* Cards that arrive after the board is on screen pop in. */
  const arrivals = useArrivals(cards.map((card) => card.id))

  const dismissedRecs = useMemo(
    () => recommendations.filter((rec) => dismissed.has(getRecommendationId(rec))),
    [recommendations, dismissed]
  )

  const criticalCount = cards.filter(
    (card) => card.rec.severity === "CRITICAL"
  ).length

  const unassignedCount = cards.filter(
    (card) => card.task.contractor_ids.length === 0
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
    /* Every name on the task, not just the first. Searching for the
       customs agent has to find the container she is on even when the
       crane driver was added before her. */
    const names = card.task.contractor_ids
      .map((id) => contractors.find((person) => person.id === id)?.name ?? "")
      .join(" ")

    return [
      card.rec.equipment,
      card.rec.stageName ?? "",
      card.rec.recommended_action,
      card.rec.message,
      px(CATEGORY_LABEL[card.rec.action_category] ?? CATEGORY_LABEL.other),
      px(PRIORITY_LABEL[card.task.priority]),
      names,
    ]
      .join(" ")
      .toLowerCase()
  }

  const trimmedQuery = query.trim().toLowerCase()

  /** Sectors and departments actually present on the board right now — one
   *  shared board with filters, not a board per sector, since the same
   *  person often works across sectors and a split board would just hide
   *  their other work from them. */
  const sectorKeys = useMemo(() => {
    const seen: string[] = []
    for (const card of cards) {
      if (card.rec.sector && !seen.includes(card.rec.sector)) seen.push(card.rec.sector)
    }
    return seen
  }, [cards])

  const roleKeys = useMemo(() => {
    const seen: string[] = []
    for (const person of contractors) {
      const key = person.role?.trim() || NO_ROLE
      if (!seen.includes(key)) seen.push(key)
    }
    return seen
  }, [contractors])

  function cardRoles(card: Card): string[] {
    return card.task.contractor_ids.map(
      (id) => contractors.find((person) => person.id === id)?.role?.trim() || NO_ROLE
    )
  }

  const visible = useMemo(() => {
    let out = cards

    if (filter === "critical") {
      out = out.filter((card) => card.rec.severity === "CRITICAL")
    } else if (filter === "unassigned") {
      out = out.filter((card) => card.task.contractor_ids.length === 0)
    }

    if (activeSector) {
      out = out.filter((card) => card.rec.sector === activeSector)
    }

    if (activeRole) {
      out = out.filter((card) => {
        const roles = cardRoles(card)
        return activeRole === NO_ROLE
          ? card.task.contractor_ids.length > 0 && roles.includes(NO_ROLE)
          : roles.includes(activeRole)
      })
    }

    if (trimmedQuery) {
      out = out.filter((card) => haystack(card).includes(trimmedQuery))
    }

    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, filter, trimmedQuery, activeSector, activeRole, contractors, tx])

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
  // Stable, so the popover's outside-click listener is not rebuilt on
  // every render of the board.
  const closeAssign = useCallback(() => setAssigningId(null), [])

  function updateTask(id: string, patch: Partial<TaskMeta>): Promise<boolean> {
    const card = cards.find((entry) => entry.id === id)

    if (!card) return Promise.resolve(false)

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
      return Promise.resolve(false)
    }

    return saveAssignment(companyName, { task_key: id, ...next }).then((result) => {
      if (result.ok) {
        setSaveError(null)

        /* Acting on an alert is what tells SentrIA it is worth raising
           (F-SUPPRESS): it restarts the dismissal count. */
        if (
          "status" in patch &&
          patch.status !== before?.status &&
          (patch.status === "in_progress" || patch.status === "done")
        ) {
          sendAlertFeedback(card.rec.alert_key, card.rec.equipment, "acted")
        }

        /* The open-task counts next to each contractor are derived from
           these rows, so they move whenever one does. */
        if ("contractor_ids" in patch || "status" in patch) {
          refreshContractors()
        }

        return true
      }

      setSaveError(px(result.detail))

      setTaskMap((current) => {
        const rolledBack = { ...current }

        if (before) rolledBack[id] = before
        else delete rolledBack[id]

        return rolledBack
      })

      return false
    })
  }

  /** Set a card aside as not useful (F-SUPPRESS). Optimistic, rolled back
   *  and said out loud if the server refuses, like every other change. */
  function dismissCard(id: string) {
    const rec = recommendations.find((entry) => getRecommendationId(entry) === id)

    if (!rec) return

    if (!companyName) {
      setSaveError(
        tx(
          "Aucun nom d'entreprise renseigné : la modification ne peut pas être enregistrée. Renseignez-le dans les Paramètres.",
          "No company name is set, so the change cannot be saved. Set it in Settings."
        )
      )
      return
    }

    const task = taskMap[id] ?? defaultTask(rec)

    setDismissed((current) => new Set(current).add(id))
    setEditingId(null)

    saveAssignment(companyName, { task_key: id, ...task, status: "dismissed" }).then((result) => {
      if (result.ok) {
        setSaveError(null)
        sendAlertFeedback(rec.alert_key, rec.equipment, "dismissed")
        return
      }

      setSaveError(px(result.detail))
      setDismissed((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    })
  }

  function restoreCard(id: string) {
    const rec = recommendations.find((entry) => getRecommendationId(entry) === id)

    if (!rec || !companyName) return

    setDismissed((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })

    saveAssignment(companyName, { task_key: id, ...defaultTask(rec), ...(taskMap[id] ?? {}), status: "todo" }).then((result) => {
      if (result.ok) return

      setSaveError(px(result.detail))
      setDismissed((current) => new Set(current).add(id))
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
        {unmeasured
          ? tx(
              "Aucune priorité urgente pour ce secteur dans les données dont nous disposons. Elles ne sont pas à jour : cela ne dit pas que tout va bien.",
              "No urgent priority for this sector in the data we hold. It is not up to date, so this does not say all is well."
            )
          : tx(
              "Aucune priorité urgente pour ce secteur pour le moment. Tout est sous contrôle ici.",
              "No urgent priority for this sector right now. Everything here is under control."
            )}
      </div>
    )
  }

  const doneCount = cards.filter((card) => card.task.status === "done").length

  /* Shared by the card and the list row: the owner (opens the picker in
     place) and the due date (set in place). */
  const ownerButton = (id: string, assignees: Contractor[], compact: boolean) => (
    <button
      type="button"
      onClick={() => setAssigningId(assigningId === id ? null : id)}
      aria-expanded={assigningId === id}
      aria-haspopup="dialog"
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-1.5 rounded-full text-left transition-opacity hover:opacity-70",
        compact && "[&_span.h-6]:h-5 [&_span.h-6]:w-5"
      )}
    >
      <Owner assignees={assignees} tx={tx} />
    </button>
  )

  const dueDate = (
    id: string,
    equipment: string,
    deadline: string | null | undefined,
    overdue: boolean
  ) => (
    <label
      className={cn(
        "relative flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-1 py-0.5 text-[11px] transition-colors hover:bg-muted",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
        overdue ? "font-semibold text-destructive" : "text-muted-foreground"
      )}
    >
      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />

      {deadline ? formatDeadline(deadline, tx) : tx("Échéance", "Due")}

      <input
        type="date"
        value={deadline ?? ""}
        onChange={(event) => updateTask(id, { deadline: event.target.value || null })}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker?.()
          } catch {
            /* Older browsers focus the field instead. */
          }
        }}
        aria-label={tx(`Échéance de ${equipment}`, `Due date for ${equipment}`)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* The Ask SentrIA layout, as on Calendar: lime card (how far
          along), grey panel (the question, then search and filters), black
          card (the numbers). */}
      <AskHeader
        icon={ListChecks}
        eyebrow={opsLabel ?? tx("Toutes priorités", "All priorities")}
        title={tx("Que faut-il traiter maintenant ?", "What needs handling right now?")}
        progress={{
          share: cards.length ? doneCount / cards.length : 0,
          label: tx(`${doneCount} traitée${doneCount > 1 ? "s" : ""}`, `${doneCount} handled`),
          value: `${doneCount} / ${cards.length}`,
        }}
        heading={tx("Priorités du moment", "What matters now")}
        status={tx("Classées par urgence", "Ranked by urgency")}
        message={tx(
          `${cards.length} priorité${cards.length > 1 ? "s" : ""}, dont ${criticalCount} critique${criticalCount > 1 ? "s" : ""}. ${unassignedCount > 0 ? `${unassignedCount} n'${unassignedCount > 1 ? "ont" : "a"} encore personne.` : "Chacune a un responsable."} Chaque carte montre sa preuve, sa confiance et son impact.`,
          `${cards.length} priorit${cards.length === 1 ? "y" : "ies"}, ${criticalCount} critical. ${unassignedCount > 0 ? `${unassignedCount} still ${unassignedCount === 1 ? "has" : "have"} no one on ${unassignedCount === 1 ? "it" : "them"}.` : "Every one has an owner."} Each card shows its evidence, confidence and impact.`
        )}
        statsTitle={tx("Le tableau", "The board")}
        sectorTag
        rows={[
          { label: tx("Critiques", "Critical"), value: String(criticalCount), icon: TriangleAlert, tone: criticalCount > 0 ? "danger" : undefined },
          { label: tx("Non assignées", "Unassigned"), value: String(unassignedCount) },
          { label: tx("Traitées", "Handled"), value: String(doneCount) },
          ...(totalExposure > 0
            ? [{ label: tx("Exposition", "Exposure"), value: formatMoney(totalExposure, currency, tx) }]
            : []),
        ]}
        big={{ label: tx("Priorités", "Priorities"), value: String(cards.length) }}
      >
        <div className="flex flex-col gap-3">
        <div className="relative w-full max-w-md">
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
            className="h-10 w-full rounded-full border border-transparent bg-card pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand"
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
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-brand text-[#141414]"
                    : "bg-card hover:bg-card/70"
                )}
              >
                {item.label}

                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    active
                      ? "bg-[var(--ink)] text-brand"
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

      {(sectorKeys.length > 1 || roleKeys.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          {sectorKeys.length > 1 && (
            <>
              <span className="px-1 text-xs text-muted-foreground">
                {tx("Secteur", "Sector")}
              </span>
              <button
                type="button"
                onClick={() => setActiveSector(null)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  activeSector === null
                    ? "bg-brand text-[#141414]"
                    : "bg-card hover:bg-card/70"
                )}
              >
                {tx("Tous", "All")}
              </button>
              {sectorKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSector(key)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                    activeSector === key
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {sectorLabel(key, tx)}
                </button>
              ))}
            </>
          )}

          {sectorKeys.length > 1 && roleKeys.length > 1 && (
            <span className="mx-1 h-5 w-px shrink-0 bg-border" />
          )}

          {roleKeys.length > 1 && (
            <>
              <span className="px-1 text-xs text-muted-foreground">
                {tx("Département", "Department")}
              </span>
              <button
                type="button"
                onClick={() => setActiveRole(null)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  activeRole === null
                    ? "bg-brand text-[#141414]"
                    : "bg-card hover:bg-card/70"
                )}
              >
                {tx("Tous", "All")}
              </button>
              {roleKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveRole(key)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                    activeRole === key
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {key === NO_ROLE ? tx("Sans fonction", "No role") : key}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      </AskHeader>

      <div
        id="priorities-board"
        className="t-enter overflow-hidden rounded-[28px] bg-card shadow-sm"
        style={enterAt(1.6)}
      >
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
      {/* Board or list: the same priorities, two densities. */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 md:px-5">
        <p className="text-xs text-muted-foreground">
          {tx(
            `${visible.length} priorité${visible.length > 1 ? "s" : ""}`,
            `${visible.length} ${visible.length === 1 ? "priority" : "priorities"}`
          )}
        </p>

        <div
          role="group"
          aria-label={tx("Affichage", "Layout")}
          className="flex items-center gap-0.5 rounded-full bg-muted p-0.5"
        >
          {(
            [
              ["board", SquareKanban, tx("Tableau", "Board")],
              ["list", Menu, tx("Liste", "List")],
            ] as const
          ).map(([value, Glyph, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={layout === value}
              onClick={() => chooseLayout(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                layout === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Glyph className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {layout === "list" ? (
        <ul
          className="divide-y divide-border border-t border-border"
          aria-label={tx("Priorités", "Priorities")}
          data-testid="priority-list"
        >
          {visible.length === 0 && (
            <li className="px-5 py-10 text-center text-xs text-muted-foreground">
              {tx("Rien ne correspond.", "Nothing matches.")}
            </li>
          )}

          {[...visible]
            .sort(
              (a, b) =>
                COLUMNS.findIndex((c) => c.id === a.task.status) -
                  COLUMNS.findIndex((c) => c.id === b.task.status) ||
                PRIORITY_RANK[b.task.priority] - PRIORITY_RANK[a.task.priority]
            )
            .map(({ id, rec, task }) => {
              const tone = toneOf(rec)
              const risk = riskOf(rec)
              const assignees = task.contractor_ids
                .map((cid) => contractors.find((person) => person.id === cid))
                .filter((person): person is Contractor => Boolean(person))

              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-muted/40 md:px-5"
                >
                  {/* A fixed slot, so every title starts on the same line. */}
                  <span className="w-[6.5rem] shrink-0">
                    <StatusTag tone={tone.tag} size="xs">
                      {px(tone.word)}
                      {risk !== null && (
                        <span className="tabular-nums opacity-70">{` · ${risk}`}</span>
                      )}
                    </StatusTag>
                  </span>

                  <div className="min-w-[12rem] flex-1">
                    <p className="truncate text-sm font-semibold">
                      {rec.equipment}
                      {rec.stageName && (
                        <span className="font-normal text-muted-foreground">
                          {` · ${rec.stageName}`}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={rec.recommended_action}>
                      {rec.recommended_action}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={task.status}
                      onChange={(event) => moveTo(id, event.target.value as Status)}
                      aria-label={tx(`Statut de ${rec.equipment}`, `Status of ${rec.equipment}`)}
                      className="h-7 rounded-full border border-border bg-card px-2.5 text-[11px] font-semibold"
                    >
                      {COLUMNS.map((column) => (
                        <option key={column.id} value={column.id}>
                          {px(column.label)}
                        </option>
                      ))}
                    </select>

                    <span className="relative flex items-center">
                      {ownerButton(id, assignees, true)}
                      {assigningId === id && (
                        <AssignPopover
                          task={task}
                          contractors={contractors}
                          contractorsLoaded={loaded}
                          onPatch={(patch) => updateTask(id, patch)}
                          onClose={closeAssign}
                        />
                      )}
                    </span>

                    {dueDate(id, rec.equipment, task.deadline, isDeadlineOverdue(task.deadline))}

                    {(rec.exposureEUR ?? 0) > 0 && (
                      <span className="hidden w-20 text-right text-[11px] font-semibold tabular-nums lg:inline">
                        {formatMoney(rec.exposureEUR!, currency, tx)}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setEditingId(id)}
                      aria-label={tx(
                        `Détails de la priorité ${rec.equipment}`,
                        `Priority detail for ${rec.equipment}`
                      )}
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
        </ul>
      ) : (
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
                  <h4 className="min-w-0">
                    <StatusTag tone={COLUMN_TONE[column.id].tag} size="sm">
                      {px(column.label)}
                    </StatusTag>
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

                  /* Resolved in the order they were added, and a stale
                     id that no longer matches a contractor is dropped
                     rather than drawn as a blank face. */
                  const assignees = task.contractor_ids
                    .map((cid) =>
                      contractors.find((person) => person.id === cid)
                    )
                    .filter((person): person is Contractor =>
                      Boolean(person)
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
                        "group relative cursor-grab rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm",
                        "transition-[box-shadow,border-color,transform] duration-200 ease-out",
                        "hover:border-foreground/15 hover:shadow-md active:cursor-grabbing",
                        arrivals.has(id) && "t-rise-in",
                        isDragging &&
                          "scale-[1.02] opacity-95 shadow-xl ring-2 ring-brand"
                      )}
                    >
                      {/* Three lines: what and how bad; what to do; who,
                          by when, for how much. The rest is in the detail. */}
                      <div className="flex items-center gap-2">
                        <h5
                          id={`board-card-${id}`}
                          className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight"
                          title={subtitle ? `${rec.equipment} · ${subtitle}` : rec.equipment}
                        >
                          {rec.equipment}
                          {subtitle && (
                            <span className="font-normal text-muted-foreground">
                              {` · ${subtitle}`}
                            </span>
                          )}
                        </h5>

                        <StatusTag tone={tone.tag} size="xs">
                          {px(tone.word)}
                          {risk !== null && (
                            <span className="tabular-nums opacity-70">
                              {` · ${risk}`}
                            </span>
                          )}
                        </StatusTag>
                      </div>

                      <p
                        className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"
                        title={rec.recommended_action}
                      >
                        <Icon
                          className="mt-1 h-3 w-3 shrink-0"
                          aria-label={px(
                            CATEGORY_LABEL[rec.action_category] ?? CATEGORY_LABEL.other
                          )}
                        />
                        <span className="line-clamp-1">{rec.recommended_action}</span>
                      </p>

                      <div className="relative mt-2 flex items-center gap-1.5">
                        {ownerButton(id, assignees, true)}

                        {assigningId === id && (
                          <AssignPopover
                            task={task}
                            contractors={contractors}
                            contractorsLoaded={loaded}
                            onPatch={(patch) => updateTask(id, patch)}
                            onClose={closeAssign}
                          />
                        )}

                        {dueDate(id, rec.equipment, task.deadline, overdue)}

                        {/* Priority is the column's sort order, and the
                            severity tag already says how bad it is. */}
                        {(rec.exposureEUR ?? 0) > 0 && (
                          <span className="min-w-0 truncate text-[11px] font-semibold tabular-nums">
                            {formatMoney(rec.exposureEUR!, currency, tx)}
                          </span>
                        )}

                        {/* Move arrows appear on hover or keyboard focus;
                            the detail button is always there (touch has
                            no hover). */}
                        <div className="ml-auto flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
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
                        </div>

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
      )}
      </div>

      {/* Cards set aside as not useful (F-SUPPRESS), one click from coming
          back. Shown only when there are some. */}
      {dismissedRecs.length > 0 && (
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={() => setShowDismissed((open) => !open)}
            aria-expanded={showDismissed}
            className="flex w-full items-center gap-2 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <EyeOff className="h-3.5 w-3.5" />
            {tx(
              `Écartées : ${dismissedRecs.length}`,
              `Dismissed: ${dismissedRecs.length}`
            )}
          </button>

          {showDismissed && (
            <ul className="mt-3 divide-y divide-border">
              {dismissedRecs.map((rec) => {
                const id = getRecommendationId(rec)

                return (
                  <li key={id} className="flex items-center gap-3 py-2">
                    <p className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-semibold">{rec.equipment}</span>
                      <span className="text-muted-foreground"> · {rec.message}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => restoreCard(id)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/70"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {tx("Rétablir", "Restore")}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {editingCard && (
        <DetailDialog
          card={editingCard}
          contractors={contractors}
          contractorsLoaded={loaded}
          currency={currency}
          onPatch={(patch) => updateTask(editingCard.id, patch)}
          onDispatch={(personId) =>
            updateTask(editingCard.id, {
              contractor_ids: [...editingCard.task.contractor_ids.filter((id) => id !== personId), personId],
              status: editingCard.task.status === "todo" ? "in_progress" : editingCard.task.status,
            })
          }
          onDismiss={() => dismissCard(editingCard.id)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
