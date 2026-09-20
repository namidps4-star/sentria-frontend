"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Phone,
  Plus,
  Trash2,
  UserPlus,
  UserRound,
  XCircle,
  Zap,
} from "lucide-react"

import { useCompanyIdentity } from "@/lib/company"
import {
  AVAILABILITY_LABEL,
  createContractor,
  deactivateContractor,
  fetchContractors,
  updateContractor,
  type Availability,
  type Contractor,
} from "@/lib/crm"
import { cn } from "@/lib/utils"
import { useTx, type Localized, resolve } from "@/lib/i18n"
import type { ViewKey } from "./types"

/* --------------------------------------------------------------------------
 * The people who can be sent out, and whether they are free.
 *
 * This is the other half of the priorities board. The board could always
 * assign a task; there was simply nobody to assign it to, because the
 * contractor list had no source. This view is that source.
 *
 * Two facts sit side by side on every row and they are deliberately not
 * merged: what the person declared about themselves, and how many open
 * tasks they are actually carrying. "Disponible, 4 en cours" is the case
 * an administrator needs to see before handing over a fifth, and a single
 * combined status would hide it.
 * -------------------------------------------------------------------------- */

const AVAILABILITY_ORDER: Availability[] = ["available", "busy", "off"]

const AVAILABILITY_TONE: Record<Availability, string> = {
  available: "bg-accent/20 text-accent-foreground",
  busy: "bg-amber-500/15 text-amber-600",
  off: "bg-muted text-muted-foreground",
}

/** Same three states, read as a one-line status and a workload-bar color. */
const AVAILABILITY_ICON = {
  available: CheckCircle2,
  busy: Clock,
  off: XCircle,
} as const

const WORKLOAD_BAR_TONE: Record<Availability, string> = {
  available: "bg-accent",
  busy: "bg-amber-500",
  off: "bg-muted-foreground/40",
}

/** Grouping key for contractors with no `role` set. Never shown as-is. */
const NO_ROLE = "__no_role__"

function initialsOfPerson(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("")
}

