"use client"

import { useState } from "react"
import { AlertTriangle, Check, MessageSquare, Send, X } from "@/lib/icons"

import { useTx } from "@/lib/i18n"
import { discardSmsDraft, useSmsDrafts, type SmsDraft } from "@/lib/sms-drafts"
import { StatusTag } from "./status-tag"

/* --------------------------------------------------------------------------
 * The texts drafted when a contractor was removed and their tasks handed
 * over (F-CDELETE). Per-contractor SMS is not live yet, so nothing here
 * sends: the Send button stays, switched off and labelled, and the text is
 * kept so it does not have to be retyped when texting goes live. Copy lets
 * someone send it by hand in the meantime.
 * -------------------------------------------------------------------------- */

export function SmsDraftRow({
  draft,
  onDiscard,
}: {
  draft: Pick<SmsDraft, "name" | "phone" | "smsReady" | "from" | "body">
  onDiscard?: () => void
}) {
  const tx = useTx()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard blocked: the text is on screen to select by hand.
    }
  }

  return (
    <li data-sms-draft="" className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-bold">{draft.name}</p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {draft.phone || tx("Pas de numéro", "No number")}
            {draft.from
              ? ` · ${tx("reprend les tâches de", "takes over from")} ${draft.from}`
              : ""}
          </p>
        </div>

        {draft.smsReady === false && (
          <StatusTag tone="warning" size="xs" icon={AlertTriangle}>
            {tx("Numéro à corriger", "Fix the number")}
          </StatusTag>
        )}
      </div>

      <p
        data-sms-body=""
        className="mt-3 whitespace-pre-wrap rounded-xl bg-muted px-3 py-2.5 text-xs leading-5 text-foreground"
      >
        {draft.body}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled
          data-sms-send=""
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {tx("Envoyer · SMS pas encore actif", "Send · SMS not yet active")}
        </button>

        <button
          type="button"
          onClick={copy}
          data-sms-copy=""
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? tx("Copié", "Copied") : tx("Copier le texte", "Copy the text")}
        </button>

        {onDiscard && (
          <button
            type="button"
            onClick={onDiscard}
            data-sms-discard=""
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            {tx("Supprimer", "Discard")}
          </button>
        )}
      </div>
    </li>
  )
}

/** The drafts still waiting, on the Contractors page. Nothing when there are none. */
export function SmsDraftsCard() {
  const tx = useTx()
  const drafts = useSmsDrafts()

  if (drafts.length === 0) return null

  return (
    <section
      aria-labelledby="sms-drafts-title"
      data-sms-drafts=""
      className="rounded-[28px] bg-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="sms-drafts-title"
          className="flex items-center gap-2 font-heading text-base font-bold"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          {tx(
            `Messages prêts (${drafts.length})`,
            `Messages ready (${drafts.length})`
          )}
        </h2>

        <StatusTag tone="neutral" size="xs" icon={false}>
          {tx("SMS pas encore actif", "SMS not yet active")}
        </StatusTag>
      </div>

      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        {tx(
          "Ces textes sont gardés sur cet appareil. Ils partiront d'ici quand l'envoi SMS sera actif. En attendant, copiez-les.",
          "These texts are kept on this device. They will go from here once SMS sending is live. Until then, copy them."
        )}
      </p>

      <ul className="mt-4 space-y-3">
        {[...drafts].reverse().map((draft) => (
          <SmsDraftRow
            key={draft.id}
            draft={draft}
            onDiscard={() => discardSmsDraft(draft.id)}
          />
        ))}
      </ul>
    </section>
  )
}
