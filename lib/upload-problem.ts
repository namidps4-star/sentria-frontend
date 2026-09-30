import { activityLabel } from "@/lib/activities"
import type { Tx } from "@/lib/i18n"
import { sectorLabel } from "@/lib/priorities"
import { fromApiSector } from "@/lib/sector"

/** The body /upload returns with HTTP 422 when a file doesn't carry the
 *  chosen activity's data (B-24). Nothing was saved. */
type UploadProblem = {
  error_code?: string
  message?: string
  looks_like?: { sector: string; business_type: string | null }[]
}

/** The 422 body as text for the user: the server's message (already in
 *  the upload's language), then the departments the file seems to belong
 *  to, so hospital data sent to a pharmacy says where it should go. */
export function uploadProblemMessage(problem: unknown, tx: Tx): string | null {
  if (!problem || typeof problem !== "object") return null

  const { message, looks_like } = problem as UploadProblem

  if (!message) return null

  const bySector = new Map<string, (string | null)[]>()

  for (const match of looks_like ?? []) {
    const sector = fromApiSector(match.sector)
    bySector.set(sector, [...(bySector.get(sector) ?? []), match.business_type])
  }

  // One activity names it; several in one sector (industry files fit
  // every plant type) name the sector alone.
  const names = Array.from(bySector, ([sector, activities]) => {
    const activity =
      activities.length === 1 && activities[0]
        ? activityLabel(sector, activities[0], tx)
        : undefined

    return activity
      ? `${sectorLabel(sector, tx)} · ${activity}`
      : sectorLabel(sector, tx)
  })

  if (names.length === 0) return message

  return `${message} ${tx(
    "Ce fichier ressemble à des données pour :",
    "This file looks like data for:"
  )} ${names.join(", ")}.`
}

/** F-TEACH: per missing column, why SentrIA needs it and one example
 *  value, plus a filled example line under the suggested header. Sent by
 *  /upload with the 422 (pipeline/column_guide.py), already in the
 *  upload's language. */
export type UploadTeach = {
  explain: {
    column: string
    alternatives: string[]
    more_alternatives: number
    why: string
    example: string
  }[]
  example?: { header: string[]; row: string[] }
}

export function uploadTeach(problem: unknown): UploadTeach | null {
  if (!problem || typeof problem !== "object") return null
  const { explain, example } = problem as Partial<UploadTeach>
  if (!Array.isArray(explain) || explain.length === 0) return null
  const valid =
    example && Array.isArray(example.header) && Array.isArray(example.row) && example.header.length === example.row.length
  return {
    explain: explain.filter((e) => e && typeof e.column === "string"),
    example: valid ? example : undefined,
  }
}

/** The example as a CSV file: the header, then the example line. */
export function templateCsv(example: { header: string[]; row: string[] }): string {
  const cell = (value: string) => (/[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  return `${example.header.map(cell).join(",")}\n${example.row.map(cell).join(",")}\n`
}
