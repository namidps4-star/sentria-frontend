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
import { StatusTag, type TagTone } from "./status-tag"
import { formatAmount, useLocale } from "@/lib/locale"
import { cn } from "@/lib/utils"

/* The disposal log (H-VET step 2), on the Vet dashboard. One line each time
 * stock is thrown away; above it, what the log adds up to and how much went in
 * pits. The paper behind H-VET found 44 % of expired stock was thrown in pits:
 * the log makes that visible to the outlet itself. */

const METHOD_TONE: Record<DisposalMethod, TagTone> = { pit: "danger", burn: "warning", return: "info", donation: "success", other: "neutral" }

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
    "w-full rounded-xl border border-white/10 bg-[#2b2b28] px-3 py-2.5 text-sm text-white placeholder:text-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const rows = log && log.persisted ? log.disposals : []

  // Where the money went, by how it left the stock.
  const byMethod = DISPOSAL_METHODS.map((m) => ({ m, value: rows.filter((r) => r.method === m).reduce((sum, r) => sum + r.value, 0) })).filter((x) => x.value > 0)
  const methodTotal = byMethod.reduce((sum, x) => sum + x.value, 0)
  const METHOD_COLOR: Record<DisposalMethod, string> = { pit: "#9b1c2a", burn: "#e0a100", return: "#3b4bd6", donation: "#2f8f3f", other: "#555" }

  // The last six weeks, oldest first; a week starts on Monday.
  const weekStart = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
    return x.getTime()
  }
  const thisWeek = weekStart(new Date())
  const weeks = Array.from({ length: 6 }, (_, n) => thisWeek - (5 - n) * 7 * 86400000)
  const perWeek = weeks.map((start) =>
    rows.filter((r) => { const t = weekStart(new Date(r.disposed_on)); return t === start }).reduce((sum, r) => sum + r.value, 0)
  )
  const peak = Math.max(1, ...perWeek)

  const biggest = rows.reduce<{ product: string; value: number } | null>((best, r) => (!best || r.value > best.value ? { product: r.product, value: r.value } : best), null)
  const average = rows.length ? rows.reduce((sum, r) => sum + r.value, 0) / rows.length : 0

  return (
    <section data-testid="disposal-log" className="squircle rounded-[32px] bg-[var(--ink)] p-2 text-white" style={{ borderRadius: 32 }}>
      {log === null || !log.persisted ? (
        <div className="p-5">
          <h3 className="font-heading text-lg font-bold">{tx("Journal des pertes", "Disposal log")}</h3>
          <p data-testid="disposal-unavailable" className="mt-3 text-sm text-white/65">
            {tx("Le journal n'est pas encore disponible.", "The log is not available yet.")}
          </p>
        </div>
      ) : (
        <>
          <div data-testid="disposal-summary" className="squircle grid gap-5 rounded-[26px] bg-brand p-5 text-brand-foreground sm:grid-cols-[1.1fr_1fr_1.2fr] sm:items-end" style={{ borderRadius: 26 }}>
            <div>
              <h3 className="font-heading text-2xl font-extrabold leading-tight">{tx("Journal des pertes", "Disposal log")}</h3>
              <p className="mt-1 max-w-[16rem] text-sm leading-5 opacity-75">
                {tx(
                  "Notez chaque fois que du stock est jeté : comment, et ce que cela coûte.",
                  "Write down each time stock is thrown away: how, and what it cost."
                )}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-65">{tx("Perdu · 30 jours", "Lost · 30 days")}</p>
              <p className="text-4xl font-extrabold">{money(log.summary.last_30_days_value)}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider opacity-65">{tx("Perdu · total", "Lost · total")} {money(log.summary.total_value)}</p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-65">{tx("Part en fosse", "Share in pits")}</p>
              <p className="text-4xl font-extrabold" data-testid="disposal-pit-share">{log.summary.pit_share} %</p>
              <div className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-black/15" aria-hidden="true">
                {byMethod.map((x) => (
                  <i key={x.m} style={{ width: `${(x.value / methodTotal) * 100}%`, background: METHOD_COLOR[x.m] }} />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] font-semibold">
                {byMethod.map((x) => (
                  <span key={x.m} className="inline-flex items-center gap-1">
                    <i className="h-2 w-2 rounded-full" style={{ background: METHOD_COLOR[x.m] }} />
                    {method[x.m]} {Math.round((x.value / methodTotal) * 100)} %
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div data-testid="disposal-stats" className="grid gap-2 px-3 pt-3 sm:grid-cols-[1.4fr_1fr_1fr]">
            <div className="rounded-2xl bg-[#1f1f1d] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">{tx("6 dernières semaines", "Last 6 weeks")}</p>
              <div className="mt-2 flex h-16 items-end gap-2" aria-hidden="true">
                {perWeek.map((value, n) => (
                  <div key={weeks[n]} className="flex-1 rounded-t-lg rounded-b-sm" style={{ height: `${Math.max(6, (value / peak) * 100)}%`, background: value === peak && value > 0 ? "var(--brand)" : "#3a3a37" }} />
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-[#1f1f1d] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">{tx("Moyenne par perte", "Average per loss")}</p>
              <p className="mt-1 text-2xl font-bold">{money(Math.round(average))}</p>
              <p className="text-xs text-white/55">{tx(`${rows.length} entrées`, `${rows.length} entries`)}</p>
            </div>
            <div className="rounded-2xl bg-[#1f1f1d] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">{tx("Plus grosse perte", "Biggest loss")}</p>
              <p className="mt-1 truncate text-2xl font-bold">{biggest ? money(biggest.value) : "–"}</p>
              <p className="truncate text-xs text-white/55">{biggest?.product ?? ""}</p>
            </div>
          </div>

          <div className="px-3 pb-3 pt-3">
            <ul className="space-y-2" data-testid="disposal-list">
              {log.disposals.slice(0, 8).map((row) => (
                <li key={row.id} data-testid="disposal-row" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-[#1f1f1d] px-4 py-3 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: METHOD_COLOR[row.method] ?? "#555" }} aria-hidden="true" />
                  <span className="w-full min-w-0 truncate font-semibold sm:w-auto sm:flex-1">
                    {row.product}
                    {row.batch ? <span className="font-normal text-white/55"> · {tx("lot", "batch")} {row.batch}</span> : null}
                  </span>
                  <StatusTag tone={METHOD_TONE[row.method] ?? "neutral"} size="xs">{method[row.method] ?? row.method}</StatusTag>
                  <span className="text-xs text-white/55">{row.disposed_on}</span>
                  <span className="font-bold">{money(row.value)}</span>
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
                    className="rounded-full px-2 py-1 text-xs font-semibold text-white/55 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  >
                    {tx("Retirer", "Remove")}
                  </button>
                </li>
              ))}
            </ul>

            <form
              className="mt-3 grid gap-2 rounded-[22px] bg-[#1f1f1d] p-3 sm:grid-cols-2"
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
              <input type="date" max={today()} value={draft.disposed_on} onChange={(e) => setDraft({ ...draft, disposed_on: e.target.value })} aria-label={tx("Date", "Date")} className={cn(input, "[color-scheme:dark]")} />
              <button
                type="submit"
                data-testid="disposal-add"
                disabled={busy || !draft.product.trim()}
                className="justify-self-start rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {tx("Ajouter", "Add")}
              </button>
            </form>

            <p role="status" data-testid="disposal-note" className="mt-2 min-h-4 text-xs text-white/60">{note}</p>
          </div>
        </>
      )}
    </section>
  )
}
