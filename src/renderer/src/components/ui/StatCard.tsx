import { Icon } from './Icon'
import styles from './StatCard.module.css'

interface StatCardProps {
  /** `null` means the host could not be reached: shown as "Unavailable", never 0. */
  value: string | number | null
  label: string
  /** The figure adds only known counts. */
  partial?: boolean
  /** The value is an estimate and is shown with a leading "~". */
  approximate?: boolean
}

export function StatCard({ value, label, partial = false, approximate = false }: StatCardProps) {
  return (
    <div className={styles.card}>
      {value === null ? (
        <span className={styles.unavailable}>Unavailable</span>
      ) : (
        <span className={styles.value}>
          {approximate ? '~' : ''}
          {value}
        </span>
      )}
      <span className={styles.label}>{label}</span>
      {partial ? (
        <span className={styles.partial}>
          <Icon name="alert" size="xs" />
          Partial
        </span>
      ) : null}
    </div>
  )
}
