import { memo } from 'react'
import type { GraphRow } from '@shared/graph-layout'
import type { GraphCommit } from '@shared/types'
import {
  NODE_RADIUS,
  ROW_HEIGHT,
  authorLabel,
  badgeViews,
  type BadgeView,
  commitDateText,
  commitDateTitle,
  edgePath,
  graphWidth,
  isHeadCommit,
  laneTone,
  laneX,
  splitBadges
} from '../../lib/graphView'
import { shortHash } from '../../lib/repoView'
import { Avatar, RefBadge } from '../ui'

// One stroke or fill per lane colour: laneTone() gives 1 to 6.
const LINES = [
  '',
  '[stroke:var(--lane-1)]',
  '[stroke:var(--lane-2)]',
  '[stroke:var(--lane-3)]',
  '[stroke:var(--lane-4)]',
  '[stroke:var(--lane-5)]',
  '[stroke:var(--lane-6)]'
] as const
const NODES = [
  '',
  '[fill:var(--lane-1)]',
  '[fill:var(--lane-2)]',
  '[fill:var(--lane-3)]',
  '[fill:var(--lane-4)]',
  '[fill:var(--lane-5)]',
  '[fill:var(--lane-6)]'
] as const
const LINE = '[fill:none] [stroke-width:2]'

interface GraphRowViewProps {
  row: GraphRow
  index: number
  total: number
  /** Lane count of the widest row being drawn, so every graph column lines up. */
  lanes: number
  now: number
  defaultBranch: string
  /** No author or date column. */
  compact: boolean
  selected: boolean
  id: string
  onSelect: (hash: string) => void
  /** Right-click on the row (`ref` null) or on one of its badges. Absent when nothing is offered. */
  onMenu?: (commit: GraphCommit, at: { x: number; y: number }, ref: BadgeView | null) => void
}

/** Lane drawing for one row: lines first, then the node on top. */
function Lanes({ row, lanes }: { row: GraphRow; lanes: number }) {
  const head = isHeadCommit(row.commit.refs)
  const x = laneX(row.lane)
  const mid = ROW_HEIGHT / 2
  return (
    <svg
      className="block flex-none"
      width={graphWidth(lanes)}
      height={ROW_HEIGHT}
      viewBox={`0 0 ${graphWidth(lanes)} ${ROW_HEIGHT}`}
      aria-hidden="true"
    >
      {row.edges
        .filter((e) => e.part === 'through')
        .map((e, i) => (
          <path key={`t${i}`} className={`${LINE} ${LINES[laneTone(e.color)]}`} d={edgePath(e)} />
        ))}
      {row.edges
        .filter((e) => e.part !== 'through')
        .map((e, i) => (
          <path key={`c${i}`} className={`${LINE} ${LINES[laneTone(e.color)]}`} d={edgePath(e)} />
        ))}
      {head ? (
        <circle
          className="[fill:var(--island)] [stroke-width:2] [stroke:var(--lane-1)]"
          cx={x}
          cy={mid}
          r={NODE_RADIUS}
        />
      ) : (
        <circle className={NODES[laneTone(row.color)]} cx={x} cy={mid} r={NODE_RADIUS} />
      )}
    </svg>
  )
}

function GraphRowViewBase({
  row,
  index,
  total,
  lanes,
  now,
  defaultBranch,
  compact,
  selected,
  id,
  onSelect,
  onMenu
}: GraphRowViewProps) {
  const { commit } = row
  const author = authorLabel(commit.author, commit.email)
  const { shown, more } = splitBadges(badgeViews(commit.refs, defaultBranch))
  const hidden = badgeViews(commit.refs, defaultBranch)
    .slice(shown.length)
    .map((b) => b.name)
  return (
    <div
      id={id}
      className="absolute inset-x-0 flex cursor-default items-center gap-2 rounded-md pr-3 whitespace-nowrap hover:bg-accent data-[selected=true]:bg-[var(--selection)]"
      role="option"
      aria-selected={selected}
      aria-posinset={index + 1}
      aria-setsize={total}
      data-selected={selected ? 'true' : undefined}
      style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
      onClick={() => onSelect(commit.hash)}
      onContextMenu={
        onMenu
          ? (event) => {
              event.preventDefault()
              onSelect(commit.hash)
              onMenu(commit, { x: event.clientX, y: event.clientY }, null)
            }
          : undefined
      }
    >
      <Lanes row={row} lanes={lanes} />
      {shown.length > 0 ? (
        <span className="flex min-w-0 flex-[0_1_auto] items-center gap-1 overflow-hidden">
          {shown.map((b) => (
            <span
              key={`${b.kind}:${b.name}`}
              className="inline-flex"
              onContextMenu={
                onMenu
                  ? (event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onSelect(commit.hash)
                      onMenu(commit, { x: event.clientX, y: event.clientY }, b)
                    }
                  : undefined
              }
            >
              <RefBadge kind={b.kind} name={b.name} current={b.current} />
            </span>
          ))}
          {more > 0 ? (
            <span className="text-[12px] text-muted-foreground" title={hidden.join('\n')}>
              +{more}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="min-w-0 flex-[1_0_12ch] truncate" title={commit.subject}>
        {commit.subject || '(no message)'}
      </span>
      {compact ? null : (
        <>
          <span
            className="flex w-32 flex-none items-center gap-1.5 text-[12px] text-muted-foreground"
            title={commit.email ? `${author} <${commit.email}>` : author}
          >
            <Avatar name={author} size={24} />
            <span className="min-w-0 truncate">{author}</span>
          </span>
          <span
            className="w-[76px] flex-none text-[12px] text-muted-foreground"
            title={commitDateTitle(commit.date)}
          >
            {commitDateText(commit.date, now)}
          </span>
        </>
      )}
      <span className="hash w-14 flex-none text-[12px] text-muted-foreground">
        {shortHash(commit.hash)}
      </span>
    </div>
  )
}

/** Memoised: scrolling redraws only the rows that entered the window. */
export const GraphRowView = memo(GraphRowViewBase)
