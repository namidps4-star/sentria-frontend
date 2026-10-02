"use client"

/* What each plan can do (C-PRICE), drawn from the list the API sends
   (pipeline/entitlements.py CAPABILITIES via lib/plans.ts). The page is not
   written by hand: change a capability's plan in the backend and this changes
   with it, so the pricing page and the entitlement map cannot disagree. */

import { Check } from "@/lib/icons"
import { useTx, resolve } from "@/lib/i18n"
import { CAPABILITIES, PLAN_NAMES, PLAN_ORDER, TIERS, includesCapability } from "@/lib/plans"

import { StatusTag } from "./status-tag"

export function CapabilityMatrix() {
  const tx = useTx()

  // Nothing until the API has answered: no list of our own to contradict it.
  if (CAPABILITIES.length === 0 || TIERS.length === 0) return null

  const hasSeasonal = CAPABILITIES.some((c) => c.key === "seasonal_advice")

  return (
    <section data-capabilities="" className="rounded-[28px] border border-border bg-card p-7">
      <h3 className="font-heading text-xl font-bold">
        {tx("Ce que chaque offre permet", "What each plan can do")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {tx(
          "Classé par ce que cela vous apporte, pas par département.",
          "Listed by what it gives you, not by department."
        )}
      </p>

      <table className="mt-5 w-full border-collapse text-sm">
        <caption className="sr-only">{tx("Ce que chaque offre permet", "What each plan can do")}</caption>

        <thead className="sr-only md:not-sr-only">
          <tr>
            <th scope="col" className="sr-only">
              {tx("Fonctionnalité", "Capability")}
            </th>
            {PLAN_ORDER.map((plan) => (
              <th
                key={plan}
                scope="col"
                data-plan-head={plan}
                className="w-[5.75rem] pb-3 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {PLAN_NAMES[plan]}
              </th>
            ))}
          </tr>
        </thead>

        {TIERS.map((tier) => {
          const rows = CAPABILITIES.filter((c) => c.tier === tier.key)
          if (rows.length === 0) return null

          return (
            <tbody key={tier.key} data-tier={tier.key}>
              <tr>
                <th scope="colgroup" colSpan={1 + PLAN_ORDER.length} className="pb-2 pt-6 text-left font-normal">
                  <span className="font-heading text-base font-bold">{resolve(tier.label, tx)}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{resolve(tier.summary, tx)}</span>
                </th>
              </tr>

              {rows.map((capability) => (
                <tr key={capability.key} data-capability={capability.key} data-live={capability.live} className="border-t border-border">
                  <th scope="row" className="py-2.5 pr-3 text-left align-top font-normal">
                    {resolve(capability.label, tx)}
                    {!capability.live && (
                      <StatusTag tone="neutral" size="xs" className="ml-2 align-middle">
                        {tx("Bientôt", "Soon")}
                      </StatusTag>
                    )}
                    {/* A phone has no room for four columns: the lowest plan says it all. */}
                    <span data-from="" className="mt-0.5 block text-[11px] text-muted-foreground md:hidden">
                      {capability.plan === PLAN_ORDER[0]
                        ? tx("Toutes les offres", "Every plan")
                        : tx(`À partir de ${PLAN_NAMES[capability.plan]}`, `From ${PLAN_NAMES[capability.plan]}`)}
                    </span>
                  </th>

                  {PLAN_ORDER.map((plan) => {
                    const included = includesCapability(plan, capability)
                    return (
                      <td key={plan} data-plan={plan} data-included={included} className="hidden py-2.5 text-center align-top md:table-cell">
                        {included ? (
                          <Check className="mx-auto h-4 w-4 text-[var(--tag-success-fg)]" strokeWidth={2.5} aria-hidden="true" />
                        ) : (
                          <span className="text-muted-foreground/50" aria-hidden="true">
                            —
                          </span>
                        )}
                        <span className="sr-only">{included ? tx("Inclus", "Included") : tx("Non inclus", "Not included")}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          )
        })}
      </table>

      {hasSeasonal && (
        <p className="mt-5 text-xs text-muted-foreground">
          {tx(
            "Les conseils saisonniers partent du calendrier de votre région, puis de votre propre historique après 3 mois de données. Ce sont des conseils de stock, jamais des conseils médicaux.",
            "Seasonal advice starts from your region's calendar, then from your own history after 3 months of data. It is stock advice, never medical advice."
          )}
        </p>
      )}
    </section>
  )
}
