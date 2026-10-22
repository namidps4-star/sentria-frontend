import { useEffect, useState } from "react"

/* The icons of the site menu: a white glyph on a gradient squircle for a site's
 * sector, and a small glyph on each department pill. The glyph data (about 50 KB
 * as source, lib/site-icon-data.ts) loads the first time the menu opens, so the
 * top bar's first paint does not carry it.
 *
 * The tile colours are fixed, like an app icon: the same in light and dark, with
 * a white glyph that reads on every one of them. */

export type SiteIconData = Record<string, { viewBox: string; body: string }>

let loaded: SiteIconData | null = null
let loading: Promise<SiteIconData> | null = null

function load(): Promise<SiteIconData> {
  loading ??= import("@/lib/site-icon-data").then((m) => (loaded = m.SITE_ICON_DATA))
  return loading
}

/** The icon data, once `wanted`; null until it has arrived. */
export function useSiteIcons(wanted: boolean): SiteIconData | null {
  const [data, setData] = useState<SiteIconData | null>(loaded)

  useEffect(() => {
    if (!wanted || data) return
    let live = true

    void load().then((d) => {
      if (live) setData(d)
    })

    return () => {
      live = false
    }
  }, [wanted, data])

  return data
}

/** A sector's squircle: light to deep, top left to bottom right. */
const SECTOR_TILE: Record<string, [light: string, deep: string]> = {
  industry: ["#7a85ff", "#3f4bd1"],
  health: ["#ff7a9c", "#d6336c"],
  commerce: ["#ffc14d", "#e68a00"],
  agriculture: ["#5fd68a", "#1f9d55"],
  logistics: ["#4cc9e8", "#0f8fb3"],
  energy: ["#ffa94d", "#e8590c"],
  transportation: ["#9aa5bd", "#566178"],
}

const OTHER_TILE: [string, string] = ["#a3a39c", "#6b6b66"]

export function sectorTileBackground(sector: string): string {
  const [light, deep] = SECTOR_TILE[sector] ?? OTHER_TILE

  return `linear-gradient(165deg, ${light}, ${deep})`
}

export function sectorIconKey(sector: string): string {
  return sector in SECTOR_TILE ? `sector:${sector}` : "sector:other"
}

/** A data source's squircle: a quiet graphite, so the sectors keep the colour. */
export const SOURCE_TILE_BACKGROUND = "linear-gradient(165deg, #9aa5bd, #566178)"

export function sourceIconKey(type: string): string {
  return `source:${type}`
}

export function departmentIconKey(department: string): string {
  return `dept:${department}`
}
