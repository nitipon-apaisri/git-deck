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

/** "Step 3 of 7" for a rebase, `null` for the others. */
export function operationStepText(state: OperationState): string | null {
  return state.step ? `Step ${state.step.current} of ${state.step.total}` : null
}

/** The kinds of write a button shows the progress of. */
export type ActivityKind = 'clone' | 'link' | 'fetch' | 'pull' | 'push' | 'branch'

const ACTIVITY: Record<ActivityKind, { doing: string; done: string }> = {
  clone: { doing: 'Cloning…', done: 'Clone complete' },
  link: { doing: 'Linking the folder…', done: 'Folder linked' },
  fetch: { doing: 'Fetching…', done: 'Fetch complete' },
  pull: { doing: 'Pulling…', done: 'Pull complete' },
  push: { doing: 'Pushing…', done: 'Push complete' },
  branch: { doing: 'Switching branch…', done: 'Branch switched' }
}

/** What is running, for the tooltips and the screen reader. */
export function activityLabel(kind: ActivityKind): string {
  return ACTIVITY[kind].doing
}

/** The short confirmation after the write ended without an error. */
export function activityDone(kind: ActivityKind): string {
  return ACTIVITY[kind].done
}

/** "push failed", for the toast title. A write without a button icon says "action failed". */
export function activityFailed(kind: ActivityKind | null): string {
  return kind ? `${kind} failed` : 'action failed'
}

export type ButtonActivity = 'idle' | 'busy' | 'success' | 'error'

/** What one button shows: `owns` are the kinds of write it starts. */
export function buttonActivity(
  owns: readonly ActivityKind[],
  busy: ActivityKind | null,
  outcome: { kind: ActivityKind; status: 'success' | 'error' } | null
): ButtonActivity {
  if (busy && owns.includes(busy)) return 'busy'
  if (outcome && owns.includes(outcome.kind)) return outcome.status
  return 'idle'
}

/** The tooltip on a button that waits: names the running write. */
export function activityWaitTitle(kind: ActivityKind): string {
  return `${ACTIVITY[kind].doing} Wait for it to finish.`
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
