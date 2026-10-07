"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Send, X } from "@/lib/icons"

import { useTx, type Tx } from "@/lib/i18n"
import { useLocale } from "@/lib/locale"
import {
  SUPPORT_KINDS,
  SUPPORT_MAX_CHARS,
  SUPPORT_MIN_CHARS,
  sendSupportMessage,
  type SupportFailure,
  type SupportKind,
} from "@/lib/support"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

/* --------------------------------------------------------------------------
 * "Help and feedback" (F-SUPPORT).
 *
 * A bug, an idea or a question, from any page, without leaving it. It is
 * emailed to the team with the company and the plan (the API reads those from
 * the sign-in) and the page the person was on. Nothing is stored here. When a
 * send fails the text stays, so a retry costs nothing; the backdrop does not
 * close the card once there is text in it, so a stray click cannot lose it.
 * -------------------------------------------------------------------------- */

export function SupportDialog({
  open,
  page,
  pageLabel,
  onClose,
}: {
  open: boolean
  /** The view the person is on, as the app names it ("dashboard"). */
  page: string
  /** The same view in the person's language, said back to them. */
  pageLabel: string
  onClose: () => void
}) {
  const dialog = usePresence(open, "--modal-close-dur")

  if (!dialog.present) return null

  return <SupportBody page={page} pageLabel={pageLabel} className={dialog.className} onClose={onClose} />
}

const KIND_LABEL: Record<SupportKind, [string, string]> = {
  bug: ["Problème", "Bug"],
  idea: ["Idée", "Idea"],
  question: ["Question", "Question"],
}

const KIND_HINT: Record<SupportKind, [string, string]> = {
  bug: ["Que s'est-il passé, et qu'attendiez-vous ?", "What happened, and what did you expect?"],
  idea: ["Qu'aimeriez-vous pouvoir faire ?", "What would you like to be able to do?"],
  question: ["Que voulez-vous savoir ?", "What would you like to know?"],
}

/** "12 min", or "3 h" when it is long. */
function waitText(seconds: number, tx: Tx): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  const hours = Math.ceil(minutes / 60)

  return minutes < 120 ? `${minutes} min` : tx(`${hours} h`, `${hours} hours`)
}

function failureText(reason: SupportFailure, waitSeconds: number | undefined, tx: Tx): string {
  switch (reason) {
    case "rate_limited":
      // No number when the API did not give one: a guess would be wrong.
      return waitSeconds
        ? tx(
            `Vous avez envoyé plusieurs messages à la suite. Réessayez dans ${waitText(waitSeconds, tx)}.`,
            `You sent several messages in a row. Try again in ${waitText(waitSeconds, tx)}.`
          )
        : tx(
            "Vous avez envoyé plusieurs messages à la suite. Réessayez plus tard.",
            "You sent several messages in a row. Try again later."
          )
    case "busy":
      return tx(
        "Nous recevons beaucoup de messages en ce moment. Réessayez dans quelques minutes.",
        "We are getting a lot of messages right now. Try again in a few minutes."
      )
    case "not_configured":
      return tx(
        "Les messages ne sont pas encore activés. Réessayez plus tard.",
        "Messages are not switched on yet. Try again later."
      )
    case "send_failed":
      return tx(
        "Le message n'a pas pu partir. Votre texte est gardé : réessayez.",
        "The message could not be sent. Your text is kept: try again."
      )
    case "signed_out":
      return tx(
        "Votre session a expiré. Reconnectez-vous, puis réessayez.",
        "Your session expired. Sign in again, then try again."
      )
    case "invalid":
      return tx(
        "Le message n'a pas été accepté. Vérifiez sa longueur et réessayez.",
        "The message was not accepted. Check its length and try again."
      )
    case "unreachable":
      return tx(
        "L'API SentrIA n'a pas répondu. Votre texte est gardé : réessayez.",
        "The SentrIA API did not answer. Your text is kept: try again."
      )
    default:
      return tx(
        "Un problème est survenu. Votre texte est gardé : réessayez.",
        "Something went wrong. Your text is kept: try again."
      )
  }
}

