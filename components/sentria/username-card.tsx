"use client"

import { useEffect, useState, type FormEvent } from "react"

import { AtSign, Check, Loader2 } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

import { StatusTag } from "./status-tag"

/** Same rule as the database (migrations/006_usernames.sql). */
const USERNAME = /^[a-z0-9_]{3,24}$/

/** Fired when the username is set, so the sidebar shows it at once. */
export const USERNAME_UPDATED_EVENT = "sentria_username_updated"

type Check = "empty" | "invalid" | "checking" | "free" | "taken" | "unknown"

/** The account's @username: shown when it has one, chosen here (once)
 *  when it doesn't. Accounts made before usernames existed have none. */
export function UsernameCard({ username }: { username: string | null }) {
  const tx = useTx()
  const [value, setValue] = useState("")
  const [check, setCheck] = useState<Check>("empty")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const current = saved ?? username
  const wanted = value.trim().toLowerCase()

  // "Is it free?", as the user types.
  useEffect(() => {
    if (current) return
    if (!wanted) return setCheck("empty")
    if (!USERNAME.test(wanted)) return setCheck("invalid")
    if (!supabase) return setCheck("unknown")

    setCheck("checking")
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase!.rpc("username_available", { name: wanted })
      if (cancelled) return
      setCheck(error || typeof data !== "boolean" ? "unknown" : data ? "free" : "taken")
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [wanted, current])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    if (!USERNAME.test(wanted)) {
      setMessage({ ok: false, text: tx("3 à 24 caractères : lettres minuscules, chiffres ou _.", "3 to 24 characters: lowercase letters, digits or _.") })
      return
    }
    if (check === "taken") {
      setMessage({ ok: false, text: tx("Ce nom d'utilisateur est déjà utilisé.", "This username is already used.") })
      return
    }
    if (!supabase) return

    setSaving(true)
    const { data, error } = await supabase.rpc("set_username", { name: wanted })
    setSaving(false)

    if (error) {
      setMessage({
        ok: false,
        text: /set_username|function/i.test(error.message ?? "")
          ? tx("Les noms d'utilisateur ne sont pas encore activés (migration 007).", "Usernames aren't switched on yet (migration 007).")
          : tx("Enregistrement impossible. Réessayez.", "Couldn't save it. Try again."),
      })
      return
    }

    const outcome = String(data)
    if (outcome === "ok") {
      setSaved(wanted)
      window.dispatchEvent(new CustomEvent(USERNAME_UPDATED_EVENT, { detail: wanted }))
      setMessage({ ok: true, text: tx(`C'est fait : vous êtes @${wanted}.`, `Done: you are @${wanted}.`) })
      return
    }

    const reasons: Record<string, [string, string]> = {
      taken: ["Ce nom d'utilisateur vient d'être pris. Choisissez-en un autre.", "This username was just taken. Choose another one."],
      invalid: ["3 à 24 caractères : lettres minuscules, chiffres ou _.", "3 to 24 characters: lowercase letters, digits or _."],
      already_set: ["Votre compte a déjà un nom d'utilisateur.", "Your account already has a username."],
      no_account: ["Compte introuvable. Reconnectez-vous.", "Account not found. Sign in again."],
      not_signed_in: ["Session expirée. Reconnectez-vous.", "Your session has expired. Sign in again."],
    }
    const reason = reasons[outcome] ?? ["Enregistrement impossible. Réessayez.", "Couldn't save it. Try again."]
    if (outcome === "taken") setCheck("taken")
    setMessage({ ok: false, text: tx(reason[0], reason[1]) })
  }

  return (
    <div className="rounded-[28px] bg-card p-6 shadow-sm" data-testid="username-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold">{tx("Nom d'utilisateur", "Username")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tx(
              "Affiché dans la barre latérale et pour l'administrateur. Vous vous connectez toujours avec votre email.",
              "Shown in the sidebar and to your admin. You still sign in with your email."
            )}
          </p>
        </div>
        {current && <StatusTag tone="success">{tx("Actif", "Active")}</StatusTag>}
      </div>

      {current ? (
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
            <AtSign className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tracking-tight">@{current}</p>
            <p className="text-xs text-muted-foreground">
              {tx("Choisi une fois, il ne change pas.", "Chosen once, it doesn't change.")}
            </p>
          </div>
          
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label htmlFor="profile-username" className="sr-only">
              {tx("Choisissez votre nom d'utilisateur", "Choose your username")}
            </label>
            <div
              className={cn(
                "flex h-12 items-center gap-1 rounded-full border bg-background px-4 focus-within:ring-2 focus-within:ring-ring",
                check === "taken" || check === "invalid" ? "border-destructive/60" : "border-border"
              )}
            >
              <span className="text-muted-foreground" aria-hidden="true">@</span>
              <input
                id="profile-username"
                value={value}
                onChange={(event) => setValue(event.target.value.replace(/\s/g, "").toLowerCase())}
                placeholder={tx("votre_nom", "your_name")}
                autoComplete="username"
                maxLength={24}
                aria-describedby="profile-username-status"
                aria-invalid={check === "taken" || check === "invalid"}
                className="h-full flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <p
              id="profile-username-status"
              className={cn(
                "mt-1.5 px-4 text-xs",
                check === "taken" || check === "invalid" ? "text-destructive" : check === "free" ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {check === "taken"
                ? tx("Ce nom d'utilisateur est déjà utilisé.", "This username is already used.")
                : check === "free"
                  ? tx(`@${wanted} est libre.`, `@${wanted} is available.`)
                  : check === "checking"
                    ? tx("Vérification…", "Checking…")
                    : check === "invalid"
                      ? tx("3 à 24 caractères : lettres minuscules, chiffres ou _.", "3 to 24 characters: lowercase letters, digits or _.")
                      : tx("Lettres minuscules, chiffres ou _. Choisi une fois.", "Lowercase letters, digits or _. Chosen once.")}
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || !wanted || check === "taken" || check === "invalid"}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {tx("Enregistrer", "Save")}
          </button>
        </form>
      )}

      {message && !message.ok && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {message.text}
        </p>
      )}
      {message?.ok && (
        <p role="status" className="mt-3 text-sm">
          {message.text}
        </p>
      )}
    </div>
  )
}
