"use client"

import type { ReactNode } from "react"

import { useEnter } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

/** A headline and its supporting line rising in with a staggered blur: the
 *  transitions.dev texts reveal (app/transitions.css). Give the first line
 *  `t-stagger-line t-stagger-line--1` and the second `t-stagger-line
 *  t-stagger-line--2`. It plays once, when this mounts. */
export function RevealText({ children, className }: { children: ReactNode; className?: string }) {
  const shown = useEnter("is-shown")

  return <div className={cn("t-stagger", shown, className)}>{children}</div>
}
