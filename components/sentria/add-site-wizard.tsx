"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Database, Upload, Wifi, X } from "@/lib/icons"
import { ACTIVITIES_BY_SECTOR, activityLabel, readSectors } from "@/lib/activities"
import { DEPARTMENT_GROUPS, atLeast, isAllowedCombo, type PlanId } from "@/lib/plans"
import { prioritiesFor, type Sector as PrioritySector } from "@/lib/priorities"
import { SOURCE_TYPES, type StoredSource } from "@/lib/sites"
import { resolve, useTx, type Localized } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { CsvTemplateLink } from "./csv-template-link"
import { SAMPLE_ALERTS, SECTORS, imageForActivity, imageForPriority } from "./onboarding-modal"
import { SectorBadge } from "./sector-badge"

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

/** One choice, as a card: the same shape on every step. */
function Tile({
  id,
  selected,
  disabled,
  onPick,
  art,
  icon: Icon,
  title,
  detail,
  badge,
  wide,
}: {
  id: string
  selected: boolean
  disabled?: boolean
  onPick: () => void
  /** The onboarding artwork for this choice, in the corner. */
  art?: string
  /** Fallback glyph when a choice has no artwork. */
  icon?: React.ElementType
  title: string
  detail?: string
  badge?: React.ReactNode
  /** The first of an odd number of tiles takes the whole row (the tile rule). */
  wide?: boolean
}) {
  return (
    <button
      type="button"
      data-testid={id}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onPick}
      className={cn(
        "relative flex min-h-[190px] flex-col justify-end overflow-hidden rounded-[28px] p-5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        wide && "sm:col-span-2",
        selected ? "bg-brand text-[#141414]" : "border border-border bg-card hover:-translate-y-0.5",
        disabled && "cursor-not-allowed opacity-50 hover:translate-y-0"
      )}
    >
      {art ? (
        <img
          src={art}
          alt=""
          className={cn("pointer-events-none absolute -bottom-2 -right-2 h-[68%] w-[46%] object-contain", !selected && "[filter:var(--art-filter)]")}
        />
      ) : Icon ? (
        <Icon className={cn("absolute bottom-5 right-5 h-14 w-14 stroke-[1.5]", !selected && "[filter:var(--art-filter)]")} aria-hidden="true" />
      ) : null}

      {badge && <span className="absolute left-5 top-5">{badge}</span>}

      {selected && (
        <span className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#141414] text-brand" aria-hidden="true">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      )}

      <span className="relative mt-auto block max-w-[58%]">
        <span className="block font-heading text-[18px] font-extrabold leading-tight tracking-tight">{title}</span>
        {detail && <span className={cn("mt-1 block text-[13px] leading-snug", selected ? "text-[#141414]/70" : "text-muted-foreground")}>{detail}</span>}
      </span>
    </button>
  )
}

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
    tx("Données", "Data"),
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

  const activityLabelFor = (sectorId: string, id: string) => activityLabel(sectorId, id, tx) ?? id
  const chosenSector = SECTORS.find((s) => s.id === sector)
  const sectorName = chosenSector ? px(chosenSector.label) : null
  const departmentCount = (id: string) => (ACTIVITIES_BY_SECTOR[id as keyof typeof ACTIVITIES_BY_SECTOR] ?? []).filter((a) => a.id !== "plusieurs-activites").length
  const sampleAlert = sector ? px(SAMPLE_ALERTS[sector as keyof typeof SAMPLE_ALERTS]) : null
  const priorityName = (id: string) => {
    const found = priorityList.find((p) => p.id === id)

    return found ? px(found.short ?? found.label) : id
  }
  const shownPriorities = priorities.length > 0 ? priorities : priorityList.slice(0, 3).map((p) => p.id)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-site-title"
        data-testid="add-site-wizard"
        className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-border bg-card shadow-2xl sm:max-h-[92vh] sm:max-w-5xl sm:rounded-[32px] md:h-[min(46rem,92vh)] md:grid md:grid-cols-[minmax(0,1fr)_340px] md:grid-rows-[minmax(0,1fr)]"
      >
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 sm:px-8 sm:pt-7">
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-border sm:hidden" aria-hidden="true" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="add-site-title" ref={heading} tabIndex={-1} className="font-heading text-xl font-extrabold tracking-tight outline-none sm:text-2xl">
                {tx("Ajouter un site", "Add a site")}
              </h3>
              <p className="mt-1 text-[13px] text-muted-foreground sm:text-sm" data-testid="add-site-step">
                {tx(`Étape ${step} sur ${last} · ${stepNames[step - 1]}`, `Step ${step} of ${last} · ${stepNames[step - 1]}`)}
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label={tx("Fermer", "Close")}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <ol className="mb-4 mt-4 flex items-center gap-1.5 sm:mt-5 md:gap-2" aria-hidden="true">
            {stepNames.map((label, index) => {
              const done = index + 1 < step
              const on = index + 1 === step

              return (
                <li
                  key={label}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-full md:justify-start md:px-3 md:py-2 md:text-[13px] md:font-semibold",
                    "h-1.5 md:h-auto",
                    on ? "bg-foreground text-background" : done ? "bg-foreground md:border md:border-border md:bg-card md:text-foreground" : "bg-border md:bg-muted md:text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "hidden h-[22px] w-[22px] items-center justify-center rounded-full text-xs md:flex",
                      on ? "bg-brand text-brand-foreground" : done ? "bg-foreground text-background" : "bg-border text-muted-foreground"
                    )}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className="hidden md:inline">{label}</span>
                </li>
              )
            })}
          </ol>

          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-3 pr-1">
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-[17px] font-bold">{tx("Comment s'appelle ce site ?", "What is this site called?")}</p>
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
                      "mt-2 min-h-12 w-full rounded-2xl border bg-background px-4 py-3 text-base outline-none transition-colors sm:text-sm",
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
                    className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none transition-colors focus:border-foreground sm:text-sm"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="mb-3 text-[17px] font-bold">{tx("Dans quel secteur travaille ce site ?", "Which industry does this site work in?")}</p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {SECTORS.map((item, index) => {
                    const count = departmentCount(item.id)

                    return (
                      <Tile
                        key={item.id}
                        wide={SECTORS.length % 2 === 1 && index === 0}
                        id={`add-site-sector-${item.id}`}
                        selected={sector === item.id}
                        disabled={locked(item.id)}
                        onPick={() => chooseSector(item.id)}
                        art={item.image}
                        title={px(item.label)}
                        detail={px(item.description)}
                        badge={
                          locked(item.id) ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">Entreprise</span>
                          ) : count > 0 ? (
                            <span className={cn("rounded-full px-2 py-0.5", sector === item.id ? "bg-foreground text-brand" : "bg-muted text-muted-foreground")}>
                              {tx(`${count} département${count > 1 ? "s" : ""}`, `${count} department${count > 1 ? "s" : ""}`)}
                            </span>
                          ) : null
                        }
                      />
                    )
                  })}
                </div>

                {!several && held.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {tx("Plusieurs secteurs dans un même compte : offre Entreprise.", "Several sectors in one account: Entreprise plan.")}
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <p className="text-[17px] font-bold">
                  {canMulti
                    ? tx("Cochez chaque département que ce site exploite.", "Tick every department this site runs.")
                    : tx("Choisissez le département le plus proche.", "Pick the closest department.")}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {departmentList.map((item, index) => (
                    <Tile
                      key={item.id}
                      wide={departmentList.length % 2 === 1 && index === 0}
                      id={`add-site-department-${item.id}`}
                      selected={departments.includes(item.id)}
                      onPick={() => chooseDepartment(item.id)}
                      art={imageForActivity(item.id)}
                      icon={item.icon}
                      title={px(item.label)}
                      detail={px(item.description)}
                    />
                  ))}
                </div>

                {!canMulti && departmentList.length > 1 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {tx("Plusieurs départements liés : offre Business.", "Several linked departments: Business plan.")}
                  </p>
                )}
              </div>
            )}

            {step === 4 && (
              <div>
                <p className="text-[17px] font-bold">{tx("Sélectionnez ce qui compte pour ce site.", "Select what matters for this site.")}</p>

                {priorityList.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">{tx("Rien à choisir pour ce secteur.", "Nothing to pick for this sector.")}</p>
                ) : (
                  <>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {tx(
                          `${priorities.length} sur ${priorityList.length} choisies`,
                          `${priorities.length} of ${priorityList.length} picked`
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid="add-site-priorities-all"
                          onClick={() => setPriorities(priorityList.map((item) => item.id))}
                          disabled={priorities.length === priorityList.length}
                          className="rounded-full bg-muted px-4 py-2 text-sm font-bold transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {tx("Tout sélectionner", "Select all")}
                        </button>
                        <button
                          type="button"
                          data-testid="add-site-priorities-none"
                          onClick={() => setPriorities([])}
                          disabled={priorities.length === 0}
                          className="rounded-full bg-muted px-4 py-2 text-sm font-bold transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {tx("Tout désélectionner", "Clear all")}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {priorityList.map((item, index) => (
                      <Tile
                        key={item.id}
                        wide={priorityList.length % 2 === 1 && index === 0}
                        id={`add-site-priority-${item.id}`}
                        selected={priorities.includes(item.id)}
                        onPick={() => setPriorities(toggle(priorities, item.id))}
                        art={imageForPriority(item.id)}
                        icon={item.icon}
                        title={px(item.short ?? item.label)}
                        detail={px(item.description)}
                      />
                    ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 5 && (
              <div>
                <p className="text-[17px] font-bold">{tx("Comment les données de ce site arriveront-elles ?", "How will this site's data arrive?")}</p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {SOURCES.map((item, index) => (
                    <Tile
                      key={item.type}
                      wide={SOURCES.length % 2 === 1 && index === 0}
                      id={`add-site-source-${item.type}`}
                      selected={wanted.includes(item.type)}
                      onPick={() => setWanted(toggle(wanted, item.type as string))}
                      icon={item.icon}
                      title={px(item.label)}
                      detail={px(item.description)}
                      badge={
                        item.live ? null : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{tx("Pas encore actif", "Not live yet")}</span>
                        )
                      }
                    />
                  ))}
                </div>

                {wanted.includes("csv") && (
                  <div className="mt-3 pl-1">
                    <CsvTemplateLink department={departments[0]} sector={sector} className="text-muted-foreground hover:text-foreground" />
                  </div>
                )}

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
            <p role="alert" data-testid="add-site-error" className="mb-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          {/* Phone: the preview shrinks to one line above the buttons. */}
          {sector && sectorName && (
            <p data-testid="add-site-preview-line" className="mb-2 flex items-center gap-2 rounded-2xl bg-sidebar px-3.5 py-2.5 text-[12.5px] text-sidebar-foreground md:hidden">
              <SectorBadge sector={sector} size="sm" />
              <span className="min-w-0 truncate">
                <b className="text-brand">{sectorName}</b>
                {departments.length > 0 && ` · ${departments.map((d) => activityLabelFor(sector, d)).join(", ")}`}
              </span>
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border py-3 sm:py-4">
            <button
              type="button"
              onClick={() => (step === 1 ? onCancel() : setStep(step - 1))}
              disabled={busy}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-5 text-sm font-bold transition-colors hover:bg-muted sm:flex-none"
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
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-6 text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-40 sm:flex-none"
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
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-6 text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:flex-none"
              >
                {busy ? tx("Création…", "Creating…") : tx("Créer le site", "Create the site")}
                {!busy && <Check className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>

        {/* The dashboard this site will get, as it takes shape. Black in every theme, like the other dark cards. */}
        <aside data-testid="add-site-preview" className="hidden min-h-0 flex-col gap-5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-sidebar p-7 text-sidebar-foreground md:flex" aria-label={tx("Aperçu du tableau de bord", "Dashboard preview")}>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/60">{tx("Votre nouveau tableau de bord", "Your new dashboard")}</p>

          <div>
            {sector && sectorName ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-3 py-1.5 text-[13px] font-bold text-brand">
                <SectorBadge sector={sector} size="sm" className="bg-transparent" />
                {sectorName}
              </span>
            ) : (
              <span className="text-sm text-sidebar-foreground/60">{tx("Choisissez un secteur", "Pick an industry")}</span>
            )}
            <h4 className="mt-2 truncate font-heading text-[22px] font-extrabold tracking-tight">{name.trim() || tx("Nouveau site", "New site")}</h4>
            {location.trim() && <p className="truncate text-sm text-sidebar-foreground/60">{location.trim()}</p>}
          </div>

          {sector && departmentList.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/60">
                {departments.length > 0 ? tx("Départements choisis", "Departments chosen") : tx("Départements possibles", "Departments you can run")}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {(departments.length > 0 ? departments : departmentList.map((d) => d.id)).map((id) => (
                  <span key={id} className={cn("rounded-full border px-3 py-1.5 text-[13px] font-semibold", departments.length > 0 ? "border-brand bg-brand text-brand-foreground" : "border-white/20")}>
                    {activityLabelFor(sector, id)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {sector && priorityList.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/60">
                {priorities.length > 0 ? tx("Ce qu'il surveille", "What it watches") : tx("Ce qu'il peut surveiller", "What it can watch")}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {shownPriorities.map((id) => (
                  <span key={id} className={cn("rounded-full border px-3 py-1.5 text-[13px] font-semibold", priorities.length > 0 ? "border-brand bg-brand text-brand-foreground" : "border-white/20")}>
                    {priorityName(id)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {step >= 5 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/60">{tx("Vos données", "Your data")}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {wanted.length === 0 ? (
                  <span className="text-sm text-sidebar-foreground/60">{tx("À configurer plus tard", "Set up later")}</span>
                ) : (
                  wanted.map((type) => (
                    <span key={type} className="rounded-full border border-white/20 px-3 py-1.5 text-[13px] font-semibold uppercase">
                      {type}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {sampleAlert && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/60">{tx("Une alerte que vous verrez", "An alert you will see")}</p>
              <div className="mt-2.5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-destructive/20 text-destructive" aria-hidden="true">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <p className="text-[13px] leading-[1.45] text-sidebar-foreground/90">{sampleAlert}</p>
              </div>
            </div>
          )}

          <p className="mt-auto text-[12.5px] leading-relaxed text-sidebar-foreground/60">
            {tx(
              "Seules les données de ce site s'affichent ici. Un autre site ne s'y mélange jamais. Vous pourrez changer le secteur plus tard.",
              "Only this site's data shows here. Another site never mixes with it. You can change the industry later."
            )}
          </p>
        </aside>
      </div>
    </div>
  )
}
