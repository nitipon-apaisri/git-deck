import type { ThemeSetting } from '../../lib/theme'
import styles from './ThemePreview.module.css'

/** A tiny mock of the app shell. It carries its own `data-theme`, so it draws with that theme's tokens. */
function Mock({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <span className={styles.mock} data-theme={theme} aria-hidden="true">
      <span className={styles.rail} />
      <span className={styles.side}>
        <span className={styles.line} />
        <span className={styles.line} />
        <span className={`${styles.line} ${styles.selected}`} />
      </span>
      <span className={styles.main}>
        <span className={styles.bar} />
        <span className={styles.line} />
      </span>
    </span>
  )
}

export function ThemePreview({ setting }: { setting: ThemeSetting }) {
  if (setting === 'system') {
    return (
      <span className={styles.split} aria-hidden="true">
        <span className={styles.half}>
          <Mock theme="light" />
        </span>
        <span className={`${styles.half} ${styles.right}`}>
          <Mock theme="dark" />
        </span>
      </span>
    )
  }
  return <Mock theme={setting} />
}
