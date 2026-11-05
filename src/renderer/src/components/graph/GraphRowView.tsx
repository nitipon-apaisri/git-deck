import { memo } from 'react'
import type { GraphRow } from '@shared/graph-layout'
import {
  NODE_RADIUS,
  ROW_HEIGHT,
  authorLabel,
  badgeViews,
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
import styles from './GraphRowView.module.css'

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
}

/** Lane drawing for one row: lines first, then the node on top. */
function Lanes({ row, lanes }: { row: GraphRow; lanes: number }) {
  const head = isHeadCommit(row.commit.refs)
  const x = laneX(row.lane)
  const mid = ROW_HEIGHT / 2
  return (
    <svg
      className={styles.lanes}
      width={graphWidth(lanes)}
      height={ROW_HEIGHT}
      viewBox={`0 0 ${graphWidth(lanes)} ${ROW_HEIGHT}`}
      aria-hidden="true"
    >
      {row.edges
        .filter((e) => e.part === 'through')
        .map((e, i) => (
          <path
            key={`t${i}`}
            className={styles.line}
            data-lane={laneTone(e.color)}
            d={edgePath(e)}
          />
        ))}
      {row.edges
        .filter((e) => e.part !== 'through')
        .map((e, i) => (
          <path
            key={`c${i}`}
            className={styles.line}
            data-lane={laneTone(e.color)}
            d={edgePath(e)}
          />
        ))}
      {head ? (
        <circle className={styles.ring} cx={x} cy={mid} r={NODE_RADIUS} />
      ) : (
        <circle
          className={styles.node}
          data-lane={laneTone(row.color)}
          cx={x}
          cy={mid}
          r={NODE_RADIUS}
        />
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
  onSelect
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
      className={styles.row}
      role="option"
      aria-selected={selected}
      aria-posinset={index + 1}
      aria-setsize={total}
      data-selected={selected ? 'true' : undefined}
      style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
      onClick={() => onSelect(commit.hash)}
    >
      <Lanes row={row} lanes={lanes} />
      {shown.length > 0 ? (
        <span className={styles.badges}>
          {shown.map((b) => (
            <RefBadge key={`${b.kind}:${b.name}`} kind={b.kind} name={b.name} current={b.current} />
          ))}
          {more > 0 ? (
            <span className={styles.more} title={hidden.join('\n')}>
              +{more}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className={styles.subject} title={commit.subject}>
        {commit.subject || '(no message)'}
      </span>
      {compact ? null : (
        <>
          <span
            className={styles.author}
            title={commit.email ? `${author} <${commit.email}>` : author}
          >
            <Avatar name={author} size={24} />
            <span className={styles.authorName}>{author}</span>
          </span>
          <span className={styles.date} title={commitDateTitle(commit.date)}>
            {commitDateText(commit.date, now)}
          </span>
        </>
      )}
      <span className={`${styles.hash} hash`}>{shortHash(commit.hash)}</span>
    </div>
  )
}

/** Memoised: scrolling redraws only the rows that entered the window. */
export const GraphRowView = memo(GraphRowViewBase)