function SupportBody({
  page,
  pageLabel,
  className,
  onClose,
}: {
  page: string
  pageLabel: string
  className: string
  onClose: () => void
}) {
  const tx = useTx()
  const { ui } = useLocale()
  const [kind, setKind] = useState<SupportKind>("bug")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState("")
  const [sent, setSent] = useState(false)
  const sendingRef = useRef(false)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !sendingRef.current) onClose()
    }

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const trimmed = message.trim()
  const ready = trimmed.length >= SUPPORT_MIN_CHARS && !sending
  // A stray click on the backdrop must not lose a message that was not sent.
  const keepOpen = sending || (message.length > 0 && !sent)

  async function send() {
    if (!ready || sendingRef.current) return

    sendingRef.current = true
    setSending(true)
    setProblem("")

    const result = await sendSupportMessage({
      kind,
      message: trimmed,
      page,
      language: ui === "en" ? "en" : "fr",
    })

    sendingRef.current = false
    setSending(false)

    if (result.ok) {
      setSent(true)

      return
    }

    setProblem(failureText(result.reason, result.waitSeconds, tx))
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 t-modal-backdrop",
        className
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget && !keepOpen) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-title"
        data-support=""
        className={cn(
          "max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl t-modal sm:p-6",
          className
        )}
      >
        {sent ? (
          <div data-support-done="" role="status" className="flex flex-col items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>

            <div>
              <h3 id="support-title" className="font-heading text-lg font-bold text-foreground">
                {tx("Message envoyé", "Message sent")}
              </h3>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {tx(
                  "Merci. Si une réponse est utile, elle arrivera par email.",
                  "Thank you. If a reply helps, it will come by email."
                )}
              </p>
            </div>

            <div className="mt-2 flex w-full justify-end">
              <button
                type="button"
                autoFocus
                onClick={onClose}
                data-support-close=""
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tx("Fermer", "Close")}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void send()
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="support-title" className="font-heading text-lg font-bold text-foreground">
                  {tx("Comment pouvons-nous aider ?", "How can we help?")}
                </h3>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {tx(
                    "Un bug, une idée ou une question. Le message part directement à l'équipe.",
                    "A bug, an idea or a question. It goes straight to the team."
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                aria-label={tx("Fermer", "Close")}
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div
              role="radiogroup"
              aria-label={tx("Type de message", "Type of message")}
              className="mt-4 flex flex-wrap gap-2"
            >
              {SUPPORT_KINDS.map((value) => {
                const chosen = kind === value

                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    data-support-kind={value}
                    onClick={() => setKind(value)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      chosen
                        ? "border-transparent bg-foreground text-background"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {tx(...KIND_LABEL[value])}
                  </button>
                )
              })}
            </div>

            <label htmlFor="support-message" className="mt-4 block text-xs font-semibold text-muted-foreground">
              {tx("Votre message", "Your message")}
            </label>

            <textarea
              id="support-message"
              autoFocus
              rows={5}
              value={message}
              maxLength={SUPPORT_MAX_CHARS}
              readOnly={sending}
              placeholder={tx(...KIND_HINT[kind])}
              onChange={(event) => {
                setMessage(event.target.value)
                if (problem) setProblem("")
              }}
              className="mt-1.5 block w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px] leading-4 text-muted-foreground">
              <span>
                {tx(
                  `Nous joignons votre entreprise, votre offre et cette page (${pageLabel}) pour aller plus vite.`,
                  `We attach your company, your plan and this page (${pageLabel}) so we can help faster.`
                )}
              </span>

              <span data-support-count="" className="shrink-0 tabular-nums">
                {message.length}/{SUPPORT_MAX_CHARS}
              </span>
            </div>

            {problem && (
              <p
                role="alert"
                data-support-problem=""
                className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-xs leading-5 text-destructive"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {problem}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                data-support-cancel=""
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              >
                {tx("Annuler", "Cancel")}
              </button>

              <button
                type="submit"
                disabled={!ready}
                data-support-send=""
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {sending ? tx("Envoi…", "Sending…") : tx("Envoyer", "Send")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
