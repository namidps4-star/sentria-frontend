"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUp,
  ArrowUpRight,
  MessageSquare,
  Plus,
  Sparkles,
} from "@/lib/icons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { activityLabel, inAccountScope, readSectors } from "@/lib/activities"
import { API_BASE, apiFetch } from "@/lib/api"
import { readTimezoneId, timezoneFor, useCompanyIdentity } from "@/lib/company"
import { taskKeyFor } from "@/lib/crm"
import { useTx, type Tx } from "@/lib/i18n"
import { readDepartments } from "@/lib/plans"
import { sectorLabel } from "@/lib/priorities"
import { withOurSector } from "@/lib/sector"
import { enterAt } from "@/lib/motion"
import { cn } from "@/lib/utils"

import { StatusTag } from "./status-tag"
import type { Notification } from "./topbar"
import type { ViewKey } from "./types"

import { SectorTag } from "./sector-tag"
type Msg = { role: "user" | "ai"; text: string; failed?: boolean }

type Thread = { id: string; title: string; messages: Msg[]; updatedAt: number }

type Alert = {
  id?: string | number
  equipment?: string
  severity?: string
  sector?: string | null
  business_type?: string | null
  alert_key?: string | null
}

/* ------------------------------------------------------------------ */
/*  Conversations, kept for this tab and this user only                */
/* ------------------------------------------------------------------ */

// sessionStorage, keyed by user: gone when the tab closes, and another
// account signed in on the same browser never sees them.
function storageKey(): string | null {
  try {
    const owner = localStorage.getItem("sentria_account_owner")
    return owner ? `sentria_ask:${owner}` : null
  } catch {
    return null
  }
}

function readThreads(): Thread[] {
  const key = storageKey()
  if (!key) return []
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "[]")
    return Array.isArray(saved) ? saved.filter((t) => t && typeof t.id === "string" && Array.isArray(t.messages)) : []
  } catch {
    return []
  }
}

function writeThreads(threads: Thread[]) {
  const key = storageKey()
  if (!key) return
  try {
    sessionStorage.setItem(key, JSON.stringify(threads.slice(0, 12)))
  } catch {
    /* storage full or blocked: the chat still works */
  }
}

function newThread(): Thread {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return { id, title: "", messages: [], updatedAt: Date.now() }
}

/* ------------------------------------------------------------------ */
/*  Questions worth asking, from the account's own data                */
/* ------------------------------------------------------------------ */

const SECTOR_QUESTION: Record<string, [string, string]> = {
  health: ["Quels médicaments sont les plus proches de la rupture ?", "Which medicines are closest to running out?"],
  industry: ["Quelle machine risque de tomber en panne en premier ?", "Which machine is most likely to break down next?"],
  logistics: ["Où les choses sont-elles bloquées en ce moment ?", "Where are things stuck right now?"],
  commerce: ["Quels produits dois-je recommander cette semaine ?", "Which products should I reorder this week?"],
  agriculture: ["Quels lots sont les plus à risque ?", "Which lots are most at risk?"],
  energy: ["Quel site faut-il ravitailler en premier ?", "Which site needs fuel first?"],
}

function questionsFor(sector: string | undefined, topCritical: string | undefined, tx: Tx): string[] {
  const list: string[] = []
  if (topCritical) {
    list.push(tx(`Pourquoi ${topCritical} est critique, et que faire d'abord ?`, `Why is ${topCritical} critical, and what do I do first?`))
  }
  list.push(tx("Qu'est-ce qui demande mon attention aujourd'hui ?", "What needs my attention today?"))
  const bySector = sector ? SECTOR_QUESTION[sector] : undefined
  if (bySector) list.push(tx(bySector[0], bySector[1]))
  list.push(tx("Résume les alertes critiques des 7 derniers jours.", "Summarise the critical alerts of the last 7 days."))
  return list.slice(0, 4)
}

/* ------------------------------------------------------------------ */
/*  The view                                                           */
/* ------------------------------------------------------------------ */

