// What the Changes tab shows, as pure functions. No DOM, so tests run it under tsx.
import type { ChangeKind, DiffHunk, DiffRequest, StatusEntry } from '../../../shared/types'

export type RowKind = ChangeKind | 'untracked' | 'conflicted'

export interface StatusGroups {
  conflicted: StatusEntry[]
  staged: StatusEntry[]
  /** Changed in the work tree, or new and not yet tracked. */
  unstaged: StatusEntry[]
}

/** A file can be in both lists: staged once, then edited again. */
export function groupStatus(entries: readonly StatusEntry[]): StatusGroups {
  const groups: StatusGroups = { conflicted: [], staged: [], unstaged: [] }
  for (const entry of entries) {
    if (entry.conflicted) groups.conflicted.push(entry)
    else {
      if (entry.index) groups.staged.push(entry)
      if (entry.worktree || entry.untracked) groups.unstaged.push(entry)
    }
  }
  return groups
}

const LETTERS: Record<RowKind, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  typechange: 'T',
  untracked: 'U',
  conflicted: '!'
}

const WORDS: Record<RowKind, string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
  copied: 'Copied',
  typechange: 'Type changed',
  untracked: 'New file',
  conflicted: 'Conflict'
}

export const rowLetter = (kind: RowKind): string => LETTERS[kind]
export const rowWord = (kind: RowKind): string => WORDS[kind]

export function stagedKind(entry: StatusEntry): RowKind {
  return entry.index ?? 'modified'
}

export function unstagedKind(entry: StatusEntry): RowKind {
  return entry.untracked ? 'untracked' : (entry.worktree ?? 'modified')
}

/** `src/app/main.ts` becomes `{ dir: 'src/app/', name: 'main.ts' }`. */
export function splitPath(path: string): { dir: string; name: string } {
  const slash = path.lastIndexOf('/')
  return slash < 0
    ? { dir: '', name: path }
    : { dir: path.slice(0, slash + 1), name: path.slice(slash + 1) }
}

/** Why Commit is disabled, in words, or `null` when it can run. */
export function commitBlocker(options: {
  message: string
  staged: number
  conflicts: number
  amend: boolean
}): string | null {
  const { message, staged, conflicts, amend } = options
  if (conflicts > 0) return 'Resolve the conflicts first'
  const hasMessage = message.trim().length > 0
  if (amend) return staged === 0 && !hasMessage ? 'Change the message or stage a file' : null
  if (staged === 0) return 'Stage at least one file'
  if (!hasMessage) return 'Write a commit message'
  return null
}

export interface Selection {
  source: 'worktree' | 'staged'
  path: string
}

/** Keeps the selected file while it still has changes in the list it was picked from. */
export function keepSelection(selection: Selection | null, groups: StatusGroups): Selection | null {
  if (!selection) return null
  const list = selection.source === 'staged' ? groups.staged : groups.unstaged
  return list.some((e) => e.path === selection.path) ? selection : null
}

export const selectionRequest = (s: Selection): DiffRequest => ({ source: s.source, path: s.path })

export function countText(n: number, noun: string): string {
  return `${n.toLocaleString('en-GB')} ${noun}${n === 1 ? '' : 's'}`
}

/** `+3 −1`, with a real minus sign. */
export function diffTotalsText(additions: number, deletions: number): string {
  return `+${additions.toLocaleString('en-GB')} −${deletions.toLocaleString('en-GB')}`
}

/** Diffs longer than this start collapsed, with a button for the rest. */
export const DIFF_LINE_LIMIT = 2000

/** Lines to render: all of them, or `limit` when the diff is longer. */
export const visibleLineCount = (total: number, limit: number = DIFF_LINE_LIMIT): number =>
  Math.min(total, limit)

/** The first `limit` lines of the hunks, cutting the last hunk short if it must. */
export function limitHunks(hunks: readonly DiffHunk[], limit: number): DiffHunk[] {
  const out: DiffHunk[] = []
  let left = limit
  for (const hunk of hunks) {
    if (left <= 0) break
    out.push(hunk.lines.length <= left ? hunk : { ...hunk, lines: hunk.lines.slice(0, left) })
    left -= hunk.lines.length
  }
  return out
}
