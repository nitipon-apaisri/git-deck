// Pure: the todo list the interactive rebase dialog edits.
import type { RebaseAction, RebasePlan, RebaseTodoItem } from '../../../shared/types'

export interface RebaseRow {
  hash: string
  subject: string
  action: RebaseAction
  /** The new message of a `reword`. */
  message: string
}

export const REBASE_ACTION_OPTIONS: { value: RebaseAction; label: string }[] = [
  { value: 'pick', label: 'Pick (keep)' },
  { value: 'reword', label: 'Reword (new message)' },
  { value: 'squash', label: 'Squash (join, keep both messages)' },
  { value: 'fixup', label: 'Fixup (join, drop message)' },
  { value: 'drop', label: 'Drop (remove)' }
]

export function rowsFromPlan(plan: RebasePlan): RebaseRow[] {
  return plan.commits.map((c) => ({
    hash: c.hash,
    subject: c.subject,
    action: 'pick',
    message: c.message
  }))
}

/** Moves a row up (-1) or down (+1). Out of range is a no-op. */
export function moveRow(rows: RebaseRow[], index: number, delta: -1 | 1): RebaseRow[] {
  const to = index + delta
  if (index < 0 || index >= rows.length || to < 0 || to >= rows.length) return rows
  const next = rows.slice()
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

export function patchRow(rows: RebaseRow[], index: number, patch: Partial<RebaseRow>): RebaseRow[] {
  return rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
}

/** Why the list cannot run yet, or `null`. Mirrors the checks main repeats. */
export function rebaseProblem(rows: RebaseRow[]): string | null {
  const kept = rows.filter((r) => r.action !== 'drop')
  if (kept.length === 0) return 'Keep at least one commit. To undo them all, use reset.'
  if (kept[0].action === 'squash' || kept[0].action === 'fixup') {
    return 'The first commit that is kept must be a pick or a reword, so there is something to join into.'
  }
  if (rows.some((r) => r.action === 'reword' && !r.message.trim())) {
    return 'A reworded commit needs a message.'
  }
  return null
}

/** Why "Start rebase" is off while the list can run, or `null`. */
export function unchangedHint(rows: RebaseRow[], plan: RebasePlan): string | null {
  return isUnchanged(rows, plan) ? 'Reorder, reword, join or drop a commit to start.' : null
}

/** True when running would change nothing: every row is a pick in the original order. */
export function isUnchanged(rows: RebaseRow[], plan: RebasePlan): boolean {
  return rows.every((r, i) => r.action === 'pick' && r.hash === plan.commits[i]?.hash)
}

export function toTodo(rows: RebaseRow[]): RebaseTodoItem[] {
  return rows.map((r) =>
    r.action === 'reword'
      ? { hash: r.hash, action: r.action, message: r.message }
      : { hash: r.hash, action: r.action }
  )
}
