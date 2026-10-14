"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Database, Upload, Wifi, X } from "@/lib/icons"
import { ACTIVITIES_BY_SECTOR, readSectors } from "@/lib/activities"
import { DEPARTMENT_GROUPS, atLeast, isAllowedCombo, type PlanId } from "@/lib/plans"
import { prioritiesFor, type Sector as PrioritySector } from "@/lib/priorities"
import { SOURCE_TYPES, type StoredSource } from "@/lib/sites"
import { resolve, useTx, type Localized } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { CsvTemplateLink } from "./csv-template-link"
import { SECTORS } from "./onboarding-modal"

type Choice = { sector: string; departments: string[]; priorities: string[]; sources: StoredSource[] }

export type WizardResult = {
  name: string
  location: string
  sector: Choice["sector"]
  departments: string[]
  priorities: string[]
  sources: StoredSource[]
}

const SOURCES: { type: (typeof SOURCE_TYPES)[number]; label: Localized; description: Localized; icon: React.ElementType; live: boolean }[] = [
  {
    type: "csv",
    label: { fr: "CSV / Excel", en: "CSV / Excel" },
    description: { fr: "Importez vos fichiers : le plus simple pour commencer.", en: "Import your files: the simple way to start." },
    icon: Upload,
    live: true,
  },
  {
    type: "api",
    label: { fr: "API", en: "API" },
    description: { fr: "Votre système envoie les données à SentrIA.", en: "Your system sends the data to SentrIA." },
    icon: Database,
    live: false,
  },
  {
    type: "erp",
    label: { fr: "ERP", en: "ERP" },
    description: { fr: "Odoo, SAP ou autre logiciel de gestion.", en: "Odoo, SAP or another management system." },
    icon: Database,
    live: false,
  },
  {
    type: "iot",
    label: { fr: "IoT / Capteurs", en: "IoT / Sensors" },
    description: { fr: "Lectures de vos équipements.", en: "Readings from your equipment." },
    icon: Wifi,
    live: false,
  },
]

/** "Add a site" (F-SITESCOPE): the onboarding's choices, for one more site.
 *  A name and a place, then its sector, its departments (several where the
 *  plan lets a sector run them together), what it monitors, and how its data
 *  will arrive. Nothing here connects an API or an ERP by itself: the choice is
 *  kept, and CSV is the way in that works now. */
