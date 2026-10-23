"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  ArrowRight,
  AtSign,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "@/lib/icons"
import type { AuthError } from "@supabase/supabase-js"

import { API_BASE } from "@/lib/api"
import { useLocale, writeLanguage } from "@/lib/locale"
import { useTx, type Tx } from "@/lib/i18n"
import { missingSupabaseEnv, supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { useShake } from "@/lib/use-shake"

import { SectorShowcase } from "./sector-showcase"
import { LegalDialog } from "./legal-dialog"
import { LEGAL_VERSION, type LegalDocId } from "@/lib/legal"

type Mode = "sign-in" | "sign-up" | "forgot" | "reset"

const MIN_PASSWORD = 8

/** Same rule as the database (migrations/006_usernames.sql). */
const USERNAME = /^[a-z0-9_]{3,24}$/

type UsernameStatus = "empty" | "invalid" | "checking" | "free" | "taken" | "unknown"

/** Sign in with @username: the API finds the account and signs in with
 *  Supabase for us (Sentria api/username_login.py), so the email behind a
 *  username never reaches the browser. It answers with the session tokens. */
async function signInWithUsername(username: string, password: string, tx: Tx) {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/auth/username-sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error(
      tx(
        "Connexion par nom d'utilisateur indisponible. Utilisez votre email.",
        "Signing in with a username is unavailable. Use your email."
      )
    )
  }

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const code = body?.detail?.error_code
    throw new Error(
      code === "invalid_credentials"
        ? tx("Nom d'utilisateur ou mot de passe incorrect.", "Wrong username or password.")
        : code === "email_not_confirmed"
          ? tx(
              "Confirmez d'abord votre email : cliquez sur le lien que nous vous avons envoyé.",
              "Confirm your email first: click the link we sent you."
            )
          : code === "too_many_attempts"
            ? tx(
                "Trop d'essais. Patientez quelques minutes puis réessayez.",
                "Too many tries. Wait a few minutes, then try again."
              )
            : tx(
                "Connexion par nom d'utilisateur indisponible. Utilisez votre email.",
                "Signing in with a username is unavailable. Use your email."
              )
    )
  }

  return body as { access_token: string; refresh_token: string }
}

/** Supabase's errors, in the user's language. */
function authErrorMessage(error: AuthError | Error, tx: Tx): string {
  const code = "code" in error ? error.code : undefined

  switch (code) {
    case "invalid_credentials":
      return tx("Email ou mot de passe incorrect.", "Wrong email or password.")
    case "email_not_confirmed":
      return tx(
        "Confirmez d'abord votre email : cliquez sur le lien que nous vous avons envoyé.",
        "Confirm your email first: click the link we sent you."
      )
    case "weak_password":
      return tx(
        `Mot de passe trop faible : au moins ${MIN_PASSWORD} caractères, avec lettres et chiffres.`,
        `Password too weak: at least ${MIN_PASSWORD} characters, with letters and numbers.`
      )
    case "same_password":
      return tx(
        "Choisissez un mot de passe différent de l'ancien.",
        "Choose a password different from the old one."
      )
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return tx(
        "Trop de tentatives. Réessayez dans quelques minutes.",
        "Too many attempts. Try again in a few minutes."
      )
    default:
      return tx(
        "Une erreur est survenue. Vérifiez votre connexion et réessayez.",
        "Something went wrong. Check your connection and try again."
      )
  }
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="ml-1.5 block text-sm font-bold">
        {label}
      </label>
      {children}
    </div>
  )
}

/* Soft pill fields: a quiet grey fill, a lime glow when focused. */
const INPUT =
  "mt-1.5 block h-[54px] w-full rounded-full border border-transparent bg-muted px-6 text-base text-foreground placeholder:text-muted-foreground/70 transition-[background-color,border-color,box-shadow] focus:border-brand focus:bg-card focus:outline-none focus:ring-4 focus:ring-brand/30"

