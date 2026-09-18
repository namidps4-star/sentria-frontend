# SentrIA handover

> Written 2026-09-18, in English by request. Previous handovers were in
> French; this one replaces the 2026-09-17 version.
>
> | Repo | Branch | HEAD | State |
> |---|---|---|---|
> | `namidps4-star/Sentria` | `main` | `95b6f0f` | pushed, deployed on Render |
> | `namidps4-star/sentria-landing-page` | `main` | `a3d8a8a` | merged, untouched this session |
> | `namidps4-star/sentria-frontend` | `feature/onboarding-view` | `4c900c2` | pushed, never merged |
>
> Nothing is waiting locally in the frontend. The backend working tree is
> clean except for `__pycache__` files, which are tracked in git by
> mistake (see section 5).

---

## 1. The objective

Make the logistics side of SentrIA as real as the health side, and make
the product address the operator by name.

**a. One way to show selected priorities.** Onboarding lets the operator
pick priorities. Five different screens rendered that choice five
different ways, and one of them invented a default.

**b. Turn the logistics priority views into real product.** Blockages,
cost, waiting and anticipate were premium-looking shells filled with
hardcoded numbers. They had to become derivations of the alerts actually
returned by the backend, with honest empty states when there is nothing to
show.

**c. Reproduce the reference flow aesthetic exactly.** The user supplied a
screenshot: a charcoal capsule, lime circular nodes, connectors passing
behind the circles. Not "in that spirit", identical, on all four screens.

**d. Fill the two blank port stages.** Arrival and Customs always read
"Aucun signal" because no backend signal existed for them. A missing data
source, not a display bug.

**e. Let one company run several logistics activities.** A port operator
may also run cold chain. Onboarding forced a single choice.

**f. Give the product the operator's identity.** Company name and
timezone, captured at onboarding, used in the report header and in the Ask
AI prompt, with alert timestamps converted to the operator's own zone.

---

## 2. The problem we are trying to solve

Same single thread as the previous handover, one layer deeper: **the
interface asserted things the data did not support.** On the logistics
side it was not a rounding error, it was fabrication.

### The logistics views were theatre

Four views rendered figures that came from nowhere. Two of them
(`logistics-cost-view`, `logistics-waiting-view`) shipped a `TICK_OFFSETS`
array driven by `setInterval`, so the numbers visibly moved on screen.
Nothing was measuring anything. A demo that animates invented data is
worse than a blank panel, because a blank panel cannot be believed.

### Money was invented from thresholds of zero

The cost model priced "cycles" against a threshold of zero, which yielded
214 cycles at 30 EUR, so 6420 EUR of exposure that did not exist. A
separate bug priced `transport.service.*` kilometres at the per-day rate:
22000 km at 15 EUR came out as 330000 EUR on a single card.

### Exposure summed history instead of reading the present

`deriveExposure` walked every alert row, so an asset that reported the
same breach hourly was billed once per report. Cold chain read 9900 EUR
where the current state was 5745 EUR.

### The onboarding vocabulary did not match the consumer vocabulary

Onboarding wrote `port-conteneurs` to `localStorage`. Every consumer
expected `port`. The value fell through to the `multi` branch, so a real
port operator got a 19 stage union chain and generic checks instead of
their own 5 stage chain. Silent, and it looked plausible enough to survive
several rounds.

### Zero still did not distinguish itself from "no data"

Carried over from the previous session and now applied to logistics: every
one of the eight logistics panels needed an explicit empty state, because
an empty flow track reads as "everything is fine".

### The report was entirely fictional

`report-view.tsx` carried a 75 line `MOCK_DATA` block: site name "Clinique
Nord, Site principal", inventory 82 percent, cold chain 98.6 percent.
`app-shell.tsx` rendered `<ReportView />` with no props at all. There was
no wiring to remove, because there was no wiring.

### Dark mode did not exist, and the tokens behind it were wrong

`app/layout.tsx` hardcoded `className="light"` on `<html>`, so the theme
toggle did nothing. Underneath, the dark block still carried shadcn
defaults: `--ring`, `--accent` and `--sidebar-primary` at hue 264 (blue),
and `--sidebar` equal to `--card`.

---

## 3. The important files

### Frontend: `namidps4-star/sentria-frontend`, branch `feature/onboarding-view`

