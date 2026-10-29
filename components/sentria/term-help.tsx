"use client"

import { useEffect, useRef, useState } from "react"

import { resolve, useTx } from "@/lib/i18n"
import { TERM_HELP, type TermKey } from "@/lib/term-help"
import { cn } from "@/lib/utils"

/** A small "i" that opens a plain explanation, with examples, of one of the
 *  alert numbers. Closes on a second press, Escape, or a click outside. */
export function TermHelp({ term, className }: { term: TermKey; className?: string }) {
  const tx = useTx()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  const help = TERM_HELP[term]
  const label = resolve(help.label, tx)

  useEffect(() => {
    if (!open) return

    function onDown(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <span ref={box} className={cn("relative inline-flex align-middle normal-case tracking-normal", className)}>
      <button
        type="button"
        data-testid={`term-help-${term}`}
        aria-label={tx(`Aide : ${label}`, `Help: ${label}`)}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        i
      </button>
      {open && (
        <span
          role="note"
          data-testid={`term-help-${term}-text`}
          className="absolute left-0 top-6 z-50 flex w-72 max-w-[80vw] flex-col gap-1.5 rounded-2xl bg-[var(--ink)] p-4 text-left text-xs font-normal leading-relaxed text-white shadow-xl"
        >
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand">{label}</span>
          <span>{resolve(help.short, tx)}</span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-wide text-brand">{tx("Exemples", "Examples")}</span>
          <ul className="flex flex-col gap-1.5">
            {help.examples.map((example, index) => (
              <li key={index} className="opacity-90">
                {resolve(example, tx)}
              </li>
            ))}
          </ul>
          {help.rule && <span className="mt-1 border-t border-white/20 pt-2">{resolve(help.rule, tx)}</span>}
        </span>
      )}
    </span>
  )
}
