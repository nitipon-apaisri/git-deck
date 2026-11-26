// Parser for `git worktree list --porcelain`. No electron import, so it runs under tsx tests.
import type { WorktreeEntry } from './types'

export type ParsedWorktree = Omit<WorktreeEntry, 'repoKey'>

/** Records are separated by a blank line. The first one is the main working tree. */
export function parseWorktrees(text: string): ParsedWorktree[] {
  const out: ParsedWorktree[] = []
  for (const block of text.split(/\n\s*\n/)) {
    let cur: ParsedWorktree | null = null
    for (const line of block.split('\n')) {
      const [key, ...rest] = line.split(' ')
      const value = rest.join(' ')
      if (key === 'worktree') {
        cur = {
          path: value,
          head: '',
          branch: null,
          detached: false,
          bare: false,
          locked: null,
          prunable: null,
          isMain: out.length === 0
        }
      } else if (!cur) continue
      else if (key === 'HEAD') cur.head = value
      else if (key === 'branch') cur.branch = value.replace(/^refs\/heads\//, '')
      else if (key === 'detached') cur.detached = true
      else if (key === 'bare') cur.bare = true
      else if (key === 'locked') cur.locked = value
      else if (key === 'prunable') cur.prunable = value
    }
    if (cur) out.push(cur)
  }
  return out
}
