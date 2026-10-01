# Sentria Frontend

## Purpose

Client dashboard for Sentria — lets a company upload sector CSV data, see
alerts/recommendations, chat with the "SentrIA" assistant, and manage sites
and contractors. Consumes the Sentria backend's REST API directly (no
frontend-side auth/session exists on this branch — see Authentication below).

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS 4**, shadcn-derived component conventions (`class-variance-authority`,
  `tailwind-merge`, `components.json`)
- **recharts** is already a dependency — prefer it (or its shadcn-styled
  wrapper, Tremor, if added later) over hand-rolling new SVG chart code in
  `components/sentria/charts.tsx`
- `react-markdown` + `remark-gfm` for rendering SentrIA's chat responses
- `@vercel/analytics` — deployed on Vercel
- Linting: `eslint .` (no separate Prettier/stylelint config found)

## Architecture

- `app/` — minimal App Router shell: `layout.tsx`, `page.tsx`, `globals.css`.
  Routing is intentionally shallow; most of the app is one client-rendered
  tree, not separate Next.js routes per view.
- `components/sentria/` — the real app. Each file is a full "view"
  (`dashboard-view.tsx`, `ask-view.tsx`, `sites-view.tsx`,
  `onboarding-modal.tsx`, `sidebar.tsx`, `topbar.tsx`, `app-shell.tsx`,
  `pricing-view.tsx`, `profile-view.tsx`, `report-view.tsx`,
  `settings-view.tsx`, `logistics-blockages-view.tsx`, `charts.tsx`).
  `app-shell.tsx` owns which view is mounted.
- `lib/` — currently just `utils.ts` (shadcn's `cn()` helper) and
  `logistics-data-contract.ts`. No `lib/plans.ts`, `lib/account.ts`, or
  Supabase client exists on this branch (see Authentication).
- **Note for future sessions**: a separate branch, `new_feat`, carries
  substantially more unreleased work — a real Supabase Auth flow, an
  onboarding wizard, a plan/tier system (`lib/plans.ts`), a contractors CRM
  UI, and a sites view. Don't assume those exist here just because they're
  referenced in product discussions — check which branch you're actually on.

## Database architecture

No direct database access from the frontend — all data comes through the
Sentria backend's REST API. There is no Supabase client library in this
branch's `package.json`.

## Authentication architecture

**None exists on this branch.** No `@supabase/supabase-js` or `@supabase/ssr`
dependency, no login/signup UI, no session handling, no auth-gated routing.
Every view is reachable with no identity check. This is a known, tracked gap
(Notion chantier `S-3`) — when it's built, it will be **Supabase Auth**, not
a custom system; don't build a parallel auth mechanism here independent of
that decision.

## API conventions

- The backend base URL is currently **hardcoded directly in component
  source**, not read from an env var — and two different views hardcode two
  *different* hosts (`ask-view.tsx` vs `dashboard-view.tsx`). This is a known
  inconsistency, not an intentional multi-backend setup. If you touch either,
  prefer consolidating to a single `NEXT_PUBLIC_API_URL`-style env var rather
  than adding a third hardcoded value.
- No request ever carries an auth token today (nothing to carry — see above).
  Don't add one speculatively; wait for the real auth implementation to land.

## Deployment architecture

- Deployed on Vercel. `next.config.mjs` sets `typescript.ignoreBuildErrors:
  true` — TypeScript errors do **not** currently block a production build.
  Treat type errors as real bugs to fix, don't rely on this flag staying on.
- No `headers()` security configuration exists in `next.config.mjs` (no CSP/
  HSTS/etc.) — tracked as part of the broader security chantiers.

## Environment variable conventions

No `process.env` usage exists in this codebase beyond
`process.env.NODE_ENV` in `app/layout.tsx`. No `NEXT_PUBLIC_*` variables are
defined. If you add the backend URL or Supabase keys as env vars, use the
`NEXT_PUBLIC_` prefix only for genuinely public values (a Supabase anon key
is fine; a service-role key or any secret must never get that prefix or
reach client bundle code at all).

## Security requirements

- Current security posture and open items are tracked in Notion chantiers
  `S-1`–`S-6`. Check there before assuming an auth/authorization gap is or
  isn't already being worked on.
- Never store a session/auth token in `localStorage` if a cookie-based
  (`@supabase/ssr`) flow is available when auth is implemented.
- `localStorage` today is used only for non-sensitive UI preferences
  (`sentria_onboarded`, `sentria_sector`, `sentria_equipment`, etc.) — keep
  it that way; it is not an appropriate place for anything security-sensitive.

## Coding conventions

- Each major UI area is one file under `components/sentria/`, not split
  across many small files — follow that pattern rather than fragmenting a
  view into many sub-components unless a piece is genuinely reused elsewhere.
- Use `cn()` from `lib/utils.ts` for conditional Tailwind classes, not manual
  string concatenation.
- French-language UI strings are used directly in JSX in most views (not run
  through an i18n library) — match the existing language/tone of the view
  you're editing rather than introducing a new i18n system unprompted.

## Commands

- Install: `npm install` (or `pnpm install` — `pnpm.overrides` exists in
  `package.json` for a `hono` transitive dependency, reason not documented
  in-repo; confirm before removing it)
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- No test runner is currently configured in this repo.

## Constraints that must not be changed without explicit approval

- Do not add a parallel/custom auth mechanism — Supabase Auth is the decided
  provider (chantier `S-3`) once auth work starts here.
- Do not flip `typescript.ignoreBuildErrors` without separately fixing
  whatever type errors it's currently masking — removing the flag blind will
  break the build.
- Do not add a new hardcoded backend host — consolidate existing ones
  instead if you're touching that code.

## Known architectural decisions future sessions should respect

- Shallow App Router usage is deliberate — this is a client-rendered SPA-style
  dashboard, not a page-per-route Next.js app. Don't restructure into many
  routes without discussing it first.
- No i18n library is in use; language handling (where it exists) is manual.
- `new_feat` branch is the forward-looking branch for auth/onboarding/plans/
  CRM work — check branch context before concluding a feature is "missing."