| File | Role |
|---|---|
| `lib/logistics-signals.ts` | **The data layer, 1400 lines. Start here.** `METRICS` maps each `alert_key` to a metric definition with a per ops type stage mapping. Everything else derives from it: `stageOf`, `deriveStages`, `deriveBreakpoints`, `deriveExposure`, `deriveQueues`, `deriveAnticipation`, `deriveRecommendations`, `currentReadings`, `chainFor` |
| `components/sentria/flow-track.tsx` | The reference flow. Charcoal `bg-track` capsule, lime circular nodes, connectors sized `-mx-2 h-4 min-w-4 flex-1` so the circles overlap them. Labels live in a separate `<ul aria-hidden>` below. Shared by all four logistics views |
| `components/sentria/logistics-blockages-view.tsx`<br>`logistics-cost-view.tsx`<br>`logistics-waiting-view.tsx`<br>`logistics-anticipate-view.tsx` | The four priority views. Each one reads alerts, derives, and shows an empty state rather than a zero |
| `lib/activities.ts` | Activity catalogue plus `normalizeOpsType` (maps `port-conteneurs` to `port`), `readOpsTypes` / `writeOpsTypes` / `opsTypeFor`, `SINGLE_OPS_TYPES`. Multi activity support lives here |
| `lib/priorities.ts` | The single priority catalogue, shared by onboarding and dashboard. Replaced five duplicated renderings |
| `lib/company.ts` | **New.** Company name and timezone: `TIMEZONES` (5 African and European zones), `readCompanyName`, `readTimezoneId`, `detectTimezoneId` (via `Intl.DateTimeFormat`), `formatInCompanyZone` |
| `lib/report.ts` | **New.** `buildReport(alerts, companyName, timezoneId, days)` returns KPIs, trends and 40 alert rows, all counted from real alerts, all timestamped in the operator zone, `empty: true` when there is nothing |
| `lib/theme.ts` | `THEME_INIT_SCRIPT` inlined in `<head>` so the theme applies before paint, `DEFAULT_THEME = "light"` |
| `components/sentria/onboarding-modal.tsx` | 1560 lines. Company name, timezone, multi activity picker, select all / deselect all per priority step, flush grids for odd card counts, CSV import panel with a per file activity selector |
| `components/sentria/report-view.tsx` | Split into a fetching `ReportView` and a presentational `ReportBody` |
| `components/sentria/ask-view.tsx` | Sends `company_name`, `timezone` (IANA) and `timezone_label` with every question |
| `test-data/` | 8 CSVs plus a README, validated against the real pipeline |

### Backend: `namidps4-star/Sentria`, branch `main`

| File | Role |
|---|---|
| `pipeline/port_flow.py` | **New, 361 lines.** The arrival and customs signals: ETA drift, berth window, discharge overrun, free time risk, missing documents, dwell, inspection. `projected_clearance_hours` adds 6 h per missing document and 24 h per inspection to the remaining median |
| `pipeline/alerts.py` | Still the core. `fire()` now passes `risk_score` through to `translate()` |
| `api/main.py` | `/ask` reads `company_name`, `timezone`, `timezone_label`, adds a "WHO YOU ARE TALKING TO" block to the prompt, and renders alert timestamps with `zoneinfo.ZoneInfo` |
| `pipeline/demo_supplier.py` | Still the guard rail. Its output must stay byte identical after any backend change |

---

## 4. What was tried and failed

The real mistakes. As before, the most useful section.

### Fourteen fabricated figures, found one at a time

Replacing the hardcoded logistics numbers was not one edit, it was a
sequence of discoveries, and most were found by testing rather than by
reading:

- `formatHours` printed **"21 h 60"**, because minutes were rounded after
  the hour was split off instead of before.
- French plurals came out as **"4 signalaux"** and **"2 cass"**, from
  naive `+ "s"` and `+ "x"` concatenation.
- "Ouvert depuis" read the **newest** reading, so a condition open for
  48 h displayed "2 h".
- `logistics.risk.elevated` mapped to **no stage in 4 of the 5 chains**,
  so the most common alert key was silently dropped.
- `stageOf` ignored the chain for `multi` **despite a comment claiming it
  did not**, so a temperature reading for a port plus warehouse operator
  landed on `transportRefrigere` and was discarded.

### A backend bug that shipped a template literal to users

`fire()` takes `risk_score` as a named parameter, so `{risk_score}` was
never substituted. Messages went out containing the literal text
**"(score {risk_score}/100)"**. In production. Found only when the test
CSVs produced real alerts to read.

### The recommendation ranking was backwards, twice

First it ordered by leverage before risk, so a vessel at risk 81 outranked
a crane at 95. Then, once corrected to `risk + downstream * 5`, the
exposure figure was keyed on the asset alone, so GRUE-02's 1110 EUR
appeared in full on both its Quai card and its Cour card. Fixed by keying
on `stage:equipment` (720 EUR at Quai).

### A bug I fixed that was not mine, and one I wrongly assumed was

The hydration mismatch was real: six `useState` initialisers read
`localStorage`. Before claiming credit or blame I stashed everything and
tested `bcf5ad6`: the error was **pre-existing**, not introduced by this
session's work. That check cost five minutes and prevented a false
statement in both directions.

### Two bugs the mock data had been hiding in the report

These only appeared once real numbers arrived, which is the argument for
deleting mocks rather than improving them:

- `DeltaBadge` appended **"%" to a plain alert count**, and painted a rise
  **green**. More alerts read as good news.
