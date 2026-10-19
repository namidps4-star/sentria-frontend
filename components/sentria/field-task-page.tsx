"use client"

import { useEffect, useState } from "react"

import { answerField, fetchField, type FieldAnswer, type FieldFailure, type FieldView } from "@/lib/field-link"
import { AlertTriangle, Check, Clock, Loader2 } from "@/lib/icons"
import { cn } from "@/lib/utils"

/* What a field person sees from the text (F-CONTRACTOR): one task, in big
 * type, with three answers. No login and no menu: the signed token in the
 * address is the only credential. The language is the one the boss's app was
 * in when the link was made, else the phone's. */

type Phase =
  | { kind: "loading" }
  | { kind: "failed"; failure: FieldFailure }
  | { kind: "ready"; view: FieldView; busy: FieldAnswer | null; confirm: boolean; note: "ack" | null; error: FieldFailure | null }
  | { kind: "finished"; view: FieldView; how: "done" | "cannot" | "closed" }

export function FieldTaskPage({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [phoneLang, setPhoneLang] = useState<"fr" | "en">("fr")

  useEffect(() => {
    setPhoneLang(navigator.language?.toLowerCase().startsWith("en") ? "en" : "fr")

    let alive = true

    fetchField(token).then((result) => {
      if (!alive) return

      if (!result.ok) return setPhase({ kind: "failed", failure: result.failure })

      const closed = result.view.status === "done" || result.view.status === "dismissed"

      setPhase(
        closed
          ? { kind: "finished", view: result.view, how: "closed" }
          : { kind: "ready", view: result.view, busy: null, confirm: false, note: null, error: null }
      )
    })

    return () => {
      alive = false
    }
  }, [token])

  const lang = phase.kind === "ready" || phase.kind === "finished" ? phase.view.lang : phoneLang
  const tx = (fr: string, en: string) => (lang === "en" ? en : fr)

  async function answer(action: FieldAnswer) {
    if (phase.kind !== "ready") return

    const { view } = phase

    setPhase({ ...phase, busy: action, error: null })

    const result = await answerField(token, action)

    if (!result.ok) {
      if (result.failure === "invalid" || result.failure === "expired") return setPhase({ kind: "failed", failure: result.failure })

      return setPhase({ kind: "ready", view, busy: null, confirm: false, note: null, error: result.failure })
    }

    if (action === "done") return setPhase({ kind: "finished", view, how: "done" })
    if (action === "cannot") return setPhase({ kind: "finished", view, how: "cannot" })

    setPhase({ kind: "ready", view: { ...view, status: "in_progress" }, busy: null, confirm: false, note: "ack", error: null })
  }

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background text-foreground" data-testid="field-page">
      <p className="px-5 pt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">SentrIA</p>
      {children}
    </main>
  )

  if (phase.kind === "loading") {
    return shell(
      <div className="flex flex-1 items-center justify-center" role="status" aria-label={tx("Chargement", "Loading")}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (phase.kind === "failed") {
    const text: Record<FieldFailure, [string, string, string, string]> = {
      invalid: ["Ce lien n'est plus valable", "This link is not valid any more", "Il a peut-être été remplacé ou vous n'êtes plus sur cette tâche. Demandez un nouveau lien.", "It may have been replaced, or you are no longer on this task. Ask for a new link."],
      expired: ["Ce lien a expiré", "This link has expired", "Demandez un nouveau lien à la personne qui vous l'a envoyé.", "Ask the person who sent it for a new link."],
      limited: ["Trop d'essais", "Too many tries", "Attendez quelques minutes puis rouvrez le lien.", "Wait a few minutes, then open the link again."],
      unavailable: ["Pas encore disponible", "Not available yet", "Ce service n'est pas encore activé. Réessayez plus tard.", "This service is not switched on yet. Try again later."],
      network: ["Pas de connexion", "No connection", "Vérifiez votre réseau puis rouvrez le lien.", "Check your network, then open the link again."],
    }
    const [frTitle, enTitle, frBody, enBody] = text[phase.failure]

    return shell(
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center" data-testid="field-failed" data-failure={phase.failure}>
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="font-heading text-2xl font-bold">{tx(frTitle, enTitle)}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{tx(frBody, enBody)}</p>
      </div>
    )
  }

  if (phase.kind === "finished") {
    const { view, how } = phase
    const words = {
      done: [`Terminé, merci ${view.name}`, `Done, thank you ${view.name}`, "Le responsable voit que c'est fini.", "Your manager can see it is finished."],
      cannot: [`Merci ${view.name}`, `Thank you ${view.name}`, "Vous n'êtes plus sur cette tâche. Le responsable est prévenu et la confie à quelqu'un d'autre.", "You are off this task. Your manager can see it and will give it to someone else."],
      closed: ["Cette tâche est déjà terminée", "This task is already finished", "Il n'y a plus rien à faire ici. Merci.", "There is nothing left to do here. Thank you."],
    }[how]

    return shell(
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center" data-testid="field-finished" data-how={how}>
        <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Check className="h-9 w-9" aria-hidden="true" />
        </span>
        <h1 className="font-heading text-2xl font-bold">{tx(words[0], words[1])}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{tx(words[2], words[3])}</p>
      </div>
    )
  }

  const { view, busy, confirm, note, error } = phase
  const priority: Record<string, [string, string, string]> = {
    critical: ["Critique", "Critical", "bg-[var(--tag-danger-bg)] text-[var(--tag-danger-fg)]"],
    high: ["Priorité haute", "High priority", "bg-[var(--tag-danger-bg)] text-[var(--tag-danger-fg)]"],
    medium: ["Priorité moyenne", "Medium priority", "bg-muted text-foreground"],
    low: ["Priorité basse", "Low priority", "bg-muted text-foreground"],
  }
  const tag = view.priority ? priority[view.priority] : undefined
  const due = view.deadline ? new Date(`${view.deadline}T12:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" }) : null
  const started = view.status === "in_progress"

  return shell(
    <div className="flex flex-1 flex-col gap-4 p-5">
      <section className="rounded-[28px] bg-[var(--ink)] p-5 text-white" data-testid="field-task">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c6f432]">{tx("Votre tâche", "Your task")}</p>
        <h1 className="mt-2 font-heading text-2xl font-bold leading-tight" data-testid="field-title">{view.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {tag && <span className={cn("rounded-full px-3 py-1 text-xs font-bold", tag[2])}>{tx(tag[0], tag[1])}</span>}
          {due && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {tx(`Pour le ${due}`, `Due ${due}`)}
            </span>
          )}
          {started && <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold" data-testid="field-started">{tx("En cours", "In progress")}</span>}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card px-5 py-1">
        {view.problem && (
          <div className="border-b border-border py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tx("Ce qui ne va pas", "What is wrong")}</p>
            <p className="mt-1 text-base leading-6" data-testid="field-problem">{view.problem}</p>
          </div>
        )}
        {view.action && (
          <div className="py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tx("Ce qu'il faut faire", "What to do")}</p>
            <p className="mt-1 text-base font-semibold leading-6" data-testid="field-action">{view.action}</p>
          </div>
        )}
        {!view.problem && !view.action && <p className="py-4 text-sm text-muted-foreground">{tx("Votre responsable vous a confié cette tâche.", "Your manager gave you this task.")}</p>}
      </section>

      {note === "ack" && (
        <p role="status" data-testid="field-ack-note" className="rounded-2xl bg-muted px-4 py-3 text-sm font-semibold">
          {tx(`Merci ${view.name}, c'est noté : en cours.`, `Thank you ${view.name}, noted: in progress.`)}
        </p>
      )}
      {error && (
        <p role="alert" data-testid="field-error" className="rounded-2xl bg-[var(--tag-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--tag-danger-fg)]">
          {tx("Ça n'a pas marché. Réessayez.", "That did not work. Try again.")}
        </p>
      )}

      <div className="mt-auto grid gap-2.5 pb-3">
        {confirm ? (
          <div className="grid gap-2.5 rounded-3xl border border-border p-4" data-testid="field-confirm">
            <p className="text-sm font-semibold">{tx("Vous ne pouvez pas faire cette tâche ? Vous serez retiré de la tâche.", "You cannot do this task? You will be taken off it.")}</p>
            <button type="button" data-testid="field-cannot-yes" disabled={busy !== null} onClick={() => answer("cannot")} className="min-h-12 rounded-full bg-[var(--ink)] px-5 text-sm font-extrabold text-white disabled:opacity-60">
              {busy === "cannot" ? "…" : tx("Oui, je ne peux pas", "Yes, I cannot")}
            </button>
            <button type="button" data-testid="field-cannot-no" disabled={busy !== null} onClick={() => setPhase({ ...phase, confirm: false })} className="min-h-12 rounded-full border-2 border-border px-5 text-sm font-extrabold">
              {tx("Non, retour", "No, go back")}
            </button>
          </div>
        ) : (
          <>
            {!started && (
              <button type="button" data-testid="field-ack" disabled={busy !== null} onClick={() => answer("ack")} className="min-h-14 rounded-full bg-brand px-5 text-base font-extrabold text-brand-foreground transition-opacity disabled:opacity-60">
                {busy === "ack" ? "…" : tx("Reçu, j'y vais", "Got it, on my way")}
              </button>
            )}
            <button type="button" data-testid="field-done" disabled={busy !== null} onClick={() => answer("done")} className={cn("min-h-14 rounded-full px-5 text-base font-extrabold transition-opacity disabled:opacity-60", started ? "bg-brand text-brand-foreground" : "bg-[var(--ink)] text-white")}>
              {busy === "done" ? "…" : tx("C'est terminé", "Mark as done")}
            </button>
            <button type="button" data-testid="field-cannot" disabled={busy !== null} onClick={() => setPhase({ ...phase, confirm: true })} className="min-h-14 rounded-full border-2 border-border px-5 text-base font-extrabold disabled:opacity-60">
              {tx("Je ne peux pas", "I can't do this")}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
