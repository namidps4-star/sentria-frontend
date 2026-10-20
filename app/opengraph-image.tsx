import { ImageResponse } from "next/og"

export const alt = "SentrIA"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/* The card shown when the link is shared. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#b8f23e",
          color: "#141414",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44, fontWeight: 800 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              background: "#141414",
              color: "#b8f23e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            S
          </div>
          SentrIA
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>
            Voyez les problèmes avant qu&apos;ils ne coûtent.
          </div>
          <div style={{ fontSize: 34, opacity: 0.75 }}>See problems before they cost you.</div>
        </div>
      </div>
    ),
    size
  )
}
