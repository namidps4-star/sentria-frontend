# Sign-up email (F-EMAIL)

Supabase sends the confirmation email, not the app. Nothing in a deploy changes
it: the template and the sender live in the Supabase dashboard. This folder holds
the template so it has a source of truth and a test.

`confirmation.html` is one file for both languages. It reads the language the
person saw on the sign-up screen (`user_metadata.language`, set by
`components/sentria/auth-screen.tsx`) and falls back to French when it is missing.
It never prints the name, the company or the username, because whoever fills the
form types those, and the email would reach the address they typed.

## Set it up (about 15 minutes)

1. **Template.** Supabase dashboard, Authentication, Email Templates, "Confirm signup".
   Paste the whole of `confirmation.html` as the message body. Subject:
   `Confirmez votre email · Confirm your email`. Save.
2. **Sender.** Authentication, SMTP Settings, turn on custom SMTP.
   - Sender email: an address on your own domain, such as `no-reply@your-domain`.
     Sender name: `SentrIA`.
   - If you send mail with Resend: host `smtp.resend.com`, port `465`, username
     `resend`, password a Resend API key. Verify the domain in Resend first (the
     DNS records it shows), or the mail goes to spam or is refused.
   - The key stays in the dashboard. Never put it in the repo.
3. **Links.** Authentication, URL Configuration. The Site URL is the production
   app. Add the preview address to the redirect list if you test there. The app
   asks for a redirect to the address it runs on.
4. **Try it.** Open the sign-up screen, pick the language, and create an account
   with an address you can read. Check the sender, the words, and that the button
   opens the app. Do it once in French and once in English.

Supabase's own sender is meant for tests and allows only a few emails an hour,
so custom SMTP also lifts that limit.

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
