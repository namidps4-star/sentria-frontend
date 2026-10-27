"use client"

import { readRoleView } from "./view-as"
import { useEffect, useState } from "react"

import { PLAN_UPDATED_EVENT } from "@/lib/plans"

/* An employee the boss put in charge (F-TEAMROLES).
 *
 * accounts.role is read at sign-in (lib/account.ts) and kept here only to hide
 * what an employee cannot use: the site menu, the Sites page, the account's
 * export and delete, and the Team card. The API refuses all of it on its own
 * (403 owner_only), so editing this in the browser opens nothing. */

export const ROLE_KEY = "sentria_role"

export function readIsEmployee(): boolean {
  // The founder's employee preview (lib/view-as.ts) reads the app as an employee would.
  if (readRoleView()?.role === "employee") return true

  try {
    return localStorage.getItem(ROLE_KEY) === "employee"
  } catch {
    return false
  }
}

export function useIsEmployee(): boolean {
  const [employee, setEmployee] = useState(false)

  useEffect(() => {
    const read = () => setEmployee(readIsEmployee())

    read()
    window.addEventListener(PLAN_UPDATED_EVENT, read)

    return () => window.removeEventListener(PLAN_UPDATED_EVENT, read)
  }, [])

  return employee
}
