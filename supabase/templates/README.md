# Sign-up email (F-EMAIL)

Supabase sends the confirmation email, not the app. Nothing in a deploy changes
it: the template and the sender live in the Supabase dashboard. This folder holds
the template so it has a source of truth and a test.

`confirmation.html` is one file for both languages. It reads the language the
person saw on the sign-up screen (`user_metadata.language`, set by
`components/sentria/auth-screen.tsx`) and falls back to French when it is missing.
It never prints the name, the company or the username, because whoever fills the
form types those, and the email would reach the address they typed.

## Set it up (about 15 minutes, no paid Supabase plan needed)

Do the sender first. Custom SMTP is free on every Supabase plan, and Supabase's own
sender cannot do this job: it only sends to addresses in your own Supabase
organization (since September 2024), so a customer would get nothing. Since
3 June 2026 a free project created after that date also cannot edit its email
templates while it uses Supabase's own sender. Turning on custom SMTP unlocks the
editor on any plan.

1. **Sender.** Authentication, SMTP Settings, turn on custom SMTP.
   - Sender email: an address on your own domain, such as `no-reply@your-domain`.
     Sender name: `SentrIA`.
   - If you send mail with Resend: host `smtp.resend.com`, port `465`, username
     `resend`, password a Resend API key. Verify the domain in Resend first (the
     DNS records it shows), or the mail goes to spam or is refused.
   - The key stays in the dashboard. Never put it in the repo.
2. **Template.** Authentication, Email Templates, "Confirm signup". Paste the whole
   of `confirmation.html` as the message body. Subject:
   `Confirmez votre email · Confirm your email`. Save.
3. **Links.** Authentication, URL Configuration. The Site URL is the production
   app. Add the preview address to the redirect list if you test there. The app
   asks for a redirect to the address it runs on.
4. **Try it.** Open the sign-up screen, pick the language, and create an account
   with an address you can read. Check the sender, the words, and that the button
   opens the app. Do it once in French and once in English.

## Changing the email

Edit `confirmation.html`, paste it into the dashboard again (nothing deploys it),
then run `node tests/e2e/signupemail.js`. The test renders the file with Go's own
template engines when Go is installed, so a syntax slip is caught before Supabase
sees it.

The colours are written as hex because email apps do not read CSS variables. They
are the brand tokens converted to sRGB, and the test fails if the tokens move.

## Not done here

The reset-password email is a separate Supabase template and still uses the
default. It can reuse this layout; it needs its own paste and its own test.
