"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, X } from "@/lib/icons"

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
 * so at the top: it must not read as a statement of compliance. A contents
 * list of numbers jumps to a section; each section is a numbered card. */

const pad = (n: number) => String(n).padStart(2, "0")

/** "Your account: name, company…" reads better with the label set in bold.
 *  Only a short label before a colon counts; a sentence is left alone. */
function withLead(text: string) {
  const match = text.match(/^([^.:]{2,40}?)(\s?:)\s([\s\S]+)$/)

  if (!match) return text

  return (
    <>
      <b className="font-bold text-foreground">{match[1]}{match[2]}</b> {match[3]}
    </>
  )
}

/** "We work with providers…: Supabase (sign-in), Vercel (hosting) and Render
 *  (API)." becomes the intro and one chip per provider. Anything that does not
 *  read exactly like that list stays a plain paragraph. */
function asProviders(text: string) {
  const match = text.match(/^([^:]{3,120}?)(\s?:)\s([\s\S]+?)\.$/)

  if (!match) return null

  const rest = match[3]
  const items = Array.from(rest.matchAll(/([A-Z][A-Za-z]+) \(([^()]+)\)/g))

  if (items.length < 4) return null

  const left = items.reduce((acc, item) => acc.replace(item[0], ""), rest).replace(/,|\band\b|\bet\b|\s/g, "")

  if (left !== "") return null

  return { intro: match[1] + match[2], items: items.map((item) => ({ name: item[1], note: item[2] })) }
}

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
  const [current, setCurrent] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const email = legalEmail()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // The contents list: the sections of the open page, then Contact.
  const entries = [
    ...LEGAL_DOCS[doc].map((section) => ({ fr: section.title[0], en: section.title[1] })),
    { fr: "Contact", en: "Contact" },
  ]

  function pickDoc(id: LegalDocId) {
    setDoc(id)
    setCurrent(0)
    scroller.current?.scrollTo({ top: 0 })
  }

  function jump(index: number) {
    const box = scroller.current
    const el = box?.querySelector<HTMLElement>(`[data-legal-section="${index}"]`)

    if (!box || !el) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    box.scrollTo({ top: el.offsetTop - box.offsetTop, behavior: reduce ? "auto" : "smooth" })
    setCurrent(index)
  }

  // The entry of the section at the top of the text follows the reader.
  function onScroll() {
    const box = scroller.current

    if (!box) return

    const nodes = Array.from(box.querySelectorAll<HTMLElement>("[data-legal-section]"))
    const line = box.scrollTop + box.offsetTop + 24
    let at = 0

    nodes.forEach((node, index) => {
      if (node.offsetTop <= line) at = index
    })

    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 2) at = nodes.length - 1

    setCurrent(at)
  }

  const card = "squircle grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-[26px] bg-muted px-6 pb-6 pt-5 max-sm:grid-cols-1 max-sm:gap-1 max-sm:px-5"

  const numberTile = (index: number) => (
    <span
      className="font-heading text-[44px] font-light leading-none tracking-tight text-muted-foreground tabular-nums max-sm:text-3xl"
      aria-hidden="true"
    >
      {pad(index + 1)}
    </span>
  )

  const renderParagraph = (text: string) => {
    const providers = asProviders(text)

    if (!providers) return <p className="max-w-[62ch]">{withLead(text)}</p>

    return (
      <div data-legal-providers="">
        <p className="max-w-[62ch]">{providers.intro}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {providers.items.map((item) => (
            <li key={item.name} className="rounded-full border border-border bg-card px-3 py-1 text-[12.5px] font-bold leading-snug text-foreground">
              {item.name} <span className="font-medium text-muted-foreground">· {item.note}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

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
          "squircle flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-border bg-card p-2.5 shadow-2xl t-modal",
          className
        )}
      >
        <div className="squircle rounded-[24px] bg-accent px-[18px] pb-3.5 pt-4 text-accent-foreground">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="legal-title" className="font-heading text-2xl font-bold leading-tight tracking-tight">
                {tx(LEGAL_TITLES[doc][0], LEGAL_TITLES[doc][1])}
              </h2>
              <p className="mt-0.5 text-xs font-bold opacity-75">
                {LEGAL_COMPANY} · {tx("Version du", "Version of")} {LEGAL_VERSION}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={tx("Fermer", "Close")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-foreground/10 transition-colors hover:bg-accent-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div role="tablist" className="mt-3 inline-flex gap-1 rounded-full bg-accent-foreground/10 p-[3px]">
            {(["privacy", "terms"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={doc === id}
                data-testid={`legal-tab-${id}`}
                onClick={() => pickDoc(id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  doc === id ? "bg-accent-foreground text-accent" : "hover:bg-accent-foreground/10"
                )}
              >
                {tx(LEGAL_TITLES[id][0], LEGAL_TITLES[id][1])}
              </button>
            ))}
          </div>
        </div>

        <p
          data-testid="legal-draft"
          className="mt-2 flex gap-2 rounded-[18px] bg-[var(--tag-warning-bg)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--tag-warning-fg)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {tx(
              "Brouillon non relu par un juriste. Ce texte ne dit pas que le service respecte une loi donnée. Les points à confirmer sont indiqués.",
              "Draft not reviewed by a lawyer. This text does not say the service follows any particular law. Points still to confirm are marked."
            )}
          </span>
        </p>

        <div className="mt-2 grid min-h-0 flex-1 gap-2.5 md:grid-cols-[11.5rem_minmax(0,1fr)]">
          <nav aria-label={tx("Sommaire", "Contents")} data-testid="legal-toc" className="flex flex-wrap content-start gap-1.5 md:flex-col md:flex-nowrap md:gap-0.5 md:p-1">
            {entries.map((entry, index) => {
              const label = tx(entry.fr, entry.en)

              return (
                <button
                  key={entry.en}
                  type="button"
                  onClick={() => jump(index)}
                  aria-current={current === index ? "true" : undefined}
                  aria-label={label}
                  title={label}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:h-10 max-md:w-10 max-md:justify-center max-md:rounded-full max-md:p-0",
                    current === index ? "bg-muted font-extrabold text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-xs font-semibold tabular-nums",
                      current === index ? "rounded-md bg-card px-1 py-px text-foreground" : "opacity-80"
                    )}
                    aria-hidden="true"
                  >
                    {pad(index + 1)}
                  </span>
                  <span className="max-md:hidden">{label}</span>
                </button>
              )
            })}
          </nav>

          <div ref={scroller} onScroll={onScroll} className="min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:pr-1">
            <div className="flex flex-col gap-2">
              {LEGAL_DOCS[doc].map((section, index) => (
                <section key={section.title[1]} data-legal-section={index} className={card}>
                  {numberTile(index)}
                  <div className="min-w-0">
                    <h3 className="mb-2.5 mt-1 text-[19px] font-bold leading-tight tracking-tight">{tx(section.title[0], section.title[1])}</h3>
                    <div className="flex flex-col gap-2.5 text-[15px] leading-[1.7] text-muted-foreground">
                      {section.body.map((paragraph) => (
                        <div key={paragraph[1]}>{renderParagraph(tx(paragraph[0], paragraph[1]))}</div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}

              <section data-legal-section={LEGAL_DOCS[doc].length} className={card}>
                {numberTile(LEGAL_DOCS[doc].length)}
                <div className="min-w-0">
                  <h3 className="mb-2.5 mt-1 text-[19px] font-bold leading-tight tracking-tight">Contact</h3>
                  <p className="max-w-[62ch] text-[15px] leading-[1.7] text-muted-foreground">
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
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
