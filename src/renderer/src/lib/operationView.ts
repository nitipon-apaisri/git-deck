// Pure: words for the merge, cherry-pick, revert and rebase banner and the stash list.
import type { BisectState, OperationState, StashEntry } from '../../../shared/types'

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

/** "Bisect: testing a1b2c3d" or the result. */
export function bisectTitle(state: BisectState): string {
  if (state.result) return `Bisect found the first bad commit (${state.result.hash.slice(0, 7)})`
  return state.current ? `Bisect: testing ${state.current.slice(0, 7)}` : 'Bisect in progress'
}

export function bisectHint(state: BisectState): string {
  if (state.result)
    return `${state.result.subject || '(no subject)'}. Finish to go back to your branch.`
  const marks = `${state.good.length} good, ${state.skipped.length} skipped`
  return `Test this commit, then mark it good or bad (${marks}). Skip it if it cannot be tested.`
}
