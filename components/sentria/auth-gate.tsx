"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "@/lib/icons"
import type { Session } from "@supabase/supabase-js"

import { clearLocalAccount, loadAccount, syncAccount } from "@/lib/account"
import { useTx } from "@/lib/i18n"
import { supabase } from "@/lib/supabase"

import { USERNAME_UPDATED_EVENT } from "./username-card"
import { AppShell } from "./app-shell"
import { AuthScreen } from "./auth-screen"

type State =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "recovery" }
  | { kind: "failed"; userId: string }
  | { kind: "ready"; userId: string; email: string; name: string; username: string | null }

/** Shows the app only to a signed-in user, with their own account loaded
 *  (S-3 step 1). Everyone else gets the sign-in screen. */
export function AuthGate() {
  const tx = useTx()
  const [state, setState] = useState<State>({ kind: "loading" })
  const stopSync = useRef<null | (() => Promise<void>)>(null)
  const current = useRef<string | null>(null)
  // Arrived from the password reset email: the new password comes first.
  const recovering = useRef(false)

  const enter = useCallback(async (session: Session) => {
    if (!supabase) return

    const user = session.user

    if (recovering.current) return

    // Token refreshes and other tabs re-announce the same user: the
    // account is already loaded and syncing.
    if (current.current === user.id) return
    current.current = user.id

    setState({ kind: "loading" })

    let username: string | null = null

    try {
      ;({ username } = await loadAccount(supabase, user))
    } catch (error) {
      console.error("The account could not be loaded:", error)
      current.current = null
      setState({ kind: "failed", userId: user.id })
      return
    }

    if (recovering.current) {
      current.current = null
      return
    }

    await stopSync.current?.()
    stopSync.current = syncAccount(supabase, user.id)
    const fullName = user.user_metadata?.full_name
    setState({
      kind: "ready",
      userId: user.id,
      email: user.email ?? "",
      // The name typed at sign-up, shown instead of the email.
      name: typeof fullName === "string" ? fullName.trim() : "",
      username,
    })
  }, [])

  const leave = useCallback(async () => {
    await stopSync.current?.()
    stopSync.current = null
    current.current = null
    clearLocalAccount()
    setState({ kind: "signed-out" })
  }, [])

  // A username chosen on the Profile page shows in the sidebar at once.
  useEffect(() => {
    const onUsername = (event: Event) => {
      const value = (event as CustomEvent<string>).detail
      if (typeof value !== "string" || !value) return
      setState((current) => (current.kind === "ready" ? { ...current, username: value } : current))
    }
    window.addEventListener(USERNAME_UPDATED_EVENT, onUsername)
    return () => window.removeEventListener(USERNAME_UPDATED_EVENT, onUsername)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setState({ kind: "signed-out" })
      return
    }

    let active = true

    if (window.location.hash.includes("type=recovery")) {
      recovering.current = true
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      // A reset link lands here with a session and PASSWORD_RECOVERY:
      // let that event decide.
      if (recovering.current) return
      if (data.session) void enter(data.session)
      else setState({ kind: "signed-out" })
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (event === "PASSWORD_RECOVERY") {
        recovering.current = true
        setState({ kind: "recovery" })
      } else if (event === "SIGNED_OUT") {
        void leave()
      } else if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        // Deferred: Supabase calls this inside its auth lock, and
        // loadAccount makes Supabase calls of its own.
        setTimeout(() => {
          if (active) void enter(session)
        }, 0)
      }
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
      void stopSync.current?.()
    }
  }, [enter, leave])

  const signOut = useCallback(async () => {
    // Save the last changes while still signed in, then sign out.
    await stopSync.current?.()
    stopSync.current = null
    await supabase?.auth.signOut().catch((error) => {
      console.error("Sign-out failed:", error)
    })
    await leave()
  }, [leave])

  if (state.kind === "ready") {
    return (
      <AppShell
        key={state.userId}
        email={state.email}
        name={state.name}
        username={state.username}
        onSignOut={signOut}
      />
    )
  }

  if (state.kind === "signed-out") return <AuthScreen />

  if (state.kind === "recovery") {
    return (
      <AuthScreen
        initialMode="reset"
        onPasswordUpdated={() => {
          recovering.current = false
          window.history.replaceState(null, "", window.location.pathname)
          void supabase?.auth.getSession().then(({ data }) => {
            if (data.session) void enter(data.session)
            else setState({ kind: "signed-out" })
          })
        }}
      />
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-sm text-muted-foreground">
      {state.kind === "loading" ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span role="status">{tx("Chargement de votre compte…", "Loading your account…")}</span>
        </>
      ) : (
        <>
          <p role="alert" className="max-w-sm text-foreground">
            {tx(
              "Votre compte n'a pas pu être chargé. Vérifiez votre connexion et réessayez.",
              "Your account could not be loaded. Check your connection and try again."
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void supabase?.auth.getSession().then(({ data }) => {
                  if (data.session) void enter(data.session)
                  else setState({ kind: "signed-out" })
                })
              }}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              {tx("Réessayer", "Try again")}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground"
            >
              {tx("Se déconnecter", "Sign out")}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
