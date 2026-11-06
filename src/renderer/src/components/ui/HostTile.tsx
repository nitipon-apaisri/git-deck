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
  /** Show the brand logo instead of letters (GitHub and GitLab only). */
  logo?: boolean
}

export function HostTile({ tile, host, size = 20, label, logo = false }: HostTileProps) {
  const showLogo = logo && (host === 'github' || host === 'gitlab')
  return (
    <span
      className={`${styles.tile} ${styles[`s${size}`]}`}
      data-host={host}
      data-logo={showLogo ? '' : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {showLogo ? <BrandLogo brand={host as 'github' | 'gitlab'} /> : tile}
    </span>
  )
}
