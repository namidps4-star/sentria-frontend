"use client"

import { useCallback, useEffect, useState } from "react"

import { API_BASE, apiFetch } from "@/lib/api"
import { useTx } from "@/lib/i18n"
import { useIsEmployee } from "@/lib/role"
import { useSites } from "@/lib/sites"

/* The boss puts someone in charge of one site (F-TEAMROLES). They get an
 * invitation by email and see that site only: no site menu, no Sites page, no
 * export or delete. The API holds the rule; this card only asks. */

type Member = { user_id: string; email: string | null; name: string | null; site_ids: string[] }

export function TeamCard() {
  const tx = useTx()
  const employee = useIsEmployee()
  const { ready, mode, sites } = useSites()
  const [team, setTeam] = useState<Member[]>([])
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [siteId, setSiteId] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const failure = (code: unknown) => {
    const known: Record<string, [string, string]> = {
      team_email_invalid: ["Cette adresse e-mail n'a pas l'air correcte.", "That email address does not look right."],
      team_email_taken: ["Cette adresse a déjà un compte SentrIA.", "That address already has a SentrIA account."],
      team_full: ["L'équipe est complète.", "The team is full."],
      team_site_required: ["Choisissez le site de cette personne.", "Choose the site this person works on."],
      team_invite_failed: ["L'invitation n'a pas pu partir. Réessayez.", "The invitation could not be sent. Try again."],
    }
    const found = typeof code === "string" ? known[code] : undefined

    return found ? tx(found[0], found[1]) : tx("Échec. Réessayez.", "That failed. Try again.")
  }

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/team`)
      const body = await res.json().catch(() => null)

      if (res.ok && Array.isArray(body?.team)) setTeam(body.team)
    } catch {
      /* the list stays as it was */
    }
  }, [])

  const usable = ready && mode === "server" && sites.length > 0 && !employee

  useEffect(() => {
    if (usable) void load()
  }, [usable, load])

  useEffect(() => {
    if (!siteId && sites[0]) setSiteId(sites[0].id)
  }, [sites, siteId])

  if (employee || !ready) return null

  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? "—"

  const call = async (path: string, init: RequestInit, done: string) => {
    setBusy(true)
    setNote(null)

    try {
      const res = await apiFetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json" } })
      const body = await res.json().catch(() => null)

      if (!res.ok) {
        setNote(failure(body?.error_code ?? body?.detail?.error_code))
        return false
      }

      setNote(done)
      await load()
      return true
    } catch {
      setNote(failure(null))
      return false
    } finally {
      setBusy(false)
    }
  }

  const input =
    "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="mt-5 border-t border-border pt-4" data-testid="team-card">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {tx("Équipe", "Team")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {tx(
          "Mettez quelqu'un en charge d'un site. Cette personne ne voit que ce site, sans menu des sites, ni export, ni suppression du compte.",
          "Put someone in charge of one site. They see that site only: no site menu, no export, no account deletion."
        )}
      </p>

      {!usable ? (
        <p className="mt-3 text-xs text-muted-foreground" data-testid="team-needs-sites">
          {tx("Ajoutez d'abord un site : une personne en charge travaille sur le site que vous lui donnez.", "Add a site first: a person in charge works on the site you give them.")}
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2" data-testid="team-list">
            {team.map((member) => (
              <li key={member.user_id} data-testid="team-member" className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5 text-xs">
                <span className="min-w-0 flex-1 truncate font-semibold">{member.name ? `${member.name} · ` : ""}{member.email ?? "—"}</span>
                <select
                  aria-label={tx("Site", "Site")}
                  value={member.site_ids[0] ?? ""}
                  disabled={busy}
                  onChange={(event) =>
                    void call(`/team/${member.user_id}`, { method: "PATCH", body: JSON.stringify({ site_ids: [event.target.value] }) }, tx("Site changé.", "Site changed."))
                  }
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  {member.site_ids[0] && !sites.some((s) => s.id === member.site_ids[0]) && (
                    <option value={member.site_ids[0]}>{siteName(member.site_ids[0])}</option>
                  )}
                </select>
                <button
                  type="button"
                  data-testid="team-remove"
                  disabled={busy}
                  onClick={() => void call(`/team/${member.user_id}`, { method: "DELETE" }, tx("Personne retirée.", "Person removed."))}
                  className="rounded-full border border-[var(--tag-danger-fg)] px-3 py-1 text-xs font-semibold text-[var(--tag-danger-fg)] transition-colors hover:bg-[var(--tag-danger-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {tx("Retirer", "Remove")}
                </button>
              </li>
            ))}
          </ul>

          <form
            className="mt-3 grid gap-2"
            onSubmit={async (event) => {
              event.preventDefault()

              const sent = await call("/team", { method: "POST", body: JSON.stringify({ email, name, site_ids: [siteId] }) }, tx("Invitation envoyée.", "Invitation sent."))

              if (sent) {
                setEmail("")
                setName("")
              }
            }}
          >
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tx("E-mail de la personne", "Their email")} aria-label={tx("E-mail de la personne", "Their email")} data-testid="team-email" className={input} />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={tx("Nom (facultatif)", "Name (optional)")} aria-label={tx("Nom", "Name")} className={input} />
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label={tx("Site", "Site")} data-testid="team-site" className={input}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="submit"
              data-testid="team-invite"
              disabled={busy || !email || !siteId}
              className="justify-self-start rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {tx("Inviter", "Invite")}
            </button>
          </form>
        </>
      )}

      <p role="status" data-testid="team-note" className="mt-2 min-h-4 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
