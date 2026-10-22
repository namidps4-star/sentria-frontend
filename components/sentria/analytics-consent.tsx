"use client"

import { useEffect, useState } from "react"

import { analyticsConfigured, CONSENT_EVENT, readConsent, setConsent, startAnalytics, type Consent } from "@/lib/analytics"
import { errorTrackingConfigured, followConsent } from "@/lib/error-tracking"
import { useTx } from "@/lib/i18n"

import { LegalDialog } from "./legal-dialog"

/* Asks once, before anything is measured (F-ANALYTICS). Renders nothing when
 * no PostHog key is set for the build, and nothing once the person has
 * answered. Settings shows the answer and lets them change it. */

export function AnalyticsConsent() {
  const tx = useTx()
  const [consent, setConsentState] = useState<Consent | "unknown">("unknown")
  const [legalOpen, setLegalOpen] = useState(false)

  useEffect(() => {
    const sync = () => setConsentState(readConsent())

    sync()
    void startAnalytics()
    window.addEventListener(CONSENT_EVENT, sync)
    const stopFollowing = followConsent()

    return () => {
      window.removeEventListener(CONSENT_EVENT, sync)
      stopFollowing()
    }
  }, [])

  if (!(analyticsConfigured() || errorTrackingConfigured()) || consent !== null) return null

  return (
    <>
      <div
        role="region"
        aria-label={tx("Statistiques d'usage", "Usage statistics")}
        data-testid="analytics-consent"
        className="fixed bottom-4 left-4 right-4 z-[60] rounded-2xl border border-border bg-card p-4 shadow-xl sm:left-auto sm:max-w-sm"
      >
        <p className="text-sm font-semibold">{tx("Mesurer l'usage de SentrIA ?", "Measure how SentrIA is used?")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {tx(
            "Nous comptons les écrans ouverts et les étapes terminées, et nous recevons un rapport quand l'application plante, pour améliorer le produit. Aucun nom, aucun contenu de fichier. Vous pouvez changer d'avis dans Paramètres.",
            "We count the screens opened and the steps finished, and we get a report when the app crashes, to improve the product. No names, no file contents. You can change your mind in Settings."
          )}{" "}
          <button
            type="button"
            onClick={() => setLegalOpen(true)}
            className="underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tx("Confidentialité", "Privacy")}
          </button>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="analytics-accept"
            onClick={() => setConsent("granted")}
            className="rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tx("Accepter", "Accept")}
          </button>
          <button
            type="button"
            data-testid="analytics-decline"
            onClick={() => setConsent("denied")}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tx("Refuser", "Decline")}
          </button>
        </div>
      </div>
      <LegalDialog open={legalOpen} doc="privacy" onClose={() => setLegalOpen(false)} />
    </>
  )
}
