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
  /** A quiet line under the label, for example "on 3 hosts". */
  note?: string
  /** Why the figure is partial or approximate, as a tooltip. */
  explain?: string
}

export function StatCard({
  value,
  label,
  partial = false,
  approximate = false,
  note,
  explain
}: StatCardProps) {
  return (
    <div className={styles.card} title={explain}>
      {value === null ? (
        <span className={styles.unavailable}>Unavailable</span>
      ) : (
        <span className={styles.value}>
          {approximate ? '~' : ''}
          {value}
        </span>
      )}
      <span className={styles.label}>{label}</span>
      {note ? <span className={styles.label}>{note}</span> : null}
      {partial ? (
        <span className={styles.partial}>
          <Icon name="alert" size="xs" />
          Partial
        </span>
      ) : null}
    </div>
  )
}
