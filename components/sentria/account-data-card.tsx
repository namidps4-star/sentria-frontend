"use client"

import { useEffect, useState } from "react"

import { API_BASE, apiFetch } from "@/lib/api"
import { useTx } from "@/lib/i18n"
import { supabase } from "@/lib/supabase"
import { usePresence } from "@/lib/use-presence"
import { cn } from "@/lib/utils"

/* Privacy rights (F-LEGAL): download everything held for the account, or
 * delete the account. Deleting asks for the word DELETE, and offers the
 * export first. */

const WORD = "DELETE"

export function AccountDataCard() {
  const tx = useTx()
  const [busy, setBusy] = useState<"export" | "delete" | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const dialog = usePresence(confirming, "--modal-close-dur")

  useEffect(() => {
    if (!confirming) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirming(false)
    }

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [confirming])

  const download = async () => {
    setBusy("export")
    setNote(null)

    try {
      const res = await apiFetch(`${API_BASE}/account/export`)

      if (!res.ok) throw new Error(String(res.status))

      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement("a")

      link.href = url
      link.download = "sentria-data.json"
      link.click()
      URL.revokeObjectURL(url)
      setNote(tx("Fichier téléchargé.", "File downloaded."))
    } catch {
      setNote(tx("L'export a échoué, réessayez.", "The export failed, try again."))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy("delete")
    setError(null)

    try {
      const res = await apiFetch(`${API_BASE}/account`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: WORD }),
      })

      if (!res.ok) throw new Error(String(res.status))

      try {
        localStorage.clear()
      } catch {
        /* storage blocked: the page reload below still signs out */
      }

      await supabase?.auth.signOut().catch(() => undefined)
      window.location.reload()
    } catch {
      setError(tx("La suppression a échoué, réessayez.", "The deletion failed, try again."))
      setBusy(null)
    }
  }

  const close = () => {
    setConfirming(false)
    setTyped("")
    setError(null)
  }

  return (
    <div className="mt-5 border-t border-border pt-4" data-testid="account-data">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {tx("Vos données", "Your data")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {tx(
          "Téléchargez tout ce que SentrIA garde sur votre compte, ou supprimez le compte.",
          "Download everything SentrIA keeps on your account, or delete the account."
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="account-export"
          disabled={busy !== null}
          onClick={() => void download()}
          className="rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {busy === "export" ? tx("Export…", "Exporting…") : tx("Exporter mes données", "Export my data")}
        </button>
        <button
          type="button"
          data-testid="account-delete"
          disabled={busy !== null}
          onClick={() => setConfirming(true)}
          className="rounded-full border border-[var(--tag-danger-fg)] px-4 py-2 text-xs font-semibold text-[var(--tag-danger-fg)] transition-colors hover:bg-[var(--tag-danger-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {tx("Supprimer mon compte", "Delete my account")}
        </button>
      </div>

      <p role="status" data-testid="account-note" className="mt-2 min-h-4 text-xs text-muted-foreground">
        {note}
      </p>

      {dialog.present && (
        <div
          className={cn("fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 t-modal-backdrop", dialog.className)}
          onClick={(event) => {
            if (event.target === event.currentTarget && busy === null) close()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-delete-title"
            data-testid="account-delete-dialog"
            className={cn("w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl t-modal", dialog.className)}
          >
            <h2 id="account-delete-title" className="font-heading text-xl font-semibold tracking-tight">
              {tx("Supprimer le compte ?", "Delete the account?")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {tx(
                "Votre connexion et les données de l'entreprise (alertes, sites, sous-traitants, coûts, SMS) sont effacées. C'est définitif. Si d'autres comptes partagent l'entreprise, seules vos informations de compte partent.",
                "Your login and the company's data (alerts, sites, contractors, costs, SMS) are erased. This cannot be undone. If other accounts share the company, only your own account goes."
              )}
            </p>
            <button
              type="button"
              data-testid="account-delete-export"
              disabled={busy !== null}
              onClick={() => void download()}
              className="mt-3 text-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tx("Exporter d'abord mes données", "Export my data first")}
            </button>

            <label className="mt-4 block text-xs font-semibold" htmlFor="account-delete-word">
              {tx(`Tapez ${WORD} pour confirmer`, `Type ${WORD} to confirm`)}
            </label>
            <input
              id="account-delete-word"
              data-testid="account-delete-word"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            <p role="alert" data-testid="account-delete-error" className="mt-2 min-h-4 text-xs font-medium text-[var(--tag-danger-fg)]">
              {error}
            </p>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={close}
                className="rounded-full px-4 py-2 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tx("Annuler", "Cancel")}
              </button>
              <button
                type="button"
                data-testid="account-delete-confirm"
                disabled={typed !== WORD || busy !== null}
                onClick={() => void remove()}
                className="rounded-full bg-[var(--tag-danger-fg)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
              >
                {busy === "delete" ? tx("Suppression…", "Deleting…") : tx("Supprimer définitivement", "Delete for good")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
