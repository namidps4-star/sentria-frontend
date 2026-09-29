"use client"

import { useState, type KeyboardEvent } from "react"
import {
  ArrowRight,
  Factory,
  HeartPulse,
  Pause,
  Play,
  ShoppingBasket,
  Ship,
  Sprout,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { Tx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { SeverityTag } from "./status-tag"

type Example = {
  id: string
  icon: LucideIcon
  sector: [string, string]
  department: [string, string]
  severity: "CRITICAL" | "WARNING"
  figure: [string, string]
  figureCaption: [string, string]
  title: [string, string]
  action: [string, string]
}

/** One made-up alert per sector, shown as an example of what SentrIA
 *  says. Labelled "Example" on screen: no real company's data. */
const EXAMPLES: Example[] = [
  {
    id: "health",
    icon: HeartPulse,
    sector: ["Santé", "Health"],
    department: ["Pharmacie", "Pharmacy"],
    severity: "CRITICAL",
    figure: ["3 j", "3 d"],
    figureCaption: ["avant la rupture", "before stock-out"],
    title: ["Paracétamol 500 mg : rupture dans 3 jours", "Paracetamol 500 mg: out of stock in 3 days"],
    action: ["Commandez 120 boîtes aujourd'hui : votre fournisseur livre en 5 jours.", "Order 120 boxes today: your supplier delivers in 5 days."],
  },
  {
    id: "industry",
    icon: Factory,
    sector: ["Industrie", "Industry"],
    department: ["Production", "Production"],
    severity: "CRITICAL",
    figure: ["212 min", "212 min"],
    figureCaption: ["d'usure, limite 200", "tool wear, limit 200"],
    title: ["Presse n° 4 : outil usé au-delà de sa limite", "Press no. 4: tool worn past its limit"],
    action: ["Changez l'outil à l'équipe de ce soir, avant qu'une casse n'arrête la ligne.", "Change the tool on tonight's shift, before a breakdown stops the line."],
  },
  {
    id: "logistics",
    icon: Ship,
    sector: ["Logistique", "Logistics"],
    department: ["Port", "Port"],
    severity: "WARNING",
    figure: ["6 j", "6 d"],
    figureCaption: ["au terminal", "at the terminal"],
    title: ["Conteneur MSKU 4810 : bloqué depuis 6 jours", "Container MSKU 4810: stuck for 6 days"],
    action: ["Relancez le transitaire aujourd'hui : les frais de stockage démarrent demain.", "Chase the forwarder today: storage charges start tomorrow."],
  },
  {
    id: "commerce",
    icon: ShoppingBasket,
    sector: ["Commerce", "Retail"],
    department: ["Supermarché", "Supermarket"],
    severity: "WARNING",
    figure: ["×3", "×3"],
    figureCaption: ["de ventes cette semaine", "sales this week"],
    title: ["Riz 25 kg : se vend 3 fois plus vite que d'habitude", "Rice 25 kg: selling 3 times faster than usual"],
    action: ["Sortez 40 sacs du dépôt avant samedi pour ne pas vider le rayon.", "Bring 40 bags out of the depot before Saturday so the shelf stays full."],
  },
  {
    id: "agriculture",
    icon: Sprout,
    sector: ["Agriculture", "Agriculture"],
    department: ["Exploitation", "Farm"],
    severity: "WARNING",
    figure: ["−40 %", "−40%"],
    figureCaption: ["de pluie ce mois-ci", "rain this month"],
    title: ["Maïs, parcelle B : pluies très en dessous de la normale", "Maize, plot B: rain far below normal"],
    action: ["Irriguez la parcelle B en premier : elle fleurit dans deux semaines.", "Water plot B first: it flowers in two weeks."],
  },
  {
    id: "energy",
    icon: Zap,
    sector: ["Énergie", "Energy"],
    department: ["Solaire", "Solar"],
    severity: "WARNING",
    figure: ["−18 %", "−18%"],
    figureCaption: ["vs les onduleurs voisins", "vs the other inverters"],
    title: ["Onduleur 2 : produit moins que les autres", "Inverter 2: producing less than the others"],
    action: ["Nettoyez ou contrôlez l'onduleur 2 : environ 34 kWh perdus par jour.", "Clean or check inverter 2: about 34 kWh lost a day."],
  },
]

/** The login page's example alerts: one per sector, 6 s each. Pauses on
 *  hover, on focus and on request; never moves with reduced motion. */
export function SectorShowcase({ tx, className }: { tx: Tx; className?: string }) {
  const [index, setIndex] = useState(0)
  const [stopped, setStopped] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const paused = stopped || hovered || focused
  const t = (pair: [string, string]) => tx(pair[0], pair[1])
  const current = EXAMPLES[index]
  const Icon = current.icon

  const go = (next: number) => setIndex((next + EXAMPLES.length) % EXAMPLES.length)

  // From the tab that has focus (the selected one, unless clicked away).
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, from: number) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    let next: number | null = null
    if (event.key in moves) next = (from + moves[event.key] + EXAMPLES.length) % EXAMPLES.length
    if (event.key === "Home") next = 0
    if (event.key === "End") next = EXAMPLES.length - 1
    if (next === null) return
    event.preventDefault()
    go(next)
    document.getElementById(`showcase-tab-${EXAMPLES[next].id}`)?.focus()
  }

  return (
    <section
      aria-roledescription={tx("carrousel", "carousel")}
      aria-label={tx("Exemples d'alertes par secteur", "Example alerts by sector")}
      className={cn(
        "relative overflow-hidden rounded-[28px] bg-[#141414] p-5 text-white shadow-xl ring-1 ring-black/5 dark:ring-white/10",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      {/* A soft lime glow behind the figure. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/25 blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
          {tx("Exemple d'alerte", "Example alert")}
        </p>
        <button
          type="button"
          onClick={() => setStopped((value) => !value)}
          aria-label={stopped ? tx("Reprendre le défilement", "Resume the slideshow") : tx("Mettre en pause", "Pause the slideshow")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {stopped ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>

      {/* Sectors */}
      <div
        role="tablist"
        aria-label={tx("Secteurs", "Sectors")}
        className="relative mt-4 flex flex-wrap gap-1.5"
      >
        {EXAMPLES.map((example, i) => {
          const TabIcon = example.icon
          const active = i === index
          return (
            <button
              key={example.id}
              id={`showcase-tab-${example.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="showcase-panel"
              tabIndex={active ? 0 : -1}
              title={t(example.sector)}
              onClick={() => go(i)}
              onKeyDown={(event) => onTabKey(event, i)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                active
                  ? "bg-brand px-3.5 text-[#141414]"
                  : "w-9 justify-center bg-white/[0.07] text-white/70 hover:bg-white/15 hover:text-white"
              )}
            >
              <TabIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className={active ? "" : "sr-only"}>{t(example.sector)}</span>
            </button>
          )
        })}
      </div>

      {/* The alert */}
      <div
        id="showcase-panel"
        role="tabpanel"
        aria-labelledby={`showcase-tab-${current.id}`}
        aria-live={paused ? "polite" : "off"}
        className="relative mt-5 grid grid-cols-[auto_1fr] items-start gap-5"
      >
        <div key={`figure-${current.id}`} className="min-w-[96px] animate-in fade-in duration-500 motion-reduce:animate-none">
          <p className="font-heading text-4xl font-bold leading-none tracking-tight text-brand tabular-nums">
            {t(current.figure)}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-white/55">{t(current.figureCaption)}</p>
        </div>

        <div key={`text-${current.id}`} className="min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
              <Icon className="h-3 w-3" aria-hidden="true" />
              {t(current.sector)} · {t(current.department)}
            </span>
            <SeverityTag severity={current.severity} tx={tx} size="xs" />
          </div>
          <p className="mt-2.5 text-[15px] font-semibold leading-snug">{t(current.title)}</p>
          <p className="mt-2 flex gap-2 text-sm leading-snug text-white/70">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <span>{t(current.action)}</span>
          </p>
        </div>
      </div>

      {/* Whose turn: a bar per sector, the current one filling up. */}
      <div className="relative mt-5 flex gap-1.5" aria-hidden="true">
        {EXAMPLES.map((example, i) => (
          <span key={example.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            {i < index && <span className="block h-full w-full bg-brand/60" />}
            {i === index && (
              <span
                key={`${example.id}-${index}`}
                className="block h-full w-full origin-left animate-[sentria-fill_6s_linear_forwards] bg-brand motion-reduce:animate-none"
                style={{ animationPlayState: paused ? "paused" : "running" }}
                onAnimationEnd={() => go(index + 1)}
              />
            )}
          </span>
        ))}
      </div>
    </section>
  )
}
