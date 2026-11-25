import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import type { AccountType } from '@shared/types'
import { pillClickable, type BadgeView, type BranchCheck, type RefPill } from '../../lib/graphView'
import { Icon, REF_KINDS } from '../ui'
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
  return (
    <span className="@container flex w-(--col-refs) flex-none items-center gap-1 overflow-hidden">
      {first ? (
        <span
          className={cn(
            PILL,
            first.current ? REF_KINDS.head : REF_KINDS[first.kind],
            first.current ? 'font-bold' : 'font-medium'
          )}
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
          {first.current && ci && ci.branch === first.name && ci.state !== 'none' ? (
            <CheckDot state={ci.state} />
          ) : null}
          {first.current || first.kind === 'head' ? <Icon name="check" size="xs" /> : null}
          {first.tag ? <Icon name="tag" size="xs" /> : null}
          <span className={NAME}>{first.name}</span>
          <Marks pill={first} host={host} />
        </span>
      ) : null}
      {rest.length > 0 ? (
        <MoreRefs rest={rest} host={host} onActivate={onActivate} onMenu={onMenu} />
      ) : null}
    </span>
  )
}

/** "+n": hover, focus or click opens a card under it with the other refs; a click on one checks it out. */
function MoreRefs({
  rest,
  host,
  onActivate,
  onMenu
}: {
  rest: readonly RefPill[]
  host: AccountType | null
  onActivate?: (badge: BadgeView) => void
  onMenu?: (event: React.MouseEvent, badge: BadgeView) => void
}) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const open = (el: HTMLElement) => {
    clearTimeout(timer.current)
    const box = el.getBoundingClientRect()
    setAt({ x: box.left, y: box.bottom + 2 })
  }
  // A short delay lets the pointer cross the gap between the chip and the card.
  const later = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAt(null), 150)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <>
      <button
        type="button"
        className="flex-none cursor-pointer rounded-(--radius-xs) px-1 text-[12px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`${rest.length} more branches and tags`}
        aria-haspopup="true"
        aria-expanded={at !== null}
        onMouseEnter={(event) => open(event.currentTarget)}
        onMouseLeave={later}
        onFocus={(event) => open(event.currentTarget)}
        onBlur={later}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setAt(null)
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (at) setAt(null)
          else open(event.currentTarget)
        }}
      >
        +{rest.length}
      </button>
      {at
        ? createPortal(
            <div
              role="group"
              aria-label="More branches and tags"
              className="fixed z-50 flex max-w-95 min-w-40 flex-col gap-1 rounded-lg bg-popover p-1.5 text-popover-foreground shadow-(--shadow-menu)"
              style={{ left: at.x, top: at.y }}
              onMouseEnter={() => clearTimeout(timer.current)}
              onMouseLeave={later}
            >
              {rest.map((p) => {
                const clickable = pillClickable(p) && onActivate !== undefined
                return (
                  <button
                    key={p.key}
                    type="button"
                    disabled={!clickable}
                    title={
                      clickable
                        ? `Check out ${p.name}`
                        : p.tag
                          ? "Tags can't be checked out here"
                          : p.title
                    }
                    className={cn(
                      PILL,
                      REF_KINDS[p.kind],
                      'w-full justify-between disabled:cursor-default',
                      clickable && 'cursor-pointer hover:brightness-110'
                    )}
                    onClick={(event) => {
                      event.stopPropagation()
                      setAt(null)
                      onActivate?.(p.badge)
                    }}
                    onContextMenu={onMenu ? (event) => onMenu(event, p.badge) : undefined}
                  >
                    <span className="min-w-0 truncate">{p.name}</span>
                    {p.tag ? <Icon name="tag" size="xs" /> : <Marks pill={p} host={host} />}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
