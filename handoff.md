## DONE
- P-TIER implemented in both repos. Plan limits now live in one backend table, `pipeline/entitlements.py` (sectors, departments, sites, users, Ask questions/month, history days, sms/tracking/ml per plan).
- Backend: `plans.check` (upload enforcement) and `ask_limits` (monthly cap, replacing `FREE_MONTHLY`) read that table. New signed-in `GET /plans` returns `order`, `entitlements`, `department_groups` and `your_plan` (trial counts as Business).
- Frontend: `lib/plans.ts` keeps bundled defaults only. `applyEntitlements()` overwrites `ENTITLEMENTS`, `PLAN_LIMITS` (labels generated from numbers), `DEPARTMENT_GROUPS` (`retail` -> `commerce`) in place and fires `PLAN_UPDATED_EVENT`. `lib/entitlements.ts` fetches `/plans` after sign-in (called from `auth-gate.tsx`) and caches the last answer in localStorage (`sentria_plan_table`). Malformed or missing answers are ignored.
- Verified: all backend `tests/check_*.py` pass (new `check_entitlements.py`; `check_ask_limits.py` now edits the table). Frontend `tsc` clean, ESLint shows only the expected `set-state-in-effect` warning, all 28 e2e suites pass on a fresh build, including the new `ptier.js` (changed numbers, API down, malformed answer, dark, 390px; screenshots taken).
- Pushed: backend `c1d78df` to `claude/laughing-noether-91k4gu` and `retail_tst`; frontend `d7ce783` to `new_feat`. Both `gotcha.md` files updated.
- Not run: clean-copy frozen-lockfile build (no dependencies changed).

## CURRENT PROBLEM
No code bug is open. What remains is owner-side release steps and a gap in enforcement:
- Render builds `main`, which lacks `/plans`, the Ask limits, G-CONF, S-4 and the secret guard until the owner merges `retail_tst`.
- `migrations/010_ask_usage.sql` has not been run; without it Ask counts are kept in memory only.
- The Notion P-TIER card could not be fetched (Notion returned 500s), so its status is not set to "To verify".
- Site cap and history window are enforced by the app only, because sites are client state. The user count is not enforced anywhere.

## EXPECTED BEHAVIOR
- After the owner merges and runs the migration, production serves `GET /plans` and the app shows and enforces the same numbers as the API. The P-TIER card shows "To verify".
- Changing a plan number in `pipeline/entitlements.py` alone changes upload enforcement, the Ask cap and the app's pricing table and Sites cap.

## RELEVANT FILES
- Backend (`/home/user/Sentria`): `pipeline/entitlements.py`, `pipeline/plans.py`, `pipeline/ask_limits.py`, `api/main.py` (`/plans`), `tests/check_entitlements.py`, `tests/check_ask_limits.py`, `migrations/010_ask_usage.sql`, `gotcha.md`.
- Frontend (`/home/user/sentria-frontend`): `lib/plans.ts`, `lib/entitlements.ts`, `components/sentria/auth-gate.tsx`, `tests/e2e/ptier.js`, `tests/e2e/run-all.js`, `gotcha.md`.

## WHAT I TRIED
- Notion search/fetch for the P-TIER card: repeated 500 errors ("Cross-cell memcached access is not allowed"). I proceeded from the code.
- First run of `check_entitlements.py` failed on my own test data (Stock+Sales are not a linked retail group). I fixed the test with real group members and the suite passed.
- `check_ask_limits.py` failed after the refactor because it set the removed `FREE_MONTHLY`. I pointed it at `ENTITLEMENTS["decouverte"]["ask_per_month"]` and it passed.

## CONSTRAINTS
- Read `gotcha.md` first in each repo. Never push to `main`; no PR unless asked.
- Backend pushes go to `claude/laughing-noether-91k4gu` and `retail_tst` (same commit). Frontend pushes go to `new_feat`.
- Commit only the files you changed (`pycache` is tracked in the backend, so run `git checkout -- pipeline/__pycache__ api/__pycache__` first). Do not hand-edit generated icons or lockfiles.
- Stop on any failing test before pushing.
- `GET /plans` must stay behind sign-in (`tests/check_s4_access.py` expects three public routes).
- Plan numbers belong only in `pipeline/entitlements.py`; the bundled frontend defaults must stay in step with it.
- The owner's email never goes in code. Never print or commit secrets.
- Reports stay in the Done / Tested / Pushed / Your turn / Open questions / Next format.
- Test server on port 3201, freed with `fuser -k 3201/tcp`.

## NEXT STEP
Retry the Notion fetch for the P-TIER card and set it to "To verify". If Notion still fails, tell the user. Then ask which smaller chantier to take next: F-TIERTAG, F-SIGNOUT, P-ADMIN, P-BRAND, or trimming the public `/health` in production.