export function ContractorsView({
  onNavigate,
}: {
  onNavigate?: (view: ViewKey) => void
}) {
  const { name: companyName } = useCompanyIdentity()

  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loaded, setLoaded] = useState(false)
  const tx = useTx()

  /** Resolve a module-level pair. */
  const px = (text: Localized | undefined) => resolve(text, tx)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
  })

  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [availabilityFilter, setAvailabilityFilter] =
    useState<Availability | null>(null)

  async function reload() {
    if (!companyName) {
      setLoaded(true)
      return
    }

    const result = await fetchContractors(companyName)

    if (result.ok) {
      setContractors(result.data)
      setError(null)
    } else {
      setError(px(result.detail))
    }

    setLoaded(true)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!companyName) {
        setLoaded(true)
        return
      }

      const result = await fetchContractors(companyName)

      if (cancelled) return

      if (result.ok) {
        setContractors(result.data)
        setError(null)
      } else {
        setError(px(result.detail))
      }

      setLoaded(true)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [companyName])

  async function submit() {
    if (!form.name.trim() || busy) return

    setBusy(true)

    const result = await createContractor(companyName, {
      name: form.name,
      role: form.role || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
    })

    setBusy(false)

    if (!result.ok) {
      setError(px(result.detail))
      return
    }

    setError(null)
    setForm({ name: "", role: "", phone: "", email: "" })
    setAdding(false)
    await reload()
  }

  async function setAvailability(
    contractor: Contractor,
    availability: Availability
  ) {
    if (busy || contractor.availability === availability) return

    /* Optimistic, then corrected by the reload. A rejected change is
       said out loud rather than left on screen looking applied. */
    setContractors((current) =>
      current.map((person) =>
        person.id === contractor.id ? { ...person, availability } : person
      )
    )

    const result = await updateContractor(contractor.id, { availability })

    if (!result.ok) {
      setError(px(result.detail))
    } else {
      setError(null)
    }

    await reload()
  }

  async function remove(contractor: Contractor) {
    if (busy) return

    setBusy(true)

    const result = await deactivateContractor(contractor.id)

    setBusy(false)

    if (!result.ok) {
      setError(px(result.detail))
      return
    }

    setError(null)
    await reload()
  }

  /* Without a company name there is no partition to read or write, and
     the API rejects the request. Saying so and pointing at Settings is
     more use than an empty list. */
  if (loaded && !companyName) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <UserRound
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <h2 className="mt-4 font-heading text-lg font-bold">
          {tx("Nom de l'entreprise manquant", "Company name missing")}
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {tx(
            "Les intervenants sont enregistrés sous le nom de votre entreprise. Renseignez-le pour commencer.",
            "Contractors are saved under your company name. Set it to get started."
          )}
        </p>

        <button
          type="button"
          onClick={() => onNavigate?.("settings")}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {tx("Ouvrir les Paramètres", "Open Settings")}
        </button>
      </div>
    )
  }

  const declaredAvailable = contractors.filter(
    (person) => person.availability === "available"
  ).length

  const carryingWork = contractors.filter(
    (person) => person.open_assignments > 0
  ).length

  /* Every role that actually appears, in first-seen order, so the filter
     pills never offer a choice nobody is on file under. */
  const roleKeys: string[] = []
  for (const person of contractors) {
    const key = person.role?.trim() || NO_ROLE
    if (!roleKeys.includes(key)) roleKeys.push(key)
  }

  const filteredContractors = contractors.filter((person) => {
    if (roleFilter !== null && (person.role?.trim() || NO_ROLE) !== roleFilter)
      return false
    if (availabilityFilter !== null && person.availability !== availabilityFilter)
      return false
    return true
  })

  const groups = new Map<string, Contractor[]>()
  for (const person of filteredContractors) {
    const key = person.role?.trim() || NO_ROLE
    const bucket = groups.get(key)
    if (bucket) bucket.push(person)
    else groups.set(key, [person])
  }

  /* The workload bar reads as "relative to the busiest person on file
     today," never as a fabricated percentage of a capacity nobody
     declared. */
  const maxOpenAssignments = Math.max(
    1,
    ...contractors.map((person) => person.open_assignments)
  )

  function filterPillClass(active: boolean) {
    return cn(
      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "bg-foreground text-background"
        : "bg-muted text-muted-foreground hover:bg-muted/70"
    )
  }

  return (
    <div className="space-y-6">
      {/* BANNER — same bg-sidebar / accent-pill / accent-CTA treatment as
          the Dashboard hero, for a consistent look across views. */}
      <div className="flex flex-col gap-4 rounded-3xl bg-sidebar p-6 text-sidebar-foreground md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Zap className="h-3.5 w-3.5" />
            {tx("Temps réel", "Live")}
          </span>

          <h2 className="mt-3 text-balance font-heading text-2xl font-bold leading-tight md:text-3xl">
            {tx(
              "Qui peut être envoyé maintenant ?",
              "Who can be sent out right now?"
            )}
          </h2>

          <p className="mt-2 text-pretty text-sm text-sidebar-foreground/70">
            {tx(
              "La disponibilité déclarée et la charge réelle de chacun, avant d'assigner une nouvelle tâche.",
              "Everyone's declared availability and real workload, before you hand out a new task."
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
        >
          {tx("Ajouter un intervenant", "Add a contractor")}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* HEADER */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {companyName || tx("Organisation", "Organisation")}
            </p>

            <h3 className="mt-1 font-heading text-2xl font-bold tracking-tight">
              {tx("Intervenants", "Contractors")}
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              {tx(
                "Qui peut être envoyé, et ce qu'ils portent déjà.",
                "Who can be sent out, and what they are already carrying."
              )}
            </p>
          </div>

          <div className="grid shrink-0 grid-cols-3 gap-3">
            <div className="flex min-w-[100px] flex-col items-center justify-center rounded-2xl bg-accent p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-accent-foreground/70">
                {tx("Enregistrés", "On file")}
              </p>
              <p className="mt-1 font-heading text-3xl font-black leading-none tabular-nums text-accent-foreground">
                {loaded ? contractors.length : "—"}
              </p>
            </div>

            <div className="flex min-w-[100px] flex-col items-center justify-center rounded-2xl bg-primary p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/50">
                {tx("Se disent dispo", "Say they are free")}
              </p>
              <p className="mt-1 font-heading text-3xl font-black leading-none tabular-nums text-primary-foreground">
                {loaded ? declaredAvailable : "—"}
              </p>
            </div>

            <div className="flex min-w-[100px] flex-col items-center justify-center rounded-2xl bg-primary p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/50">
                {tx("Avec du travail", "Carrying work")}
              </p>
              <p className="mt-1 font-heading text-3xl font-black leading-none tabular-nums text-primary-foreground">
                {loaded ? carryingWork : "—"}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-xs leading-5"
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {tx("Opération refusée.", "The operation was refused.")}
            </span>{" "}
            {error}
          </p>
        )}

        {/* ADD */}
        {adding ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
            className="mt-5 rounded-2xl border border-border bg-background p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tx("Nom", "Name")}
                </span>

                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder={tx("Ex. Kofi Adjoyi", "e.g. Kofi Adjoyi")}
                  autoComplete="name"
                  required
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tx("Fonction", "Role")}
                </span>

                <input
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value }))
                  }
                  placeholder={tx("Ex. Grutier", "e.g. Crane operator")}
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tx("Téléphone", "Phone")}
                </span>

                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+229 90 00 00 00"
                  autoComplete="tel"
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tx("Email", "Email")}
                </span>

                <input
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder={tx("nom@exemple.com", "name@example.com")}
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring"
                />
              </label>
            </div>

            <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
              {tx(
                "L'API SentrIA n'a pas d'authentification. Ne mettez ici que des coordonnées que vous accepteriez de voir lues par un tiers.",
                "The SentrIA API has no authentication. Only put contact details here that you would accept a stranger reading."
              )}
            </p>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="submit"
                disabled={!form.name.trim() || busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {tx("Enregistrer", "Save")}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setForm({ name: "", role: "", phone: "", email: "" })
                }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {tx("Annuler", "Cancel")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {tx("Ajouter un intervenant", "Add a contractor")}
          </button>
        )}
      </div>

      {/* LIST */}
      {!loaded ? (
        <p className="rounded-3xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          {tx("Chargement des intervenants…", "Loading contractors…")}
        </p>
      ) : contractors.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <UserPlus
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <h2 className="mt-4 font-heading text-lg font-bold">
            {tx("Aucun intervenant", "No contractor")}
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {tx(
              "Tant que personne n'est enregistré, le menu d'assignation du tableau des priorités reste vide et les cartes ne peuvent être confiées à personne.",
              "While nobody is on file, the assign menu on the priorities board stays empty and no card can be handed to anyone."
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* FILTERS — only the fields the CRM actually has. */}
          <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-border bg-card p-4">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {tx("Fonction", "Role")}
            </span>
            <button
              type="button"
              onClick={() => setRoleFilter(null)}
              className={filterPillClass(roleFilter === null)}
            >
              {tx("Toutes", "All")}
            </button>
            {roleKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRoleFilter(key)}
                className={filterPillClass(roleFilter === key)}
              >
                {key === NO_ROLE
                  ? tx("Sans fonction", "No role")
                  : key}
              </button>
            ))}

            <span className="mx-1 h-5 w-px shrink-0 bg-border" />

            <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {tx("Disponibilité", "Availability")}
            </span>
            <button
              type="button"
              onClick={() => setAvailabilityFilter(null)}
              className={filterPillClass(availabilityFilter === null)}
            >
              {tx("Toutes", "All")}
            </button>
            {AVAILABILITY_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAvailabilityFilter(value)}
                className={filterPillClass(availabilityFilter === value)}
              >
                {px(AVAILABILITY_LABEL[value])}
              </button>
            ))}
          </div>

          {groups.size === 0 ? (
            <p className="rounded-3xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              {tx(
                "Aucun intervenant ne correspond à ces filtres.",
                "No contractor matches these filters."
              )}
            </p>
          ) : (
            Array.from(groups.entries()).map(([key, people]) => (
              <div key={key}>
                <div className="mb-3 flex items-center gap-2">
                  <h4 className="font-heading text-sm font-bold uppercase tracking-wide text-foreground">
                    {key === NO_ROLE
                      ? tx("Sans fonction", "No role set")
                      : key}
                  </h4>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                    {people.length}
                  </span>
                </div>

                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {people.map((person) => {
                    const StatusIcon = AVAILABILITY_ICON[person.availability]
                    const barPct = Math.round(
                      (person.open_assignments / maxOpenAssignments) * 100
                    )

                    return (
                      <li
                        key={person.id}
                        className="rounded-3xl border border-border bg-card p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-xs font-bold text-background">
                              {initialsOfPerson(person.name) || (
                                <UserRound className="h-4 w-4" aria-hidden="true" />
                              )}
                            </span>

                            <div className="min-w-0">
                              <p className="truncate font-heading text-base font-bold">
                                {person.name}
                              </p>

                              <p className="truncate text-sm text-muted-foreground">
                                {person.role ||
                                  tx("Fonction non renseignée", "No role set")}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => remove(person)}
                            aria-label={tx(
                              `Retirer ${person.name}`,
                              `Remove ${person.name}`
                            )}
                            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>

                        {(person.phone || person.email) && (
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                            {person.phone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3" aria-hidden="true" />
                                {person.phone}
                              </span>
                            )}

                            {person.email && (
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Mail
                                  className="h-3 w-3 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate">{person.email}</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Workload, scaled against the busiest person on
                            file today — not a fixed capacity nobody
                            declared. */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <span>{tx("Charge", "Workload")}</span>
                            <span className="tabular-nums text-foreground">
                              {tx(
                                `${person.open_assignments} en cours`,
                                `${person.open_assignments} open`
                              )}
                            </span>
                          </div>

                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                WORKLOAD_BAR_TONE[person.availability]
                              )}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>

                        {/* One-line status: what they wrote, or what they
                            declared. */}
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <StatusIcon
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {person.note || px(AVAILABILITY_LABEL[person.availability])}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center gap-1 border-t border-border pt-4">
                          <div
                            className="flex items-center gap-1"
                            role="group"
                            aria-label={tx(
                              `Disponibilité de ${person.name}`,
                              `${person.name}'s availability`
                            )}
                          >
                            {AVAILABILITY_ORDER.map((value) => {
                              const active = person.availability === value

                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setAvailability(person, value)}
                                  aria-pressed={active}
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active
                                      ? AVAILABILITY_TONE[value]
                                      : "text-muted-foreground hover:bg-muted"
                                  )}
                                >
                                  {px(AVAILABILITY_LABEL[value]) || value}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* The disagreement worth seeing, stated rather
                            than left for the reader to spot. */}
                        {person.availability === "available" &&
                          person.open_assignments > 0 && (
                            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                              {tx(
                                `Se dit disponible tout en portant ${
                                  person.open_assignments
                                } tâche${
                                  person.open_assignments > 1 ? "s" : ""
                                } ouverte${
                                  person.open_assignments > 1 ? "s" : ""
                                }.`,
                                `Says available while carrying ${
                                  person.open_assignments
                                } open task${
                                  person.open_assignments > 1 ? "s" : ""
                                }.`
                              )}
                            </p>
                          )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
