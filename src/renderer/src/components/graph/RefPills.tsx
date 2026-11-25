import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { AccountType } from '@shared/types'
import type { BadgeView, BranchCheck, RefPill } from '../../lib/graphView'
import { Icon, Menu, REF_KINDS } from '../ui'
import { BrandLogo } from '../ui/BrandLogo'
import { CheckDot } from '../ui/CheckDot'

interface RefPillsProps {
  pills: readonly RefPill[]
  /** The repo's host, for the remote mark. Unknown: a cloud. */
  host: AccountType | null
  /** CI of the checked-out branch: a dot beside its pill. */
  ci?: BranchCheck
  onMenu?: (event: React.MouseEvent, badge: BadgeView) => void
  /** Double-click on a pill, or a pick from the "+n" list. */
  onActivate?: (badge: BadgeView) => void
}

const PILL =
  'inline-flex h-5 min-w-0 items-center gap-1 rounded-(--radius-xs) border border-transparent px-1.5 text-[11.5px] leading-4 whitespace-nowrap'
// Below this column width a pill keeps only its icons.
const NAME = 'min-w-0 truncate @max-[140px]:hidden'

function Marks({ pill, host }: { pill: RefPill; host: AccountType | null }) {
  const place = host === 'gitlab' ? 'GitLab' : host === 'github' ? 'GitHub' : 'the remote'
  return (
    <>
      {pill.local ? (
        <span title="Local branch" className="inline-flex">
          <Icon name="monitor" size="xs" />
        </span>
      ) : null}
      {pill.remote ? (
        <span title={`Remote branch on ${place}`} className="inline-flex">
          {host ? (
            <BrandLogo brand={host} className="size-3 flex-none" />
          ) : (
            <Icon name="cloud" size="xs" />
          )}
        </span>
      ) : null}
    </>
  )
}

/** The first pill (name cut with "…") and a "+n" for the rest. The column is a container. */
export function RefPills({ pills, host, ci, onMenu, onActivate }: RefPillsProps) {
  const [first, ...rest] = pills
  const [more, setMore] = useState<{ x: number; y: number } | null>(null)
  return (
    <span className="@container flex w-(--col-refs) flex-none items-center gap-1 overflow-hidden">
      {first ? (
        <span
          className={cn(PILL, REF_KINDS[first.kind], first.current ? 'font-bold' : 'font-medium')}
          title={first.title}
          onContextMenu={onMenu ? (event) => onMenu(event, first.badge) : undefined}
          onDoubleClick={
            onActivate
              ? (event) => {
                  event.stopPropagation()
                  onActivate(first.badge)
                }
              : undefined
          }
        >
          {first.current && ci && ci.branch === first.name ? <CheckDot state={ci.state} /> : null}
          {first.kind === 'head' ? <Icon name="check" size="xs" /> : null}
          {first.tag ? <Icon name="tag" size="xs" /> : null}
          <span className={NAME}>{first.name}</span>
          <Marks pill={first} host={host} />
        </span>
      ) : null}
      {rest.length > 0 ? (
        <button
          type="button"
          className="flex-none cursor-pointer text-[12px] text-muted-foreground hover:text-foreground"
          title={rest.map((p) => p.title).join('\n')}
          onClick={(event) => {
            event.stopPropagation()
            setMore({ x: event.clientX, y: event.clientY })
          }}
        >
          +{rest.length}
        </button>
      ) : null}
      {more ? (
        <Menu
          label="More branches and tags"
          at={more}
          onClose={() => setMore(null)}
          entries={rest.map((p) => ({
            kind: 'item' as const,
            id: p.key,
            label: p.name,
            leading: p.tag ? <Icon name="tag" size="xs" /> : <Marks pill={p} host={host} />,
            disabled: !onActivate || p.badge.refKind === 'head' || p.badge.refKind === 'tag',
            onSelect: () => onActivate?.(p.badge)
          }))}
        />
      ) : null}
    </span>
  )
}
