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
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
