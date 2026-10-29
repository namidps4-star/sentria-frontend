# SentrIA frontend

[![ci](https://github.com/namidps4-star/sentria-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/namidps4-star/sentria-frontend/actions/workflows/ci.yml) [![e2e](https://github.com/namidps4-star/sentria-frontend/actions/workflows/e2e.yml/badge.svg)](https://github.com/namidps4-star/sentria-frontend/actions/workflows/e2e.yml) [![security](https://github.com/namidps4-star/sentria-frontend/actions/workflows/security.yml/badge.svg)](https://github.com/namidps4-star/sentria-frontend/actions/workflows/security.yml)

The web app for SentrIA: operating data in, alerts and plain-language actions out. Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Supabase Auth, pnpm. The API is the `Sentria` repo (FastAPI).

## Run it

```sh
pnpm install --frozen-lockfile
pnpm dev                 # http://localhost:3000
```

It needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `NEXT_PUBLIC_API_URL` points at another API; without it the app calls the production one (see `lib/api.ts`). `NEXT_PUBLIC_SITE_URL` is the public address used for canonical links and share cards.

## Check it

```sh
npx tsc --noEmit -p .    # next build does not fail on type errors
npx eslint <files>
pnpm test:unit           # vitest, the pure helpers in lib/ (tests/unit)
```

CI (`.github/workflows/ci.yml`) runs the install, types, lint, unit tests and the build on every push. `e2e.yml` runs the browser suites on Chromium, Firefox and WebKit, and `smoke.yml` checks a live deploy (needs the `SMOKE_EMAIL` and `SMOKE_PASSWORD` secrets for the sign-in steps).

Browser suites live in `tests/e2e/` (Playwright, fake Supabase): see `tests/e2e/README.md`. Judge them on a production build, not `next dev`.

## Deploy

Push to `new_feat`. Vercel deploys `main` and installs from a frozen `pnpm-lock.yaml`, so change both lockfiles with the tools. Details and traps are in `gotcha.md`; read it before changing anything.

## Where things are

- `app/`: routes, the 404, error and loading pages, and the share card.
- `components/sentria/`: the screens.
- `lib/`: helpers, the API client, the French and English strings (`tx(fr, en)`).
- `scripts/`: the icon build and the secret scan.
