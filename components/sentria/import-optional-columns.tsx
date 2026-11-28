"use client"

import { useTx } from "@/lib/i18n"
import { reorderColumnsFor } from "@/lib/reorder-columns"

const CHIP = "rounded-md bg-card px-1.5 py-0.5 font-mono text-[11px] text-foreground"

/** The "Optional" box under the file row, for health and retail: the columns that
 *  name who to order from and, where the department has a reorder alert, the ones
 *  that let the alert say how much to order. */
export function ImportOptionalColumns({ department }: { department?: string | null }) {
  const tx = useTx()
  const reorder = reorderColumnsFor(department)
  const hospital = department === "clinique-hopital"

  return (
    <div
      data-supplier-columns=""
      data-reorder-columns={reorder.length > 0 ? "" : undefined}
      className="mt-2 rounded-[20px] bg-muted px-3.5 py-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {reorder.length > 0
          ? tx("Facultatif · chez qui commander, et combien", "Optional · who to order from, and how much")
          : tx("Facultatif · pour savoir chez qui commander", "Optional · to know who to order from")}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        <code className={CHIP}>supplier</code> <code className={CHIP}>supplier_phone</code>{" "}
        <code className={CHIP}>supplier_email</code>{" "}
        {tx("le nom, le téléphone (format +229…) et l'e-mail du fournisseur", "the supplier's name, phone (as +229…) and email")}
      </p>
      {reorder.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-[3px]">
          {reorder.map((column) => (
            <li key={column.name} className="text-xs leading-5 text-muted-foreground">
              <code className={CHIP}>{column.name}</code> {tx(column.fr, column.en)}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        {reorder.length === 0
          ? tx(
              "L'alerte de stock dit alors chez qui commander et propose Appeler, SMS et E-mail. Sans ces colonnes, rien ne change.",
              "The stock alert then says who to order from and offers Call, Text and Email. Without these columns nothing changes."
            )
          : hospital
            ? tx(
                "L'alerte de stock dit alors chez qui commander et propose Appeler, SMS et E-mail. Avec la consommation dans le fichier, les fournitures critiques (oxygène, sang…) ont aussi une quantité à commander.",
                "The stock alert then says who to order from and offers Call, Text and Email. With usage in the file, critical supplies (oxygen, blood…) also get an order quantity."
              )
            : tx(
                "L'alerte de stock dit alors chez qui commander et combien, et propose Appeler, SMS et E-mail. Sans ces colonnes, SentrIA suppose 7 jours de livraison.",
                "The stock alert then says who to order from and how much, and offers Call, Text and Email. Without these columns SentrIA assumes 7 days to deliver."
              )}
      </p>
    </div>
  )
}
