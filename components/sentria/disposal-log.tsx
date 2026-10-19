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
  const [only, setOnly] = useState<DisposalMethod | "all">("all")
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
              <p className="text-xs font-bold uppercase tracking-wider opacity-65">{tx("Perdu · 30 jours", "Lost · 30 days")}</p>
              <p className="text-4xl font-extrabold">{money(log.summary.last_30_days_value)}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider opacity-65">{tx("Perdu · total", "Lost · total")} {money(log.summary.total_value)}</p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-65">{tx("Part en fosse", "Share in pits")}</p>
              <p className="text-4xl font-extrabold" data-testid="disposal-pit-share">{log.summary.pit_share} %</p>
              <div className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-black/15" aria-hidden="true">
                {byMethod.map((x) => (
                  <i key={x.m} style={{ width: `${(x.value / methodTotal) * 100}%`, background: METHOD_COLOR[x.m] }} />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs font-semibold">
                {byMethod.map((x) => (
                  <span key={x.m} className="inline-flex items-center gap-1">
                    <i className="h-2 w-2 rounded-full" style={{ background: METHOD_COLOR[x.m] }} />
                    {method[x.m]} {Math.round((x.value / methodTotal) * 100)} %
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div data-testid="disposal-stats" className="grid gap-2 px-3 pt-3 sm:grid-cols-[1.7fr_1fr]">
            <div className="rounded-2xl bg-[#1f1f1d] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-white/55">{tx("6 dernières semaines", "Last 6 weeks")}</p>
              <div
                role="img"
                aria-label={tx("Pertes par semaine : ", "Losses per week: ") + weeks.map((start, n) => `${new Date(start).toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${money(perWeek[n])}`).join(", ")}
                className="mt-2 flex h-16 items-end gap-2"
              >
                {perWeek.map((value, n) => (
                  <div key={weeks[n]} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${new Date(weeks[n]).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${money(value)}`}>
                    <span className="text-xs font-semibold tabular-nums text-white/75">{value > 0 ? money(value) : ""}</span>
                    <div className="w-full rounded-t-lg rounded-b-sm" style={{ height: `${Math.max(6, (value / peak) * 70)}%`, background: value === peak && value > 0 ? "var(--brand)" : "#3a3a37" }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-2" aria-hidden="true">
                {weeks.map((start) => (
                  <span key={start} className="flex-1 text-center text-xs text-white/60">
                    {new Date(start).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-rows-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#1f1f1d] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-white/55">{tx("Moyenne par perte", "Average per loss")}</p>
              <div className="text-right">
                <p className="text-2xl font-bold leading-none">{money(Math.round(average))}</p>
                <p className="mt-1 text-xs text-white/55">{tx(`${rows.length} entrées`, `${rows.length} entries`)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#1f1f1d] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-white/55">{tx("Plus grosse perte", "Biggest loss")}</p>
              <div className="min-w-0 text-right">
                <p className="text-2xl font-bold leading-none">{biggest ? money(biggest.value) : "–"}</p>
                <p className="mt-1 truncate text-xs text-white/55">{biggest?.product ?? ""}</p>
              </div>
            </div>
            </div>
          </div>

          <div className="px-3 pb-3 pt-3">
            {rows.length === 0 && (
              <p data-testid="disposal-empty" className="mb-3 rounded-2xl border border-dashed border-white/20 px-4 py-4 text-sm text-white/70">
                {tx("Aucune perte notée. Ajoutez la première ci-dessous.", "No losses logged yet. Add the first one below.")}
              </p>
            )}

            {log.summary.pit_share >= 50 && (
              <p data-testid="disposal-advice" className="mb-3 rounded-2xl bg-brand/15 px-4 py-3 text-sm font-semibold text-brand">
                {tx(
                  `${log.summary.pit_share} % des pertes finissent en fosse. Rendre le stock périmé au fournisseur ou le donner peut en récupérer une partie.`,
                  `${log.summary.pit_share} % of losses end in a pit. Returning expired stock to the supplier, or donating it, can recover part of the cost.`
                )}
              </p>
            )}

            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={tx("Filtrer par méthode", "Filter by method")}>
              {(["all", ...DISPOSAL_METHODS] as const).filter((m) => m === "all" || rows.some((r) => r.method === m)).map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`disposal-filter-${m}`}
                  aria-pressed={only === m}
                  onClick={() => setOnly(m)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    only === m ? "border-transparent bg-brand text-brand-foreground" : "border-white/15 text-white/70 hover:bg-white/10"
                  )}
                >
                  {m === "all" ? tx("Tout", "All") : method[m]}
                </button>
              ))}
            </div>

            <ul className="space-y-2" data-testid="disposal-list">
              {log.disposals.filter((row) => only === "all" || row.method === only).slice(0, 8).map((row) => (
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
              <label className="block text-xs font-semibold text-white/70">{tx("Produit", "Product")}
                <input data-testid="disposal-product" required value={draft.product} onChange={(e) => setDraft({ ...draft, product: e.target.value })} placeholder={tx("ex. Vaccin rage", "e.g. Rabies vaccine")} aria-label={tx("Produit", "Product")} className={cn(input, "mt-1")} />
              </label>
              <label className="block text-xs font-semibold text-white/70">{tx("Lot (facultatif)", "Batch (optional)")}
                <input value={draft.batch} onChange={(e) => setDraft({ ...draft, batch: e.target.value })} placeholder={tx("ex. B7", "e.g. B7")} aria-label={tx("Lot", "Batch")} className={cn(input, "mt-1")} />
              </label>
              <label className="block text-xs font-semibold text-white/70">{tx("Quantité", "Quantity")}
                <input inputMode="decimal" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} placeholder="0" aria-label={tx("Quantité", "Quantity")} className={cn(input, "mt-1")} />
              </label>
              <label className="block text-xs font-semibold text-white/70">{tx("Valeur perdue", "Value lost")}
                <input data-testid="disposal-value" inputMode="decimal" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder={currency.symbol} aria-label={tx("Valeur perdue", "Value lost")} className={cn(input, "mt-1")} />
              </label>
              <label className="block text-xs font-semibold text-white/70">{tx("Comment", "How")}
                <select data-testid="disposal-method" value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as DisposalMethod })} aria-label={tx("Comment", "How")} className={cn(input, "mt-1")}>
                {DISPOSAL_METHODS.map((m) => (
                  <option key={m} value={m}>{method[m]}</option>
                ))}
              </select>
              </label>
              <label className="block text-xs font-semibold text-white/70">{tx("Date", "Date")}
                <input type="date" max={today()} value={draft.disposed_on} onChange={(e) => setDraft({ ...draft, disposed_on: e.target.value })} aria-label={tx("Date", "Date")} className={cn(input, "mt-1 [color-scheme:dark]")} />
              </label>
              <button
                type="submit"
                data-testid="disposal-add"
                disabled={busy || !draft.product.trim()}
                className="self-end justify-self-start rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
