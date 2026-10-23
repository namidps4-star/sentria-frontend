/** The API address from NEXT_PUBLIC_API_URL, cleaned. A stray space, trailing
 *  slash or a dot after the host ("https://api.example.dev.") each break every
 *  call: the dot makes the browser see another server and the API refuses it.
 *  A value that is not a web address is returned as it is. */
export function normalizeApiBase(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim()

  if (!raw) return fallback

  try {
    const url = new URL(raw)

    url.hostname = url.hostname.replace(/\.+$/, "")

    return url.toString().replace(/\/+$/, "")
  } catch {
    return raw.replace(/\/+$/, "")
  }
}
