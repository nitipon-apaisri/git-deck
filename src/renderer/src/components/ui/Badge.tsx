import type { ReactNode } from 'react'
import styles from './Badge.module.css'

interface BadgeProps {
  /** `warning` is for states that need a second look, such as an archived repository. */
  tone?: 'neutral' | 'warning'
  children: ReactNode
}

/** A small word label. Always text, so the state never rests on colour alone. */
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  )
}
