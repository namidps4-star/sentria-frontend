/** The public address of the site, for canonical links, the sitemap and
 *  social cards. Set NEXT_PUBLIC_SITE_URL to the real domain on Vercel.
 *  Without it, Vercel's production address is used, then localhost. */
export function siteUrl(): string {
  const set = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  const raw = set || (vercel ? `https://${vercel}` : "http://localhost:3000")

  return raw.replace(/\/+$/, "")
}
