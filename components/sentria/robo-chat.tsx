"use client"

import { useEffect, useState } from "react"

import { X } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { GUIDE_NAME } from "@/lib/guide-steps"
import { roboAnswer, roboFallback, type RoboStart, type RoboTopic } from "@/lib/robo-chat"
import { cn } from "@/lib/utils"

import { RoboHead } from "./guide-buddy"

/* Robo's chat (ROBO-CHAT): Robo's head sits in the corner with a small card above it.
 * The person types a question. A word Robo knows gets a short answer, and Robo then
 * offers to show the tour step that explains it. "Show me" hands over to the tour,
 * which pops the same way. Scripted, so no AI and no cost per question.
 *
 * On a phone the top bar has no room for a button, so the head itself is the way
 * in: a round launcher in the corner, above the bottom tab bar. */

export function RoboChat({
  open,
  onOpen,
  onClose,
  onShowTour,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  onShowTour: (start: RoboStart) => void
}) {
  const tx = useTx()
  const [draft, setDraft] = useState("")
  // The question asked, and what Robo answered: a topic, or null for the fallback.
  const [asked, setAsked] = useState<{ text: string; topic: RoboTopic | null } | null>(null)

  useEffect(() => {
    if (!open) return

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      setAsked(null)
      setDraft("")
      onClose()
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-robo-launcher=""
        aria-label={tx("Demander à Robo", "Ask Robo")}
        className="fixed bottom-24 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:hidden"
      >
        <RoboHead className="h-9 w-9" />
      </button>
    )
  }

  function close() {
    setAsked(null)
    setDraft("")
    onClose()
  }

  function ask(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setAsked({ text, topic: roboAnswer(text, tx) })
    setDraft("")
  }

  function showTour(start: RoboStart) {
    setAsked(null)
    onShowTour(start)
  }

  const topic = asked?.topic ?? null

  return (
    <div
      className="fixed bottom-24 right-4 z-[70] flex w-[min(320px,calc(100vw-2rem))] flex-col items-end gap-2 sm:right-6"
      data-testid="robo-chat"
      data-stage={asked ? "answer" : "ask"}
    >
      <div className="squircle w-full rounded-[22px] border border-border bg-card p-4 text-card-foreground shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{GUIDE_NAME}</span>
          <button
            type="button"
            onClick={close}
            aria-label={tx("Fermer", "Close")}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {asked ? (
          <div className="mt-3 flex flex-col gap-2.5">
            <p className="self-end rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-[13px] text-background">{asked.text}</p>

            {topic ? (
              <>
                <p className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-[13px] leading-snug" data-testid="robo-answer" data-topic={topic.id}>
                  {topic.answer}
                </p>

                {topic.start && (
                  <>
                    <p className="pt-1 text-[13px] font-semibold">{tx("Voulez-vous que je vous montre maintenant ?", "Do you want me to show you now?")}</p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAsked(null)}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {tx("Pas maintenant", "Not now")}
                      </button>
                      <button
                        type="button"
                        onClick={() => showTour(topic.start!)}
                        data-testid="robo-show"
                        className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {tx("Montrez-moi", "Show me")}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-[13px] leading-snug" data-testid="robo-answer" data-topic="none">
                  {roboFallback(tx)}
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setAsked(null)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {tx("Poser une autre question", "Ask another question")}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={ask} className="mt-3 flex flex-col gap-2.5">
            <p className="text-[13px] leading-snug text-card-foreground/85">
              {tx("Posez-moi une question sur SentrIA.", "Ask me a question about SentrIA.")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                data-testid="robo-input"
                aria-label={tx("Votre question", "Your question")}
                placeholder={tx("Par exemple : risque", "For example: risk")}
                autoFocus
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                data-testid="robo-send"
                disabled={!draft.trim()}
                className={cn(
                  "rounded-full bg-brand px-3.5 py-2 text-xs font-semibold text-[#141414] transition-opacity hover:opacity-90 disabled:opacity-40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {tx("Envoyer", "Send")}
              </button>
            </div>
          </form>
        )}
      </div>

      <RoboHead className="h-16 w-16 animate-[robo-pop_0.45s_cubic-bezier(0.2,1.4,0.4,1)]" />
    </div>
  )
}
