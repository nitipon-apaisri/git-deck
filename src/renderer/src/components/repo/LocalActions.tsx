import { useState } from 'react'
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
import { stashButtonLabel } from '../../lib/operationView'
import type { LocalActions as Actions } from '../../state/useLocalActions'
import { Button, Icon, IconButton, Menu, ProgressBar, Spinner, type MenuEntry } from '../ui'

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
  onRemotes: () => void
  /** A narrow pane: Open folder, Fetch, Pull and Push show only their icon. */
  compact?: boolean
}

type OpenMenu = { id: 'branch' | 'pull' | 'push'; x: number; y: number }
type BranchRef = { kind: 'branch' | 'remote'; name: string; current: boolean }

/** Buttons inside the joined Fetch / Pull / Push strip: the strip draws the border. */
const SEGMENT = 'h-full rounded-none border-0 pr-1.5 pl-3'
const DIVIDER = 'border-l border-border'
const SEGMENT_ICON = 'h-full w-8 rounded-none'
const SEGMENT_CARET = 'h-full w-7 rounded-none'

const PROGRESS_LABEL = { clone: 'Cloning…', pull: 'Pulling…', push: 'Pushing…' } as const

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
  onRemotes,
  compact = false
}: LocalActionsProps) {
  const { busy } = actions
  const working = busy !== null
  const [menu, setMenu] = useState<OpenMenu | null>(null)

  if (busy === 'clone' || busy === 'pull' || busy === 'push') {
    const label = `${busy[0].toUpperCase()}${busy.slice(1)} progress`
    return (
      <div className="flex max-w-[480px] flex-col gap-1.5" role="group" aria-label={label}>
        <ProgressBar percent={actions.progress?.percent ?? null} label={label} />
        <p className="m-0 text-[12px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
          {actions.progress?.line ?? PROGRESS_LABEL[busy]}
        </p>
      </div>
    )
  }

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
              className="grid w-3.5 flex-none place-items-center text-[var(--accent-text)]"
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
      list.push({ kind: 'separator', id: 's-new' })
      list.push({ kind: 'item', id: 'new', label: 'New branch…', onSelect: onNewBranch })
      if (current) {
        list.push({
          kind: 'item',
          id: 'rename',
          label: `Rename ${current.name}…`,
          onSelect: () => onRenameBranch(current.name)
        })
      }
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
        case 'merge':
          return actions.merge(action.branch, action.noFf)
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
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Button
          icon="git-branch"
          disabled={working || !branches}
          className="max-w-[220px] min-w-0"
          title={
            branches?.detached ? 'HEAD is detached. Choose a branch to switch to it.' : 'Branches'
          }
          aria-haspopup="menu"
          aria-expanded={menu?.id === 'branch'}
          onClick={(e) => open('branch', e.currentTarget)}
        >
          <span className="truncate">{branchName}</span>
          <Icon name="chevron-down" size="xs" />
        </Button>
        <div
          className="inline-flex h-9 items-center overflow-hidden rounded-md border border-border"
          role="group"
          aria-label="Sync"
        >
          <IconButton
            label={busy === 'fetch' ? 'Fetching…' : 'Fetch'}
            icon="refresh"
            disabled={working}
            className={SEGMENT_ICON}
            onClick={actions.fetch}
          />
          <Button
            icon="arrow-down"
            disabled={working || !state.pull.enabled}
            title={state.pull.title}
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
            disabled={working || !state.push.enabled}
            title={state.push.title}
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
        {(
          [
            { id: 'stash', label: stashButtonLabel(stashCount), icon: 'layers', onClick: onStash },
            { id: 'tags', label: 'Tags', icon: 'tag', onClick: onTags },
            { id: 'remotes', label: 'Remotes', icon: 'globe', onClick: onRemotes }
          ] as const
        ).map((b) =>
          compact ? (
            <IconButton
              key={b.id}
              label={b.label}
              icon={b.icon}
              className="size-9"
              onClick={b.onClick}
            />
          ) : (
            <Button key={b.id} icon={b.icon} onClick={b.onClick}>
              {b.label}
            </Button>
          )
        )}
        {busy === 'fetch' || busy === 'branch' ? (
          <Spinner label={busy === 'fetch' ? 'Fetching' : 'Switching branches'} />
        ) : null}
        {repo.accountId === 'local' ? null : (
          <Button
            variant="ghost"
            disabled={working}
            onClick={actions.unlink}
            title="Forget this folder. Nothing is deleted from disk."
          >
            Unlink
          </Button>
        )}
        <IconButton
          label="Open folder"
          icon="folder"
          className="ml-auto size-9"
          disabled={working}
          onClick={actions.openFolder}
        />
        {menu ? (
          <Menu
            label={menu.id === 'branch' ? 'Branches' : menu.id === 'pull' ? 'Pull' : 'Push'}
            at={{ x: menu.x, y: menu.y }}
            entries={entriesFor(menu.id)}
            minWidth={menu.id === 'branch' ? 240 : undefined}
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
          disabled={working}
          onClick={() => actions.clone('https')}
        >
          Clone (HTTPS)
        </Button>
      ) : null}
      {repo.sshUrl ? (
        <Button icon="download" disabled={working} onClick={() => actions.clone('ssh')}>
          Clone (SSH)
        </Button>
      ) : null}
      <Button icon="link" disabled={working} onClick={actions.link}>
        {busy === 'link' ? 'Linking…' : 'Link existing folder'}
      </Button>
    </div>
  )
}
