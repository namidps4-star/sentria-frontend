# CLAUDE.md: how we work (frontend)

**Read `gotcha.md` before changing anything.** It holds project-specific facts the code doesn't make obvious. Treat its warnings as operational knowledge; don't override one just because the code seems to say otherwise. When you find a new durable, non-obvious issue, add it to `gotcha.md` (Problem / Reality / Rule). Don't put debugging notes, conversation history or general coding advice there, and don't repeat rules from this file in it.

## Stack
Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Supabase Auth (`@supabase/supabase-js`), pnpm. Deployed on Vercel. Backend: the `Sentria` repo (FastAPI) on Render.

## Conventions
- UI is premium and compact: lime / black / grey rounded cards, pastel tags. No big cards, faded colours or hidden controls.
- Every string is French and English via `tx(fr, en)` / `localized()`.
- Light, dark and 390 px must all look right.
- Theme tokens, never `dark:`.
- The owner's email address never goes into code.
- Secrets never go in the repo: `scripts/check_secrets.py` runs as a pre-commit hook (turn it on once per clone: `git config core.hooksPath .githooks`) and in GitHub Actions. A deliberately fake line can carry `secret-scan: allow`.

## Testing
- `npx tsc --noEmit -p .` and `npx eslint <files>` (the `set-state-in-effect` warnings are expected).
- Every feature gets a Playwright suite in `tests/e2e/` (add it to `run-all.js`), with screenshots in light, dark and 390 px before pushing.
- Build from a clean copy with the frozen lockfile (see `gotcha.md`). Stop on any failure.

## Deployment & git
- Push to `new_feat`. Never push to `main`; no PR unless asked.
- Commit only the files you changed (`git add <names>`); keep untracked third-party files out.
- Commit message ends with the trailers given by the session.

## Files not to edit by hand
`lib/icons.tsx`, `lib/icon-data.ts` (generated), both lockfiles (use the tools).

## Reporting
Terse: Done / Tested / Pushed / Your turn / Open questions / Next. Say plainly what was and wasn't verified.
