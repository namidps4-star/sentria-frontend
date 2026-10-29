# Google Search Console

What is in the code, what you do in Google, and how to check it.

## What the code does

- One public page, `/`, serves French and English. Its title and description come from `lib/seo.ts`; `app/layout.tsx` serves the French pair to crawlers and `components/sentria/document-language.tsx` swaps in the visitor's language.
- `app/sitemap.ts` lists `/`. `app/robots.ts` allows the site and blocks `/t/`, where the one-task links sent by text live. Those pages also send `noindex`.
- Target phrases (change them in `lib/seo.ts`): French "alertes de stock en temps réel", English "real-time stock alerts". Markets: Benin, Côte d'Ivoire, Senegal, Kenya, Uganda.

## Your turn (needs your Google account)

1. On Vercel, set `NEXT_PUBLIC_SITE_URL` to the public address you want indexed, then redeploy. Without it the sitemap and canonical use the Vercel address. (Not verified: whether it is set.)
2. Open Google Search Console and add a property. Choose "Domain" if the DNS is yours, otherwise "URL prefix".
3. Verify ownership with the DNS record Google gives you. Keep the token out of the repo.
4. In Search Console, open Sitemaps and submit `sitemap.xml`. It should show one page and no errors.
5. Do the same in Bing Webmaster Tools. It can import the Search Console property.
6. Write down here who owns the login and the date you submitted the sitemap: `____`.
7. Check the Pages report once a week for the first month. Write down the pages indexed and the first impressions, with the date. Do not quote a ranking until it is measured.

## Check it yourself

- View the page source of `/` and find `<title>`, `<meta name="description">` and `<link rel="canonical">`. They must be in the first response, not added by the browser.
- Open `/robots.txt` and `/sitemap.xml` on the live address.
- Open any `/t/...` link and look for `<meta name="robots" content="noindex, nofollow">`.

## Not done, and why

- Separate French and English addresses (and `hreflang` links between them). One address serves both languages, so there is nothing to link yet. This needs language routes.
- The target phrases are not in the visible heading or first paragraph. That is the sign-in screen's copy, so it is your call.
- The signed-in app shares the address with the landing. It is a client-rendered screen behind sign-in, and the search-facing text is the hidden intro in `app/page.tsx`.
- Whether the public landing is this app or the separate landing-page repo is not confirmed. If it is the other repo, its titles need the same work.
