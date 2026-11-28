/* The optional columns that let a stock alert say how much to order (F-JIT),
 * by department. It mirrors the backend: the checks that raise the reorder
 * alerts are the pharmacy and vet check, the hospital check (critical
 * supplies, and only from a usage column) and the retail stock check. The
 * laboratory, the pharmaceutical wholesaler and the distributor have no
 * reorder point, so they list none. */

export type ReorderColumn = { name: string; fr: string; en: string }

const LEAD: ReorderColumn = {
  name: "supplier_lead_days",
  fr: "jours de livraison du fournisseur",
  en: "days the supplier takes to deliver",
}
const ON_ORDER: ReorderColumn = {
  name: "qty_on_order",
  fr: "unités déjà commandées",
  en: "units already ordered",
}
const CRITICALITY: ReorderColumn = {
  name: "criticality",
  fr: "critique, haute, normale ou faible",
  en: "critical, high, normal or low",
}
const USAGE: ReorderColumn = {
  name: "usage_last_30_days",
  fr: "unités utilisées sur 30 jours",
  en: "units used in the last 30 days",
}

const STOCK = [LEAD, ON_ORDER, CRITICALITY]

const BY_DEPARTMENT: Record<string, ReorderColumn[]> = {
  pharmacie: STOCK,
  veterinaire: STOCK,
  // A hospital's alert needs its usage first: only critical supplies get one.
  "clinique-hopital": [USAGE, LEAD, ON_ORDER],
  "supermarche-hypermarche": STOCK,
  "epicerie-proximite": STOCK,
  "chaine-magasins": STOCK,
}

/** The columns to list for a department, or none when it has no reorder alert. */
export function reorderColumnsFor(department: string | null | undefined): ReorderColumn[] {
  return (department && BY_DEPARTMENT[department]) || []
}
