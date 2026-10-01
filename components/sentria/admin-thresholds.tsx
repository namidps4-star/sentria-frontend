"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Settings } from "@/lib/icons"

import { API_BASE, apiFetch } from "@/lib/api"
import { useTx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { StatusTag } from "./status-tag"

type Pair = { fr: string; en: string }

/** One alert threshold, as GET /admin/thresholds lists it (the backend's
 *  pipeline/thresholds.py is the source of the defaults and ranges). */
type Threshold = {
  key: string
  group: string
  group_label: Pair
  label: Pair
  help: Pair | null
  unit: Pair | null
  integer: boolean
  min: number
  max: number
  default: number
  value: number
  overridden: boolean
}

/** Whether a typed value could be saved: a number inside the range, and a
 *  whole one when the threshold counts things. The API checks it again,
 *  and also that two related thresholds stay in order. */
function validDraft(threshold: Threshold, draft: string): boolean {
  if (draft.trim() === "") return false
  const number = Number(draft)
  if (!Number.isFinite(number)) return false
  if (number < threshold.min || number > threshold.max) return false
  return !threshold.integer || Number.isInteger(number)
}

/** The Admin page's alert thresholds (P-ADMIN): the founder changes a
 *  number the alerts use; the next upload applies it, for every company,
 *  with no redeploy. Staff only: the API checks the admin flag on every
 *  call. */
export function AdminThresholds() {
  const tx = useTx()
  const [items, setItems] = useState<Threshold[]>([])
  const [persisted, setPersisted] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const res = await apiFetch(`${API_BASE}/admin/thresholds`)
      const body = await res.json().catch(() => null)

      if (!res.ok || !Array.isArray(body?.thresholds)) {
        throw new Error(body?.detail?.message ?? `HTTP ${res.status}`)
      }

      setItems(body.thresholds)
      setPersisted(body.persisted !== false)
      setDrafts({})
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** `value` null puts the threshold back to its default. */
  async function save(threshold: Threshold, value: number | null) {
    setSaving(threshold.key)
    setNotice("")

    try {
      const res = await apiFetch(`${API_BASE}/admin/thresholds/${encodeURIComponent(threshold.key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok || !body?.threshold) {
        throw new Error(body?.detail?.message ?? `HTTP ${res.status}`)
      }

      setItems((current) => current.map((t) => (t.key === threshold.key ? body.threshold : t)))
      setDrafts((current) => {
        const next = { ...current }
        delete next[threshold.key]
        return next
      })
      setNotice(
        tx(
          `${threshold.label.fr} : enregistré, appliqué dès le prochain upload.`,
          `${threshold.label.en}: saved, applied from the next upload.`
        )
      )
    } catch (caught) {
      setNotice(tx("Échec : ", "Failed: ") + (caught instanceof Error ? caught.message : String(caught)))
    } finally {
      setSaving(null)
    }
  }

  const groups: { key: string; label: Pair; rows: Threshold[] }[] = []
  for (const item of items) {
    let group = groups.find((g) => g.key === item.group)
    if (!group) {
      group = { key: item.group, label: item.group_label, rows: [] }
      groups.push(group)
    }
    group.rows.push(item)
  }

  return (
    <div className="rounded-3xl border border-border bg-card" data-testid="admin-thresholds">
      <div className="flex items-center justify-between gap-3 border-b border-border p-5">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" aria-hidden="true" />
          <h3 className="font-heading text-lg font-bold">{tx("Seuils d'alerte", "Alert thresholds")}</h3>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          aria-label={tx("Actualiser les seuils", "Refresh the thresholds")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
        </button>
      </div>

      {!persisted && !error && (
        <p
          role="status"
          className="border-b border-[var(--tag-warning-bd)] bg-[var(--tag-warning-bg)] px-5 py-2 text-sm text-[var(--tag-warning-fg)]"
        >
          {tx(
            "Rien ne peut être enregistré tant que la migration 011 n'est pas lancée (migrations/011_alert_thresholds.sql). Les valeurs par défaut s'appliquent.",
            "Nothing can be saved until migration 011 is run (migrations/011_alert_thresholds.sql). The defaults apply."
          )}
        </p>
      )}

      {notice && <p role="status" className="border-b border-border px-5 py-2 text-sm">{notice}</p>}

      {error ? (
        <p role="alert" className="p-5 text-sm text-destructive">{error}</p>
      ) : loading && items.length === 0 ? (
        <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {tx("Chargement des seuils…", "Loading thresholds…")}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {groups.map((group) => (
            <section key={group.key} className="px-5 py-4" aria-label={tx(group.label.fr, group.label.en)}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tx(group.label.fr, group.label.en)}
              </h4>

              <ul className="mt-1 divide-y divide-border">
                {group.rows.map((t) => {
                  const draft = drafts[t.key] ?? String(t.value)
                  const dirty = drafts[t.key] !== undefined && draft !== String(t.value)
                  const valid = validDraft(t, draft)
                  const busy = saving === t.key
                  const unit = t.unit ? tx(t.unit.fr, t.unit.en) : ""

                  return (
                    <li
                      key={t.key}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                    >
                      <div className="min-w-0">
                        <label htmlFor={`threshold-${t.key}`} className="text-sm font-medium">
                          {tx(t.label.fr, t.label.en)}
                        </label>
                        {t.overridden && (
                          <StatusTag tone="brand" size="xs" className="ml-2 align-middle">
                            {tx("Modifié", "Modified")}
                          </StatusTag>
                        )}
                        {t.help && (
                          <p className="text-xs text-muted-foreground">{tx(t.help.fr, t.help.en)}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {tx("Par défaut : ", "Default: ")}
                          {t.default}
                          {unit && ` ${unit}`}
                          {` · ${t.min}–${t.max}`}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <input
                          id={`threshold-${t.key}`}
                          type="number"
                          inputMode="decimal"
                          step={t.integer ? 1 : "any"}
                          min={t.min}
                          max={t.max}
                          value={draft}
                          disabled={!persisted || busy}
                          aria-invalid={dirty && !valid}
                          onChange={(e) => setDrafts((current) => ({ ...current, [t.key]: e.target.value }))}
                          className={cn(
                            "h-9 w-24 rounded-lg border bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                            dirty && !valid ? "border-destructive" : "border-border"
                          )}
                        />
                        {unit && <span className="min-w-8 text-xs text-muted-foreground">{unit}</span>}
                        <button
                          type="button"
                          disabled={!persisted || busy || !dirty || !valid}
                          onClick={() => void save(t, Number(draft))}
                          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-[#141414] transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                          {tx("Enregistrer", "Save")}
                        </button>
                        {t.overridden && (
                          <button
                            type="button"
                            disabled={!persisted || busy}
                            onClick={() => void save(t, null)}
                            className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                          >
                            {tx("Rétablir", "Reset")}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        {tx(
          "S'applique dès le prochain upload, à toutes les entreprises. Les seuils écrits dans chaque règle d'alerte et les limites des colonnes du fichier ne sont pas encore réglables ici.",
          "Applies from the next upload, to every company. The limits written inside each alert rule and the limits carried by the file's own columns can't be tuned here yet."
        )}
      </p>
    </div>
  )
}
