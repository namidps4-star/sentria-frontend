import type { MetadataRoute } from "next"

/* This is the signed-in app, kept out of search by a noindex tag (app/layout.tsx).
   It is not disallowed here, because Google must be able to crawl a page to see
   its noindex. The public landing, sentriahq.dev, is a separate site with its
   own sitemap. /t/ holds one-task links sent by text. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/t/"] }],
  }
}
