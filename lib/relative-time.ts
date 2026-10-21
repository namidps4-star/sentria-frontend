import { timezoneFor, readTimezoneId } from "@/lib/company"

type Tx = (fr: string, en: string) => string

/** How long ago an alert was raised: "12 min ago", "2 h ago", "Yesterday",
 *  then a short date ("12 Oct") once it is older than two days. The full date
 *  and time belong in a tooltip or a detail view, not in a table cell. */
export function agoLabel(date: string, tx: Tx, now: number = Date.now()): string {
  const at = Date.parse(date)

  if (!Number.isFinite(at)) return ""

  const min = Math.max(0, Math.round((now - at) / 60000))

  if (min < 60) return tx(`il y a ${Math.max(1, min)} min`, `${Math.max(1, min)} min ago`)

  const h = Math.round(min / 60)

  if (h < 24) return tx(`il y a ${h} h`, `${h} h ago`)
  if (h < 48) return tx("Hier", "Yesterday")

  try {
    return new Intl.DateTimeFormat(tx("fr-FR", "en-GB"), {
      day: "numeric",
      month: "short",
      timeZone: timezoneFor(readTimezoneId()).zone,
    }).format(new Date(at))
  } catch {
    return new Date(at).toLocaleDateString(tx("fr-FR", "en-GB"), { day: "numeric", month: "short" })
  }
}
