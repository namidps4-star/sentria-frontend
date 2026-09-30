# Browser suites

Playwright scripts that drive the built app against a fake Supabase
(`auth-mock.js`) and a mocked API. They live in their own package so the
deploy never installs Playwright.

## Run

```sh
# 1. Build the app pointed at the fake Supabase, then serve it on 3201
NEXT_PUBLIC_SUPABASE_URL=https://sentria-test.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon npx next build
git checkout next-env.d.ts
npx next start -p 3201 &

# 2. Run every suite (or name some: npm test -- ask auth)
cd tests/e2e
npm install
npm test
```

Each suite prints `PASS` / `FAIL` lines and exits non-zero on a failure.
Screenshots land in `tests/e2e/shots/` (git-ignored).

Settings: `E2E_URL` (app address), `E2E_CHROME` (Chromium binary),
`E2E_SHOTS` (screenshot folder).

## Real upload percentage (`realpct.js`)

Not in `npm test`: Playwright's request interception hides upload progress,
so this one needs a real server. Start `node fakeapi.js` (port 4555), build
with `NEXT_PUBLIC_API_URL=http://localhost:4555` added, then
`node realpct.js`.
