"use client"

import { cn } from "@/lib/utils"
import {
  SOURCE_TILE_BACKGROUND,
  sectorIconKey,
  sectorTileBackground,
  sourceIconKey,
  type SiteIconData,
} from "@/lib/site-icons"

/* The squircle tiles of the site screens: a white Solar glyph on a gradient,
 * in the style of an app icon. A sector has its own colour; a data source is
 * graphite. `icons` comes from useSiteIcons: until it has arrived the tile is
 * drawn empty at the same size, so nothing moves. */

const SHADOW = "shadow-[inset_0_0.5px_0_rgba(255,255,255,0.55),0_1px_3px_rgba(0,0,0,0.25)]"

function Tile({
  size,
  background,
  icon,
  className,
  ...data
}: {
  size: number
  background: string
  icon: { viewBox: string; body: string } | undefined
  className?: string
  [key: `data-${string}`]: string
}) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center text-white", SHADOW, className)}
      style={{ width: size, height: size, borderRadius: size * 0.29, background }}
      aria-hidden="true"
      {...data}
    >
      {icon && (
        <svg
          viewBox={icon.viewBox}
          width={Math.round(size * 0.55)}
          height={Math.round(size * 0.55)}
          focusable="false"
          dangerouslySetInnerHTML={{ __html: icon.body }}
        />
      )}
    </span>
  )
}

/** A site's sector. */
export function SectorTile({ sector, icons, size = 44, className }: { sector: string; icons: SiteIconData | null; size?: number; className?: string }) {
  const key = sectorIconKey(sector)

  return <Tile size={size} background={sectorTileBackground(sector)} icon={icons?.[key]} className={className} data-sector-icon={key} />
}

/** A data source: csv, api, erp or iot. */
export function SourceTile({ type, icons, size = 30, className }: { type: string; icons: SiteIconData | null; size?: number; className?: string }) {
  const key = sourceIconKey(type)

  return <Tile size={size} background={SOURCE_TILE_BACKGROUND} icon={icons?.[key] ?? icons?.["dept:other"]} className={className} data-source-icon={type} />
}
