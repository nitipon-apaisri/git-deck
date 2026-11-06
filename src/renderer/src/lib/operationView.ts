// Pure: words for the merge, cherry-pick, revert and rebase banner and the stash list.
import type { OperationState, StashEntry } from '../../../shared/types'

/** "Merge in progress", with the commit when git recorded one. */
export function operationTitle(state: OperationState): string {
  const word = state.kind
  const head = `${word[0].toUpperCase()}${word.slice(1)} in progress`
  return state.target ? `${head} (${state.target})` : head
}

/** What the user has left to do. */
export function operationHint(state: OperationState): string {
  const n = state.conflicted.length
  if (n === 0 && state.kind === 'rebase') {
    return 'Every conflict is resolved. Continue to replay the next commit, skip this one, or abort to undo the whole rebase.'
  }
  if (n === 0) return 'Every conflict is resolved. Continue to finish it, or abort to undo it.'
  const files = `${n} file${n === 1 ? ' has' : 's have'} conflicts`
  return `${files}. Resolve ${n === 1 ? 'it' : 'each one'} here or in your editor, then continue. Aborting undoes everything.`
}

/** Paths for the banner, capped so a huge merge does not fill the screen. */
export function conflictPreview(paths: string[], max = 5): { shown: string[]; more: number } {
  return { shown: paths.slice(0, max), more: Math.max(0, paths.length - max) }
}

/** The text of a stash row: the message, or a stand-in for an empty one. */
export function stashTitle(entry: Pick<StashEntry, 'message'>): string {
  return entry.message.trim() || '(no message)'
}

export function stashButtonLabel(count: number): string {
  return count > 0 ? `Stash · ${count}` : 'Stash'
}
