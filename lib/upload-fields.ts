import type { Tx } from "@/lib/i18n"

/** Plain names for the fields an import asks for, in French and English. A field
 *  not listed here is shown with its own name, spaced and capitalised. */
const LABELS: Record<string, [fr: string, en: string]> = {
  medicine_name: ["Article", "Item"],
  product_name: ["Produit", "Product"],
  stock_qty: ["Quantité", "Quantity"],
  min_stock: ["Stock minimum", "Minimum stock"],
  sales_last_30_days: ["Ventes 30 jours", "Sales, last 30 days"],
  last_sale_date: ["Dernière vente", "Last sale date"],
  unit_cost: ["Prix unitaire", "Unit price"],
  expiry_date: ["Date de péremption", "Expiry date"],
  reagent_name: ["Réactif", "Reagent"],
  batch_number: ["Numéro de lot", "Batch number"],
  category: ["Catégorie", "Category"],
  fridge_temp: ["Température frigo", "Fridge temperature"],
  bought_on_credit: ["Acheté à crédit", "Bought on credit"],
  store_id: ["Magasin", "Store"],
  sku: ["Référence", "SKU"],
}

export function fieldLabel(name: string, tx: Tx): string {
  const pair = LABELS[name]
  if (pair) return tx(pair[0], pair[1])
  const words = name.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
