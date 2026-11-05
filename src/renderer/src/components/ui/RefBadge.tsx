import { truncateMiddle } from '../../lib/format'
import { Icon } from './Icon'
import styles from './RefBadge.module.css'

export type RefBadgeKind = 'head' | 'main' | 'feature' | 'project' | 'tag'

interface RefBadgeProps {
  kind: RefBadgeKind
  name: string
  /** Longest name shown before the middle is cut. The title keeps the full name. */
  maxLength?: number
  /** The checked-out branch: drawn heavier. */
  current?: boolean
}

/** Labels a branch, remote or tag on a commit. A tag also carries the tag icon. */
export function RefBadge({ kind, name, maxLength = 28, current = false }: RefBadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[kind]}`}
      title={current ? `${name} (checked out)` : name}
      data-current={current ? 'true' : undefined}
    >
      {kind === 'tag' ? <Icon name="tag" size="xs" /> : null}
      {truncateMiddle(name, maxLength)}
    </span>
  )
}
