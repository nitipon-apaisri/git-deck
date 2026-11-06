import { truncateMiddle } from '../../lib/format'
import { Icon } from './Icon'
import { cn } from '@/lib/cn'

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
const KINDS: Record<RefBadgeKind, string> = {
  head: 'bg-[var(--ref-head-bg)] text-[var(--ref-head-fg)]',
  main: 'border-[var(--ref-main-edge)] bg-[var(--ref-main-bg)] text-[var(--ref-main-fg)]',
  feature:
    'border-[var(--ref-feature-edge)] bg-[var(--ref-feature-bg)] text-[var(--ref-feature-fg)]',
  project:
    'border-[var(--ref-project-edge)] bg-[var(--ref-project-bg)] text-[var(--ref-project-fg)]',
  tag: 'border-[var(--ref-tag-edge)] bg-[var(--ref-tag-bg)] text-[var(--ref-tag-fg)]'
}

export function RefBadge({ kind, name, maxLength = 28, current = false }: RefBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-[var(--radius-xs)] border border-transparent px-2 text-[11.5px] leading-4 whitespace-nowrap',
        current ? 'font-bold' : 'font-medium',
        KINDS[kind]
      )}
      title={current ? `${name} (checked out)` : name}
    >
      {kind === 'tag' ? <Icon name="tag" size="xs" /> : null}
      {truncateMiddle(name, maxLength)}
    </span>
  )
}
