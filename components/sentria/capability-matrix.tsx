"use client"

/* What each plan can do (C-PRICE), drawn from the list the API sends
   (pipeline/entitlements.py CAPABILITIES via lib/plans.ts). The page is not
   written by hand: change a capability's plan in the backend and this changes
   with it, so the pricing page and the entitlement map cannot disagree. */

import { Check } from "@/lib/icons"
import { useTx, resolve } from "@/lib/i18n"
import { CAPABILITIES, PLAN_NAMES, PLAN_ORDER, TIERS, includesCapability } from "@/lib/plans"
import { useEffectivePlan } from "@/lib/use-plan"
import { cn } from "@/lib/utils"

import { StatusTag } from "./status-tag"

/* One pastel tone per kind of value, from the app's tag tokens (they follow
   light and dark): detect is blue, estimate is green, coordinate is amber. */
const TIER_TONE: Record<string, { pill: string; check: string }> = {
  detection: {
    pill: "bg-[var(--tag-info-bg)] text-[var(--tag-info-fg)]",
    check: "bg-[var(--tag-info-bg)] text-[var(--tag-info-fg)]",
  },
  estimation: {
    pill: "bg-[var(--tag-success-bg)] text-[var(--tag-success-fg)]",
    check: "bg-[var(--tag-success-bg)] text-[var(--tag-success-fg)]",
  },
  coordination: {
    pill: "bg-[var(--tag-warning-bg)] text-[var(--tag-warning-fg)]",
    check: "bg-[var(--tag-warning-bg)] text-[var(--tag-warning-fg)]",
  },
}

/* The column of the plan in force: a soft lime tint, lime at the head. */
const YOU_TINT = "bg-[color-mix(in_oklab,var(--brand)_14%,transparent)]"

export function CapabilityMatrix() {
  const tx = useTx()
  const current = useEffectivePlan()

  // Nothing until the API has answered: no list of our own to contradict it.
  if (CAPABILITIES.length === 0 || TIERS.length === 0) return null

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
                data-you={plan === current}
                className={cn(
                  "w-[5.75rem] pb-3 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground",
                  plan === current && "rounded-t-2xl bg-brand pt-2.5 text-brand-foreground"
                )}
              >
                {PLAN_NAMES[plan]}
                {plan === current && (
                  <span className="block text-[9px] font-bold normal-case opacity-70">{tx("Votre offre", "Your plan")}</span>
                )}
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
                  <span
                    data-tier-pill={tier.key}
                    className={cn("inline-block rounded-full px-3 py-1 font-heading text-sm font-bold", TIER_TONE[tier.key]?.pill)}
                  >
                    {resolve(tier.label, tx)}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{resolve(tier.summary, tx)}</span>
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
                      <td key={plan} data-plan={plan} data-included={included} className={cn("hidden py-2.5 text-center align-top md:table-cell", plan === current && YOU_TINT)}>
                        {included ? (
                          <span
                            className={cn(
                              "mx-auto flex h-5 w-5 items-center justify-center rounded-full",
                              TIER_TONE[capability.tier]?.check ?? "bg-[var(--tag-success-bg)] text-[var(--tag-success-fg)]"
                            )}
                            aria-hidden="true"
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
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
    </section>
  )
}
