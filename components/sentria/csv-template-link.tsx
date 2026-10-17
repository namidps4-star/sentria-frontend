"use client"

import { Upload } from "@/lib/icons"
import { columnsForUpload, emptyCsv } from "@/lib/csv-columns"
import { useTx } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** "Download an empty CSV": the header row for a department (else its sector),
 *  so a file can be filled in before it is imported. Says nothing when no
 *  columns are known for it. */
export function CsvTemplateLink({
  department,
  sector,
  className,
}: {
  department?: string | null
  sector?: string | null
  className?: string
}) {
  const tx = useTx()
  const columns = columnsForUpload(department, sector)

  if (columns.length === 0) return null

  const name = `sentria-${department || sector}-template.csv`

  function download() {
    const blob = new Blob([emptyCsv(columns)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={download}
      data-testid="csv-template"
      data-columns={columns.join(",")}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <Upload className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
      {tx("Télécharger un CSV vide", "Download an empty CSV")}
    </button>
  )
}
