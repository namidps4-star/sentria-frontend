"use client"

import { useCallback, useEffect, useState } from "react"

import {
  DISPOSAL_METHODS,
  fetchDisposals,
  removeDisposal,
  saveDisposal,
  type DisposalDraft,
  type DisposalLog as Log,
  type DisposalMethod,
} from "@/lib/disposals"
import { useTx } from "@/lib/i18n"
import { formatAmount, useLocale } from "@/lib/locale"

/* The disposal log (H-VET step 2), on the Vet dashboard. One line each time
 * stock is thrown away; above it, what the log adds up to and how much went in
 * pits. The paper behind H-VET found 44 % of expired stock was thrown in pits:
 * the log makes that visible to the outlet itself. */

const today = () => new Date().toISOString().slice(0, 10)

export function DisposalLog() {
  const tx = useTx()
  const { currency } = useLocale()
  const [log, setLog] = useState<Log | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const blank = (): DisposalDraft => ({ product: "", batch: "", qty: "", value: "", method: "pit", disposed_on: today(), currency: currency.code })
  const [draft, setDraft] = useState<DisposalDraft>(blank)

  const load = useCallback(async () => setLog(await fetchDisposals()), [])

  useEffect(() => {
    void load()
  }, [load])

  const method: Record<DisposalMethod, string> = {
    pit: tx("Jeté en fosse", "Thrown in a pit"),
    burn: tx("Brûlé", "Burned"),
    return: tx("Retourné au fournisseur", "Returned to supplier"),
    donation: tx("Donné", "Donated"),
    other: tx("Autre", "Other"),
  }

  const failure = (code: string) =>
    ({
      product_required: tx("Indiquez le produit.", "Name the product."),
      qty_invalid: tx("La quantité doit être un nombre.", "The quantity must be a number."),
      value_invalid: tx("La valeur doit être un nombre.", "The value must be a number."),
      disposed_on_invalid: tx("Cette date n'est pas valide.", "That date is not valid."),
      disposals_unavailable: tx("Le journal n'est pas encore disponible.", "The log is not available yet."),
    })[code] ?? tx("Échec. Réessayez.", "That failed. Try again.")

  if (log === undefined) return null

  const money = (value: number) => formatAmount(value, currency.symbol, tx)
  const input =
    "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <section data-testid="disposal-log" className="rounded-3xl border border-border bg-card p-6">
      <h3 className="font-heading text-lg font-bold">{tx("Journal des pertes", "Disposal log")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {tx(
          "Notez chaque fois que du stock est jeté : comment, et ce que cela coûte.",
          "Write down each time stock is thrown away: how, and what it cost."
        )}
      </p>

      {log === null || !log.persisted ? (
        <p data-testid="disposal-unavailable" className="mt-4 text-sm text-muted-foreground">
          {tx("Le journal n'est pas encore disponible.", "The log is not available yet.")}
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2" data-testid="disposal-summary">
            <div className="rounded-2xl bg-muted px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{tx("Perdu · 30 jours", "Lost · 30 days")}</p>
              <p className="text-lg font-bold">{money(log.summary.last_30_days_value)}</p>
            </div>
            <div className="rounded-2xl bg-muted px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{tx("Perdu · total", "Lost · total")}</p>
              <p className="text-lg font-bold">{money(log.summary.total_value)}</p>
            </div>
            <div className="rounded-2xl bg-muted px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{tx("Part en fosse", "Share in pits")}</p>
              <p className="text-lg font-bold" data-testid="disposal-pit-share">{log.summary.pit_share} %</p>
            </div>
          </div>

          <ul className="mt-4 divide-y divide-border" data-testid="disposal-list">
            {log.disposals.slice(0, 8).map((row) => (
              <li key={row.id} data-testid="disposal-row" className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="w-full min-w-0 truncate font-semibold sm:w-auto sm:flex-1">
                  {row.product}
                  {row.batch ? <span className="font-normal text-muted-foreground"> · {tx("lot", "batch")} {row.batch}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">{method[row.method] ?? row.method}</span>
                <span className="text-xs text-muted-foreground">{row.disposed_on}</span>
                <span className="font-semibold">{money(row.value)}</span>
                <button
                  type="button"
                  data-testid="disposal-remove"
                  aria-label={tx(`Retirer ${row.product}`, `Remove ${row.product}`)}
                  onClick={async () => {
                    setBusy(true)
                    await removeDisposal(row.id)
                    await load()
                    setBusy(false)
                  }}
                  disabled={busy}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {tx("Retirer", "Remove")}
                </button>
              </li>
            ))}
          </ul>

          <form
            className="mt-4 grid gap-2 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault()
              setBusy(true)
              setNote(null)

              const saved = await saveDisposal(draft)

              if (saved.ok) {
                setDraft(blank())
                setNote(tx("Enregistré.", "Saved."))
                await load()
              } else {
                setNote(failure(saved.code))
              }

              setBusy(false)
            }}
          >
            <input data-testid="disposal-product" required value={draft.product} onChange={(e) => setDraft({ ...draft, product: e.target.value })} placeholder={tx("Produit", "Product")} aria-label={tx("Produit", "Product")} className={input} />
            <input value={draft.batch} onChange={(e) => setDraft({ ...draft, batch: e.target.value })} placeholder={tx("Lot (facultatif)", "Batch (optional)")} aria-label={tx("Lot", "Batch")} className={input} />
            <input inputMode="decimal" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} placeholder={tx("Quantité", "Quantity")} aria-label={tx("Quantité", "Quantity")} className={input} />
            <input data-testid="disposal-value" inputMode="decimal" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder={tx(`Valeur perdue (${currency.symbol})`, `Value lost (${currency.symbol})`)} aria-label={tx("Valeur perdue", "Value lost")} className={input} />
            <select data-testid="disposal-method" value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as DisposalMethod })} aria-label={tx("Comment", "How")} className={input}>
              {DISPOSAL_METHODS.map((m) => (
                <option key={m} value={m}>{method[m]}</option>
              ))}
            </select>
            <input type="date" max={today()} value={draft.disposed_on} onChange={(e) => setDraft({ ...draft, disposed_on: e.target.value })} aria-label={tx("Date", "Date")} className={input} />
            <button
              type="submit"
              data-testid="disposal-add"
              disabled={busy || !draft.product.trim()}
              className="justify-self-start rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {tx("Ajouter", "Add")}
            </button>
          </form>

          <p role="status" data-testid="disposal-note" className="mt-2 min-h-4 text-xs text-muted-foreground">{note}</p>
        </>
      )}
    </section>
  )
}
