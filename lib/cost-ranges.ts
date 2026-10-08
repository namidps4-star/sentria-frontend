import type { CostBucket } from "@/lib/crm"
import type { Tx } from "@/lib/i18n"

/* The ranges an answer about cost can take, written for the reader. The
   symbol is the account's currency; with none, the figures stand alone. */

const GROUP = (value: number, tx: Tx) => value.toLocaleString(tx("fr-FR", "en-GB"))

export function bucketRange(bucket: CostBucket, symbol: string, tx: Tx): string {
  const money = (value: number) => (symbol ? `${GROUP(value, tx)} ${symbol}` : GROUP(value, tx))

  switch (bucket) {
    case "lt100":
      return tx(`moins de ${money(100)}`, `under ${money(100)}`)
    case "100_1k":
      return `${GROUP(100, tx)}–${money(1000)}`
    case "1k_10k":
      return `${GROUP(1000, tx)}–${money(10000)}`
    default:
      return tx(`plus de ${money(10000)}`, `over ${money(10000)}`)
  }
}
