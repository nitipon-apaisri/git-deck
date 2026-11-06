// Which changed lines of one hunk are ticked for line-level staging. Pure, so tests run it.
import type { DiffHunk, FileDiff } from '../../../shared/types'

/** Positions in `DiffHunk.lines`, the same numbers main receives as `HunkRequest.lines`. */
export type LineSelection = readonly number[]

export function isChanged(hunk: DiffHunk, position: number): boolean {
  const type = hunk.lines[position]?.type
  return type === 'add' || type === 'del'
}

/** A hunk can be split when it has no "no newline" note and the file is not created or deleted. */
export function canSelectLines(diff: Pick<FileDiff, 'change'>, hunk: DiffHunk): boolean {
  return diff.change === null && !hunk.lines.some((l) => l.type === 'note')
}

export function toggleLine(
  selection: LineSelection,
  hunk: DiffHunk,
  position: number
): LineSelection {
  if (!isChanged(hunk, position)) return selection
  return selection.includes(position)
    ? selection.filter((n) => n !== position)
    : [...selection, position].sort((a, b) => a - b)
}

/** Shift-click: ticks every changed line between `from` and `to`, both included. */
export function selectRange(
  selection: LineSelection,
  hunk: DiffHunk,
  from: number,
  to: number
): LineSelection {
  const [lo, hi] = from <= to ? [from, to] : [to, from]
  const next = new Set(selection)
  for (let n = lo; n <= hi; n++) if (isChanged(hunk, n)) next.add(n)
  return [...next].sort((a, b) => a - b)
}

export function selectAllChanged(hunk: DiffHunk): number[] {
  return hunk.lines.flatMap((l, n) => (l.type === 'add' || l.type === 'del' ? [n] : []))
}

export function buttonLabel(direction: 'stage' | 'unstage', count: number): string {
  const verb = direction === 'stage' ? 'Stage' : 'Unstage'
  return `${verb} ${count} ${count === 1 ? 'line' : 'lines'}`
}
