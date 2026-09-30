"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  ArrowRight,
  BellRing,
  Eye,
  EyeOff,
  ListChecks,
  Loader2,
  ShieldCheck,
} from "@/lib/icons"
import type { AuthError } from "@supabase/supabase-js"

import { API_BASE } from "@/lib/api"
import { useLocale, writeLanguage } from "@/lib/locale"
import { useTx, type Tx } from "@/lib/i18n"
import { missingSupabaseEnv, supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

import { SectorShowcase } from "./sector-showcase"

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
    case "user_already_exists":
    case "email_exists":
      return tx(
        "Un compte existe déjà avec cet email. Connectez-vous.",
        "An account already exists with this email. Sign in instead."
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
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      {children}
    </div>
  )
}

/* Glossy pill fields: a soft inset shade with a light lower edge, and a
   lime glow when focused (the black underline read as a hard line). */
const INPUT =
  "mt-1.5 block w-full rounded-2xl border border-transparent bg-muted px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/70 shadow-[inset_0_1px_2px_rgb(0_0_0/0.07),0_1px_0_var(--field-hi)] transition-[background-color,border-color,box-shadow] focus:border-brand focus:bg-card focus:outline-none focus:ring-4 focus:ring-brand/30"

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
            data: { full_name: name.trim(), company_name: company.trim(), username: wanted },
          },
        })
        // The database refuses a username taken in the meantime; Supabase
        // reports it as "Database error saving new user".
        if (error && /database error saving new user/i.test(error.message ?? "")) {
          setUsernameStatus("taken")
          setError(tx("Ce nom d'utilisateur vient d'être pris. Choisissez-en un autre.", "This username was just taken. Choose another one."))
          return
        }
        if (error) throw error

        if (!data.session) {
          // Email confirmation is on: nothing to do until they click.
          setNotice(
            tx(
              `Compte créé. Ouvrez l'email envoyé à ${email.trim()} et cliquez sur le lien pour l'activer.`,
              `Account created. Open the email sent to ${email.trim()} and click the link to activate it.`
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

  const features = [
    {
      icon: BellRing,
      title: tx("Alertes en temps réel", "Real-time alerts"),
      body: tx(
        "Stocks, machines, flux : prévenu avant la panne ou la rupture.",
        "Stock, machines, flows: warned before a breakdown or a stock-out."
      ),
    },
    {
      icon: ShieldCheck,
      title: tx("Vos données restent les vôtres", "Your data stays yours"),
      body: tx(
        "Chaque entreprise ne voit que ses propres données.",
        "Each company sees its own data, and only its own."
      ),
    },
    {
      icon: ListChecks,
      title: tx("Des actions, pas juste des chiffres", "Actions, not just numbers"),
      body: tx(
        "Chaque alerte dit quoi faire, à qui, et suit le résultat.",
        "Every alert says what to do, who does it, and tracks it."
      ),
    },
  ]

  /* The Ask SentrIA layout: lime card (who we are, what we do), white card
     (the form, introduced like a chat), black card (an example alert).
     Glossy cards floating on the canvas instead of one outlined frame. */
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top_left,var(--auth-glow)_0%,transparent_55%),radial-gradient(ellipse_at_bottom_right,var(--auth-glow)_0%,transparent_60%)] bg-[var(--auth-bg)] px-4 py-8">
      <main className="grid w-full max-w-[1240px] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        {/* --------------------------------------------------------- LEFT */}
        <div className="flex flex-col gap-4">
          <section className="gloss rounded-[28px] bg-brand p-6 text-[#141414]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)]">
                  <img src="/logo-mark.png" alt="" className="h-7 w-7 object-contain" />
                </span>
                <span className="font-heading text-xl font-bold">SentrIA</span>
              </div>

              <div
                className="flex items-center rounded-full bg-white/60 p-0.5 text-xs"
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
                      "rounded-full px-3 py-1.5 font-semibold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]",
                      ui === code ? "bg-[var(--ink)] text-white" : "text-[#141414]/70 hover:text-[#141414]"
                    )}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-6 font-heading text-2xl font-bold leading-tight md:text-3xl">
              {tx("Voyez les problèmes avant qu'ils ne coûtent.", "See problems before they cost you.")}
            </p>
            <p className="mt-2 text-sm text-[#141414]/70">
              {tx(
                "SentrIA lit vos données d'exploitation et vous dit quoi faire, et quand.",
                "SentrIA reads your operating data and tells you what to do, and when."
              )}
            </p>
          </section>

          {/* Three promises, as rows. */}
          <section className="gloss hidden rounded-[28px] bg-card p-5 md:block">
            <ul className="flex flex-col gap-2">
              {features.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-3 rounded-2xl bg-muted p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-snug tracking-tight">{title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ------------------------------------------------------- CENTER */}
        <section className="gloss flex flex-col justify-center rounded-[28px] bg-card p-6 md:p-10">
          <h1 className="font-heading text-3xl font-bold leading-tight md:text-5xl">
            {heading}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-brand ring-2 ring-brand/30" aria-hidden="true" />
            {tx("Connexion sécurisée", "Secure sign-in")}
          </p>

          {mode === "sign-in" && (
            <p className="mt-5 max-w-md self-start rounded-[22px] bg-[var(--ink)] p-4 text-sm leading-relaxed text-white">
              {tx(
                "Bonjour. Connectez-vous avec votre email ou votre @nom d'utilisateur.",
                "Hello. Sign in with your email or your @username."
              )}
            </p>
          )}

          {mode === "forgot" && (
            <p className="mt-3 text-sm text-muted-foreground">
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
            <form onSubmit={submit} className="mt-6 flex w-full flex-col gap-4" noValidate>
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
                              : tx("Lettres minuscules, chiffres ou _.", "Lowercase letters, digits or _.")}
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
                  label={mode === "sign-in" ? tx("Email ou nom d'utilisateur", "Email or username") : "Email"}
                >
                  <input
                    id="auth-email"
                    type={mode === "sign-in" ? "text" : "email"}
                    className={INPUT}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete={mode === "sign-in" ? "username" : "email"}
                    inputMode={mode === "sign-in" ? undefined : "email"}
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={mode === "sign-in" ? tx("vous@entreprise.com ou @nom", "you@company.com or @name") : undefined}
                    required
                  />
                </Field>
              )}

              {mode !== "forgot" && (
                <Field
                  id="auth-password"
                  label={mode === "reset" ? tx("Nouveau mot de passe", "New password") : tx("Mot de passe", "Password")}
                >
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      className={cn(INPUT, "pr-12")}
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="-mt-1 self-end px-1 text-xs font-semibold underline underline-offset-2 hover:no-underline"
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

              <button
                type="submit"
                disabled={busy}
                className="gloss mt-2 flex h-14 items-center justify-between rounded-full bg-brand pl-6 pr-2 text-base font-bold text-[#141414] transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {button}
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </span>
              </button>

              {mode !== "reset" && (
                <p className="text-center text-sm">
                  {mode === "sign-in" ? (
                    <>
                      {tx("Pas encore de compte ?", "No account yet?")}{" "}
                      <button type="button" onClick={() => switchTo("sign-up")} className="font-bold underline underline-offset-2 hover:no-underline">
                        {tx("Créer un compte", "Create one")}
                      </button>
                    </>
                  ) : (
                    <>
                      {mode === "sign-up" ? tx("Déjà un compte ?", "Already have an account?") : null}{" "}
                      <button type="button" onClick={() => switchTo("sign-in")} className="font-bold underline underline-offset-2 hover:no-underline">
                        {mode === "sign-up" ? tx("Se connecter", "Sign in") : tx("Retour à la connexion", "Back to sign in")}
                      </button>
                    </>
                  )}
                </p>
              )}
            </form>
          )}
        </section>

        {/* -------------------------------------------------------- RIGHT */}
        {/* What SentrIA says, sector by sector: examples, labelled as such. */}
        <SectorShowcase tx={tx} className="gloss hidden md:col-span-2 md:flex lg:col-span-1 lg:self-stretch" />
      </main>
    </div>
  )
}
