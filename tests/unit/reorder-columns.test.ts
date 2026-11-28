import { describe, expect, it } from "vitest"

import { reorderColumnsFor } from "@/lib/reorder-columns"

const names = (department: string | null | undefined) => reorderColumnsFor(department).map((column) => column.name)

describe("reorderColumnsFor", () => {
  it("lists the delivery time, the units on order and the criticality for a pharmacy, a vet and a shop", () => {
    for (const department of ["pharmacie", "veterinaire", "supermarche-hypermarche", "epicerie-proximite", "chaine-magasins"]) {
      expect(names(department)).toEqual(["supplier_lead_days", "qty_on_order", "criticality"])
    }
  })

  it("asks a hospital for its usage first, and not for a criticality (the category says it)", () => {
    expect(names("clinique-hopital")).toEqual(["usage_last_30_days", "supplier_lead_days", "qty_on_order"])
  })

  it("lists nothing where the backend has no reorder point", () => {
    for (const department of ["laboratoire", "grossiste-pharma", "grossiste-distributeur", "usine-production", "unknown", "", null, undefined]) {
      expect(reorderColumnsFor(department as string | null | undefined)).toEqual([])
    }
  })

  it("has French and English words for every column, with no em dash", () => {
    for (const department of ["pharmacie", "clinique-hopital"]) {
      for (const column of reorderColumnsFor(department)) {
        expect(column.fr.length).toBeGreaterThan(0)
        expect(column.en.length).toBeGreaterThan(0)
        expect(column.fr).not.toBe(column.en)
        expect(column.fr + column.en).not.toContain("\u2014")
      }
    }
  })

  it("says the criticality words the API reads: English and French", () => {
    const criticality = reorderColumnsFor("pharmacie").find((column) => column.name === "criticality")
    expect(criticality?.en).toBe("critical, high, normal or low")
    expect(criticality?.fr).toBe("critique, haute, normale ou faible")
  })
})
