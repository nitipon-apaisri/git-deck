// Pure: no DOM, so it runs under tsx tests. Decides what the branch menu and the
// Push and Pull buttons show for one repository.
import type { BranchList, GraphRef, LocalBranch, ResetMode } from '../../../shared/types'

export function currentBranch(list: BranchList | null): LocalBranch | null {
  return list?.local.find((b) => b.current) ?? null
}

/** `↑1 ↓2` for a tracking branch that is out of step, `gone` when its upstream was deleted. */
export function trackingText(branch: Pick<LocalBranch, 'ahead' | 'behind' | 'gone'>): string {
  if (branch.gone) return 'gone'
  return [branch.ahead > 0 ? `↑${branch.ahead}` : '', branch.behind > 0 ? `↓${branch.behind}` : '']
    .filter(Boolean)
    .join(' ')
}

/** Remote branches that have no local branch yet: the ones worth a "check out" entry. */
export function remoteOnly(list: BranchList): string[] {
  const taken = new Set<string>()
  for (const b of list.local) {
    taken.add(b.name)
    if (b.upstream) taken.add(b.upstream)
  }
  return list.remote.filter((name) => {
    const local = name.slice(name.indexOf('/') + 1)
    return !taken.has(name) && !list.local.some((b) => b.name === local)
  })
}

export interface ButtonState {
  enabled: boolean
  /** Why it is off, or what it does. Shown as the tooltip. */
  title: string
}

export interface RemoteState {
  pull: ButtonState
  push: ButtonState & { label: 'Push' | 'Publish' }
  /** Force push is offered once there is an upstream to overwrite. */
  force: boolean
  ahead: number
  behind: number
}

export function remoteState(list: BranchList | null): RemoteState {
  const off = (title: string): RemoteState => ({
    pull: { enabled: false, title },
    push: { enabled: false, title, label: 'Push' },
    force: false,
    ahead: 0,
    behind: 0
  })
  if (!list) return off('Reading branches…')
  const branch = currentBranch(list)
  if (!branch) return off('Check out a branch first. HEAD is detached.')
  if (list.remotes.length === 0) return off('This repository has no remote.')
  const hasUpstream = branch.upstream !== null && !branch.gone
  return {
    pull: hasUpstream
      ? {
          enabled: true,
          title:
            branch.behind > 0
              ? `Pull ${branch.behind} commit${branch.behind === 1 ? '' : 's'} (fast-forward only)`
              : 'Pull (fast-forward only)'
        }
      : { enabled: false, title: 'This branch has no upstream yet. Push it first.' },
    push: hasUpstream
      ? {
          enabled: branch.ahead > 0,
          title:
            branch.ahead > 0
              ? `Push ${branch.ahead} commit${branch.ahead === 1 ? '' : 's'}`
              : 'Nothing to push',
          label: 'Push'
        }
      : { enabled: true, title: 'Push this branch and set its upstream', label: 'Publish' },
    force: hasUpstream,
    ahead: branch.ahead,
    behind: branch.behind
  }
}

export type RefAction =
  | { type: 'checkout-branch'; name: string }
  | { type: 'checkout-remote'; name: string }
  | { type: 'checkout-commit'; hash: string }
  | { type: 'create-branch'; startPoint: string }
  | { type: 'rename-branch'; name: string }
  | { type: 'delete-branch'; name: string }
  | { type: 'merge'; branch: string; noFf: boolean }
  | { type: 'cherry-pick'; hash: string }
  | { type: 'create-tag'; hash: string }
  | { type: 'rebase'; onto: string }
  | { type: 'revert'; hash: string }
  | { type: 'reset'; hash: string; mode: ResetMode }
  | { type: 'copy'; text: string; what: string }

export interface RefActionItem {
  id: string
  label: string
  action: RefAction
  danger?: boolean
  /** A separator goes before this item. */
  group: 'ref' | 'commit'
}

export interface RefActionContext {
  /** The checked-out branch. `null` while HEAD is detached: merging is not offered. */
  currentBranch: string | null
  /** The commit has two or more parents. Cherry-picking one needs a mainline: not offered. */
  isMerge: boolean
  /** A merge, cherry-pick, revert or rebase is waiting: starting another is not offered. */
  operationActive: boolean
}

