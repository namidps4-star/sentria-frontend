"use client"

import { useEffect, useState } from "react"

import { activeSiteId } from "@/lib/active-site"
import { useTx } from "@/lib/i18n"
import { readAccountPlan } from "@/lib/plans"
import { readRoleView, setRoleView, type RoleView } from "@/lib/view-as"
import { cn } from "@/lib/utils"

/* The founder's switch (SentrIA staff only): see the app as the founder, as the
 * boss, or as an employee of the site on screen. Read only: the server answers
 * as that role and gives no staff powers with it (api/main.py, X-View-As-Owner
 * and X-View-As-Employee). Choosing reloads, so every screen starts again. */

type Mode = "founder" | "boss" | "employee"

function modeOf(view: RoleView | null): Mode {
  return view ? view.role : "founder"
}

export function RoleSwitch() {
  const tx = useTx()
  const [isAdmin, setIsAdmin] = useState(false)
  const [mode, setMode] = useState<Mode>("founder")
  const [site, setSite] = useState<string | null>(null)

  useEffect(() => {
    setIsAdmin(readAccountPlan().isAdmin)
    setMode(modeOf(readRoleView()))
    setSite(activeSiteId())
  }, [])

  if (!isAdmin) return null

  const options: { id: Mode; label: string; disabled?: boolean; title?: string }[] = [
    { id: "founder", label: tx("Fondateur", "Founder") },
    { id: "boss", label: tx("Patron", "Boss") },
    {
      id: "employee",
      label: tx("Employé", "Employee"),
      disabled: !site,
      title: site ? undefined : tx("Choisissez d'abord un site", "Pick a site first"),
    },
  ]

  function choose(next: Mode) {
    if (next === "founder") setRoleView(null)
    else if (next === "boss") setRoleView({ role: "boss" })
    else if (site) setRoleView({ role: "employee", sites: [site] })
    else return

    window.location.reload()
  }

  return (
    <div className="mt-2 border-t border-border pt-2.5" data-testid="role-switch">
      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tx("Voir comme", "View as")}</p>
      <div role="group" aria-label={tx("Voir l'application comme", "View the app as")} className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {options.map((option) => {
          const active = mode === option.id
          return (
            <button
              key={option.id}
              type="button"
              data-testid={`role-${option.id}`}
              aria-pressed={active}
              disabled={option.disabled}
              title={option.title}
              onClick={() => choose(option.id)}
              className={cn(
                "min-h-9 rounded-full px-2 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-background"
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
