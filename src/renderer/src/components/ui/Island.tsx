import type { HTMLAttributes, Ref } from 'react'
import styles from './Island.module.css'

interface IslandProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>
  as?: 'div' | 'aside' | 'main' | 'section'
  /** Adds the `space-5` padding. Lists that run edge to edge leave it off. */
  padded?: boolean
}

/** The panel that holds a working area. One level only: never inside another island. */
export function Island({
  as: Tag = 'div',
  padded = false,
  ref,
  className,
  children,
  ...rest
}: IslandProps) {
  const classes = [styles.island, padded ? styles.padded : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <Tag ref={ref as Ref<HTMLDivElement>} className={classes} {...rest}>
      {children}
    </Tag>
  )
}
