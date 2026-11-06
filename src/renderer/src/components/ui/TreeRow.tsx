import type { MouseEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'

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
  const quiet = level === 'namespace'
  return (
    <div
      className={cn(
        'group/row mx-1.5 flex min-h-[var(--tree-row-height)] items-center gap-2 rounded-md text-foreground transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)]',
        quiet && 'min-h-[26px] text-muted-foreground text-[12px]',
        selected
          ? 'bg-[var(--selection)] font-medium hover:bg-[var(--selection)]'
          : 'hover:bg-accent'
      )}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        className={cn(
          'flex min-h-[var(--tree-row-height)] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent py-0 pr-0 pl-2 text-left text-[13px] text-inherit',
          quiet && 'min-h-[26px] pl-6 text-[12px]',
          level === 'repo' && 'pl-11'
        )}
        onClick={onClick}
        aria-expanded={expanded}
        aria-current={selected ? 'true' : undefined}
        title={title}
      >
        {leading}
        <span className={cn('min-w-0 flex-1 truncate', level === 'host' && 'font-semibold')}>
          {children}
        </span>
      </button>
      {action ? (
        <span className="flex flex-none opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100">
          {action}
        </span>
      ) : null}
      {trailing ? (
        <span className="flex flex-none items-center gap-2 pr-2 text-[12px] font-normal text-muted-foreground">
          {trailing}
        </span>
      ) : null}
    </div>
  )
}
