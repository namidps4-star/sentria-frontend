"use client"

import { useEffect, useState } from "react"

import { answerField, fetchField, sendFieldNote, sendFieldPhoto, shrinkPhoto, type FieldAnswer, type FieldFailure, type FieldView, type ReportFailure } from "@/lib/field-link"
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


/* A note or a photo on the task. Shown while the task is open and after "done"
 * (a photo of the finished job is the usual one). The API caps what one person
 * can send; this only reflects it. */
function FieldReport({ token, view, tx, sent: already, onSent }: { token: string; view: FieldView; tx: (fr: string, en: string) => string; sent: { notes: number; photos: number }; onSent: (kind: "notes" | "photos") => void }) {
  const start = view.reports
  // What the page has sent in this visit lives in the page, so it survives the switch to the "done" screen.
  const notes = (start?.notes ?? 0) + already.notes
  const photos = (start?.photos ?? 0) + already.photos
  const [text, setText] = useState("")
  const [busy, setBusy] = useState<"note" | "photo" | null>(null)
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null)

  if (!start || !start.available) {
    return (
      <p data-testid="field-report-unavailable" className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        {tx("Les notes et les photos ne sont pas encore disponibles.", "Notes and photos are not available yet.")}
      </p>
    )
  }

  const failure = (reason: ReportFailure) =>
    ({
      limit: tx("Vous avez envoyé le maximum pour cette tâche.", "You have sent the most you can on this task."),
      invalid: tx("Ça n'a pas marché. Réessayez.", "That did not work. Try again."),
      too_big: tx("Cette photo est trop lourde. Reprenez-la.", "That photo is too big. Take it again."),
      unavailable: tx("Les notes et les photos ne sont pas encore disponibles.", "Notes and photos are not available yet."),
      link: tx("Ce lien n'est plus valable.", "This link is not valid any more."),
      network: tx("Pas de connexion. Réessayez.", "No connection. Try again."),
    })[reason]

  const noteFull = notes >= start.max_notes
  const photoFull = photos >= start.max_photos

  return (
    <section className="grid gap-3 rounded-3xl border border-border bg-card p-4" data-testid="field-report">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tx("Ajouter une note ou une photo", "Add a note or a photo")}</p>

      <textarea
        data-testid="field-note"
        value={text}
        maxLength={300}
        rows={2}
        disabled={noteFull || busy !== null}
        onChange={(event) => setText(event.target.value)}
        placeholder={tx("Une note pour votre responsable", "A note for your manager")}
        aria-label={tx("Note", "Note")}
        className="w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          data-testid="field-note-send"
          disabled={!text.trim() || noteFull || busy !== null}
          onClick={async () => {
            setBusy("note")
            setMessage(null)

            const sent = await sendFieldNote(token, text.trim())

            if (sent.ok) {
              onSent("notes")
              setText("")
              setMessage({ tone: "ok", text: tx("Note envoyée.", "Note sent.") })
            } else {
              setMessage({ tone: "bad", text: failure(sent.failure) })
            }

            setBusy(null)
          }}
          className="min-h-12 rounded-full border-2 border-border px-4 text-sm font-extrabold disabled:opacity-50"
        >
          {busy === "note" ? "…" : tx("Envoyer la note", "Send note")}
        </button>

        <label
          className={cn(
            "flex min-h-12 cursor-pointer items-center justify-center rounded-full border-2 border-border px-4 text-sm font-extrabold focus-within:ring-2 focus-within:ring-ring",
            (photoFull || busy !== null) && "pointer-events-none opacity-50"
          )}
        >
          {busy === "photo" ? "…" : tx("Ajouter une photo", "Add a photo")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            data-testid="field-photo-input"
            className="sr-only"
            disabled={photoFull || busy !== null}
            onChange={async (event) => {
              const file = event.target.files?.[0]

              event.target.value = ""

              if (!file) return

              setBusy("photo")
              setMessage(null)

              const small = await shrinkPhoto(file)
              const sent = small ? await sendFieldPhoto(token, small) : ({ ok: false, failure: "invalid" } as const)

              if (sent.ok) {
                onSent("photos")
                setMessage({ tone: "ok", text: tx("Photo envoyée.", "Photo sent.") })
              } else {
                setMessage({ tone: "bad", text: failure(sent.failure) })
              }

              setBusy(null)
            }}
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="field-report-count">
        {tx(`${notes} note sur ${start.max_notes} · ${photos} photo sur ${start.max_photos}`, `${notes} of ${start.max_notes} notes · ${photos} of ${start.max_photos} photos`)}
      </p>
      {message && (
        <p role={message.tone === "bad" ? "alert" : "status"} data-testid="field-report-message" className={cn("text-sm font-semibold", message.tone === "bad" && "text-[var(--tag-danger-fg)]")}>
          {message.text}
        </p>
      )}
    </section>
  )
}

export function FieldTaskPage({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [phoneLang, setPhoneLang] = useState<"fr" | "en">("fr")
  const [sent, setSent] = useState({ notes: 0, photos: 0 })
  const onSent = (kind: "notes" | "photos") => setSent((current) => ({ ...current, [kind]: current[kind] + 1 }))

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
        {how === "done" && (
          <div className="mt-8 w-full text-left">
            <FieldReport token={token} view={view} tx={tx} sent={sent} onSent={onSent} />
          </div>
        )}
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

      {!confirm && <FieldReport token={token} view={view} tx={tx} sent={sent} onSent={onSent} />}

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
