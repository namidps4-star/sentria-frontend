# SentrIA handover

> Written 2026-09-18, in English by request. This replaces the French
> 2026-09-17 version, whose content is preserved in git history at
> `da131b6`.
>
> | Repo | Branch | HEAD | State |
> |---|---|---|---|
> | `namidps4-star/sentria-frontend` | `feature/onboarding-view` | `de76bb1` | pushed, never merged |
> | `namidps4-star/Sentria` | `feature/contractors-crm` | `bb5a183` | **pushed, NOT merged, so nothing is live** |
> | `namidps4-star/sentria-landing-page` | `main` | `a3d8a8a` | untouched this session |
>
> Nothing is waiting locally. The backend working tree is clean except
> for `__pycache__`, still tracked in git by mistake.

---

## 1. The objective

Two things were asked for, in this order.

**a. A contractor CRM.** The priorities board could already assign a task
to somebody. It kept the assignment in the administrator's own browser,
so the contractor never saw it. The ask was to make an assignment a fact
about the operation rather than a fact about one laptop.

**b. Internationalisation.** Ask the operator's country and language at
onboarding, use the country for currency, and put the product in their
language. The bar was stated plainly and it is the right bar:

> "selecting english must make literally everything in english no
> exception whatso ever"

**That second objective is not met.** The rest of this document is mostly
about why, and what the next person needs to know to finish it.

---

## 2. The problem we are trying to solve

The thread running through this branch has not changed: **the interface
asserted things the data did not support.** This session added two new
instances of it, one of them mine.

### The board's assignments never left the browser

`localStorage` under `sentria_recommendation_tasks_v2`. An administrator
assigned GRUE-02 to a crane operator and the crane operator saw nothing,
ever. The UI showed an assignment; no assignment existed.

### Every amount claimed euros

`pipeline/alerts.py:683` has always read a currency per row from the CSV.
The frontend hardcoded the euro anyway: `formatEuros`, `"€ / h au-delà de
8 h"`, a euro sign beside every exposure figure.

The figures in the cost view are rates **the operator types in
themselves**, so the currency is a label on their own numbers. A Lagos
terminal entering 45000 for immobilisation means naira. Stamping a euro
sign on it was simply false, and it was false for every non-eurozone
customer from the day that view shipped.

### The language picker was decorative

`settings-view.tsx` offered six languages from a `useState("fr")` that
was never written down and never read by another screen. Six languages,
none stored, exactly like the timezone select before it.

### And then I did the same thing, in a new place

This is the failure that matters most, so it gets its own section below.
I marked English as a language the interface exists in, and it did not.
The picker promised English because I typed `true`, not because anything
had been translated.

---

## 3. The important files

### Frontend: `namidps4-star/sentria-frontend`, branch `feature/onboarding-view`

| File | Role |
|---|---|
| `lib/i18n/fr.ts` | The message catalogue, **53 keys**, source of truth. Chrome only: nav, view titles, the repeated buttons |
| `lib/i18n/en.ts` | Typed `Record<keyof typeof fr, string>`. **This is the mechanism.** A missing key is a build error, verified by deleting one |
| `lib/i18n/index.ts` | `useT()` for the catalogue, `useTx()` / `tx(fr, en)` for bulk, `Localized` + `pick()` for module-level catalogues that cannot call a hook |
| `scripts/check-i18n.mjs` | **Start here for the i18n work.** Counts unlocalized user-facing text. `--strict` exits 1 while any remains. `--file <path>` lists them with line numbers |
| `lib/locale.ts` | Language and country. `uiReady` is `"full"` / `"partial"` / `"none"`, `uiLanguage()` narrows a choice to a language the UI has, `COUNTRIES` carries the currency, `formatMoney()` |
| `lib/crm.ts` | The contractor CRM client. Every call returns `{ ok, data }` or `{ ok: false, code, detail }`, because these endpoints answer HTTP 200 on failure |
| `components/sentria/contractors-view.tsx` | New "Intervenants" screen. Availability is declared, workload is counted, and the two are never merged |
| `components/sentria/recommendations-board-view.tsx` | The priorities board. Restyled on the supplied reference, and now saves through the API with rollback on a rejected save |
| `components/sentria/onboarding-modal.tsx` | Eight successive steps: language, country, timezone, company, sector, activity, priorities, data. Cards rather than selects |
| `components/sentria/dashboard-view.tsx` | **243 unlocalized strings, the single biggest obstacle to English.** Only the hero is done |

### Backend: `namidps4-star/Sentria`, branch `feature/contractors-crm`

