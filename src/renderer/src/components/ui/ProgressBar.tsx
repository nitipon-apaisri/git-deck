import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  /** 0 to 100. `null` shows a moving bar for work that reports no percentage. */
  percent: number | null
  label: string
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const known = percent !== null
  const value = known ? Math.min(100, Math.max(0, Math.round(percent))) : undefined
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div
        className={styles.fill}
        data-indeterminate={known ? undefined : 'true'}
        style={known ? { width: `${value}%` } : undefined}
      />
    </div>
  )
}
