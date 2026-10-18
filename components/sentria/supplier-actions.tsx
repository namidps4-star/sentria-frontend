"use client"

import { Mail, MessageSquare, Phone } from "@/lib/icons"
import { useTx } from "@/lib/i18n"
import { cleanSupplier, type Supplier } from "@/lib/supplier"
import { cn } from "@/lib/utils"

/* Who to order from, and a way to reach them (F-SUPPLIER): Call, Text and
 * Email, each only when the file gave that contact. They are plain links, so
 * the phone's own apps do the work: nothing is sent from SentrIA, nothing is
 * charged to the company, and no text goes through the Guard. Nothing is shown
 * for an alert with no supplier. */

export function SupplierActions({
  supplier,
  tone = "light",
  className,
}: {
  supplier: Supplier | null | undefined
  /** The card it sits in: "dark" is the black detail card, "light" a white one. */
  tone?: "dark" | "light"
  className?: string
}) {
  const tx = useTx()
  const clean = cleanSupplier(supplier)

  if (!clean) return null

  const button = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    tone === "dark"
      ? "bg-white/10 text-white hover:bg-white/20"
      : "border border-border bg-card text-foreground hover:bg-muted"
  )

  return (
    <div data-testid="supplier-actions" className={cn("flex flex-wrap items-center gap-2", className)}>
      <span
        className={cn("text-xs", tone === "dark" ? "text-white/70" : "text-muted-foreground")}
        data-testid="supplier-name"
      >
        {tx("Fournisseur : ", "Supplier: ")}
        <span className={cn("font-semibold", tone === "dark" ? "text-white" : "text-foreground")}>{clean.name}</span>
      </span>

      {clean.phone && (
        <a href={`tel:${clean.phone}`} data-testid="supplier-call" className={button}>
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          {tx("Appeler", "Call")}
        </a>
      )}
      {clean.phone && (
        <a href={`sms:${clean.phone}`} data-testid="supplier-text" className={button}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {tx("SMS", "Text")}
        </a>
      )}
      {clean.email && (
        <a href={`mailto:${clean.email}`} data-testid="supplier-email" className={button}>
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          {tx("E-mail", "Email")}
        </a>
      )}
    </div>
  )
}
