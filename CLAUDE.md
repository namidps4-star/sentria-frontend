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

## Writing
- Talk to the founder in caveman style, built for ADHD: answer first, short lines, small words, one thing at a time, five lines max unless asked for more, one question per message. Reports keep the Done / Tested / Pushed / Your turn / Open questions / Next order, each part a line or two.
- All prose you write (replies, commit messages, code comments, test labels, docs, UI copy) follows the `humanizer` skill's surface pass: no em dashes, no hype words, no "not X, it's Y", no cheerful openers or closers. Skip its "add personality" advice and the `structural-humanizer` pass for code and test output. Run `copy_scan.py` on UI copy and commit messages before you commit.
- The skills are third-party and stay out of the repo, like the transitions skill. If `~/.claude/skills/humanizer` is missing (fresh container): `git clone https://github.com/NulightJens/humanizer-stack ~/humanizer-stack && git -C ~/humanizer-stack checkout 13f5c023189d428ffba726c75886ca1fd0dcba65 && ~/humanizer-stack/install.sh --copy`. The pin is the commit that was read before installing; read the diff before moving it.
