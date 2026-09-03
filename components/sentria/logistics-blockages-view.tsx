"use client"

import { useState } from "react"
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileWarning,
  PackageCheck,
  Radar,
  ShieldCheck,
  Truck,
  Warehouse,
  Boxes,
  Factory,
  UsersRound,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

type FlowStage = "Fournisseurs" | "Stock" | "Entrepôt" | "Transport" | "Douane" | "Client"

const stages: { name: FlowStage; state: "good" | "watch" | "risk"; icon: typeof Factory }[] = [
  { name: "Fournisseurs", state: "good", icon: Factory },
  { name: "Stock", state: "good", icon: Boxes },
  { name: "Entrepôt", state: "watch", icon: Warehouse },
  { name: "Transport", state: "risk", icon: Truck },
  { name: "Douane", state: "watch", icon: FileWarning },
  { name: "Client", state: "good", icon: UsersRound },
]

const breakpoints = [
  { stage: "Transport" as FlowStage, title: "Retard probable", risk: 68, impact: "17 commandes", tone: "risk" },
  { stage: "Stock" as FlowStage, title: "Stock de sécurité atteint", risk: 42, impact: "41 h restantes", tone: "watch" },
  { stage: "Douane" as FlowStage, title: "Documents incomplets", risk: 31, impact: "3 expéditions", tone: "watch" },
]

