"use client"

import { useCallback, useEffect, useState } from "react"

import { API_BASE, apiFetch } from "@/lib/api"
import { useTx } from "@/lib/i18n"
import { Activity, CircleCheck, CircleX, Clock, Loader2, Minus, RefreshCw } from "@/lib/icons"
import { cn } from "@/lib/utils"

type CheckState = "passed" | "failed" | "running" | "skipped"

type Check = { name: string; state: CheckState; seconds: number | null; url: string | null }

type RepoBlock = { repo: string; sha: string | null; branch: string | null; at: string | null; checks: Check[] }

/** GET /admin/checks. `configured` is false until the API host holds a GitHub token. */
type ChecksAnswer =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; repos: RepoBlock[]; total: number; passed: number; failed: number; running: number }

const TILE: Record<CheckState, string> = {
  passed: "linear-gradient(165deg, #5fd68a, #1f9d55)",
  failed: "linear-gradient(165deg, #ff7a6c, #e2362a)",
  running: "linear-gradient(165deg, #ffc14d, #e68a00)",
  skipped: "linear-gradient(165deg, #9aa5bd, #566178)",
}

const TILE_ICON = { passed: CircleCheck, failed: CircleX, running: Clock, skipped: Minus }

function duration(seconds: number | null, tx: (fr: string, en: string) => string): string {
  if (seconds === null) return ""
  if (seconds < 60) return `${seconds} s`

  return tx(`${Math.floor(seconds / 60)} min ${seconds % 60} s`, `${Math.floor(seconds / 60)} min ${seconds % 60} s`)
}

/** The ring: passed checks over the checks that gave an answer. */
function Ring({ passed, total }: { passed: number; total: number }) {
  const size = 176
  const stroke = 20
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const share = total > 0 ? passed / total : 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${passed} / ${total}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference * share} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize="42"
        fontWeight="800"
        className="font-heading"
      >
        {passed}/{total}
      </text>
    </svg>
  )
}

/** The Admin page's Checks (LAUNCH-READY B): how the newest push did on every
 *  GitHub Actions workflow, for both repos. Staff only; the API holds the
 *  GitHub token, and says so here when it does not. */
export function AdminChecks() {
  const tx = useTx()
  const [answer, setAnswer] = useState<ChecksAnswer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const res = await apiFetch(`${API_BASE}/admin/checks`)
      const body = await res.json().catch(() => null)

      if (!res.ok || typeof body?.configured !== "boolean") {
        throw new Error(body?.detail?.message ?? `HTTP ${res.status}`)
      }

      setAnswer(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const live = answer && answer.configured && "repos" in answer ? answer : null
  const rows = live ? live.repos.flatMap((block) => block.checks.map((check) => ({ ...check, repo: block.repo }))) : []

  return (
    <div className="rounded-3xl border border-border bg-card" data-testid="admin-checks">
      <div className="flex items-center justify-between gap-3 border-b border-border p-5">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" aria-hidden="true" />
          <h3 className="font-heading text-lg font-bold">{tx("Vérifications", "Checks")}</h3>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          aria-label={tx("Actualiser les vérifications", "Refresh the checks")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
        </button>
      </div>

      {error && <p role="alert" className="border-b border-border px-5 py-2 text-sm text-destructive">{error}</p>}

      {!answer ? (
        !error && (
          <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {tx("Chargement…", "Loading…")}
          </p>
        )
      ) : !answer.configured ? (
        <p className="p-5 text-sm leading-relaxed text-muted-foreground" data-testid="checks-not-connected">
          <span className="font-semibold text-foreground">{tx("Non connecté.", "Not connected.")}</span>{" "}
          {tx(
            "Ajoutez un jeton GitHub en lecture seule (Actions : lecture) sous le nom GITHUB_CHECKS_TOKEN sur l'hébergeur de l'API.",
            "Add a read-only GitHub token (Actions: read) as GITHUB_CHECKS_TOKEN on the API host."
          )}
        </p>
      ) : !live ? (
        <p role="alert" className="p-5 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{tx("Non mesuré :", "Not measured:")}</span>{" "}
          {tx("GitHub n'a pas répondu. Réessayez dans un instant.", "GitHub did not answer. Try again in a moment.")}
        </p>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{tx("Aucune exécution trouvée.", "No run found.")}</p>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-[260px_minmax(0,1fr)] md:p-5">
          <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] bg-[var(--ink)] p-6 text-center text-white">
            <Ring passed={live.passed} total={live.total} />
            <div>
              <p className="text-sm font-bold">{tx("vérifications réussies", "checks green")}</p>
              <p className="mt-1 text-xs text-white/70" data-testid="checks-summary">
                {live.failed > 0
                  ? tx(`${live.failed} à regarder avant la prochaine fusion`, `${live.failed} need you before the next merge`)
                  : live.running > 0
                    ? tx(`${live.running} en cours`, `${live.running} still running`)
                    : tx("Tout est vert", "All green")}
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-[28px] bg-muted p-4 md:p-5">
            {live.repos.map((block) => (
              <div key={block.repo} className="mb-3 last:mb-0">
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{block.repo.split("/")[1]}</span>
                  {block.branch ? ` · ${block.branch}` : ""}
                  {block.sha ? ` · ${block.sha}` : ""}
                </p>
                <ul>
                  {block.checks.map((check) => {
                    const Icon = TILE_ICON[check.state]

                    return (
                      <li key={check.name} className="flex items-center gap-3 border-t border-border py-2 first:border-t-0">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                          style={{ background: TILE[check.state] }}
                          aria-hidden="true"
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {check.url ? (
                            <a href={check.url} target="_blank" rel="noreferrer" className="hover:underline">
                              {check.name}
                            </a>
                          ) : (
                            check.name
                          )}
                        </span>
                        <span className="sr-only">
                          {check.state === "passed"
                            ? tx("réussi", "passed")
                            : check.state === "failed"
                              ? tx("échoué", "failed")
                              : check.state === "running"
                                ? tx("en cours", "running")
                                : tx("ignoré", "skipped")}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{duration(check.seconds, tx)}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
