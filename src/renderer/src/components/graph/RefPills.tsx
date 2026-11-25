import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
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

// The checked-out branch keeps its own colour, filled solid: the kind's text colour becomes the
// background and the HEAD text colour (dark in dark theme, white in light) goes on top.
const SOLID: Partial<Record<RefPill['kind'], string>> = {
  main: 'bg-(--ref-main-fg) text-(--ref-head-fg)',
  feature: 'bg-(--ref-feature-fg) text-(--ref-head-fg)',
  project: 'bg-(--ref-project-fg) text-(--ref-head-fg)'
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
            first.current ? (SOLID[first.kind] ?? REF_KINDS[first.kind]) : REF_KINDS[first.kind],
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
  const [at, setAt] = useState<{ x: number; y: number; top: number } | null>(null)
  // Opened by a click (or the keyboard): hovering away no longer closes it.
  const pinned = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const trigger = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = () => {
    clearTimeout(timer.current)
    pinned.current = false
    setAt(null)
  }
  const open = () => {
    clearTimeout(timer.current)
    const box = trigger.current?.getBoundingClientRect()
    if (box) setAt({ x: box.left, y: box.bottom + 2, top: box.top - 2 })
  }
  // A short delay lets the pointer cross the gap between the chip and the card.
  const later = () => {
    clearTimeout(timer.current)
    if (!pinned.current) timer.current = setTimeout(() => setAt(null), 150)
  }
  const items = () => Array.from(card.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
  const inside = (node: EventTarget | null) =>
    node instanceof Node && (card.current?.contains(node) || trigger.current?.contains(node))
  useEffect(() => () => clearTimeout(timer.current), [])
  // Keep the card on screen: flip above the chip near the bottom edge, pull in from the right.
  useLayoutEffect(() => {
    const el = card.current
    if (!at || !el) return
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${Math.max(8, Math.min(at.x, window.innerWidth - width - 8))}px`
    el.style.top = `${at.y + height > window.innerHeight - 8 ? Math.max(8, at.top - height) : at.y}px`
  }, [at])
  // Escape from anywhere, a click outside, a scroll or a resize close it.
  const isOpen = at !== null
  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (card.current?.contains(document.activeElement)) trigger.current?.focus()
      close()
    }
    const onDown = (event: PointerEvent) => {
      if (!inside(event.target)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [isOpen])
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="flex-none cursor-pointer rounded-(--radius-xs) px-1 text-[12px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`${rest.length} more branches and tags`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        onMouseEnter={open}
        onMouseLeave={later}
        onFocus={open}
        onBlur={(event) => {
          if (!inside(event.relatedTarget)) later()
        }}
        onKeyDown={(event) => {
          // Tab or Down moves into the card, which is outside this button's place in the DOM.
          if (isOpen && (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey))) {
            event.preventDefault()
            pinned.current = true
            items()[0]?.focus()
          }
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (isOpen && pinned.current) return close()
          pinned.current = true
          open()
        }}
      >
        +{rest.length}
      </button>
      {at
        ? createPortal(
            <div
              ref={card}
              id={id}
              role="group"
              aria-label="More branches and tags"
              className="fixed z-50 flex max-w-95 min-w-40 flex-col gap-1 rounded-lg bg-popover p-1.5 text-popover-foreground shadow-(--shadow-menu)"
              style={{ left: at.x, top: at.y }}
              onMouseEnter={() => clearTimeout(timer.current)}
              onMouseLeave={later}
              onBlur={(event) => {
                if (!inside(event.relatedTarget)) close()
              }}
              onKeyDown={(event) => {
                const list = items()
                const cur = list.indexOf(document.activeElement as HTMLButtonElement)
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  const step = event.key === 'ArrowDown' ? 1 : -1
                  list[(cur + step + list.length) % list.length]?.focus()
                } else if (event.key === 'Tab') {
                  // Leave the card and go on from the chip.
                  event.preventDefault()
                  trigger.current?.focus()
                  close()
                }
              }}
            >
              {rest.map((p) => {
                const clickable = pillClickable(p) && onActivate !== undefined
                return (
                  <button
                    key={p.key}
                    type="button"
                    // aria-disabled, not disabled: a tag stays focusable, so its tooltip and name reach the keyboard.
                    aria-disabled={!clickable}
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
                      'w-full justify-between focus-visible:outline-2 focus-visible:outline-ring',
                      clickable ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
                    )}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!clickable) return
                      close()
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
