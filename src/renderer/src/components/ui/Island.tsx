import type { HTMLAttributes } from 'react'
import styles from './Island.module.css'

interface IslandProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'aside' | 'main' | 'section'
  /** Adds the `space-5` padding. Lists that run edge to edge leave it off. */
  padded?: boolean
}

/** The panel that holds a working area. One level only: never inside another island. */
export function Island({
  as: Tag = 'div',
  padded = false,
  className,
  children,
  ...rest
}: IslandProps) {
  const classes = [styles.island, padded ? styles.padded : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  )
}
