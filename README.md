# SentrIA frontend

The web app for SentrIA: operating data in, alerts and plain-language actions out. Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Supabase Auth, pnpm. The API is the `Sentria` repo (FastAPI).

## Run it

```sh
pnpm install --frozen-lockfile
pnpm dev                 # http://localhost:3000
```

It needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `NEXT_PUBLIC_API_URL` points at another API; without it the app calls the production one (see `lib/api.ts`). `NEXT_PUBLIC_SITE_URL` is the public address used for the sitemap and share cards.

## Check it

```sh
npx tsc --noEmit -p .    # next build does not fail on type errors
npx eslint <files>
```

Browser suites live in `tests/e2e/` (Playwright, fake Supabase): see `tests/e2e/README.md`. Judge them on a production build, not `next dev`.

## Deploy

Push to `new_feat`. Vercel deploys `main` and installs from a frozen `pnpm-lock.yaml`, so change both lockfiles with the tools. Details and traps are in `gotcha.md`; read it before changing anything.

## Where things are

- `app/`: routes, the 404, error and loading pages, the sitemap and share card.
- `components/sentria/`: the screens.
- `lib/`: helpers, the API client, the French and English strings (`tx(fr, en)`).
- `scripts/`: the icon build and the secret scan.
