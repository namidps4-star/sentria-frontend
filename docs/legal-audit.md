# LEG-1 legal and compliance audit (draft)

Date: 2026-10-18. Scope: Africa (Benin first, then the rest of West Africa and the continent) and the EU.

**Status: DRAFT. Nothing here is legal advice and nothing says SentrIA complies with any law.** Every legal point is UNVERIFIED until a lawyer confirms it. Facts about the code were read from the repos.

## 1. What data SentrIA holds (from the code)

| Data | Where | Whose |
|---|---|---|
| Login email, password hash, username | Supabase Auth | The user |
| Company name, sector, settings | Supabase `accounts.profile` | The company |
| Uploaded CSV rows turned into alerts, costs, sites | Supabase tables | The company's own business data |
| Contractor names and phone numbers | Supabase `contractors` | **Third parties** who never signed up |
| SMS texts sent and received | Supabase `sms_messages`, Twilio | Contractors, company staff |
| Questions to Ask and the company data sent with them | Google Gemini | The company, possibly personal data inside |
| Errors and traces | Sentry (`traces_sample_rate=1.0`) | Technical, may carry ids |
| Page views | Vercel Analytics | Visitors |
| Screens opened, onboarding steps, import results (only after a yes, no names or file content) | PostHog, EU region by default, off until a key is set | Users who accepted |
| Browser storage | 39 `localStorage` keys (settings, language, sector, theme) | The user |

## 2. Outside services (processors)

| Service | Used for | Region (to confirm) | DPA signed? |
|---|---|---|---|
| Supabase | Auth and database | Project region UNVERIFIED | UNVERIFIED |
| Render | API hosting | UNVERIFIED | UNVERIFIED |
| Vercel | Frontend hosting and analytics | Mostly US | UNVERIFIED |
| Twilio | SMS | US | UNVERIFIED |
| Google Gemini | AI answers | US | UNVERIFIED, and whether the paid API tier excludes training on the data is UNVERIFIED |
| Resend | Email | US | UNVERIFIED |
| Sentry | Error tracking | UNVERIFIED | UNVERIFIED |
| PostHog | Usage statistics, after consent (F-ANALYTICS) | EU by default | UNVERIFIED |

Fonts come from `next/font`, which serves them from our own host at runtime. No Google Fonts request from the browser.

## 3. Risk register

Severity: **High** blocks a launch in the named region. **Medium** fix before scaling. **Low** tidy.

| # | Risk | Region | Severity | Next step |
|---|---|---|---|---|
| R1 | No signed data processing agreement with any service in section 2 | EU, Africa | High | Accept each vendor's standard DPA, file copies |
| R2 | Data goes to the US and other regions. Transfer rules differ per country (EU needs a transfer tool; several African laws need authority approval or an adequacy test) | EU, Africa | High | Counsel to list each country's rule. Check which Supabase region is used |
| R3 | Contractor phone numbers and SMS: people who never agreed. The company is the controller, SentrIA the processor, but the app has no text saying the company must have a legal basis | EU, Africa | High | Add a customer terms clause, and a short notice in the SMS flow. Counsel to confirm |
| R4 | No customer contract that names SentrIA as processor and the company as controller | EU, Africa | High | Counsel drafts a B2B DPA |
| R5 | Gemini receives company data. Terms on training and retention not checked | EU, Africa | High | Check the Google API data terms. Strip names and phones before the call if they are not needed |
| R6 | Registration with the data authority may be required before processing (for example Benin's APDP, Senegal's CDP, Côte d'Ivoire's ARTCI, Nigeria's NDPC for larger processors) | Africa | High | Counsel confirms per country. Do not launch in a country until answered |
| R7 | No named EU representative or data protection officer decision | EU | High if EU customers are targeted | Counsel decides. Needed for EU launch only |
| R8 | No breach process (who is told, within how long) | EU, Africa | Medium | Write a one-page runbook. EU rule is 72 hours to the authority |
| R9 | Backup retention unknown. The privacy text says "to be confirmed" | EU, Africa | Medium | Read Supabase backup settings, write the real period into the privacy text |
| R10 | Vercel Analytics and Sentry run without a consent step. Vercel Analytics is cookieless. EU rules on cookieless analytics vary by country. PostHog (F-ANALYTICS) now asks first, so only these two remain | EU | Medium | Counsel decides. The new banner can hold them too |
| R11 | Sentry traces at 100 percent may capture personal data in URLs or payloads | EU, Africa | Medium | Lower the rate, scrub payloads, confirm `send_default_pii` stays off |
| R12 | Account deletion does not reach backups, Twilio logs, or Gemini logs | EU, Africa | Medium | Say so in the privacy text. Ask vendors for their deletion path |
| R13 | A company with several accounts: deleting the last account deletes company data, deleting one keeps it. Behaviour is in the privacy text but not in the terms | All | Low | Add a line to the terms |
| R14 | Accessibility not audited. EU accessibility law covers some digital services | EU | Medium | Run the `accessibility-audit` skill, fix keyboard and contrast gaps |
| R15 | Terms have no governing law, court or liability cap text agreed by counsel | All | Medium | Counsel completes. Pick Benin law or another, state it |
| R16 | SMS sending rules (sender id registration, opt-out, quiet hours) differ by country | Africa, EU | Medium | Check Twilio's country rules for each target country |
| R17 | Money and tax: invoices, VAT, mobile money not in scope of the code yet | All | Low | Counsel and accountant, before charging |
| R18 | Children: no age gate. B2B tool, so low risk | All | Low | Terms say users must be adults |

## 4. Already in place

1. Privacy and terms in the app, English and French, marked as drafts, contact from an environment variable.
2. Terms box on sign-up, with the version accepted stored.
3. Export of all account data, and deletion of the account (Settings, "Your data").
4. Each company sees only its own data (checked by tests).
5. Alerts, SMS and Ask have limits so one account cannot run up costs.

## 5. Launch call (a recommendation, not legal advice)

- **Benin and one or two friendly West African pilots: conditional go.** Clear R1, R3, R4, R5 and R6 for that country first. Keep the "draft" banner until a lawyer reads the texts.
- **EU: no-go for now.** R2, R7, R10 and R14 add work on top of the items above. Start after the pilot, with counsel.

## 6. For counsel (UNVERIFIED items)

1. Which law and authority apply in each target country, and what registration is needed.
2. Whether SentrIA is a processor everywhere, or a controller for any data (login, analytics).
3. Transfer rules for the vendors in section 2, per country.
4. Whether an EU representative or a DPO is required.
5. The B2B contract, the DPA, the liability cap, the governing law.
6. Cookie and analytics consent rules per country.
7. SMS rules per country.

## 7. What the founder can do this week

1. Open each vendor's account and find the Data Processing Agreement. Accept it and save a copy.
2. Note the Supabase and Render regions.
3. Check Gemini's data terms for the plan in use.
4. Set `NEXT_PUBLIC_LEGAL_EMAIL` on Vercel.
5. Book a first call with a lawyer who knows Benin or OHADA business law and data protection.
