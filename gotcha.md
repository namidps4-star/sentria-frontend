# Gotchas

Project-specific facts that are easy to miss. Not a diary, not general advice.

## Vercel installs from a frozen pnpm lockfile
**Problem:** `package-lock.json` looks like the source of truth.
**Reality:** Vercel runs `pnpm install --frozen-lockfile`. A dependency change that doesn't update `pnpm-lock.yaml` fails the deploy. `pnpm-workspace.yaml` sets `allowBuilds` (sharp true, msw false, unrs-resolver false).
**Rule:** Update both lockfiles (`pnpm install --lockfile-only`, `npm install --package-lock-only`) and verify with a clean `pnpm install --frozen-lockfile` + `next build`.

## `next build` does not fail on type errors
**Problem:** A green build looks like clean types.
**Reality:** `next.config.mjs` sets `typescript.ignoreBuildErrors: true`.
**Rule:** Run `npx tsc --noEmit -p .` yourself.

## One place for the backend URL
**Reality:** `lib/api.ts` `API_BASE` defaults to `https://sentria-8btn.onrender.com`; `NEXT_PUBLIC_API_URL` overrides it. A stale value on Vercel points the app at the wrong API. `apiFetch` adds the Supabase token to every call.
**Rule:** Never hardcode a backend URL elsewhere; call `apiFetch`.

## Several API routes return 200 on failure
**Problem:** `res.ok` means success.
**Reality:** `/alerts`, `/recommendations`, contractors and assignments answer 200 with `error_code`. `lib/crm.ts` wraps them in `{ok, data}` / `{ok:false, code, detail}`.
**Rule:** Go through those wrappers; never trust `res.ok` alone for those routes. `/ask`, `/upload`, `/admin`, `/alerts/feedback` use real error statuses (the Ask screen reads `detail.message`).

