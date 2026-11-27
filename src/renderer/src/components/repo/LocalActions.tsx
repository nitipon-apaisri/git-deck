import { useEffect, useState } from 'react'
import { useHiddenRefs } from '../../state/hiddenRefs'
import { cn } from '@/lib/cn'
import type { BranchList, Repo } from '@shared/types'
import {
  refActions,
  remoteGroups,
  remoteState,
  trackingText,
  type RefAction
} from '../../lib/branchView'
import { refMenuEntries } from '../../lib/refMenu'
import {
  activityDone,
  activityFailed,
  activityLabel,
  activityWaitTitle,
  buttonActivity,
  stashButtonLabel,
  type ActivityKind
} from '../../lib/operationView'
import type { LocalActions as Actions } from '../../state/useLocalActions'
import { Button, Icon, IconButton, Menu, type MenuEntry } from '../ui'

interface LocalActionsProps {
  repo: Repo
  linkedPath: string | undefined
  actions: Actions
  /** `null` until the folder has been read. */
  branches: BranchList | null
  onNewBranch: () => void
  onRenameBranch: (from: string) => void
  /** A merge, cherry-pick, revert or rebase is waiting, so no second one starts. */
  operationActive: boolean
  stashCount: number
  onStash: () => void
  onTags: () => void
  onBranches: () => void
  onRemotes: () => void
  onWorktrees: () => void
  terminalOpen: boolean
  onToggleTerminal: () => void
  /** A narrow pane: Open folder, Fetch, Pull and Push show only their icon. */
  compact?: boolean
}

type OpenMenu = { id: 'branch' | 'pull' | 'push' | 'more'; x: number; y: number }
type BranchRef = { kind: 'branch' | 'remote'; name: string; current: boolean }

/** Buttons inside the joined Fetch / Pull / Push strip: the strip draws the fill. */
const SEGMENT = 'h-full rounded-none bg-transparent pr-1.5 pl-3'
const DIVIDER = 'border-l border-card'
const SEGMENT_ICON = 'h-full w-8 rounded-none bg-transparent'
const SEGMENT_CARET = 'h-full w-7 rounded-none bg-transparent'

