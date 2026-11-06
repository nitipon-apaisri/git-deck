import { useState } from 'react'
import type { BranchList, Repo } from '@shared/types'
import { remoteOnly, remoteState, trackingText } from '../../lib/branchView'
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
  /** A narrow pane: Open folder, Fetch, Pull and Push show only their icon. */
  compact?: boolean
}

type OpenMenu = { id: 'branch' | 'pull' | 'push'; x: number; y: number }

const PROGRESS_LABEL = { clone: 'Cloning…', pull: 'Pulling…', push: 'Pushing…' } as const

/** Clone, link, open, fetch, branch, pull, push and unlink for one repository. */
export function LocalActions({
  repo,
  linkedPath,
  actions,
  branches,
  onNewBranch,
  onRenameBranch,
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
        list.push({
          kind: 'item',
          id: `l:${b.name}`,
          label: b.name,
          checked: b.current,
          radio: true,
          trailing: trackingText(b) || undefined,
          onSelect: () => {
            if (!b.current) actions.checkout({ kind: 'branch', name: b.name })
          }
        })
      }
      const others = branches ? remoteOnly(branches) : []
      if (others.length > 0) {
        list.push({ kind: 'separator', id: 's-remote' })
        list.push({ kind: 'heading', id: 'h-remote', label: 'Remote branches' })
        for (const name of others) {
          list.push({
            kind: 'item',
            id: `r:${name}`,
            label: name,
            onSelect: () => actions.checkout({ kind: 'remote', name })
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
        {compact ? (
          <IconButton
            label={busy === 'fetch' ? 'Fetching…' : 'Fetch'}
            icon="refresh"
            disabled={working}
            onClick={actions.fetch}
          />
        ) : (
          <Button icon="refresh" disabled={working} onClick={actions.fetch}>
            {busy === 'fetch' ? 'Fetching…' : 'Fetch'}
          </Button>
        )}
        <span className="inline-flex items-center" role="group" aria-label="Pull">
          <Button
            icon="download"
            disabled={working || !state.pull.enabled}
            title={state.pull.title}
            className="rounded-r-none border-r-0"
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
            className="h-[34px] rounded-l-none border border-border"
            aria-haspopup="menu"
            onClick={(e) => open('pull', e.currentTarget)}
          />
        </span>
        <span className="inline-flex items-center" role="group" aria-label="Push">
          <Button
            icon="external"
            disabled={working || !state.push.enabled}
            title={state.push.title}
            className="rounded-r-none border-r-0"
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
            className="h-[34px] rounded-l-none border border-border"
            aria-haspopup="menu"
            onClick={(e) => open('push', e.currentTarget)}
          />
        </span>
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
        {compact ? (
          <IconButton
            label="Open folder"
            icon="folder"
            className="ml-auto"
            disabled={working}
            onClick={actions.openFolder}
          />
        ) : (
          <Button icon="folder" className="ml-auto" disabled={working} onClick={actions.openFolder}>
            Open folder
          </Button>
        )}
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
