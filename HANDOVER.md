# HANDOVER

Written 19 September 2026. Supersedes `PASSATION.md`, which covered the
state before English was finished; keep that file for the history of what
went wrong earlier.

**Frontend** `namidps4-star/sentria-frontend`, branch `feature/onboarding-view`, head `7ea8642`.
**Backend** `namidps4-star/Sentria`, branch `main`, head `bb5a183`, deployed on Render.

---

## L'objectif

Ship SentrIA to an operator who does not read French.

Concretely: selecting English must make **literally everything** English, with
no exception, and it must be provable rather than claimed. That bar is the
whole reason for the work in this document, and it is met.

---

## 1. La problématique qu'on essaye de résoudre

### The original defect

The language picker offered six languages and delivered one. English was
marked `uiReady: true` in `lib/locale.ts` while **nothing in the app read
that flag** — zero call sites. So the picker promised an English interface
and rendered French. The operator found it by opening the app.

That is the mistake the rest of this work exists to correct, and it has a
shape worth remembering: **a boolean that asserts a capability nobody
implemented.**

### Where it stands now

| | Then | Now |
|---|---|---|
| Unlocalized strings | 1119 in 32 files | **0** |
| `check-i18n --strict` | exit 1 | **exit 0** |
| English `uiReady` | `"true"`, then `"partial"` | **`"full"`** |
| Hardcoded `fr-FR` locales | 22 | **0** |

Verified in a real browser, not by inspection: every nav destination plus
the five logistics drill-downs swept for 70 French-only words (0 found),
the same sweep run against French looking for English-only words (0 found),
and the onboarding wizard walked for all 7 sectors in both languages
(14 / 14 pass).

### The two bugs found after that, both mine

1. **The wizard died after step 6.** Step 7 rendered a raw `{ fr, en }`
   object as a JSX child. React error #31. Covered in section 3.
2. **Choosing a language on step 1 did nothing.** The card set React state
   only; the wizard's text reads the *stored* language, which was not
   written until `finish()`. Also section 3.

### What is still open

- **Alerts already in the database cannot be re-rendered in another
  language.** `save_alert` stores the finished sentence, not the template
  plus its parameters, so a row fired in French stays French. New alerts
  fired in an English session are English. See section 4.
- **The API has no authentication**, and it now holds contractors' names,
  phone numbers and emails. Highest-priority risk in the product.

---

## 2. Les fichiers importants sur lesquels il bosse

### The translation layer

| File | What it is |
|---|---|
| `lib/i18n/pair.ts` | `Localized`, `localized()`, `Tx`, `resolve()`. **Imports nothing** — it is a leaf on purpose, because `lib/locale.ts` needs pairs and `lib/i18n/index.ts` needs `lib/locale.ts`. Putting the constructor in `index.ts` made that a cycle through a module exporting a runtime function. |
| `lib/i18n/index.ts` | `useTx()` (the hook every view uses), `txFor()`, `useT()` and the `fr`/`en` key catalogue. Re-exports everything from `pair.ts` so callers keep one import. |
| `lib/i18n/fr.ts` / `en.ts` | The keyed catalogue, 53 keys. `en.ts` is typed `Record<keyof typeof fr, string>`, so a missing key is a **build error**. |
| `lib/locale.ts` | `LANGUAGES` (with `uiReady`), `COUNTRIES`, `uiLanguage()`, `useLocale()`, `formatMoney()`. **This is where `uiReady: "full"` lives.** |
| `scripts/check-i18n.mjs` | The gate. `--strict` exits 1 if anything is unlocalized. Read its header before trusting it. |
| `scripts/smoke-onboarding.mjs` | Walks all 8 wizard steps × 7 sectors × 2 languages. The only thing that catches the class of bug in section 3. |

### Two conventions, and why

**`tx(fr, en)` for prose, the keyed catalogue for repeated chrome.** The
catalogue costs four edits per string (invent a key, add to `fr.ts`, add to
`en.ts`, replace the usage) — 4200 edits for a thousand one-off sentences.
`tx("Coûts", "Cost")` is one edit, reviews on a single line, and keeps the
stronger guarantee: **the signature makes a missing translation
unwriteable.**