| File | Role |
|---|---|
| `migrations/001_contractors_and_assignments.sql` | **Must be run in the Supabase SQL editor or the whole CRM returns `crm_query_failed`.** Two tables. RLS deliberately off, with a commented starting point |
| `pipeline/crm.py` | Contractors and assignments. Validation before the database is consulted, because there is nothing else in front of these writes |
| `pipeline/demo_crm.py` | Proof, stubbing only Supabase. **Its STEP 0 proves the fake client filters before asserting anything else** |
| `pipeline/i18n.py` | **92 keys in `fr`, 92 in `en`, zero gaps.** The operational alert messages are already bilingual. `translate(key, lang)` exists |
| `pipeline/alerts.py` | `fire()` passes the message key to `save_alert` on line 98, so **every stored alert row carries its `alert_key`** |
| `pipeline/demo_supplier.py` | The guard rail. Output must stay byte identical. md5 `6a65a141cfcf16f954031a5c259aad2a` |

---

## 4. What was tried and failed

The useful section. Read it before trusting anything I reported.

### I shipped the exact bug this branch exists to remove

I set `uiReady: true` for English in `lib/locale.ts`. `uiLanguage()`
returned `"en"` correctly, and then **nothing read it**: zero call sites.
The only translation map in the app was 15 strings local to the Settings
screen. The picker told the operator English was available because of a
boolean I typed.

The user found it by opening the app, which is the worst way for it to be
found. I had spent the whole session removing invented claims from this
codebase and then added one.

It is now `"partial"`, and the picker says *"Navigation en English ·
contenu encore en français"*.

### I never did the step I had just proposed

I laid out a plan whose step 1 was "set English to `uiReady: false`
today", then went straight to step 2 and left the flag on. When the user
asked why the dashboard was still French, the honest answer was that I
had skipped my own first step.

### I said I would not turn English on, and then left it on

Having argued that a mixed screen is worse than a French one, I shipped a
mixed screen. I do now think leaving it on is the better call, and the
third `"partial"` state is how it says so honestly, but I changed
position mid-task and should have said so at the time rather than in a
commit message.

### Two numbers I reported were wrong

- **"186 keys" in `pipeline/i18n.py`.** It is 92 keys per language. I had
  counted lines across both blocks.
- **"746 untranslated strings".** The real figure is **1119**. My first
  detector only looked for French, so it undercounted by a third.

Both were stated confidently enough to plan around. Re-measure before
trusting a number in a handover, including this one.

### My first detector asked the wrong question

`scripts/check-i18n.mjs` originally looked for French: diacritics and
French function words. It was wrong twice over.

- It **missed "Mensuel" and "Annuel"**, which carry neither.
- It could **never** have caught the three plan descriptions in the
  subscription view that existed in **English only**, where a French
  operator was reading English.

Rewritten to flag any user-facing text not wrapped in a translation call,
in any language. That is the real invariant. It over-reports on purpose.

### My own tests produced two false failures

Both times the instrument was wrong, and both times I checked before
touching working code.

- A step-3 assertion for `"Déduit de votre pays"` failed. The hint is
  CSS-uppercased, so `innerText` returns `DÉDUIT DE VOTRE PAYS` and a
  case-sensitive check missed it. The code was correct.
- The localStorage migration test reported a re-migration. Playwright's
  `addInitScript` re-runs on reload, which reseeded the legacy key and
  emptied the fake server: a legitimate migration, not a bug. Retested by
  remounting instead of reloading.

### Three wrong guesses about whitespace in one file

Patching `pricing-view.tsx` I asserted on indentation three times and was
wrong three times, burning three round trips. Reading the actual
occurrences first would have cost one. When a replacement count is
surprising, look at the file rather than guessing again.

### Bugs found in existing code, not fixed

Named here because each one is a live defect and none was in scope.

- **`pipeline/alerts.py:18`** calls `create_client()` at import with no
  guard, so importing `api/main.py` without `SUPABASE_URL` kills the
  process. That makes `api/main.py`'s careful "the app still boots and
  `/health` says which key is missing" comment false today.
- **`industry-view.tsx:167`** returns a flat `2800` or `900` as a
  downtime cost, with its own comment admitting it is a placeholder. Same
  class of invention as the report's old `MOCK_DATA`.
- **`hsl(var(--token))`** in arbitrary Tailwind values resolves to
  nothing, because the design tokens are `oklch()` values. The board's
  drag shadow never existed. Verified in the browser
  (`backgroundImage` read `none`). Fixed in the board; **worth grepping
  for elsewhere.**
- **`__pycache__`** is still tracked in the backend, which is why
  `git status` is never clean there.

### The structural limit is unchanged

**The deployed site is unreachable from the sandbox.** The proxy returns
403 on CONNECT for Render and Vercel. Everything this session was
verified against a local dev server with stubbed endpoints. Nothing has
been confirmed against production.

---

## 5. What comes next

### Blocking, and it is on the user's side

