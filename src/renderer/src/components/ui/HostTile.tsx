import type { HostKind } from '../../lib/presets'
import { BrandLogo } from './BrandLogo'
import { cn } from '@/lib/cn'

interface HostTileProps {
  /** Two-letter label: GH, GL, SH or GE. */
  tile: string
  host: HostKind
  size?: 20 | 24 | 28
  /** Set when the tile stands alone; omit when the host name is written next to it. */
  label?: string
  /** Show this brand's logo instead of letters. Self-hosted tiles pass their product. */
  brand?: 'github' | 'gitlab'
}

export function HostTile({ tile, host, size = 20, label, brand }: HostTileProps) {
  return (
    <span
      className={cn(
        'inline-grid flex-none place-items-center font-semibold text-foreground',
        size === 20 && 'size-5 rounded-sm text-[10px]',
        size === 24 && 'size-6 rounded-sm text-[10px]',
        size === 28 && 'size-7 rounded-md text-[11px]',
        // A logo sits on a plain tile: the brand colours come from the logo itself.
        brand
          ? 'bg-secondary'
          : host === 'github'
            ? 'bg-(--host-github)'
            : host === 'gitlab'
              ? 'bg-(--host-gitlab)'
              : 'bg-(--host-selfhosted)'
      )}
      data-host={host}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {brand ? <BrandLogo brand={brand} /> : tile}
    </span>
  )
}
