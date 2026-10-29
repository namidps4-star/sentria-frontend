"use client"

import { useEffect, useState } from "react"

import { X } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { GUIDE_NAME } from "@/lib/guide-steps"
import { roboQuestions, type RoboQuestion, type RoboStart } from "@/lib/robo-chat"
import { cn } from "@/lib/utils"

import { RoboHead } from "./guide-buddy"

/* Robo's chat (ROBO-CHAT): Robo's head sits in the corner with a small card above it.
 * A question from the list gets a short answer, then Robo offers to show the
 * tour step that explains it. "Show me" hands over to the tour, which pops the
 * same way. Scripted, so no AI and no cost per question. */

export function RoboChat({
  open,
  onClose,
  onShowTour,
}: {
  open: boolean
  onClose: () => void
  onShowTour: (start: RoboStart) => void
}) {
  const tx = useTx()
  const [chosen, setChosen] = useState<RoboQuestion | null>(null)
  const questions = roboQuestions(tx)

  useEffect(() => {
    if (!open) return

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      setChosen(null)
      onClose()
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  function close() {
    setChosen(null)
    onClose()
  }

  function showTour(start: RoboStart) {
    setChosen(null)
    onShowTour(start)
  }

  return (
    <div
      className="fixed bottom-24 right-4 z-[70] flex w-[min(320px,calc(100vw-2rem))] flex-col items-end gap-2 sm:right-6"
      data-testid="robo-chat"
      data-stage={chosen ? "answer" : "ask"}
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

        {chosen ? (
          <div className="mt-3 flex flex-col gap-2.5">
            <p className="self-end rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-[13px] text-background">{chosen.ask}</p>
            <p className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-[13px] leading-snug">{chosen.answer}</p>
            <p className="pt-1 text-[13px] font-semibold">{tx("Voulez-vous que je vous montre maintenant ?", "Do you want me to show you now?")}</p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setChosen(null)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tx("Pas maintenant", "Not now")}
              </button>
              <button
                type="button"
                onClick={() => showTour(chosen.start)}
                data-testid="robo-show"
                className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tx("Montrez-moi", "Show me")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-[13px] leading-snug text-card-foreground/85">
              {tx("Posez-moi une question sur SentrIA.", "Ask me a question about SentrIA.")}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {questions.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setChosen(question)}
                  data-testid="robo-question"
                  data-question={question.id}
                  className={cn(
                    "rounded-full border border-border px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  {question.ask}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <RoboHead className="h-16 w-16 animate-[robo-pop_0.45s_cubic-bezier(0.2,1.4,0.4,1)]" />
    </div>
  )
}
