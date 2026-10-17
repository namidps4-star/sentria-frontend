"use client"

import { useEffect, useState } from "react"
import { X } from "@/lib/icons"

import { useTx } from "@/lib/i18n"
import {
  LEGAL_COMPANY,
  LEGAL_DOCS,
  LEGAL_TITLES,
  LEGAL_VERSION,
  legalEmail,
  type LegalDocId,
} from "@/lib/legal"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

/* Privacy and terms (F-LEGAL). One dialog with two tabs, opened from the
 * sign-in screen, the sign-up box and Settings. The text is a draft and says
 * so at the top: it must not read as a statement of compliance. */

export function LegalDialog({
  open,
  doc,
  onClose,
}: {
  open: boolean
  doc: LegalDocId
  onClose: () => void
}) {
  const dialog = usePresence(open, "--modal-close-dur")

  if (!dialog.present) return null

  return <LegalBody start={doc} className={dialog.className} onClose={onClose} />
}

function LegalBody({
  start,
  className,
  onClose,
}: {
  start: LegalDocId
  className: string
  onClose: () => void
}) {
  const tx = useTx()
  const [doc, setDoc] = useState<LegalDocId>(start)
  const email = legalEmail()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className={cn("fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 t-modal-backdrop", className)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        data-testid="legal-dialog"
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl t-modal",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div>
            <h2 id="legal-title" className="font-heading text-xl font-semibold tracking-tight">
              {tx(LEGAL_TITLES[doc][0], LEGAL_TITLES[doc][1])}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {LEGAL_COMPANY} · {tx("Version du", "Version of")} {LEGAL_VERSION}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tx("Fermer", "Close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 sm:px-6">
          <div role="tablist" className="inline-flex gap-1 rounded-full bg-muted p-1">
            {(["privacy", "terms"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={doc === id}
                data-testid={`legal-tab-${id}`}
                onClick={() => setDoc(id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  doc === id ? "bg-[var(--ink)] text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tx(LEGAL_TITLES[id][0], LEGAL_TITLES[id][1])}
              </button>
            ))}
          </div>

          <p
            data-testid="legal-draft"
            className="mt-3 rounded-2xl bg-muted px-4 py-2.5 text-xs leading-relaxed text-muted-foreground"
          >
            {tx(
              "Brouillon non relu par un juriste. Ce texte ne dit pas que le service respecte une loi donnée. Les points à confirmer sont indiqués.",
              "Draft not reviewed by a lawyer. This text does not say the service follows any particular law. Points still to confirm are marked."
            )}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4 sm:px-6">
          <div className="flex flex-col gap-5">
            {LEGAL_DOCS[doc].map((section) => (
              <section key={section.title[1]}>
                <h3 className="text-sm font-bold">{tx(section.title[0], section.title[1])}</h3>
                <div className="mt-1.5 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                  {section.body.map((paragraph) => (
                    <p key={paragraph[1]}>{tx(paragraph[0], paragraph[1])}</p>
                  ))}
                </div>
              </section>
            ))}

            <section>
              <h3 className="text-sm font-bold">Contact</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {email ? (
                  <>
                    {tx("Pour toute question ou demande sur vos données, écrivez à", "For any question or request about your data, write to")}{" "}
                    <span className="select-all font-semibold text-foreground">{email}</span>.
                  </>
                ) : (
                  tx(
                    "Pour toute question ou demande sur vos données, utilisez Aide et retours dans l'application.",
                    "For any question or request about your data, use Help & feedback in the app."
                  )
                )}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
