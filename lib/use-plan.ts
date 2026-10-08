"use client"

import { useEffect, useState } from "react"

import { PLAN_UPDATED_EVENT, canSeeAmounts, readAccountPlan, type PlanId } from "@/lib/plans"

/** The plan in force for this account. null until the page has mounted: the
 *  plan lives in localStorage, so the server cannot know it. It follows a
 *  change made here (PLAN_UPDATED_EVENT) or in another tab ("storage"). */
export function useEffectivePlan(): PlanId | null {
  const [plan, setPlan] = useState<PlanId | null>(null)

  useEffect(() => {
    const sync = () => setPlan(readAccountPlan().effective)
    sync()
    window.addEventListener(PLAN_UPDATED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(PLAN_UPDATED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return plan
}

/** Can this account see money amounts on alerts? false until the plan is
 *  known: an amount is never shown first and taken back. */
export function useCanSeeAmounts(): boolean {
  const plan = useEffectivePlan()
  return plan !== null && canSeeAmounts(plan)
}
