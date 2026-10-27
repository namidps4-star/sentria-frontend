"use client"

import { useEffect, useState } from "react"

import { Eye } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { readRoleView, readViewAs, setRoleView, setViewAs, type RoleView, type ViewAs } from "@/lib/view-as"

/* Shown the whole time SentrIA staff are looking at a company (S-3), or at the
 * app as its boss or one of its employees (the founder's switch). It says whose
 * view this is and that nothing can be changed, and ends it. */
export function ViewAsBanner() {
  const tx = useTx()
  const [target, setTarget] = useState<ViewAs | null>(null)
  const [role, setRole] = useState<RoleView | null>(null)

  useEffect(() => {
    setTarget(readViewAs())
    setRole(readRoleView())
  }, [])

  if (!target && !role) return null

  const text = role
    ? role.role === "boss"
      ? tx("Vous voyez l'application comme le patron (lecture seule)", "You see the app as the boss (read only)")
      : tx("Vous voyez l'application comme un employé (lecture seule)", "You see the app as an employee (read only)")
    : tx(`Vous regardez ${target?.name || "une entreprise"} (lecture seule)`, `You are viewing ${target?.name || "a company"} (read only)`)

  return (
    <div
      role="status"
      data-testid="view-as-banner"
      data-preview={role ? role.role : "company"}
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <Eye className="h-4 w-4" aria-hidden="true" />
        {text}
      </span>
      <button
        type="button"
        data-testid="view-as-exit"
        onClick={() => {
          if (role) setRoleView(null)
          setViewAs(null)
          window.location.assign("/")
        }}
        className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tx("Quitter", "Exit")}
      </button>
    </div>
  )
}