- `TrendCard` compared the first day against the last as a percentage, so
  **every card read "stable"**, and it inherited the metric unit, so a
  single alert printed as **"1.0 °C"**.

### I gave advice about a feature that did not exist

I told the user to "hide the multi-sector picker" at onboarding. There was
no multi-sector picker. `finish()` hardcoded `JSON.stringify([sector])`. I
said so plainly and built the thing instead of quietly changing subject.

**Lesson:** I described the code from memory instead of reading it.

### My own test harness produced three false results

- I shadowed the fake Supabase client's `eq` **method** with an `eq`
  **attribute**, so every query returned everything.
- I overrode `fire` in a test without the `risk_score` pass through, which
  masked the very bug I was verifying.
- Two DOM scrapers climbed to the wrong ancestor and reported empty
  panels that were rendering correctly.

**Lesson:** when a measurement is surprising, suspect the instrument
first. Twice it was the instrument.

### The structural limit is unchanged

**The deployed site is still unreachable.** The sandbox proxy returns 403
on CONNECT for Render and Vercel. Everything in this session was verified
against a local dev server and the real pipeline, never against
production. Ask AI with the company name and timezone is therefore
**built and locally verified, not confirmed live**.

---

## 5. What comes next

### Blocking, on the user's side

**1. Upload the 8 test CSVs.** They live in `test-data/` with a README
explaining what each one should produce. Until they are uploaded the
logistics views correctly show empty states, which reads as "the feature
is broken" to anyone who does not know.

**2. Confirm Ask AI answers on the deployed site**, with the company name
and timezone in play. The payload and the prompt are verified locally; the
round trip is not.

**3. Decide what happens to the frontend branch.** This changed since the
last handover and the last handover was **wrong** about it.

`origin/main` **does exist** in `sentria-frontend`. The previous
PASSATION.md stated it did not. What is actually true is worse and more
specific:

- `origin/main` tip is `ae6eca9`, dated 2026-09-09, message "landing
  page", holding **39 files**.
- `feature/onboarding-view` tip is `4c900c2`, dated 2026-09-18, holding
  **517 files** across 86 commits.
- The two branches have **no common ancestor**. `git merge-base` returns
  nothing.

So there is no ordinary merge and no ordinary pull request. Merging needs
`--allow-unrelated-histories`, or `main` gets reset to the feature branch,
or the branch simply stays the trunk and `main` is deleted. This is a call
for the user, not a cleanup to perform quietly, because one of those
options discards a branch.

### Carried over from the previous handover

| Item | State |
|---|---|
| SQL migration for `business_type` | **Done.** The user confirmed it was run |
| API has no authentication | Still open. CORS only protects browsers. Any server side caller can burn the Gemini quota through `/ask`. Worth handling before a real launch |
| No `--warning` token | Still open. The WARNING pill uses raw `bg-amber-500/15 text-amber-600`. Nothing is broken, amber reads correctly on both themes, a token would be cleaner |
| 48 raw hex values in `pricing-view.tsx` | Left alone **at the user's explicit request**. That view carries a deliberate light palette |
| Lime contrast 1.24 on light backgrounds | Left alone on purpose. Severity is always written as text in its own cell, so meaning never depends on colour |
| `Procfile.txt` | Render does not read it. Content is correct, the dashboard command is what actually runs |

### Noticed while writing this, not yet fixed

**`__pycache__` is tracked in git in the backend.** 12 `.pyc` files are
under version control, which is why `git status` is never clean there.
A `git rm -r --cached` plus a `.gitignore` line would settle it. Not done
because it touches tracked files in a repo that is deployed, and it was
not part of any request.

### Product work that is now unblocked

- **Recommendations exist for logistics** (`deriveRecommendations`,
  grouped by stage and equipment, scored `risk + downstream * 5`). The
  industry side still uses `recommendations-board-view.tsx` with its own
  structure. Unifying them is the obvious next step and nobody has asked
  for it yet.
- **Arrival and Customs now produce signals**, so the port chain has no
  permanently blank stage. The thresholds in `port_flow.py` are informed
  guesses about port operations, not measured against a real terminal.
  They deserve a review by someone who runs one.

---

## Conventions to keep

- **Never use em dashes** in replies. Explicit request.
- **Summaries in ADHD friendly format**: scannable headings, short lists,
  bold on what matters, tables over paragraphs, bad news marked as bad
  news.
- **Explain what changed in simple language after every task**, before
  moving on.
- **Always work on `feature/onboarding-view`** in the frontend. Never push
  elsewhere without asking.
- **Commit messages in plain English**, never compressed.
- **Re-run `pipeline/demo_supplier.py` after any backend change.** Byte
  identical output is the proof that pharmacy behaviour did not move.
- **Run `pnpm install` at the start of the session.** It is what makes
  `tsc`, `next build` and browser testing possible, which is the
  difference between verifying and guessing.
