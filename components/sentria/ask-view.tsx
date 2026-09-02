"use client"

import { useState } from "react"
import { Sparkles, ArrowUp, Globe2, Lightbulb, MapPin } from "lucide-react"
<<<<<<< HEAD
=======
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
>>>>>>> feature/layout
import { cn } from "@/lib/utils"

const API = "https://sentria-production.up.railway.app"

const SUGGESTIONS = [
  { icon: MapPin, text: "Quels systèmes présentent un risque opérationnel croissant ?" },
  { icon: Lightbulb, text: "Compare les signaux entre la Ligne Alpha et le Groupe Froid B." },
  { icon: Globe2, text: "Résume les alertes critiques des 7 derniers jours." },
]

type Msg = { role: "user" | "ai"; text: string }

export function AskView() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: "Bonjour Aïcha. Je suis SentrIA. Posez-moi une question sur vos systèmes ou opérations — je m'appuie sur vos signaux en temps réel.",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  async function send(text: string) {
    const t = text.trim()
    if (!t || loading) return
    setMessages((m) => [...m, { role: "user", text: t }])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
<<<<<<< HEAD
        body: JSON.stringify({ text: t, lang: "fr" }),
=======
        body: JSON.stringify({ 
        text: t, 
        lang: "fr",
        session_id: "user-123"  // later use real user ID
      }),
>>>>>>> feature/layout
      })
      if (!res.ok) throw new Error("API request failed")
      const data = await res.json()
      const answer = data.answer ?? data.message ?? data.response ?? data.text
      setMessages((m) => [...m, { role: "ai", text: answer || "Réponse reçue." }])
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: "Impossible de joindre l'API SentrIA pour le moment. Vérifiez la route côté backend, puis réessayez.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-5 overflow-y-auto pb-4">
        {messages.length === 1 && (
          <div className="rounded-3xl border border-border bg-card p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-bold">Demandez à SentrIA</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Une intelligence opérationnelle pour vos systèmes critiques.
            </p>
            <div className="mt-5 grid gap-2.5">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon
                return (
                  <button
                    key={s.text}
                    onClick={() => send(s.text)}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3.5 text-left text-sm transition-colors hover:border-ring hover:bg-muted/50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4" />
                    </span>
                    {s.text}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                m.role === "ai" ? "bg-accent text-accent-foreground" : "bg-foreground text-background",
              )}
            >
              {m.role === "ai" ? <Sparkles className="h-4 w-4" /> : "AM"}
            </div>
            <div
              className={cn(
                "max-w-[80%] rounded-3xl px-4 py-3 text-sm leading-relaxed",
                m.role === "ai"
                  ? "rounded-tl-md border border-border bg-card"
                  : "rounded-tr-md bg-foreground text-background",
              )}
            >
<<<<<<< HEAD
              {m.text}
=======
              {m.role === "ai" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto [&_table]:min-w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                </div>
              ) : (
                m.text
              )}
>>>>>>> feature/layout
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="rounded-3xl border border-border bg-card p-2.5 shadow-sm"
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
            placeholder="Posez votre question à SentrIA…"
            className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-opacity disabled:opacity-40"
            aria-label="Envoyer"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