**1. Run the SQL migration.** `migrations/001_contractors_and_assignments.sql`
on the backend branch, in the Supabase SQL editor. Until it runs, every
CRM call returns `crm_query_failed` and the board shows its failure
banners doing their job.

**2. Merge the backend branch.** Render deploys `main`. `feature/contractors-crm`
is pushed and unmerged, so **the CRM does not exist in production.** I did
not merge it: it is a deployed branch and that is your call.

**3. Upload the 8 test CSVs** from `test-data/`. Still never done, so no
view has ever rendered real data.

**4. Decide the frontend branch.** `origin/main` is `ae6eca9`, 39 files,
and shares **no common ancestor** with `feature/onboarding-view` (517+
files, 90 commits). `git merge-base` returns nothing. Merging needs
`--allow-unrelated-histories`, or `main` gets reset, or `main` is
deleted. One of those discards a branch, so it is not a quiet cleanup.

### Finishing English, which is the open commitment

The bar is "no exception whatsoever". The method is in place; the volume
is not done.

**1119 unlocalized strings in 32 files.** Run
`node scripts/check-i18n.mjs` for the current list.

| File | Strings |
|---|---|
| `dashboard-view.tsx` | 243 |
| `onboarding-modal.tsx` | 97 |
| `lib/priorities.ts` | 68 |
| `settings-view.tsx` | 66 |
| `sites-view.tsx` | 63 |
| `industry-view.tsx` | 59 |
| `lib/activities.ts` | 56 |
| `lib/logistics-signals.ts` | 56 |
| 24 more files | 411 |

How to do it, in order:

1. Use **`tx("Français", "English")`** for view prose. One edit per
   string, and the signature makes a missing translation unwriteable.
2. Use **`Localized` pairs + `pick()`** for the `lib/` catalogues
   (`priorities.ts`, `activities.ts`, `logistics-signals.ts`). They are
   built at module level and cannot call a hook. `pricing-view.tsx` is
   the worked example.
3. Expect **`tsc` to flag every render site** when a catalogue field
   changes to `Localized`. That is the mechanism working; follow the
   errors.
4. Then the **22 hardcoded `"fr-FR"`** formatting calls, driven off the
   locale.
5. Then the **backend read-time translation**. Note the real constraint:
   `save_alert` stores the rendered message, not the template parameters,
   so an existing row cannot be re-rendered in English. It has the key
   but not the numbers. Add a `params jsonb` column and render on read;
   existing rows stay French under any option.
6. Flip English to **`uiReady: "full"`** only when
   `node scripts/check-i18n.mjs --strict` exits 0.

**Never translate** equipment names, the company name, contractor names,
CSV-derived values or `task_key`. They are data. Translating an
identifier is how you get two rows for one crane.

### Carried over, still open

| Item | State |
|---|---|
| **API has no authentication** | Worse now than it was. The CRM will hold contractors' names, phone numbers and assignments behind an API any server-side caller can read. CORS only protects browsers. `company_name` partitions the data; it is **not** access control, and nothing in the code claims it is |
| Arabic RTL | Recorded as `rtl: true` in `lib/locale.ts`, acted on nowhere. Product-wide right-to-left is a layout pass on every panel, flow track and chart axis, not a string pass |
| No `--warning` token | 24 raw `amber-` usages. Nothing broken, a token would be cleaner |
| 48 raw hex in `pricing-view.tsx` | Left alone at the user's explicit request. That view carries a deliberate light palette |
| `Procfile.txt` | Render does not read it. The dashboard command is what runs |

---

## Conventions to keep

- **Never use em dashes** in replies. Explicit request.
- **ADHD-friendly summaries**: scannable headings, short lists, bold on
  what matters, tables over paragraphs, **bad news marked as bad news**.
- **Explain what changed in plain language after every task.**
- **Always work on `feature/onboarding-view`** in the frontend. Ask
  before pushing anywhere else. The backend is on
  `feature/contractors-crm`; `main` is deployed.
- **Commit messages in plain English**, never compressed.
- **Re-run `pipeline/demo_supplier.py` after any backend change.** Byte
  identical output is the proof pharmacy behaviour did not move.
  `PYTHONPATH=. python3 pipeline/demo_supplier.py`
- **Run `pnpm install` at the start of a frontend session**, and
  `python3 -m pip install --ignore-installed PyJWT -r requirements.txt`
  for the backend. The plain pip install fails on a Debian-owned PyJWT.
- **Verify in a browser, do not reason about it.** Chromium and
  Playwright are at `/opt/node22/lib/node_modules/playwright`, browsers
  at `/opt/pw-browsers`. Stub `window.fetch` in `addInitScript`; the
  deployed API is unreachable.
- **When a measurement is surprising, suspect the instrument first.** It
  was the instrument twice this session, and wrong numbers made it into
  the previous handover.