## Use theme tokens, not `dark:` classes
**Reality:** `dark:` doesn't follow the "system" theme (`@custom-variant dark` is `.dark *`; under "system" there is no `.dark` class, only the `prefers-color-scheme` token overrides). The pricing check marks were dark green on a dark card for that reason. Colours live in `app/globals.css` (`--canvas`, `--ink`, `--tag-*`).
**Rule:** Use tokens. Keep the pastel tag tokens; changing them has been rejected twice. A surface that stays bright in dark mode (pricing's lime and green cards) takes `.tags-light`, which pins the light tag colours inside it. `tests/e2e/brand.js` fails on a `dark:` class in the main views.

## Icons are generated
**Reality:** `lib/icons.tsx` and `lib/icon-data.ts` are generated.
**Rule:** Edit `scripts/icon-map.mjs`, run `node scripts/build-icons.mjs`; never hand-edit the outputs.

## dashboard-view.tsx early returns
**Problem:** Industry/Logistics overviews look like separate pages.
**Reality:** They are early returns inside `dashboard-view.tsx`. Each must keep `{importPortal}`, and `{sheetTabs}` as the **last child** (the bar is sticky). `tabSector`, `departmentTabs`, `activeDepartment`, `sheetTabs` are computed before those returns.
**Rule:** Moving or adding a return path means re-adding both.

## Settings follow the account only if listed
**Reality:** `lib/account.ts` `ACCOUNT_KEYS` are synced to `accounts.profile` (polled every 2 s). Other `sentria_*` localStorage keys stay in the browser.
**Rule:** New setting that must follow the user: add its key there.

## Plan and admin flags in localStorage are UI-only
**Reality:** `sentria_plan`, `sentria_trial_ends_at`, `sentria_is_admin` only drive the UI. The server enforces plan on `/upload`, admin on `/admin`, `/ask` limits. Site limits (`maxSitesFor`) are currently UI-only.
**Rule:** Never treat a client check as security.

## Task keys and statuses
**Reality:** A task is keyed `${equipment}-${alert_key}` (`taskKeyFor`); repeat alerts are one task. `asStatus()` in the board maps unknown statuses to `todo`, so `dismissed` is handled separately (dismissed cards are filtered out and listed under "Dismissed").
**Rule:** Add any new status to the board's handling explicitly, and to `AssignmentStatus` in `lib/crm.ts`.

## Value tags: `currency` marks money
**Reality:** `valueAtRisk()` reads `value` only when `currency` is present; a bare `value` is a percentage (retail shrinkage). `basis: "sales"` marks an estimate (shown with ≈).
**Rule:** Don't show a bare `value` as money.

## Hover-only controls break touch and Playwright
**Reality:** A `pointer-events-none` / hover-only button can't be clicked by Playwright or on a phone.
**Rule:** Keep the board's ⋯ detail button always visible.

## `--sidebar` is not just the sidebar
**Problem:** The sidebar's colour looks like `--sidebar` alone.
**Reality:** `bg-sidebar` also paints dark hero cards in `dashboard-view.tsx` and `logistics-ui.tsx`. The sidebar's own surface is `--sidebar-shell` (black in light mode, `--brand-deep` green in dark, explicit or system). `--brand-deep` (#0f2e1f) is a palette colour, the same in every theme: pricing's Entreprise card, the billing toggle and AI panel, and the sign-in screen's sector panel all use `bg-brand-deep`. The green sidebar was reverted once after a report that it was invisible, then restored at the founder's request. The cause of the report was never identified (it was not reproduced, and the green measured more distinct from the page than the old black).
**Rule:** To recolour the sidebar, change `--sidebar-shell`, never `--sidebar`. Use `bg-brand-deep` / the tokens, never the hex.

## A dialog owned by the sidebar must sit beside the `<aside>`, not in it
**Problem:** A `fixed inset-0` overlay rendered inside `sidebar.tsx`'s `<aside>` looks right in the code.
**Reality:** The `<aside>` has a transform (`translate-x-0`, `lg:translate-x-0`), which makes it the containing block of its `fixed` children: the overlay would cover the sidebar only, not the screen.
**Rule:** Render sidebar dialogs as siblings of the `<aside>` (in the component's fragment), with `z-[60]` to clear its `z-50`. The sign-out confirm does this.

## Alert thresholds on the Admin page come from the API
**Reality:** `components/sentria/admin-thresholds.tsx` renders whatever `GET /admin/thresholds` returns: names, groups, labels (fr/en), units, ranges and defaults all live in the backend's `pipeline/thresholds.py`. Saving sends `{value}` (a number) or `{value: null}` to put the default back. Overrides are global and apply from the next upload. Before the backend's migration 011 the API says `persisted: false` and the page disables editing.
**Rule:** Never list a threshold, label or range in the frontend. A new tunable number is a backend registry entry; this page shows it with no change here.

## Running the browser tests
**Reality:** Build from a clean copy (`pnpm install --frozen-lockfile` + `next build` with `NEXT_PUBLIC_SUPABASE_URL=https://sentria-test.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon`), `next start -p 3201`, then `node tests/e2e/<suite>.js`. `tests/e2e/auth-mock.js` fakes Supabase. `ss` isn't installed and `pkill -f "next start"` kills your own shell: free the port with `fuser -k 3201/tcp`, and always do it before a rebuild or you test a stale server. On a phone-width viewport open the menu before clicking sidebar items. `run-all.js` takes 10+ minutes.

## Third-party skills
**Reality:** `.claude/skills/transitions-*` and `skills-lock.json` are installed, uncommitted, and licensed "no redistribution".
**Rule:** Don't commit them without the owner's say-so.

## Two branches, Vercel deploys `main`
**Reality:** Work goes to `new_feat`, which is not merged into `main`.
**Rule:** Never push to `main`; no PR unless asked.

## Secrets are scanned at commit time
**Problem:** The frontend only holds public Supabase values, so a leaked key looks unlikely.
**Reality:** The backend repo once leaked a real `.env`. `scripts/check_secrets.py` (same file as the backend's) blocks `.env`/key files and secret-shaped values in a pre-commit hook and in GitHub Actions. Only `NEXT_PUBLIC_*` values belong in client code.
**Rule:** Enable the hook per clone (`git config core.hooksPath .githooks`). Mark deliberately fake lines `secret-scan: allow`; never weaken the patterns.

## Plan numbers come from the API
**Reality:** `lib/plans.ts` holds only default values; `applyEntitlements()` overwrites `ENTITLEMENTS`, `PLAN_LIMITS` (labels are generated from the numbers) and `DEPARTMENT_GROUPS` in place from `GET /plans` after sign-in (`lib/entitlements.ts`), then fires `PLAN_UPDATED_EVENT`. Views that read them at render must re-render on that event. The backend calls the retail sector `retail`, the app `commerce`.
**Rule:** Never write a plan number into a component or a string. Change it in the backend's `pipeline/entitlements.py`, and the bundled default here only to keep it in step.
