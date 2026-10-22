/** @type {import('next').NextConfig} */
/* S-7: headers every page carries. No Content-Security-Policy yet: the app
   uses inline styles and a script from Vercel Analytics, so a strict one needs
   its own pass. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

const nextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      /* Pictures in public/ are not fingerprinted: a day in the browser, a week
         served stale while it refreshes. Nothing here is per company. */
      ...["png", "avif", "svg", "ico"].map((ext) => ({
        source: `/:file(.+\\.${ext})`,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
