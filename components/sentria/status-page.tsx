"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { useTx } from "@/lib/i18n"
import { TriangleAlert } from "@/lib/icons"

/** The page shell the 404 and the error page share: the SentrIA mark on top,
 *  one big card below. Theme tokens only, so it follows light and dark. */
function Shell({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-outer px-4 pb-6 pt-4 sm:px-8 sm:pb-8">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
          <img src="/logo-mark.png" alt="" className="h-8 w-8 object-contain" />
          SentrIA
        </Link>
        {action}
      </header>
      {children}
    </main>
  )
}

const PILL =
  "inline-flex items-center rounded-full px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"

/** 404: a page that does not exist. Says nothing is lost and offers ways back. */
export function NotFoundPage() {
  const tx = useTx()

  return (
    <Shell>
      <section className="relative flex flex-1 flex-col justify-center overflow-hidden rounded-[44px] bg-brand p-8 text-[#141414] sm:p-12">
        <p
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-6 right-4 select-none font-heading text-[8rem] font-extrabold leading-none tracking-tighter text-[#141414]/90 sm:right-12 sm:text-[14rem]"
        >
          404
        </p>
        <div className="relative max-w-md">
          <h1 className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {tx("Cette page n'existe pas.", "This page is not here.")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#141414]/80">
            {tx(
              "Le lien est peut-être ancien ou mal écrit. Vos données et vos alertes sont là où vous les avez laissées.",
              "The link may be old or mistyped. Your data and alerts are safe where you left them."
            )}
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/" className={`${PILL} bg-[#141414] text-white`}>
              {tx("Retour au tableau de bord", "Back to the dashboard")}
            </Link>
          </div>
        </div>
      </section>
    </Shell>
  )
}

/** 500: something broke. Says the data is safe, gives a code to quote, and a retry. */
export function ErrorPage({ digest, retry }: { digest?: string; retry: () => void }) {
  const tx = useTx()

  return (
    <Shell>
      <section className="flex flex-1 flex-col justify-center rounded-[44px] bg-[var(--ink)] p-8 text-white sm:p-12">
        <div className="max-w-lg">
          <span
            className="mb-5 flex h-[68px] w-[68px] items-center justify-center rounded-[23px] text-white shadow-md"
            style={{ background: "linear-gradient(165deg, #ff7a6c, #e2362a)" }}
            aria-hidden="true"
          >
            <TriangleAlert className="h-8 w-8" />
          </span>
          <h1 className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {tx("Un problème de notre côté.", "Something broke on our side.")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            {tx(
              "Vos données sont en sécurité, rien n'a été perdu. Réessayez dans un instant.",
              "Your data is safe, nothing was lost. Try again in a moment."
            )}
          </p>
          {digest && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3.5 py-2.5 font-mono text-[13px] text-white/85">
              <span className="text-brand">#</span>
              {tx("Référence", "Reference")} {digest}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={retry} className={`${PILL} bg-brand text-[#1d2a0a]`}>
              {tx("Réessayer", "Try again")}
            </button>
            <Link href="/" className={`${PILL} bg-white/15 text-white`}>
              {tx("Retour au tableau de bord", "Back to the dashboard")}
            </Link>
          </div>
        </div>
      </section>
    </Shell>
  )
}