**Module-level catalogues hold pairs, not strings.** Anything built outside
React (`lib/priorities.ts`, `lib/activities.ts`, `lib/logistics-signals.ts`,
`lib/crm.ts`) cannot call a hook, so it stores `Localized` and the view
resolves it with a local `px()`. Making a field a pair turns every accessor
into a function that needs a translator, and **the compiler then names
every call site** — that is how the call sites were found, not by grepping.

### The screens

`components/sentria/` — `dashboard-view.tsx` (3600 lines, was 243 of the
1119 strings), `onboarding-modal.tsx` (the 8-step wizard, where both
section-3 bugs were), the four `logistics-*-view.tsx`, `industry-view.tsx`,
`recommendations-board-view.tsx` and `-panel.tsx`, `settings-view.tsx`,
`sites-view.tsx`, `contractors-view.tsx`, `report-view.tsx`,
`document-language.tsx` (new — the tab title and `<html lang>`).

### Things that look wrong and are deliberate

- **`settings-view.tsx` carries its own six-language `UI` map.** It is the
  only place Spanish, Portuguese, Arabic and Kiswahili exist. Narrowing it
  to match `lib/i18n`'s two would throw away four real translations. It is
  behind an `i18n-ignore` marker with that reason written down.
- **Language names are never translated.** An English speaker scanning the
  picker looks for "Français", not "French".
- **`app/layout.tsx` metadata stays French**, behind a marker. It is
  evaluated at build time; `document-language.tsx` corrects it at runtime.

---

## 3. Ce qu'il a essayé et qui a raté

Read this section before trusting any green check.

### The flag that asserted a capability nobody had built

`uiReady: true` for English with zero call sites reading it. The fix was
not a bigger flag, it was `UiCoverage = "full" | "partial" | "none"` plus
`uiLanguage()` actually narrowing a choice to a language the interface
exists in. **`"full"` now only means something because
`check-i18n --strict` exits 0.**

### `tsc` does NOT check every JSX child

The expensive one. TypeScript rejects a raw `{ fr, en }` pair as a JSX
child — except when the fragment holding it has more than one child:

```jsx
<div>{pair}</div>          // TS2322, as you would expect
<div>{cond && pair}</div>  // TS2322
<>{<span/>}{pair}</>       // SILENT
```

A pair sat in exactly that third shape on wizard step 7. Build green, type
check green, **wizard dead after step 6** with React error #31. I verified
this blind spot with a minimal repro before believing it.

**Consequence: static checking cannot cover this class.**
`scripts/smoke-onboarding.mjs` exists because of it. I swept every
multi-child fragment in `components/` for the same pattern; that was the
only real one, but a future one will not be caught by the compiler either.

### A cast is not a check

```ts
priority: (row.priority ?? "medium") as Priority   // "urgent" sails through
```

That told the compiler a server or legacy-localStorage value was one of
four words without checking. Once the catalogues held pairs,
`PRIORITY_LABEL["urgent"]` missed and `.fr` on the miss threw. Narrowed now
by `asStatus` / `asPriority` at the boundary, and `resolve()` degrades a
missing pair instead of crashing.

### Four checker holes, each one hiding real strings

The tool was wrong four separate times, and each time it was reporting
**zero** while French was on screen:

1. **Looked for French.** Missed "Mensuel" and "Annuel" (no diacritics, no
   function words) and could never catch three plan descriptions that were
   English-only where a French operator read English. Rewritten to flag
   text not wrapped in a translation call, in **any** language.
2. **Blanked multi-line comments with plain spaces**, deleting their
   newlines, so every reported line number after a block comment was too
   low.
3. **Applied identifier exclusions everywhere.** Every one-word label —
   "Pays", "Taux", "Date", "Actif", "Statut", "Fermer", "Continuer" — read
   as a code identifier and was silently skipped. Those rules now apply
   only to literals in code, not to JSX text or copy-bearing props. This
   found **ten more strings in two files I had already called finished.**
4. **Only matched text between `>` and `<` with no braces inside.** So
   `<p>Étape {step} sur {totalSteps}</p>` was invisible, and the wizard's
   step counter stayed French in an English UI. Runs now also end at `{`
   and start after `}`; that found eight more real strings.

### Setting `document.title` — two wrong fixes that looked right

1. `document.title = ...` in an effect. The framework writes `<head>` after
   hydration and **overwrote it inside the first second.**
2. Rendering a `<title>` for React to hoist. React hoisted it but did not
   dedupe against the framework's, leaving **three** `<title>` tags. The
   browser uses the first — still French.