/** Which edges of a sideways-scrolling element have more content hidden past them. */
function useScrollFade(el: HTMLElement | null): { start: boolean; end: boolean } {
  const [fade, setFade] = useState({ start: false, end: false })
  useEffect(() => {
    if (!el) return
    const update = (): void => {
      const start = el.scrollLeft > 1
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setFade((f) => (f.start === start && f.end === end ? f : { start, end }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [el])
  return fade
}

/** Clone, link, open, fetch, branch, pull, push and unlink for one repository. */
export function LocalActions({
  repo,
  linkedPath,
  actions,
  branches,
  onNewBranch,
  onRenameBranch,
  operationActive,
  stashCount,
  onStash,
  onTags,
  onBranches,
  onRemotes,
  onWorktrees,
  terminalOpen,
  onToggleTerminal,
  compact = false
}: LocalActionsProps) {
  const { busy } = actions
  const hidden = useHiddenRefs(linkedPath ?? null)
  const working = busy !== null
  // A disabled button says what it waits for instead of going silent.
  const waitTitle = busy ? activityWaitTitle(busy) : undefined
  const outcome = actions.outcome
  const activity = (owns: readonly ActivityKind[]) => buttonActivity(owns, busy, outcome)
  // The tooltip of a button that runs a write: git's line while it runs, then how it ended.
  function titleFor(owns: readonly ActivityKind[], base?: string): string | undefined {
    const a = activity(owns)
    if (a === 'busy' && busy) return actions.progress?.line ?? activityLabel(busy)
    if (a === 'success' && outcome) return activityDone(outcome.kind)
    if (a === 'error' && outcome) return activityFailed(outcome.kind)
    return waitTitle ?? base
  }
  // One live region for the screen reader: the label once, not every output line.
  const status = busy
    ? activityLabel(busy)
    : outcome
      ? outcome.status === 'success'
        ? activityDone(outcome.kind)
        : activityFailed(outcome.kind)
      : ''
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const [row, setRow] = useState<HTMLDivElement | null>(null)
  const fade = useScrollFade(row)

  if (linkedPath) {
    const state = remoteState(branches)
    const current = branches?.local.find((b) => b.current) ?? null
    const branchName = branches
      ? (branches.current ?? (branches.detached ? 'Detached HEAD' : 'No commits'))
      : 'Branches'

    function open(id: OpenMenu['id'], el: HTMLElement): void {
      const rect = el.getBoundingClientRect()
      setMenu({ id, x: rect.left, y: rect.bottom + 4 })
    }

    function entriesFor(id: OpenMenu['id']): MenuEntry[] {
      if (id === 'pull') {
        return [
          {
            kind: 'item',
            id: 'ff',
            label: 'Pull (fast-forward only)',
            disabled: !state.pull.enabled,
            onSelect: () => actions.pull('ff-only')
          },
          {
            kind: 'item',
            id: 'merge',
            label: 'Pull and merge',
            trailing: 'creates a merge commit',
            disabled: !state.pull.enabled,
            onSelect: () => actions.pull('merge')
          }
        ]
      }
      if (id === 'more') {
        const list: MenuEntry[] = [
          {
            kind: 'item',
            id: 'tags',
            label: 'Tags',
            leading: <Icon name="tag" size="sm" />,
            onSelect: onTags
          },
          {
            kind: 'item',
            id: 'remotes',
            label: 'Remotes',
            leading: <Icon name="globe" size="sm" />,
            onSelect: onRemotes
          },
          {
            kind: 'item',
            id: 'worktrees',
            label: 'Worktrees',
            leading: <Icon name="folder" size="sm" />,
            onSelect: onWorktrees
          }
        ]
        if (hidden.all.length > 0) {
          list.push({
            kind: 'item',
            id: 'show-hidden',
            label: `${hidden.showHidden ? 'Hide' : 'Show'} hidden (${hidden.all.length})`,
            leading: <Icon name={hidden.showHidden ? 'eye' : 'eye-off'} size="sm" />,
            keepOpen: true,
            onSelect: () => hidden.setShowHidden(!hidden.showHidden)
          })
        }
        if (repo.accountId !== 'local') {
          list.push(
            { kind: 'separator', id: 's-unlink' },
            {
              kind: 'item',
              id: 'unlink',
              label: 'Unlink folder',
              leading: <Icon name="link" size="sm" />,
              trailing: 'nothing is deleted',
              danger: true,
              disabled: working,
              onSelect: actions.unlink
            }
          )
        }
        return list
      }
      if (id === 'push') {
        return [
          {
            kind: 'item',
            id: 'force',
            label: 'Force push (with lease)…',
            danger: true,
            disabled: !state.force,
            onSelect: () => actions.push(true)
          }
        ]
      }
      const list: MenuEntry[] = [{ kind: 'heading', id: 'h-local', label: 'Local branches' }]
      for (const b of branches?.local ?? []) {
        // A row opens its actions on hover or the Right arrow: check out, merge, delete, copy.
        list.push({
          kind: 'submenu',
          id: `l:${b.name}`,
          label: b.name,
          leading: (
            <span
              className="grid w-3.5 flex-none place-items-center text-(--accent-text)"
              aria-hidden="true"
            >
              {b.current ? <Icon name="check" size="sm" /> : null}
            </span>
          ),
          trailing: trackingText(b) || undefined,
          entries: refEntries({ kind: 'branch', name: b.name, current: b.current })
        })
      }
      // Every remote branch, a heading per remote (`origin`), even one that has a local twin.
      for (const group of branches ? remoteGroups(branches) : []) {
        list.push({ kind: 'separator', id: `s-remote:${group.remote}` })
        list.push({ kind: 'heading', id: `h-remote:${group.remote}`, label: group.remote })
        for (const name of group.names) {
          list.push({
            kind: 'submenu',
            id: `r:${name}`,
            label: name.slice(group.remote.length + 1),
            entries: refEntries({ kind: 'remote', name, current: false })
          })
        }
      }
      return list
    }

    // Kept at the bottom of the branch menu while its list scrolls.
    function pinnedFor(id: OpenMenu['id']): MenuEntry[] {
      if (id !== 'branch') return []
      const list: MenuEntry[] = [
        { kind: 'item', id: 'new', label: 'New branch…', onSelect: onNewBranch },
        { kind: 'item', id: 'manage', label: 'Manage branches…', onSelect: onBranches }
      ]
      return list
    }

    function runRefAction(action: RefAction): void {
      switch (action.type) {
        case 'checkout-branch':
          return actions.checkout({ kind: 'branch', name: action.name })
        case 'checkout-remote':
          return actions.checkout({ kind: 'remote', name: action.name })
        case 'rename-branch':
          return onRenameBranch(action.name)
        case 'delete-branch':
          return actions.deleteBranch(action.name)
        case 'delete-remote-branch':
          return actions.deleteRemoteBranch(action.name)
        case 'push-branch':
          return actions.pushBranch(action.name)
        case 'fast-forward-branch':
          return actions.fastForwardBranch(action.name)
        case 'merge':
          return actions.merge(action.branch, action.mode)
        case 'rebase':
          return actions.rebase(action.onto)
        case 'copy':
          void navigator.clipboard?.writeText(action.text).catch(() => {})
      }
    }

    function refEntries(ref: BranchRef): MenuEntry[] {
      // No commit under the pointer here, so only the branch's own actions.
      const items = refActions(ref, null, {
        currentBranch: current?.name ?? null,
        isMerge: false,
        operationActive
      })
      return refMenuEntries(items, current?.name ?? null, working, runRefAction)
    }

    const pullCount = state.behind > 0 ? ` ↓${state.behind}` : ''
    const pushCount = state.ahead > 0 ? ` ↑${state.ahead}` : ''

    return (
      <div
        ref={setRow}
        className="scroll-hidden scroll-fade flex min-w-0 flex-1 items-center gap-2 overflow-x-auto *:shrink-0"
        data-fade-start={fade.start || undefined}
        data-fade-end={fade.end || undefined}
      >
        <Button
          icon="git-branch"
          activity={activity(['branch'])}
          disabled={working || !branches}
          className="max-w-55 min-w-0"
          title={titleFor(
            ['branch'],
            branches?.detached ? 'HEAD is detached. Choose a branch to switch to it.' : 'Branches'
          )}
          aria-haspopup="menu"
          aria-expanded={menu?.id === 'branch'}
          onClick={(e) => open('branch', e.currentTarget)}
        >
          <span className="truncate">{branchName}</span>
          <Icon name="chevron-down" size="xs" />
        </Button>
        <div
          className="inline-flex h-9 items-center overflow-hidden rounded-md bg-secondary"
          role="group"
          aria-label="Sync"
        >
          <IconButton
            label="Fetch"
            title={titleFor(['fetch'], 'Fetch')}
            icon="refresh"
            activity={activity(['fetch'])}
            disabled={working}
            className={SEGMENT_ICON}
            onClick={actions.fetch}
          />
          <Button
            icon="arrow-down"
            activity={activity(['pull'])}
            disabled={working || !state.pull.enabled}
            title={titleFor(['pull'], state.pull.title)}
            className={cn(SEGMENT, DIVIDER)}
            onClick={() => actions.pull('ff-only')}
          >
            {compact
              ? pullCount.trim() || <span className="sr-only">Pull</span>
              : `Pull${pullCount}`}
          </Button>
          <IconButton
            label="More ways to pull"
            icon="chevron-down"
            disabled={working || !state.pull.enabled}
            className={SEGMENT_CARET}
            aria-haspopup="menu"
            onClick={(e) => open('pull', e.currentTarget)}
          />
          <Button
            icon="arrow-up"
            activity={activity(['push'])}
            disabled={working || !state.push.enabled}
            title={titleFor(['push'], state.push.title)}
            className={cn(SEGMENT, DIVIDER)}
            onClick={() => actions.push(false)}
          >
            {compact
              ? pushCount.trim() || <span className="sr-only">{state.push.label}</span>
              : `${state.push.label}${pushCount}`}
          </Button>
          <IconButton
            label="More ways to push"
            icon="chevron-down"
            disabled={working || !state.force}
            className={SEGMENT_CARET}
            aria-haspopup="menu"
            onClick={(e) => open('push', e.currentTarget)}
          />
        </div>
        <Button icon="layers" onClick={onStash}>
          {stashButtonLabel(stashCount)}
        </Button>
        <IconButton
          label="More repository actions"
          icon="more"
          className="size-9"
          aria-haspopup="menu"
          aria-expanded={menu?.id === 'more'}
          onClick={(e) => open('more', e.currentTarget)}
        />
        <span className="sr-only" role="status">
          {status}
        </span>
        <IconButton
          label="Terminal (Ctrl+`)"
          icon="terminal"
          className="ml-auto size-9"
          active={terminalOpen}
          aria-pressed={terminalOpen}
          onClick={onToggleTerminal}
        />
        <IconButton
          label="Open folder"
          icon="folder"
          className="size-9"
          disabled={working}
          onClick={actions.openFolder}
        />
        {menu ? (
          <Menu
            label={
              { branch: 'Branches', pull: 'Pull', push: 'Push', more: 'More actions' }[menu.id]
            }
            at={{ x: menu.x, y: menu.y }}
            entries={entriesFor(menu.id)}
            pinned={pinnedFor(menu.id)}
            minWidth={menu.id === 'branch' ? 240 : undefined}
            searchable={menu.id === 'branch'}
            onClose={() => setMenu(null)}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {repo.httpUrl ? (
        <Button
          variant="primary"
          icon="download"
          activity={activity(['clone'])}
          title={titleFor(['clone'])}
          disabled={working}
          onClick={() => actions.clone('https')}
        >
          Clone (HTTPS)
        </Button>
      ) : null}
      {repo.sshUrl ? (
        <Button
          icon="download"
          activity={activity(['clone'])}
          title={titleFor(['clone'])}
          disabled={working}
          onClick={() => actions.clone('ssh')}
        >
          Clone (SSH)
        </Button>
      ) : null}
      <Button
        icon="link"
        activity={activity(['link'])}
        title={titleFor(['link'])}
        disabled={working}
        onClick={actions.link}
      >
        Link existing folder
      </Button>
      <span className="sr-only" role="status">
        {status}
      </span>
    </div>
  )
}
