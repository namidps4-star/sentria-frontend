"use client"

import { useState } from "react"

import { Sparkles, ArrowUp, Globe2, Lightbulb, MapPin, User } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"
import { API_BASE as API } from "@/lib/api"
import {
  initialsOf,
  timezoneFor,
  useCompanyIdentity,
} from "@/lib/company"
import { useLocale } from "@/lib/locale"
import { localized, useTx, type Localized } from "@/lib/i18n"

/* Starter questions. They are sent to the model as typed, so each one is
   a pair: asking in English and getting a French question back in the
   thread would be the same defect as a French interface. */
const SUGGESTIONS: { icon: typeof MapPin; text: Localized }[] = [
  {
    icon: MapPin,
    text: localized(
      "Quels systèmes présentent un risque opérationnel croissant ?",
      "Which systems are showing a rising operational risk?"
    ),
  },
  {
    icon: Lightbulb,
    text: localized(
      "Compare les signaux entre la Ligne Alpha et le Groupe Froid B.",
      "Compare the signals between Line Alpha and Cold Unit B."
    ),
  },
  {
    icon: Globe2,
    text: localized(
      "Résume les alertes critiques des 7 derniers jours.",
      "Summarise the critical alerts of the last 7 days."
    ),
  },
]

type Msg = {
  role: "user" | "ai"
  text: string
}

export function AskView() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  /* The greeting used to say "Bonjour Aïcha", a person nobody had ever
     entered: she was a mock persona, like the old MOCK_DATA in the
     report. The only identity the product actually holds is the company
     name captured at onboarding, and the greeting is derived at render
     time rather than stored in the thread so a rename takes effect. */
  const { name: companyName, timezoneId } = useCompanyIdentity()

  /* The language the operator chose, not a hardcoded "fr". SentrIA
     answers in all six offered languages because the model writes the
     reply: there is nothing to translate on our side. The interface
     stays in the language it actually exists in, which is why `language`
     and `ui` are two different fields. */
  const { language } = useLocale()

  const tx = useTx()

  const greeting = companyName
    ? tx(
        `Bonjour ${companyName}. Je suis SentrIA. Posez-moi une question sur vos systèmes ou opérations. Je m'appuie sur vos signaux en temps réel.`,
        `Hello ${companyName}. I am SentrIA. Ask me anything about your systems or your operations. I work from your live signals.`
      )
    : tx(
        "Bonjour. Je suis SentrIA. Posez-moi une question sur vos systèmes ou opérations. Je m'appuie sur vos signaux en temps réel.",
        "Hello. I am SentrIA. Ask me anything about your systems or your operations. I work from your live signals."
      )

  const thread: Msg[] = [{ role: "ai", text: greeting }, ...messages]

  async function send(text: string) {
    const t = text.trim()

    if (!t || loading) return

    setMessages((m) => [...m, { role: "user", text: t }])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: t,
          lang: language,
          session_id: "user-123",
          /* Who is asking and on which clock. Without these the model
             had nothing to call the customer but "votre entreprise",
             and read every hour in the alerts against UTC. */
          company_name: companyName,
          timezone: timezoneFor(timezoneId).zone,
          timezone_label: timezoneFor(timezoneId).label,
        }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")

        console.error(
          `[SentrIA] POST ${API}/ask -> HTTP ${res.status} ${res.statusText}`,
          body
        )

        setMessages((m) => [
          ...m,
          {
            role: "ai",
            text: `L'API SentrIA a répondu ${res.status}. Détail dans la console du navigateur.`,
          },
        ])

        return
      }

      const data = await res.json()

      // The backend answers 200 even when it failed internally, and says
      // which failure it was in error_code. Surface it instead of
      // silently rendering the fallback text as if it were an answer.
      if (data.error_code) {
        console.error(
          `[SentrIA] /ask returned error_code=${data.error_code}`,
          data.error_detail ?? ""
        )
      }

      const answer =
        data.answer ?? data.message ?? data.response ?? data.text

      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: answer || tx("Réponse reçue.", "Answer received."),
        },
      ])
    } catch (err) {
      // A thrown fetch means the request never completed: CORS rejection,
      // the server being down, or DNS. It is NOT an AI error — those come
      // back as HTTP 200 with an error_code.
      console.error(
        `[SentrIA] fetch to ${API}/ask failed before any response. ` +
          `Usual causes: the origin is not in the backend CORS allowlist, ` +
          `or the API is not running. Check ${API}/health.`,
        err
      )

      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: tx(
            "Impossible de joindre l'API SentrIA : la requête n'a reçu aucune réponse. Causes probables : origine bloquée par CORS, ou API hors service. Ouvrez la console du navigateur pour le détail.",
            "Could not reach the SentrIA API: the request got no response at all. Usually either CORS blocked the origin, or the API is down. Open the browser console for the detail."
          ),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      {/* Messages */}
      <div
        className="flex-1 space-y-5 overflow-y-auto pb-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={loading}
        aria-label={tx(
          "Conversation avec SentrIA",
          "Conversation with SentrIA"
        )}
      >
        {messages.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Sparkles className="h-5 w-5" />
            </div>

            <h2 className="mt-4 font-heading text-xl font-bold">
              {tx("Demandez à SentrIA", "Ask SentrIA")}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {tx(
                "Une intelligence opérationnelle pour vos systèmes critiques.",
                "Operational intelligence for the systems you cannot afford to lose."
              )}
            </p>

            <div className="mt-5 grid gap-2.5">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon
                const question = tx(s.text.fr, s.text.en)

                return (
                  <button
                    key={question}
                    type="button"
                    onClick={() => send(question)}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3.5 text-left text-sm transition-colors hover:border-ring hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4" />
                    </span>

                    {question}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {thread.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3",
              m.role === "user" && "flex-row-reverse",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                m.role === "ai"
                  ? "bg-accent text-accent-foreground"
                  : "bg-foreground text-background",
              )}
            >
              {m.role === "ai" ? (
                <Sparkles className="h-4 w-4" />
              ) : companyName ? (
                initialsOf(companyName)
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>

            <div
              className={cn(
                "max-w-[80%] rounded-3xl px-4 py-3 text-sm leading-relaxed",
                m.role === "ai"
                  ? "rounded-tl-md border border-border bg-card"
                  : "rounded-tr-md bg-foreground text-background",
              )}
            >
              {m.role === "ai" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto [&_table]:min-w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.text}
                  </ReactMarkdown>
                </div>
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="rounded-3xl rounded-tl-md border border-border bg-card px-4 py-3">
              <span className="sr-only">
                {tx("SentrIA rédige une réponse", "SentrIA is writing a reply")}
              </span>

              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="rounded-3xl border border-border bg-card p-2.5 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={1}
            placeholder={tx(
              "Posez votre question à SentrIA…",
              "Ask SentrIA your question…"
            )}
            aria-label={tx("Votre question", "Your question")}
            disabled={loading}
            className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
            aria-label={tx("Envoyer", "Send")}
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
