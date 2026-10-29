# Google Search Console

Two sites, one job each.

- **`https://sentriahq.dev`** is the public landing. It lives in the `sentria-landing-page` repo and is the only site meant for search.
- **`https://app.sentriahq.dev`** is the signed-in app (this repo). It sends `noindex`, so Google keeps it out.

## What the code does

Landing (`sentria-landing-page`):
- `content/seo.ts` holds the English and French title and description. The server HTML carries English, which is what a crawler reads. `components/document-language.tsx` swaps in French for a French visitor on the home page. The Privacy and Terms pages keep their own titles.
- `app/sitemap.ts` lists `/`. `app/robots.ts` allows the site and names the sitemap.
- Target phrases (change them in `content/seo.ts`): English "operational decision software", French "décision opérationnelle". Markets: Benin, Côte d'Ivoire, Senegal, Kenya, Uganda.

App (this repo):
- `app/layout.tsx` sets `noindex, nofollow`. `app/robots.ts` does not block the app, so Google can read the `noindex`, and blocks `/t/` (one-task links sent by text, which also send `noindex`). There is no sitemap.
- The title and description in `lib/seo.ts` only set the browser tab.

## Your turn (needs your Google account)

1. Open Google Search Console and add a **Domain** property for `sentriahq.dev`. One property covers the landing and the app subdomain.
2. Verify ownership with the DNS record Google gives you. Keep the token out of the repo.
3. Open Sitemaps and submit `https://sentriahq.dev/sitemap.xml`. It should show one page and no errors.
4. Do the same in Bing Webmaster Tools. It can import the Search Console property.
5. Write down who owns the login and the date you submitted the sitemap: `____`.
6. Check the Pages report once a week for the first month. Write down the pages indexed and the first impressions, with the date. Do not quote a ranking until it is measured.
7. After the next deploy, use the URL Inspection tool on `https://app.sentriahq.dev/` and check it reports "noindex".

## Check it yourself

- View the page source of `https://sentriahq.dev/` and find `<title>`, `<meta name="description">` and `<link rel="canonical">`. They must be in the first response, not added by the browser.
- View the page source of `https://app.sentriahq.dev/` and find `<meta name="robots" content="noindex, nofollow">`.
- Open `https://sentriahq.dev/robots.txt` and `https://sentriahq.dev/sitemap.xml`.

## Not done, and why

- Separate French and English addresses, and `hreflang` links between them. One address serves both languages, so there is nothing to link yet. This needs language routes in the landing.
- The target phrases are not in the landing's visible headline. The headline is split into letters for an animation and hidden from screen readers, so a crawler may not read it as a heading. That is a design decision.
- The phrases are my choice, not a keyword study. Nothing here shows search volume for them.