export function AddSiteWizard({
  plan,
  heldSectors,
  busy,
  error,
  onCancel,
  onCreate,
}: {
  plan: PlanId
  /** Sectors the company's sites already use. */
  heldSectors: string[]
  busy: boolean
  error: string | null
  onCancel: () => void
  onCreate: (result: WizardResult) => void
}) {
  const tx = useTx()
  const px = (text: Localized | undefined) => resolve(text, tx)

  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [sector, setSector] = useState<string | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [priorities, setPriorities] = useState<string[]>([])
  const [wanted, setWanted] = useState<string[]>(["csv"])
  const [nameInvalid, setNameInvalid] = useState(false)

  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    heading.current?.focus()
  }, [step])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel()
    }

    document.addEventListener("keydown", onKey)

    return () => document.removeEventListener("keydown", onKey)
  }, [busy, onCancel])

  // The sectors the account already runs (onboarding and sites). A plan that
  // holds one sector keeps to them.
  const held = useMemo(() => Array.from(new Set([...heldSectors, ...readSectors()])), [heldSectors])
  const several = atLeast(plan, "entreprise")
  const locked = (id: string) => !several && held.length > 0 && !held.includes(id)

  const departmentList = useMemo(
    () => (sector ? (ACTIVITIES_BY_SECTOR[sector as keyof typeof ACTIVITIES_BY_SECTOR] ?? []).filter((a) => a.id !== "plusieurs-activites") : []),
    [sector]
  )
  const canMulti = atLeast(plan, "business") && Boolean(sector && DEPARTMENT_GROUPS[sector as keyof typeof DEPARTMENT_GROUPS])

  const priorityList = useMemo(
    () => (sector ? prioritiesFor(sector as PrioritySector, departments[0] ?? null).filter((p) => !p.comingSoon) : []),
    [sector, departments]
  )

  function chooseSector(id: string) {
    if (locked(id)) return

    setSector(id)
    setDepartments([])
    setPriorities([])
  }

  function chooseDepartment(id: string) {
    if (!canMulti) {
      setDepartments([id])
      return
    }

    setDepartments((current) => {
      if (current.includes(id)) return current.filter((d) => d !== id)

      return several || isAllowedCombo(sector ?? "", [...current, id]) ? [...current, id] : [id]
    })
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  // Priorities that the chosen departments no longer offer drop out.
  useEffect(() => {
    const offered = new Set(priorityList.map((p) => p.id))
    setPriorities((current) => {
      const kept = current.filter((id) => offered.has(id))

      return kept.length === current.length ? current : kept
    })
  }, [priorityList])

  const stepNames = [
    tx("Le site", "The site"),
    tx("Secteur", "Sector"),
    tx("Département", "Department"),
    tx("Priorités", "Priorities"),
    tx("Vos données", "Your data"),
  ]
  const last = stepNames.length

  const canNext =
    step === 1 ? name.trim().length > 0 : step === 2 ? sector !== null : step === 3 ? departments.length > 0 || departmentList.length === 0 : true

  function next() {
    if (step === 1 && !name.trim()) {
      setNameInvalid(true)
      return
    }

    if (!canNext) return

    if (step < last) setStep(step + 1)
  }

  function create() {
    if (!sector || !name.trim()) return

    onCreate({
      name: name.trim(),
      location: location.trim(),
      sector,
      departments,
      priorities,
      sources: SOURCE_TYPES.map((type) => ({ type, wanted: wanted.includes(type), connected: false, synced: false })),
    })
  }

  const chosenSector = SECTORS.find((s) => s.id === sector)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-site-title"
        data-testid="add-site-wizard"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="add-site-title" ref={heading} tabIndex={-1} className="font-heading text-xl font-bold outline-none">
              {tx("Ajouter un site", "Add a site")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="add-site-step">
              {tx(`Étape ${step} sur ${last} · ${stepNames[step - 1]}`, `Step ${step} of ${last} · ${stepNames[step - 1]}`)}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            aria-label={tx("Fermer", "Close")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <ol className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {stepNames.map((label, index) => (
            <li key={label} className={cn("h-1.5 flex-1 rounded-full", index + 1 <= step ? "bg-foreground" : "bg-muted")} />
          ))}
        </ol>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="add-site-name" className="text-sm font-semibold">
                  {tx("Nom du site", "Site name")}
                </label>
                <input
                  id="add-site-name"
                  data-testid="add-site-name"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (e.target.value.trim()) setNameInvalid(false)
                  }}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  placeholder={tx("Ex. Usine Lyon", "e.g. Lyon plant")}
                  aria-invalid={nameInvalid}
                  className={cn(
                    "mt-2 w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition-colors",
                    nameInvalid ? "border-destructive" : "border-border focus:border-foreground"
                  )}
                />
                {nameInvalid && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                    {tx("Un site doit avoir un nom.", "A site needs a name.")}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="add-site-place" className="text-sm font-semibold">
                  {tx("Localisation", "Location")}
                </label>
                <input
                  id="add-site-place"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={tx("Ex. Lyon, France", "e.g. Lyon, France")}
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-muted-foreground">
                {tx("Dans quel secteur travaille ce site ?", "Which sector does this site work in?")}
              </p>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {SECTORS.map((item) => {
                  const Icon = item.icon
                  const isLocked = locked(item.id)
                  const active = sector === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`add-site-sector-${item.id}`}
                      disabled={isLocked}
                      aria-pressed={active}
                      onClick={() => chooseSector(item.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                        active ? "border-foreground bg-accent/20" : "border-border hover:bg-muted",
                        isLocked && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{px(item.label)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{px(item.description)}</span>
                      </span>
                      {isLocked && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">Entreprise</span>
                      )}
                      {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>

              {!several && held.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {tx(
                    "Plusieurs secteurs dans un même compte : offre Entreprise.",
                    "Several sectors in one account: Entreprise plan."
                  )}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-sm text-muted-foreground">
                {canMulti
                  ? tx("Cochez chaque département que ce site exploite.", "Tick every department this site runs.")
                  : tx("Choisissez le département le plus proche.", "Pick the closest department.")}
              </p>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {departmentList.map((item) => {
                  const Icon = item.icon
                  const active = departments.includes(item.id)

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`add-site-department-${item.id}`}
                      aria-pressed={active}
                      onClick={() => chooseDepartment(item.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                        active ? "border-foreground bg-accent/20" : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{px(item.label)}</span>
                        <span className="block text-xs text-muted-foreground">{px(item.description)}</span>
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>

              {!canMulti && departmentList.length > 1 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {tx(
                    "Plusieurs départements liés : offre Business.",
                    "Several linked departments: Business plan."
                  )}
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-sm text-muted-foreground">
                {tx("Sélectionnez ce qui compte pour ce site.", "Select what matters for this site.")}
              </p>

              {priorityList.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{tx("Rien à choisir pour ce secteur.", "Nothing to pick for this sector.")}</p>
              ) : (
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {priorityList.map((item) => {
                    const Icon = item.icon
                    const active = priorities.includes(item.id)

                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`add-site-priority-${item.id}`}
                        aria-pressed={active}
                        onClick={() => setPriorities(toggle(priorities, item.id))}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                          active ? "border-foreground bg-accent/20" : "border-border hover:bg-muted"
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{px(item.short ?? item.label)}</span>
                          <span className="block text-xs text-muted-foreground">{px(item.description)}</span>
                        </span>
                        {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="text-sm text-muted-foreground">
                {tx("Comment les données de ce site arriveront-elles ?", "How will this site's data arrive?")}
              </p>

              <div className="mt-3 space-y-2.5">
                {SOURCES.map((item) => {
                  const Icon = item.icon
                  const active = wanted.includes(item.type)

                  return (
                    <div key={item.type}>
                      <button
                        type="button"
                        data-testid={`add-site-source-${item.type}`}
                        aria-pressed={active}
                        onClick={() => setWanted(toggle(wanted, item.type as string))}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                          active ? "border-foreground bg-accent/20" : "border-border hover:bg-muted"
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{px(item.label)}</span>
                          <span className="block text-xs text-muted-foreground">{px(item.description)}</span>
                        </span>
                        {!item.live && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {tx("Pas encore actif", "Not live yet")}
                          </span>
                        )}
                        {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      </button>

                      {item.type === "csv" && active && (
                        <div className="mt-1.5 pl-3">
                          <CsvTemplateLink department={departments[0]} sector={sector} className="text-muted-foreground hover:text-foreground" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {wanted.some((t) => t !== "csv") && (
                <p data-testid="add-site-not-live" className="mt-3 text-xs text-muted-foreground">
                  {tx(
                    "L'API, l'ERP et les capteurs ne se connectent pas encore tout seuls : votre choix est gardé, et l'import CSV fonctionne dès maintenant.",
                    "API, ERP and sensors do not connect by themselves yet: your choice is kept, and CSV import works now."
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" data-testid="add-site-error" className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => (step === 1 ? onCancel() : setStep(step - 1))}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {step === 1 ? tx("Annuler", "Cancel") : tx("Retour", "Back")}
          </button>

          {step < last ? (
            <button
              type="button"
              data-testid="add-site-next"
              onClick={next}
              disabled={!canNext && step !== 1}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {tx("Continuer", "Continue")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              data-testid="add-site-create"
              onClick={create}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-[#141414] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? tx("Création…", "Creating…") : tx("Créer le site", "Create the site")}
              {chosenSector && !busy ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