const stateStyle = {
  good: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", ring: "border-emerald-500/25 bg-emerald-500/10" },
  watch: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", ring: "border-amber-500/25 bg-amber-500/10" },
  risk: { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400", ring: "border-rose-500/25 bg-rose-500/10" },
}

export function LogisticsBlockagesView() {
  const [selected, setSelected] = useState<FlowStage>("Transport")
  const [applied, setApplied] = useState(false)
  const selectedStage = stages.find((stage) => stage.name === selected) ?? stages[3]
  const SelectedIcon = selectedStage.icon

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15"><Radar className="h-3.5 w-3.5" /></span>
              SentrIA Flow
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Votre flux, avant qu&apos;il ne casse.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Suivez la santé de chaque étape. SentrIA vous montre le prochain point de rupture et la décision qui protège vos opérations.</p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 px-4 py-3">
            <div className="relative grid h-12 w-12 place-items-center rounded-full" style={{ background: "conic-gradient(#f59e0b 0deg 122deg, #e5e7eb 122deg 360deg)" }}>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-card text-sm font-bold">34</div>
            </div>
            <div><p className="text-xs font-medium text-muted-foreground">Risque global</p><p className="text-sm font-semibold">Sous contrôle <span className="text-muted-foreground">/ 100</span></p></div>
          </div>
        </div>

        <div className="relative mt-8 overflow-x-auto pb-1">
          <div className="flex min-w-[720px] items-center justify-between gap-1 px-2">
            {stages.map((stage, index) => {
              const Icon = stage.icon
              const style = stateStyle[stage.state]
              const isSelected = selected === stage.name
              return (
                <div className="flex flex-1 items-center" key={stage.name}>
                  <button onClick={() => setSelected(stage.name)} className="group flex w-24 flex-col items-center gap-2 text-center" aria-pressed={isSelected}>
                    <span className={cn("grid h-12 w-12 place-items-center rounded-2xl border transition-all", style.ring, isSelected && "scale-110 shadow-lg shadow-black/5") }><Icon className={cn("h-5 w-5", style.text)} /></span>
                    <span className="text-[11px] font-semibold text-foreground">{stage.name}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />{stage.state === "risk" ? "Rupture" : stage.state === "watch" ? "Sous tension" : "Fluide"}</span>
                  </button>
                  {index < stages.length - 1 && <div className={cn("mx-1 h-1 flex-1 rounded-full", stage.state === "risk" ? "bg-gradient-to-r from-rose-300 to-amber-300" : "bg-emerald-200 dark:bg-emerald-900/60")} />}
                </div>
              )
            })}
          </div>
        </div>
        <div className="relative mt-6 flex items-center gap-3 rounded-2xl border border-rose-500/15 bg-rose-500/[0.06] p-3 text-sm">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-500 text-white"><SelectedIcon className="h-4 w-4" /></span>
          <p><span className="font-semibold">{selected} est sous surveillance.</span> {selected === "Transport" ? "C’est votre point de rupture probable." : "SentrIA suit cette étape pour préserver le flux."}</p>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.8fr)]">
        <section className="overflow-hidden rounded-[2rem] border border-rose-500/20 bg-card shadow-sm">
          <div className="border-b border-border p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-400"><CircleAlert className="h-4 w-4" /> Avant le blocage</div><h3 className="text-2xl font-semibold tracking-tight">Blocage probable dans 48 h</h3><p className="mt-1 text-sm text-muted-foreground">Transport · France <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> Espagne</p></div>
              <span className="rounded-full bg-rose-500/10 px-3 py-1.5 text-sm font-bold text-rose-700 dark:text-rose-400">68% de risque</span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[{ label: "Retards récents", value: "+23%", width: "w-[82%]", tone: "bg-rose-500" }, { label: "Capacité transport", value: "−14%", width: "w-[42%]", tone: "bg-amber-500" }, { label: "Volume demain", value: "+31%", width: "w-[91%]", tone: "bg-rose-500" }].map((signal) => <div key={signal.label} className="rounded-2xl bg-muted/60 p-3"><div className="flex items-baseline justify-between gap-2"><span className="text-xs text-muted-foreground">{signal.label}</span><span className="text-sm font-bold">{signal.value}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><div className={cn("h-full rounded-full", signal.tone, signal.width)} /></div></div>)}
            </div>
            <p className="mt-5 border-l-2 border-rose-400 pl-3 text-sm leading-6 text-muted-foreground">Ces signaux convergent vers une surcharge probable demain matin. <span className="font-medium text-foreground">11 commandes prioritaires sont concernées.</span></p>
          </div>

          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[.7fr_1.3fr]">
            <div className="rounded-2xl bg-muted/55 p-5"><p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">Si rien ne change</p><div className="mt-5 space-y-3 border-l border-dashed border-border pl-4 text-sm"><p><span className="font-semibold">Maintenant</span><span className="ml-2 text-muted-foreground">flux sous tension</span></p><p className="relative"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-amber-500" /><span className="font-semibold">+24 h</span><span className="ml-2 text-muted-foreground">surcharge</span></p><p className="relative"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-rose-500" /><span className="font-semibold">+48 h</span><span className="ml-2 text-muted-foreground">17 commandes impactées</span></p></div><p className="mt-5 text-lg font-semibold">4 800 € <span className="text-sm font-normal text-muted-foreground">de coût potentiel</span></p></div>
            <div className={cn("rounded-2xl border p-5 transition-colors", applied ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border-emerald-500/20 bg-emerald-500/[0.04]")}>
              <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-emerald-700 dark:text-emerald-400">SentrIA propose</p><h4 className="mt-1 font-semibold">Réallouer 6 expéditions au transporteur B.</h4><p className="mt-1 text-sm text-muted-foreground">Je protégerais d&apos;abord les expéditions critiques. Le vrai point de rupture est le transport, pas le stock.</p></div></div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center"><div><p className="text-xs text-muted-foreground">Risque</p><p className="mt-1 font-bold text-rose-600 line-through decoration-rose-300">68%</p></div><div className="pt-5 text-muted-foreground"><ArrowRight className="mx-auto h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">Après action</p><p className="mt-1 font-bold text-emerald-600">21%</p></div></div>
              <button onClick={() => setApplied(!applied)} className={cn("mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all", applied ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground hover:opacity-90")}><span>{applied ? "Protection activée" : "Éviter ce blocage"}</span>{applied ? <Check className="h-4 w-4" /> : <Zap className="h-4 w-4" />}</button>
            </div>
          </div>
        </section>

        <aside className="rounded-[2rem] border border-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Points de rupture</p><h3 className="mt-1 text-lg font-semibold">À protéger maintenant</h3></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-muted"><Radar className="h-4 w-4" /></span></div><div className="mt-5 space-y-3">{breakpoints.map((point) => { const active = point.stage === selected; return <button key={point.stage} onClick={() => setSelected(point.stage)} className={cn("w-full rounded-2xl border p-4 text-left transition-all", active ? "border-primary bg-muted/70 shadow-sm" : "border-border hover:border-muted-foreground/30 hover:bg-muted/40")}><div className="flex items-start gap-3"><span className={cn("mt-1 h-2.5 w-2.5 rounded-full", point.tone === "risk" ? "bg-rose-500" : "bg-amber-500")} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="font-semibold">{point.stage}</p><p className={cn("text-sm font-bold", point.tone === "risk" ? "text-rose-600" : "text-amber-600")}>{point.risk}%</p></div><p className="mt-0.5 text-sm text-muted-foreground">{point.title}</p><p className="mt-2 text-xs font-medium text-foreground">{point.impact}</p></div></div></button> })}</div><div className="mt-6 flex items-center gap-3 rounded-2xl bg-muted/60 p-4"><PackageCheck className="h-5 w-5 text-emerald-600" /><p className="text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">17 commandes peuvent être protégées</span> en agissant avant demain matin.</p></div></aside>
      </div>
    </div>
  )
}