A `MutationObserver` re-applies the correction whenever something changes
the head. It cannot be raced.

### Reporting a pass from an environment that could not fail

My sandbox has no API access, so `alerts` was always `[]`. **Every
data-dependent path went untested** and I still called the work done. Both
section-1 bugs live on those paths. When I finally needed real data I
stubbed the API in Playwright; that should have been the first move.

Worse: my browser sweep seeded `localStorage` to *skip* onboarding, so I
never walked the wizard at all before declaring English complete. The user
found the step-6 crash.

### Numbers I reported wrong

"186 keys" in `pipeline/i18n.py` (actually **92 per language**).
"746 untranslated strings" (actually **1119**). Count, do not estimate.

### Dead CSS that typechecked

`hsl(var(--accent)/0.22)` resolves to **nothing** when the tokens are
`oklch()` values — the browser drops the declaration. Confirmed in a real
browser (`backgroundImage` read `none`). Use `color-mix(in oklab, …)` or
Tailwind's own opacity utilities.

### My test was wrong, not the code (twice)

`innerText` returns CSS-uppercased text, so a case-sensitive assertion
failed on styled copy. And Playwright's `addInitScript` re-runs on reload,
reseeding the legacy key I was trying to prove had been migrated away.

---

## 4. Ce qu'il compte faire ensuite

In priority order.

### 1. Put authentication in front of the API — highest risk

There is none. `/contractors` and `/assignments` now hold real people's
names, phone numbers and emails, and **anyone who knows the URL and guesses
a company name can read them.** `company_name` partitions the data; it is
not access control and must never be described as such.

`migrations/001_contractors_and_assignments.sql` leaves Row Level Security
**deliberately disabled**, with a commented policy at the bottom as a
starting point. Enabling RLS before there is a real authenticated tenant
would lock the service out of its own tables. Order: auth first, then
policies keyed on the authenticated tenant, then RLS.

### 2. Deploy this branch, or decide not to

`origin/main` is a **landing page** (`ae6eca9`) and shares **no common
ancestor** with `feature/onboarding-view`:

```
git merge-base origin/main feature/onboarding-view   # → nothing
```

So whatever is deployed today is not this application. Nothing in this
document is live until that is resolved. **This is the operator's call, not
a merge to make quietly.**

### 3. Read-time alert translation

`fire()` passes the message key positionally to `save_alert`, so **every
alert row carries `alert_key`** — good. But `save_alert` stores the
*rendered* message and **not** the template parameters, so existing rows
cannot be re-rendered in another language.

The fix is a backend schema change: store `alert_key` plus a JSON blob of
the params, and render at read time in the caller's language. Until then an
English operator sees French text on rows fired before the change. Do not
try to translate the rendered sentence — that is re-deriving meaning from
prose.

### 4. Three known pre-existing bugs, left alone on purpose

Each is out of scope for the i18n work and each is real:

- **`pipeline/alerts.py:18`** calls `create_client()` at import with no
  guard. Without `SUPABASE_URL` the process dies on import.
- **`industry-view.tsx`** `estimateDowntimeCost()` returns a flat
  **2800 / 900** invented figure, and stamps `€` on it regardless of the
  operator's currency. The logistics cost view already solved this
  properly: a named, editable rate with the arithmetic shown.
- **`__pycache__` is tracked** in the backend repo.

### 5. Waiting on the operator

- **Upload the 8 test CSVs in `test-data/`.** Every screen is in its empty
  state until then, which is why so much of this work was verified against
  stubbed data rather than real data.

---

## How to check the work rather than trust it

```bash
# Nothing unlocalized. Exits 1 if anything is.
node scripts/check-i18n.mjs --strict

# Types, including every catalogue accessor's call sites.
npx tsc --noEmit

# The wizard actually completes: 8 steps x 7 sectors x 2 languages.
npx next build && npx next start -p 3300 &
node scripts/smoke-onboarding.mjs 3300

# Backend: byte-identical output, and the CRM demo.
cd ../sentria
python3 pipeline/demo_supplier.py | md5sum   # 6a65a141cfcf16f954031a5c259aad2a
python3 pipeline/demo_crm.py                 # must exit 0
```

**Re-run `demo_supplier.py` after any backend change and require the
output to be byte-identical.** That is the contract that catches a
pipeline regression.
