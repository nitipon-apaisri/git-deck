import type { MouseEvent, ReactNode } from 'react'
import styles from './TreeRow.module.css'

interface TreeRowProps {
  /** `host` and `repo` rows are 30px; a `namespace` row is the quiet group label. */
  level: 'host' | 'namespace' | 'repo'
  selected?: boolean
  /** Set on rows that open and close. */
  expanded?: boolean
  onClick: () => void
  /** Leading marks: chevron, tile, dot. */
  leading?: ReactNode
  /** The row's text. It truncates with an ellipsis. */
  children: ReactNode
  /** Counts and status marks. They stay visible when the label truncates. */
  trailing?: ReactNode
  /** A button that shows on hover and keyboard focus, for example "Open in split view". */
  action?: ReactNode
  title?: string
  /** Right-click or the menu key on the row. */
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
}

/** One line in the sidebar. Trailing items may be buttons of their own. */
export function TreeRow({
  level,
  selected = false,
  expanded,
  onClick,
  leading,
  children,
  trailing,
  action,
  title,
  onContextMenu
}: TreeRowProps) {
  const classes = [styles.row, styles[level], selected ? styles.selected : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} onContextMenu={onContextMenu}>
      <button
        type="button"
        className={styles.main}
        onClick={onClick}
        aria-expanded={expanded}
        aria-current={selected ? 'true' : undefined}
        title={title}
      >
        {leading}
        <span className={styles.label}>{children}</span>
      </button>
      {action ? <span className={styles.action}>{action}</span> : null}
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </div>
  )
}
