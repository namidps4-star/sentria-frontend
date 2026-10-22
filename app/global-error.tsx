"use client"

/* The last resort: an error in the root layout itself. It replaces the layout,
   so it brings its own document, fixed colours and both languages, and reads
   no app state. */
export default function GlobalError({
  error,
  retry,
}: {
  error: globalThis.Error & { digest?: string }
  retry: () => void
}) {
  const fr = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("fr")
  const tx = (a: string, b: string) => (fr ? a : b)

  return (
    <html lang={fr ? "fr" : "en"}>
      <body style={{ margin: 0, background: "#141414", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "2rem 1.5rem", maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "2.5rem", lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            {tx("Un problème de notre côté.", "Something broke on our side.")}
          </h1>
          <p style={{ marginTop: 16, lineHeight: 1.6, color: "rgba(255,255,255,.75)" }}>
            {tx("Vos données sont en sécurité, rien n'a été perdu. Réessayez dans un instant.", "Your data is safe, nothing was lost. Try again in a moment.")}
          </p>
          {error.digest && (
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: "rgba(255,255,255,.85)" }}>
              {tx("Référence", "Reference")} {error.digest}
            </p>
          )}
          <div>
            <button
              type="button"
              onClick={retry}
              style={{ marginTop: 20, border: 0, borderRadius: 999, background: "#bced31", color: "#1d2a0a", fontWeight: 700, fontSize: 14, padding: "11px 22px", cursor: "pointer" }}
            >
              {tx("Réessayer", "Try again")}
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