/**
 * What a right-click offers. `ref` is the badge that was clicked, or `null` for the row.
 * Deleting the checked-out branch is not offered at all. Without `context` (a pane that
 * cannot write) neither merge nor cherry-pick appears.
 */
export function refActions(
  ref: (Pick<GraphRef, 'kind' | 'name'> & { current?: boolean }) | null,
  hash: string,
  context?: RefActionContext
): RefActionItem[] {
  const items: RefActionItem[] = []
  const canStart = !!context && !context.operationActive
  if (ref?.kind === 'branch') {
    if (ref.current) {
      items.push({
        id: 'rename',
        label: `Rename ${ref.name}…`,
        action: { type: 'rename-branch', name: ref.name },
        group: 'ref'
      })
    } else {
      items.push({
        id: 'checkout',
        label: `Check out ${ref.name}`,
        action: { type: 'checkout-branch', name: ref.name },
        group: 'ref'
      })
      items.push({
        id: 'delete',
        label: `Delete ${ref.name}…`,
        action: { type: 'delete-branch', name: ref.name },
        danger: true,
        group: 'ref'
      })
    }
  } else if (ref?.kind === 'remote') {
    items.push({
      id: 'checkout',
      label: `Check out ${ref.name} as a tracking branch`,
      action: { type: 'checkout-remote', name: ref.name },
      group: 'ref'
    })
  }
  if (
    canStart &&
    context.currentBranch &&
    ref &&
    (ref.kind === 'remote' || (ref.kind === 'branch' && !ref.current))
  ) {
    items.push(
      {
        id: 'merge',
        label: `Merge ${ref.name} into ${context.currentBranch}`,
        action: { type: 'merge', branch: ref.name, noFf: false },
        group: 'ref'
      },
      {
        id: 'merge-no-ff',
        label: `Merge ${ref.name} into ${context.currentBranch} (always a merge commit)`,
        action: { type: 'merge', branch: ref.name, noFf: true },
        group: 'ref'
      },
      {
        id: 'rebase',
        label: `Rebase ${context.currentBranch} onto ${ref.name}`,
        action: { type: 'rebase', onto: ref.name },
        group: 'ref'
      }
    )
  }
  if (ref && (ref.kind === 'branch' || ref.kind === 'remote' || ref.kind === 'tag')) {
    items.push({
      id: 'copy-name',
      label: `Copy ${ref.kind === 'tag' ? 'tag' : 'branch'} name`,
      action: { type: 'copy', text: ref.name, what: 'name' },
      group: 'ref'
    })
  }
  items.push(
    {
      id: 'checkout-commit',
      label: 'Check out this commit (detached)',
      action: { type: 'checkout-commit', hash },
      group: 'commit'
    },
    {
      id: 'create-branch',
      label: 'Create branch here…',
      action: { type: 'create-branch', startPoint: hash },
      group: 'commit'
    }
  )
  if (canStart && context.currentBranch && !context.isMerge) {
    items.push({
      id: 'cherry-pick',
      label: `Cherry-pick onto ${context.currentBranch}`,
      action: { type: 'cherry-pick', hash },
      group: 'commit'
    })
  }
  if (canStart && context.currentBranch) {
    items.push({
      id: 'rebase-commit',
      label: `Rebase ${context.currentBranch} onto this commit`,
      action: { type: 'rebase', onto: hash },
      group: 'commit'
    })
  }
  if (canStart && context.currentBranch && !context.isMerge) {
    items.push({
      id: 'revert',
      label: `Revert this commit on ${context.currentBranch}`,
      action: { type: 'revert', hash },
      group: 'commit'
    })
  }
  if (context) {
    items.push({
      id: 'create-tag',
      label: 'Create tag here…',
      action: { type: 'create-tag', hash },
      group: 'commit'
    })
  }
  if (canStart) {
    const target = context.currentBranch ?? 'HEAD'
    for (const mode of ['soft', 'mixed', 'hard'] as const) {
      items.push({
        id: `reset-${mode}`,
        label: `Reset ${target} to here (${mode})${mode === 'hard' ? '…' : ''}`,
        action: { type: 'reset', hash, mode },
        danger: mode === 'hard',
        group: 'commit'
      })
    }
  }
  items.push({
    id: 'copy-hash',
    label: 'Copy commit hash',
    action: { type: 'copy', text: hash, what: 'hash' },
    group: 'commit'
  })
  return items
}
