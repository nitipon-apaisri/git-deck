import { memo } from 'react'
import type { GraphRow } from '@shared/graph-layout'

export const ROW_HEIGHT = 28
export const LANE_WIDTH = 16
const NODE_RADIUS = 4.5
export const GRAPH_COLORS = ['#539bf5', '#57ab5a', '#c69026', '#e275ad', '#986ee2', '#39c5cf', '#f69d50', '#e5534b']

const x = (lane: number): number => lane * LANE_WIDTH + LANE_WIDTH / 2
const mid = ROW_HEIGHT / 2

function edgePath(part: 'top' | 'bottom' | 'through', from: number, to: number): string {
  const x1 = x(from)
  const x2 = x(to)
  if (part === 'through') return `M${x1} 0 L${x1} ${ROW_HEIGHT}`
  // S-curve with control points at the vertical midpoint of the half row.
  if (part === 'top') return `M${x1} 0 C${x1} ${mid / 2}, ${x2} ${mid / 2}, ${x2} ${mid}`
  return `M${x1} ${mid} C${x1} ${mid + mid / 2}, ${x2} ${mid + mid / 2}, ${x2} ${ROW_HEIGHT}`
}

export const GraphRowSvg = memo(function GraphRowSvg({ row, lanes }: { row: GraphRow; lanes: number }): React.JSX.Element {
  const isHead = row.commit.refs.some((r) => r.kind === 'head' || r.current)
  const color = GRAPH_COLORS[row.color % GRAPH_COLORS.length]
  return (
    <svg width={Math.max(1, lanes) * LANE_WIDTH} height={ROW_HEIGHT} className="graph-svg" aria-hidden="true">
      {row.edges.map((e, i) => (
        <path
          key={i}
          d={edgePath(e.part, e.from, e.to)}
          stroke={GRAPH_COLORS[e.color % GRAPH_COLORS.length]}
          strokeWidth={2}
          fill="none"
        />
      ))}
      {isHead && <circle cx={x(row.lane)} cy={mid} r={NODE_RADIUS + 3} fill="none" stroke={color} strokeWidth={1.5} />}
      <circle cx={x(row.lane)} cy={mid} r={NODE_RADIUS} fill={color} stroke="var(--bg)" strokeWidth={1.5} />
    </svg>
  )
})
