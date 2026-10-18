# F-STATUS phase 0: a status page, build or buy

Date: 2026-10-18. Status: plan only. Nothing is built, and nothing here is verified against the vendors' current plans. Anything marked UNVERIFIED is from memory.

## What the card asks for
A public page that says whether SentrIA is up. It must stay up when SentrIA is down. So it cannot run on Render, Vercel or Supabase, and it needs its own domain or sub-domain and its own sender for emails.

The card itself says this is premature while there are no users. It is cheap to prepare, so this plan keeps it to an hour of setup and no code in our repos.

## Decision: buy, do not build
Building a status system means writing monitoring, an incident workflow, email sign-up with double opt-in, and hosting it somewhere separate. That is weeks of work for a page that people open a few times a year. A hosted product does all of it.

## Options (UNVERIFIED: check each one's free plan before choosing)
| Option | Fits because | Watch out for |
|---|---|---|
| A hosted status product with a free plan (for example Instatus, Better Stack, Atlassian Statuspage) | Separate host, built-in monitors, email subscribers, incident and maintenance posts | The free plan may limit subscribers, monitors or custom domain |
| Upptime (open source, runs on GitHub Actions and GitHub Pages) | Free, separate from our hosts, nothing to pay | GitHub Actions is the monitor. No email sign-up. Checks every 5 minutes at best |
| Build our own | Full control | The weeks of work above. Not recommended |

**Recommendation:** start with Upptime if you want zero cost and no new account, or a hosted product with a free plan if you want email sign-up for clients. Both are an afternoon.

## What to monitor
1. The API: `GET /health` on the API address. It answers 200 without sign-in, and it stays open even when the Cloudflare origin lock (S-7) is on.
2. The app: the frontend address (for example `sentria.vercel.app`).
3. Sign-in: Supabase's own status page already exists. Link to it, do not duplicate it.
4. Texts and email: Twilio and Resend publish their own status pages. Link to them.

Do not monitor `/health` more often than once a minute. It reads the database.

## Components to show
App, API, Sign-in, Text alerts, Email reports.

## Steps (about an hour)
1. Pick the option above.
2. Give the page its own address, not under the app's domain. For example `status.<your-domain>` once you have a domain, or the product's free address until then.
3. Add the monitors from the list above.
4. Add the components. Write one sentence for each in plain words.
5. Add the status link to the app. The place is the Help and feedback dialog and the footer of the legal text. That small change is the only code, and I can make it once the address exists.
6. Test it the card's way: turn off the API on purpose on a test copy and check the page still loads and shows red.

## Exit criteria from the card
1. The page loads even when the main app, database and host are down. Test by step 6.
2. Incident and maintenance posts tested once.
3. No shared single point of failure left undocumented. The only shared piece to check is the email sender: use the product's own, never Resend.

## Not now
Per the card, wait until there is a first pilot and a real domain. Do the steps above the week before the pilot starts.
