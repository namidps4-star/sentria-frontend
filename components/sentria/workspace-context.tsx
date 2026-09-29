"use client"

import { useEffect, useState } from "react"
import {
  Factory,
  HeartPulse,
  Layers,
  ShoppingBasket,
  Ship,
  Sprout,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { activityLabel, readSectors } from "@/lib/activities"
import { useTx } from "@/lib/i18n"
import { PLAN_UPDATED_EVENT, readDepartments } from "@/lib/plans"
import { sectorLabel } from "@/lib/priorities"

const SECTOR_ICONS: Record<string, LucideIcon> = {
  health: HeartPulse,
  industry: Factory,
  logistics: Ship,
  commerce: ShoppingBasket,
  agriculture: Sprout,
  energy: Zap,
  transportation: Truck,
}

type Scope = { sectors: string[]; departments: Record<string, string[]> }

function readScope(): Scope {
  return { sectors: readSectors(), departments: readDepartments() }
}

/** "Where am I": the sector(s) and department(s) the account monitors,
 *  as one quiet pill in the top bar of every page. */
export function WorkspaceContext() {
  const tx = useTx()
  const [scope, setScope] = useState<Scope>({ sectors: [], departments: {} })

  useEffect(() => {
    const refresh = () => setScope(readScope())
    refresh()
    const events = ["sentria_sectors_updated", "sentria_onboarding_completed", PLAN_UPDATED_EVENT, "storage"]
    events.forEach((name) => window.addEventListener(name, refresh))
    return () => events.forEach((name) => window.removeEventListener(name, refresh))
  }, [])

  const [first, ...others] = scope.sectors
  if (!first) return null

  const Icon = scope.sectors.length > 1 ? Layers : SECTOR_ICONS[first] ?? Layers
  const departments = (scope.departments[first] ?? [])
    .map((id) => activityLabel(first, id, tx))
    .filter((label): label is string => Boolean(label))

  const sectorText = [first, ...others].map((id) => sectorLabel(id, tx)).join(" + ")
  const departmentText =
    departments.length === 0
      ? ""
      : departments.length <= 2
        ? departments.join(", ")
        : `${departments.slice(0, 2).join(", ")} +${departments.length - 2}`
  const full = [sectorText, departments.join(", ")].filter(Boolean).join(" · ")

  return (
    <div
      className="hidden min-w-0 max-w-[320px] items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-3 text-[11px] leading-none shadow-sm md:flex"
      title={full}
      aria-label={tx(`Vous surveillez : ${full}`, `You're monitoring: ${full}`)}
      role="note"
      data-testid="workspace-context"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#141414] text-brand">
        <Icon className="h-3 w-3" aria-hidden="true" />
      </span>
      <span className="min-w-0 truncate">
        <span className="font-semibold">{sectorText}</span>
        {departmentText && <span className="text-muted-foreground"> · {departmentText}</span>}
      </span>
    </div>
  )
}
