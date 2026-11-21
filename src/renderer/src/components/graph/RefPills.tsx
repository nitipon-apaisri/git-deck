import { cn } from '@/lib/cn'
import type { AccountType } from '@shared/types'
import type { BadgeView, RefPill } from '../../lib/graphView'
import { Icon, REF_KINDS } from '../ui'
import { BrandLogo } from '../ui/BrandLogo'

interface RefPillsProps {
  pills: readonly RefPill[]
  /** The repo's host, for the remote mark. Unknown: a cloud. */
  host: AccountType | null
  onMenu?: (event: React.MouseEvent, badge: BadgeView) => void
}

const PILL =
  'inline-flex h-5 min-w-0 items-center gap-1 rounded-(--radius-xs) border border-transparent px-1.5 text-[11.5px] leading-4 whitespace-nowrap'
// Below this column width a pill keeps only its icons.
const NAME = 'min-w-0 truncate @max-[140px]:hidden'

/** The first pill (name cut with "…") and a "+n" for the rest. The column is a container. */
export function RefPills({ pills, host, onMenu }: RefPillsProps) {
  const [first, ...rest] = pills
  return (
    <span className="@container flex w-(--col-refs) flex-none items-center gap-1 overflow-hidden">
      {first ? (
        <span
          className={cn(PILL, REF_KINDS[first.kind], first.current ? 'font-bold' : 'font-medium')}
          title={first.title}
          onContextMenu={onMenu ? (event) => onMenu(event, first.badge) : undefined}
        >
          {first.current ? <Icon name="check" size="xs" /> : null}
          {first.tag ? <Icon name="tag" size="xs" /> : null}
          <span className={NAME}>{first.name}</span>
          {first.local ? <Icon name="monitor" size="xs" /> : null}
          {first.remote ? (
            host ? (
              <BrandLogo brand={host} className="size-3 flex-none" />
            ) : (
              <Icon name="cloud" size="xs" />
            )
          ) : null}
        </span>
      ) : null}
      {rest.length > 0 ? (
        <span
          className="flex-none text-[12px] text-muted-foreground"
          title={rest.map((p) => p.title).join('\n')}
        >
          +{rest.length}
        </span>
      ) : null}
    </span>
  )
}