export function AskView({
  name = "",
  email = "",
  openCritical = [],
  onNavigate,
}: {
  name?: string
  email?: string
  /** Critical tasks nobody has handled yet (the bell's list). */
  openCritical?: Notification[]
  onNavigate?: (view: ViewKey) => void
}) {
  const tx = useTx()
  const { name: companyName } = useCompanyIdentity()
  const firstName = name.trim().split(/\s+/)[0] ?? ""

  const [threads, setThreads] = useState<Thread[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [lastReplyMs, setLastReplyMs] = useState<number | null>(null)
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  const [scope, setScope] = useState<{ sectors: string[]; departments: Record<string, string[]>; businessType: string | null }>({
    sectors: [],
    departments: {},
    businessType: null,
  })
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Conversations and scope, once, in the browser.
  useEffect(() => {
    const saved = readThreads()
    const first = saved[0] ?? newThread()
    setThreads(saved.length ? saved : [first])
    setActiveId(first.id)
    let businessType: string | null = null
    try {
      businessType = localStorage.getItem("sentria_business_type")
    } catch {
      businessType = null
    }
    setScope({ sectors: readSectors(), departments: readDepartments(), businessType })
  }, [])

  // What SentrIA reads: the same alerts as the dashboard, in scope.
  const lang = tx("fr", "en")
  useEffect(() => {
    let cancelled = false
    apiFetch(`${API_BASE}/alerts?lang=${lang}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (!cancelled) setAlerts(Array.isArray(d) ? d.map(withOurSector) : [])
      })
      .catch(() => {
        if (!cancelled) setAlerts(null)
      })
    return () => {
      cancelled = true
    }
  }, [lang])

  const scoped = useMemo(
    () => (alerts ? inAccountScope(alerts, scope.sectors, scope.businessType) : []),
    [alerts, scope]
  )

  // Critical tasks (repeats of one issue count once), and how many are handled.
  const criticalTasks = useMemo(() => {
    const keys = new Set<string>()
    for (const a of scoped) {
      if (String(a.severity).toUpperCase() !== "CRITICAL") continue
      keys.add(taskKeyFor({ equipment: String(a.equipment ?? ""), alert_key: a.alert_key, id: String(a.id ?? "") }))
    }
    return keys.size
  }, [scoped])
  const openCount = Math.min(openCritical.length, criticalTasks)
  const handledCount = Math.max(0, criticalTasks - openCount)
  const handledShare = criticalTasks ? handledCount / criticalTasks : 0

  const mainSector = scope.sectors[0]
  const departmentNames = (mainSector ? scope.departments[mainSector] ?? [] : [])
    .map((id) => activityLabel(mainSector, id, tx))
    .filter((label): label is string => Boolean(label))

  const questions = questionsFor(mainSector, openCritical[0]?.equipment || undefined, tx)

  const active = threads.find((t) => t.id === activeId) ?? threads[0]
  const messages = active?.messages ?? []

  // Newest message in view.
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [messages.length, loading, activeId])

  function update(id: string, change: (thread: Thread) => Thread) {
    setThreads((current) => {
      const next = current.map((t) => (t.id === id ? change(t) : t)).sort((a, b) => b.updatedAt - a.updatedAt)
      writeThreads(next.filter((t) => t.messages.length > 0))
      return next
    })
  }

  function startConversation() {
    if (active && active.messages.length === 0) {
      inputRef.current?.focus()
      return
    }
    const thread = newThread()
    setThreads((current) => [thread, ...current])
    setActiveId(thread.id)
    setInput("")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function send(text: string) {
    const question = text.trim()
    if (!question || loading || !active) return

    const id = active.id
    update(id, (t) => ({
      ...t,
      title: t.title || (question.length > 60 ? `${question.slice(0, 57)}…` : question),
      messages: [...t.messages, { role: "user", text: question }],
      updatedAt: Date.now(),
    }))
    setInput("")
    setLoading(true)
    const startedAt = Date.now()

    const zone = timezoneFor(readTimezoneId())

    try {
      const res = await apiFetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: question,
          lang,
          session_id: id,
          timezone: zone.zone,
          timezone_label: zone.label,
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const detail = data?.detail
        throw new Error(
          (typeof detail === "string" ? detail : detail?.message) ||
            tx(`Le serveur a répondu ${res.status}.`, `The server answered ${res.status}.`)
        )
      }

      const answer = data?.answer ?? data?.message ?? data?.response ?? data?.text
      setLastReplyMs(Date.now() - startedAt)
      update(id, (t) => ({
        ...t,
        messages: [...t.messages, { role: "ai", text: String(answer || tx("Réponse vide.", "Empty answer.")) }],
        updatedAt: Date.now(),
      }))
    } catch (error) {
      update(id, (t) => ({
        ...t,
        messages: [
          ...t.messages,
          {
            role: "ai",
            failed: true,
            text:
              tx("SentrIA n'a pas pu répondre. ", "SentrIA couldn't answer. ") +
              (error instanceof Error ? error.message : tx("Réseau indisponible.", "Network unavailable.")),
          },
        ],
        updatedAt: Date.now(),
      }))
    } finally {
      setLoading(false)
    }
  }

  const today = new Date()
  const locale = tx("fr-FR", "en-GB")
  const title = active?.title || tx("Demandez à SentrIA", "Ask SentrIA")

  return (
    <div className="grid gap-4 lg:h-full lg:min-h-[560px] lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_290px]">
      {/* ---------------------------------------------------------- LEFT */}
      <div className="hidden min-h-0 flex-col gap-4 lg:flex">
        {/* Lime: who, and how far the critical list has come. */}
        <div className="t-enter rounded-[28px] bg-brand p-5 text-[#141414]" style={enterAt(0)}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold">SentrIA</span>
                <span className="block text-[11px] text-[#141414]/65">{tx("Assistant", "Assistant")}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={startConversation}
              aria-label={tx("Nouvelle conversation", "New conversation")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#141414] shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-5 truncate font-heading text-2xl font-semibold tracking-tight" title={companyName || name}>
            {companyName || name || tx("Votre espace", "Your workspace")}
          </p>

          <div className="mt-4">
            <div
              className="h-2 overflow-hidden rounded-full bg-white/70"
              role="progressbar"
              aria-label={tx("Alertes critiques traitées", "Critical alerts handled")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(handledShare * 100)}
            >
              <div className="h-full rounded-full bg-[var(--ink)] transition-[width] duration-500" style={{ width: `${Math.round(handledShare * 100)}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold">
              <span>{tx("Critiques traitées", "Critical handled")}</span>
              <span className="tabular-nums">
                {handledCount} / {criticalTasks}
              </span>
            </div>
          </div>
        </div>

        {/* Conversations */}
        <div className="flex min-h-0 flex-1 flex-col rounded-[28px] bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold tracking-tight">{tx("Conversations", "Conversations")}</h2>
            <button
              type="button"
              onClick={startConversation}
              aria-label={tx("Nouvelle conversation", "New conversation")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-white transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" aria-label={tx("Vos conversations", "Your conversations")}>
            {threads.map((thread) => {
              const on = thread.id === active?.id
              const count = thread.messages.filter((m) => m.role === "user").length
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(thread.id)}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      "w-full rounded-2xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "bg-[var(--ink)] text-white ring-1 ring-brand/40" : "bg-muted hover:bg-muted/70"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {thread.title || tx("Nouvelle conversation", "New conversation")}
                      </span>
                      {on && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
                    </span>
                    <span className={cn("mt-0.5 block text-[11px]", on ? "text-white/55" : "text-muted-foreground")}>
                      {count === 0
                        ? tx("vide", "empty")
                        : tx(`${count} question${count > 1 ? "s" : ""}`, `${count} question${count > 1 ? "s" : ""}`)}
                      {" · "}
                      {new Date(thread.updatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* -------------------------------------------------------- CENTER */}
      <section
        className="t-enter flex min-h-[70dvh] flex-col rounded-[28px] bg-foreground/[0.055] p-4 sm:p-6 lg:min-h-0"
        style={enterAt(0.4)}
        aria-label={tx("Conversation", "Conversation")}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="line-clamp-2 font-heading text-3xl font-semibold leading-[1.05] tracking-tight">{title}</h2>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-brand ring-2 ring-brand/30" aria-hidden="true" />
              {tx("Assistant en ligne", "Assistant online")}
              {companyName ? ` · ${companyName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (onNavigate ? onNavigate("tracking") : undefined)}
            className="shrink-0 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tx("Voir le suivi", "Open Tracking")}
          </button>
        </div>

        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label={tx("Messages", "Messages")}
          className="-mx-1 mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2"
        >
          {/* The greeting, and questions to start with. */}
          <div className="max-w-[85%] self-start rounded-[22px] bg-[var(--ink)] p-4 text-sm leading-relaxed text-white">
            {firstName
              ? tx(`Bonjour ${firstName}. `, `Hello ${firstName}. `)
              : tx("Bonjour. ", "Hello. ")}
            {tx(
              "Posez-moi une question sur vos opérations : je réponds à partir de vos alertes.",
              "Ask me about your operations: I answer from your alerts."
            )}
          </div>

          {messages.length === 0 && (
            <div className="mt-1">
              <p className="px-1 text-xs text-muted-foreground">{tx("Pour commencer :", "To start:")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {questions.map((q, i) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className={cn(
                      "rounded-full px-4 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      i === 0 ? "bg-brand text-[#141414] hover:opacity-90" : "bg-card hover:bg-card/70"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="max-w-[80%] self-end whitespace-pre-wrap rounded-[22px] bg-card px-4 py-3 text-sm leading-relaxed shadow-sm">
                {m.text}
              </div>
            ) : (
              <div key={i} className="max-w-[88%] self-start rounded-[22px] bg-[var(--ink)] p-4 text-sm leading-relaxed text-white">
                {m.failed && (
                  <StatusTag tone="danger" size="xs" className="mb-2">
                    {tx("Pas de réponse", "No answer")}
                  </StatusTag>
                )}
                <div className="space-y-2 overflow-x-auto [&_a]:text-brand [&_a]:underline [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_li]:ml-4 [&_ol]:list-decimal [&_strong]:font-semibold [&_strong]:text-brand [&_table]:min-w-full [&_table]:border-collapse [&_td]:border [&_td]:border-white/15 [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-white/15 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_ul]:list-disc">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                </div>
              </div>
            )
          )}

          {loading && (
            <div
              className="flex items-center gap-1.5 self-start rounded-full bg-[var(--ink)] px-4 py-3"
              role="status"
              aria-label={tx("SentrIA écrit…", "SentrIA is writing…")}
            >
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-2 w-2 animate-pulse rounded-full bg-brand motion-reduce:animate-none"
                  style={{ animationDelay: `${dot * 180}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            send(input)
          }}
          className="mt-3 flex items-end gap-2.5"
        >
          <div className="flex min-h-14 flex-1 items-center gap-2 rounded-full bg-card py-2 pl-2 pr-5 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </span>
            <label htmlFor="ask-input" className="sr-only">
              {tx("Votre question", "Your question")}
            </label>
            <textarea
              id="ask-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  send(input)
                }
              }}
              rows={1}
              placeholder={tx("Posez votre question à SentrIA…", "Ask SentrIA a question…")}
              className="max-h-32 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label={tx("Envoyer", "Send")}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-brand transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      </section>

      {/* --------------------------------------------------------- RIGHT */}
      <div className="hidden min-h-0 flex-col gap-4 xl:flex">
        {/* Black: what SentrIA reads to answer. */}
        <div className="t-enter rounded-[28px] bg-[var(--ink)] p-5 text-white" style={enterAt(0.8)}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-xl font-semibold leading-tight tracking-tight">
              {tx("Ce que SentrIA lit", "What SentrIA reads")}
            </h2>
            <SectorTag />
          </div>
          <dl className="mt-4 space-y-2.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-white/55">{tx("Secteur", "Sector")}</dt>
              <dd className="truncate font-semibold">
                {scope.sectors.map((s) => sectorLabel(s, tx)).join(" + ") || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-white/55">{tx("Départements", "Departments")}</dt>
              <dd className="truncate text-right font-semibold" title={departmentNames.join(", ")}>
                {departmentNames.join(", ") || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/55">{tx("Alertes lues", "Alerts read")}</dt>
              <dd className="font-semibold tabular-nums">{alerts ? scoped.length : "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
            <span className="text-xs text-white/55">{tx("Critiques ouvertes", "Open critical")}</span>
            <span className="font-heading text-4xl font-semibold leading-none text-brand tabular-nums">{openCount}</span>
          </div>
        </div>

        {/* Today and the last answer's speed. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 rounded-full border border-border bg-card p-1.5 pr-3 shadow-sm">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] font-heading text-base font-bold text-white tabular-nums">
              {today.getDate()}
            </span>
            <span className="text-xs font-semibold leading-tight">
              <span className="capitalize">{today.toLocaleDateString(locale, { weekday: "short" })}</span>,
              <br />
              <span className="capitalize text-muted-foreground">{today.toLocaleDateString(locale, { month: "short" })}</span>
            </span>
          </div>
          <div className="flex flex-col justify-center rounded-full bg-foreground/15 px-4 py-2">
            <span className="text-[10px] text-foreground/70">{tx("Dernière réponse", "Last reply")}</span>
            <span className="font-heading text-lg font-semibold leading-tight tabular-nums">
              {lastReplyMs === null ? "—" : `${Math.max(1, Math.round(lastReplyMs / 1000))} s`}
            </span>
          </div>
        </div>

        {/* Quick questions */}
        <div className="flex min-h-0 flex-1 flex-col rounded-[28px] bg-card p-5 shadow-sm">
          <h2 className="font-heading text-xl font-semibold tracking-tight">{tx("Questions rapides", "Quick questions")}</h2>
          <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {questions.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => send(q)}
                  disabled={loading}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-muted py-2 pl-4 pr-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <span className="line-clamp-2">{q}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card shadow-sm" aria-hidden="true">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => onNavigate?.("dashboard")}
            className="mt-4 flex items-center justify-between rounded-full bg-brand py-2 pl-5 pr-2 text-sm font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tx("Voir les alertes", "See the alerts")}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-brand" aria-hidden="true">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>

      {/* Phones and small screens: start a new conversation from here. */}
      <button
        type="button"
        onClick={startConversation}
        className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold lg:hidden"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {tx("Nouvelle conversation", "New conversation")}
      </button>
    </div>
  )
}
