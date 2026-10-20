import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/site"

/* The signed-in app lives on the same address as the landing, so only the
   landing is meant for search. /t/ holds one-task links sent by text. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/t/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  }
}
