import type { HostKind } from '../../lib/presets'
import { BrandLogo } from './BrandLogo'
import styles from './HostTile.module.css'

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
      className={`${styles.tile} ${styles[`s${size}`]}`}
      data-host={host}
      data-logo={brand ? '' : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {brand ? <BrandLogo brand={brand} /> : tile}
    </span>
  )
}
