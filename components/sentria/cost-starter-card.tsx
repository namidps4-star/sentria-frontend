"use client"

import { useEffect, useState } from "react"

import { costErrorText, fetchCost, saveCostStarter } from "@/lib/crm"
import { resolve, useTx } from "@/lib/i18n"
import { formatAmount, useLocale } from "@/lib/locale"
import { canSeeAmounts } from "@/lib/plans"
import { useEffectivePlan } from "@/lib/use-plan"

/* --------------------------------------------------------------------------
 * "What a stop costs" (I-COST step 2), in Settings. One optional number: the
 * customer's own guess of what they lose per day if something stops. SentrIA
 * shows it back as theirs ("you told us") and never works anything out from
 * it. Pro and up; the free plan sees what it unlocks.
 * -------------------------------------------------------------------------- */

type State =
  | { kind: "loading" }
  | { kind: "ready"; saved: number | null }
  | { kind: "error"; message: string }

export function CostStarterCard() {
  const tx = useTx()
  const plan = useEffectivePlan()
  const { currency } = useLocale()
  const allowed = plan !== null && canSeeAmounts(plan)

  const [state, setState] = useState<State>({ kind: "loading" })
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!allowed) return

    let cancelled = false

    fetchCost().then((result) => {
      if (cancelled) return

      if (!result.ok) {
        setState({ kind: "error", message: resolve(costErrorText(result.code, result.detail), tx) })
        return
      }

      const saved = result.data.starter?.amount ?? null

      setState({ kind: "ready", saved })
      if (saved !== null) setValue(String(saved))
    })

    return () => {
      cancelled = true
    }
    // tx changes with the language, not with the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  async function save() {
    const amount = Number(value.replace(",", "."))

    if (!Number.isFinite(amount) || amount <= 0) {
      setNote({ ok: false, text: tx("Saisissez un montant supérieur à zéro.", "Enter an amount above zero.") })
      return
    }

    setBusy(true)
    setNote(null)

    const result = await saveCostStarter(amount, currency.symbol)

    setBusy(false)

    if (!result.ok) {
      setNote({ ok: false, text: resolve(costErrorText(result.code, result.detail), tx) })
      return
    }

    setState({ kind: "ready", saved: result.data.amount })
    setNote({ ok: true, text: tx("Enregistré.", "Saved.") })
  }

  if (plan === null) return null

  return (
    <section data-cost-starter="" className="squircle rounded-[36px] bg-card p-5 shadow-sm">
      <h3 className="font-heading text-xl font-semibold tracking-tight">
        {tx("Coût d'un arrêt", "What a stop costs")}
      </h3>

      {!allowed ? (
        <p data-cost-starter-locked="" className="mt-2 text-xs leading-5 text-muted-foreground">
          {tx(
            "Indiquez ce qu'un arrêt vous coûte par jour et SentrIA vous le rappelle sur chaque alerte critique. Disponible avec le plan Pro.",
            "Tell SentrIA what a stop costs you per day and it reminds you on every critical alert. Comes with the Pro plan."
          )}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {tx(
              "Environ, que perdez-vous par jour si quelque chose s'arrête ? Facultatif. SentrIA ne calcule rien : il vous rappelle votre propre chiffre.",
              "Roughly, what do you lose per day if something stops? Optional. SentrIA works nothing out: it shows your own figure back."
            )}
          </p>

          {state.kind === "error" ? (
            <p role="alert" className="mt-3 text-xs leading-5 text-destructive">
              {state.message}
            </p>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">{tx("Coût par jour", "Cost per day")}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  disabled={state.kind === "loading" || busy}
                  data-cost-starter-input=""
                  placeholder={tx("ex. 500", "e.g. 500")}
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-3 pr-20 text-sm outline-none transition-colors focus:border-ring disabled:opacity-60"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {currency.symbol ? `${currency.symbol} ${tx("/ jour", "/ day")}` : tx("/ jour", "/ day")}
                </span>
              </label>

              <button
                type="button"
                onClick={save}
                disabled={state.kind === "loading" || busy}
                data-cost-starter-save=""
                aria-label={tx("Enregistrer le coût par jour", "Save the cost per day")}
                className="shrink-0 rounded-full bg-brand px-4 py-2.5 text-xs font-semibold text-[#141414] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {tx("Enregistrer", "Save")}
              </button>
            </div>
          )}

          {state.kind === "ready" && state.saved !== null && (
            <p data-cost-starter-saved="" className="mt-2 text-[11px] leading-4 text-muted-foreground">
              {tx("Enregistré :", "On file:")} {formatAmount(state.saved, currency.symbol, tx)} {tx("par jour", "per day")}
            </p>
          )}

          {note && (
            <p
              role={note.ok ? "status" : "alert"}
              className={note.ok ? "mt-2 text-xs font-semibold text-[var(--tag-success-fg)]" : "mt-2 text-xs text-destructive"}
            >
              {note.text}
            </p>
          )}
        </>
      )}
    </section>
  )
}