/** Sign in, create an account, and reset a password (S-3 step 1).
 *
 *  mode="reset" is shown by AuthGate when the user arrives from the
 *  password reset email. */
export function AuthScreen({
  initialMode = "sign-in",
  onPasswordUpdated,
}: {
  initialMode?: Mode
  onPasswordUpdated?: () => void
}) {
  const tx = useTx()
  const { ui } = useLocale()

  const [mode, setMode] = useState<Mode>(initialMode)
  const [accepted, setAccepted] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)
  const [legalDoc, setLegalDoc] = useState<LegalDocId>("privacy")
  const openLegal = (doc: LegalDocId) => {
    setLegalDoc(doc)
    setLegalOpen(true)
  }
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("empty")
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  // F-FORMSHAKE: a refused sign-in shakes the form. The errors say nothing
  // about which field was wrong (that is on purpose), so the whole form moves.
  const [formRef, shakeForm] = useShake<HTMLFormElement>()
  useEffect(() => {
    if (error) shakeForm()
  }, [error, shakeForm])

  function switchTo(next: Mode) {
    setMode(next)
    setError("")
    setNotice("")
    setPassword("")
  }

  // "Is this username free?", asked as the user types (debounced). If the
  // check can't run (the SQL isn't installed yet), the form doesn't block:
  // the database still refuses a duplicate at sign-up.
  const wanted = username.trim().toLowerCase()

  useEffect(() => {
    if (mode !== "sign-up") return
    if (!wanted) return setUsernameStatus("empty")
    if (!USERNAME.test(wanted)) return setUsernameStatus("invalid")
    if (!supabase) return setUsernameStatus("unknown")

    setUsernameStatus("checking")
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase!.rpc("username_available", { name: wanted })
      if (cancelled) return
      setUsernameStatus(error || typeof data !== "boolean" ? "unknown" : data ? "free" : "taken")
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [wanted, mode])

  async function submit(event: FormEvent) {
    event.preventDefault()

    if (!supabase || busy) return

    setError("")
    setNotice("")

    if (mode === "sign-up" && !USERNAME.test(wanted)) {
      setError(
        tx(
          "Nom d'utilisateur : 3 à 24 caractères, lettres minuscules, chiffres ou _.",
          "Username: 3 to 24 characters, lowercase letters, digits or _."
        )
      )
      return
    }

    if (mode === "sign-up" && usernameStatus === "taken") {
      setError(tx("Ce nom d'utilisateur est déjà utilisé.", "This username is already used."))
      return
    }

    if ((mode === "sign-up" || mode === "reset") && password.length < MIN_PASSWORD) {
      setError(
        tx(
          `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`,
          `The password must be at least ${MIN_PASSWORD} characters.`
        )
      )
      return
    }

    if (mode === "sign-up" && !accepted) {
      setError(tx("Acceptez les conditions et la politique de confidentialité pour créer un compte.", "Accept the terms and the privacy policy to create an account."))
      return
    }

    setBusy(true)

    try {
      const origin = window.location.origin

      if (mode === "sign-in") {
        const id = email.trim()
        // "ama@pharma.bj" is an email; "ama_pharma" or "@ama_pharma" a username.
        if (id.indexOf("@") > 0) {
          const { error } = await supabase.auth.signInWithPassword({ email: id, password })
          if (error) throw error
        } else {
          const tokens = await signInWithUsername(id.replace(/^@/, "").toLowerCase(), password, tx)
          const { error } = await supabase.auth.setSession(tokens)
          if (error) throw error
        }
        // AuthGate takes over on the auth state change.
      } else if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: origin,
            // The confirmation email is one template for both languages
            // (supabase/templates/confirmation.html) and reads `language`.
            data: {
              full_name: name.trim(),
              company_name: company.trim(),
              username: wanted,
              language: ui === "en" ? "en" : "fr",
              terms_version: LEGAL_VERSION,
              terms_accepted_at: new Date().toISOString(),
            },
          },
        })
        // The database refuses a username taken in the meantime; Supabase
        // reports it as "Database error saving new user".
        if (error && /database error saving new user/i.test(error.message ?? "")) {
          setUsernameStatus("taken")
          setError(tx("Ce nom d'utilisateur vient d'être pris. Choisissez-en un autre.", "This username was just taken. Choose another one."))
          return
        }
        // S-4: an address that already has an account gets the same answer
        // as a new one, so the form can't be used to find out who has an
        // account. (With email confirmation on, Supabase already does this;
        // this covers the setting where it reports the clash instead.)
        const alreadyRegistered =
          !!error && ((error as AuthError).code === "user_already_exists" || (error as AuthError).code === "email_exists")
        if (error && !alreadyRegistered) throw error

        if (alreadyRegistered || !data.session) {
          // Email confirmation is on: nothing to do until they click.
          setNotice(
            tx(
              `Ouvrez l'email envoyé à ${email.trim()} et cliquez sur le lien pour continuer. Si vous avez déjà un compte, connectez-vous ou réinitialisez votre mot de passe.`,
              `Open the email sent to ${email.trim()} and click the link to continue. If you already have an account, sign in or reset your password.`
            )
          )
          setMode("sign-in")
          setPassword("")
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: origin }
        )
        if (error) throw error

        // Same answer whether or not the address has an account.
        setNotice(
          tx(
            `Si un compte existe pour ${email.trim()}, un lien pour changer le mot de passe vient d'y être envoyé.`,
            `If an account exists for ${email.trim()}, a link to change the password has just been sent there.`
          )
        )
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        onPasswordUpdated?.()
      }
    } catch (caught) {
      // Our own messages (username sign-in) are already in the user's language.
      setError(
        caught instanceof Error && !("code" in caught) && !("status" in caught)
          ? caught.message
          : authErrorMessage(caught as AuthError, tx)
      )
    } finally {
      setBusy(false)
    }
  }

  const heading = {
    "sign-in": tx("Content de vous revoir", "Welcome back"),
    "sign-up": tx("Protégeons vos opérations ensemble", "Let's protect your operations together"),
    forgot: tx("Mot de passe oublié", "Forgot your password"),
    reset: tx("Choisissez un nouveau mot de passe", "Choose a new password"),
  }[mode]

  const button = {
    "sign-in": tx("Se connecter", "Sign in"),
    "sign-up": tx("Créer mon compte", "Create my account"),
    forgot: tx("Envoyer le lien", "Send the link"),
    reset: tx("Enregistrer le mot de passe", "Save the password"),
  }[mode]

  const promises = [
    tx("Alertes en temps réel", "Real-time alerts"),
    tx("Vos données restent les vôtres", "Your data stays yours"),
    tx("Des actions, pas juste des chiffres", "Actions, not just numbers"),
  ]

  const logo = (
    <div className="flex items-center gap-2.5">
      <span className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-[9px]">
        <img src="/logo-mark.png" alt="" className="h-full w-full object-contain" />
      </span>
      <span className="font-heading text-[19px] font-semibold">SentrIA</span>
    </div>
  )

  const langPill = (
    <div
      className="inline-flex items-center rounded-full bg-muted p-[3px] text-xs"
      role="group"
      aria-label={tx("Langue", "Language")}
    >
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => writeLanguage(code)}
          aria-pressed={ui === code}
          className={cn(
            "rounded-full px-3 py-1.5 font-extrabold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ui === code ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {code}
        </button>
      ))}
    </div>
  )

  /* The pitch and the form as one block in the middle of the screen: the
     headline, an example alert, the three promises, and a soft form card
     beside them. On a phone the form comes first and the pitch follows. */
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--auth-bg)]">
      <div className="pointer-events-none absolute -bottom-52 -right-44 h-[46rem] w-[46rem] rounded-full bg-brand/25 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-40 -top-52 h-[38rem] w-[42rem] rounded-full bg-[var(--auth-glow)] blur-3xl" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between px-5 pt-5 lg:px-11 lg:pt-7">
        {logo}
        {langPill}
      </header>

      <div className="relative z-10 flex flex-1 flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-16 lg:px-10 lg:py-8">
        {/* ----------------------------------------------------- FORM */}
        <main className="order-1 flex justify-center px-5 py-8 lg:order-3 lg:w-[26.875rem] lg:shrink-0 lg:p-0">
          <div className="relative w-full max-w-[26.875rem]">
            <div className="pointer-events-none absolute -inset-6 rounded-[70px] bg-brand/30 blur-3xl" aria-hidden="true" />

            <section className="squircle relative w-full rounded-[44px] bg-card/90 p-6 shadow-[0_0_0_1px_rgb(20_20_18/0.04),0_24px_70px_rgb(20_20_18/0.14)] backdrop-blur-xl sm:p-10">
          {(mode === "sign-in" || mode === "sign-up") && (
            <div
              role="tablist"
              aria-label={tx("Connexion ou création de compte", "Sign in or create an account")}
              className="mb-7 inline-flex rounded-full bg-muted p-1"
            >
              {(
                [
                  ["sign-in", tx("Se connecter", "Sign in")],
                  ["sign-up", tx("Créer un compte", "Create account")],
                ] as const
              ).map(([target, label]) => (
                <button
                  key={target}
                  type="button"
                  role="tab"
                  aria-selected={mode === target}
                  onClick={() => mode !== target && switchTo(target)}
                  className={cn(
                    "rounded-full px-5 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mode === target ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <h1 className="font-heading text-[32px] font-semibold leading-[1.05] tracking-tight sm:text-[38px]">{heading}</h1>

          {mode === "sign-in" && (
            <p className="mt-2 text-[15px] text-muted-foreground">
              {tx("Utilisez votre email ou votre @nom d'utilisateur.", "Use your email or your @username.")}
            </p>
          )}

          {mode === "forgot" && (
            <p className="mt-2 text-[15px] text-muted-foreground">
              {tx(
                "Entrez votre email : nous vous envoyons un lien pour en choisir un nouveau.",
                "Enter your email: we'll send you a link to choose a new one."
              )}
            </p>
          )}

          {!supabase ? (
            <p role="alert" className="mt-6 rounded-2xl bg-muted p-4 text-sm text-foreground">
              {tx(
                `La connexion n'est pas configurée : ce site a été construit sans ${missingSupabaseEnv.join(" ni ")}. Ajoutez-la sur Vercel pour cet environnement, puis redéployez.`,
                `Sign-in is not configured: this site was built without ${missingSupabaseEnv.join(" or ")}. Add it on Vercel for this environment, then redeploy.`
              )}
            </p>
          ) : (
            <form ref={formRef} onSubmit={submit} className="mt-6 flex w-full flex-col gap-3.5" noValidate>
              {mode === "sign-up" && (
                <>
                  <Field id="auth-name" label={tx("Nom", "Name")}>
                    <input
                      id="auth-name"
                      className={INPUT}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </Field>
                  <Field id="auth-username" label={tx("Nom d'utilisateur", "Username")}>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground">@</span>
                      <input
                        id="auth-username"
                        className={cn(INPUT, "pl-9")}
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={24}
                        aria-describedby="auth-username-status"
                        aria-invalid={usernameStatus === "invalid" || usernameStatus === "taken"}
                        required
                      />
                    </div>
                    <p
                      id="auth-username-status"
                      aria-live="polite"
                      className={cn(
                        "mt-1.5 px-1 text-[11px]",
                        usernameStatus === "taken" || usernameStatus === "invalid"
                          ? "font-semibold text-destructive"
                          : usernameStatus === "free"
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground"
                      )}
                    >
                      {usernameStatus === "taken"
                        ? tx("Ce nom d'utilisateur est déjà utilisé.", "This username is already used.")
                        : usernameStatus === "free"
                          ? tx(`@${wanted} est libre.`, `@${wanted} is available.`)
                          : usernameStatus === "checking"
                            ? tx("Vérification…", "Checking…")
                            : usernameStatus === "invalid"
                              ? tx("3 à 24 caractères : lettres minuscules, chiffres ou _.", "3 to 24 characters: lowercase letters, digits or _.")
                              : tx(
                                  "Vous vous connecterez avec ce @nom ou votre email. Lettres minuscules, chiffres ou _.",
                                  "You'll sign in with this @name or your email. Lowercase letters, digits or _."
                                )}
                    </p>
                  </Field>
                  <Field id="auth-company" label={tx("Entreprise", "Company")}>
                    <input
                      id="auth-company"
                      className={INPUT}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      autoComplete="organization"
                      required
                    />
                  </Field>
                </>
              )}

              {mode !== "reset" && (
                <Field
                  id="auth-email"
                  label={
                    mode === "sign-in"
                      ? tx("Email ou nom d'utilisateur", "Email or username")
                      : mode === "sign-up"
                        ? tx("Email (connexion et mot de passe oublié)", "Email (to sign in and reset your password)")
                        : "Email"
                  }
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-5 top-1/2 mt-[3px] -translate-y-1/2 text-muted-foreground">
                      {mode === "sign-in" ? <AtSign className="h-[18px] w-[18px]" aria-hidden="true" /> : <Mail className="h-[18px] w-[18px]" aria-hidden="true" />}
                    </span>
                  <input
                    id="auth-email"
                    type={mode === "sign-in" ? "text" : "email"}
                    className={cn(INPUT, "pl-12")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete={mode === "sign-in" ? "username" : "email"}
                    inputMode={mode === "sign-in" ? undefined : "email"}
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={mode === "sign-in" ? tx("vous@entreprise.com ou @nom", "you@company.com or @name") : undefined}
                    required
                  />
                  </div>
                </Field>
              )}

              {mode !== "forgot" && (
                <Field
                  id="auth-password"
                  label={mode === "reset" ? tx("Nouveau mot de passe", "New password") : tx("Mot de passe", "Password")}
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-5 top-1/2 mt-[3px] -translate-y-1/2 text-muted-foreground">
                      <Lock className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      className={cn(INPUT, "pl-12 pr-14")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                      minLength={mode === "sign-in" ? undefined : MIN_PASSWORD}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? tx("Masquer le mot de passe", "Hide the password") : tx("Afficher le mot de passe", "Show the password")}
                      aria-pressed={showPassword}
                      className="absolute right-3.5 top-1/2 mt-[3px] -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  {mode !== "sign-in" && (
                    <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
                      {tx(`Au moins ${MIN_PASSWORD} caractères.`, `At least ${MIN_PASSWORD} characters.`)}
                    </p>
                  )}
                </Field>
              )}

              {mode === "sign-in" && (
                <button
                  type="button"
                  onClick={() => switchTo("forgot")}
                  className="-mt-1 self-end px-1.5 text-[13px] font-bold underline underline-offset-[3px] hover:no-underline"
                >
                  {tx("Mot de passe oublié ?", "Forgot your password?")}
                </button>
              )}

              {error && (
                <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
                  {error}
                </p>
              )}

              {notice && (
                <p role="status" className="rounded-2xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground">
                  {notice}
                </p>
              )}

              {mode === "sign-up" && (
                <label className="flex items-start gap-2.5 px-1 text-xs leading-relaxed text-muted-foreground">
                  <input
                    id="auth-terms"
                    type="checkbox"
                    data-testid="auth-terms"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]"
                  />
                  <span>
                    {tx("J'accepte les", "I accept the")}{" "}
                    <button type="button" data-testid="auth-terms-link" onClick={() => openLegal("terms")} className="font-semibold text-foreground underline underline-offset-2 hover:no-underline">
                      {tx("conditions d'utilisation", "terms of use")}
                    </button>{" "}
                    {tx("et la", "and the")}{" "}
                    <button type="button" data-testid="auth-privacy-link" onClick={() => openLegal("privacy")} className="font-semibold text-foreground underline underline-offset-2 hover:no-underline">
                      {tx("politique de confidentialité", "privacy policy")}
                    </button>
                    .
                  </span>
                </label>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex h-14 items-center justify-between rounded-full bg-brand pl-7 pr-2 text-[17px] font-extrabold text-[#141414] shadow-[0_14px_34px_rgb(160_200_20/0.4)] transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {button}
                <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[var(--ink)] text-brand">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </span>
              </button>

              {(mode === "forgot" || mode === "reset") && (
                <p className="text-center text-sm">
                  <button type="button" onClick={() => switchTo("sign-in")} className="font-bold underline underline-offset-2 hover:no-underline">
                    {tx("Retour à la connexion", "Back to sign in")}
                  </button>
                </p>
              )}
            </form>
          )}
            </section>
          </div>
        </main>

        {/* The slight line between the pitch and the form. */}
        <div
          aria-hidden="true"
          data-testid="auth-divider"
          className="hidden w-px self-stretch bg-gradient-to-b from-transparent via-foreground/15 to-transparent lg:order-2 lg:block"
        />

        {/* --------------------------------------------------- PITCH */}
        <aside className="order-2 flex flex-col px-5 pb-8 pt-2 lg:order-1 lg:w-[600px] lg:shrink-0 lg:p-0">
          <h2 className="font-heading text-[34px] font-semibold leading-[1.03] tracking-[-0.04em] sm:text-[44px] lg:text-[54px]">
            {tx("Voyez les problèmes avant ", "See problems before they ")}
            <span className="bg-[linear-gradient(transparent_64%,var(--brand)_64%,var(--brand)_92%,transparent_92%)] px-0.5">
              {tx("qu'ils ne coûtent.", "cost you.")}
            </span>
          </h2>
          <p className="mt-3.5 max-w-[37.5rem] text-base leading-relaxed text-muted-foreground lg:text-[17px]">
            {tx(
              "SentrIA lit vos données d'exploitation et vous dit quoi faire, et quand.",
              "SentrIA reads your operating data and tells you what to do, and when."
            )}
          </p>

          {/* The example alert, with two more peeking out beneath it (the
              carousel shows one per sector; examples, labelled as such). */}
          <div className="relative mb-9 mt-8 lg:mt-10">
            <span aria-hidden="true" className="absolute inset-x-[34px] -bottom-[30px] top-[30px] rounded-[34px] bg-[#2a4a38]/50" />
            <span aria-hidden="true" className="absolute inset-x-[17px] -bottom-[15px] top-[15px] rounded-[34px] bg-[#1f3d2e]/80" />
            <SectorShowcase
              tx={tx}
              className="relative w-full rounded-[34px] p-5 shadow-[0_24px_70px_rgb(20_20_18/0.28)] sm:p-7"
            />
          </div>

          <ul className="mt-3 grid grid-cols-3 gap-5 border-t border-border pt-5 lg:mt-5">
            {promises.map((title, index) => (
              <li key={title}>
                <span className="relative inline-block pb-2.5 font-heading text-[30px] font-light leading-none tabular-nums" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                  <span className="absolute bottom-0 left-0.5 h-[3px] w-5 rounded-full bg-brand" />
                </span>
                <p className="mt-2.5 text-sm font-bold leading-snug">{title}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <p className="relative z-10 px-5 pb-6 text-center text-xs text-muted-foreground lg:pb-5">
        <button type="button" data-testid="auth-footer-privacy" onClick={() => openLegal("privacy")} className="underline underline-offset-2 hover:text-foreground">
          {tx("Confidentialité", "Privacy")}
        </button>
        {" · "}
        <button type="button" data-testid="auth-footer-terms" onClick={() => openLegal("terms")} className="underline underline-offset-2 hover:text-foreground">
          {tx("Conditions", "Terms")}
        </button>
      </p>

      <LegalDialog open={legalOpen} doc={legalDoc} onClose={() => setLegalOpen(false)} />
    </div>
  )
}
