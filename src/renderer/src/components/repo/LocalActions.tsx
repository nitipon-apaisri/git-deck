import type { Repo } from '@shared/types'
import type { LocalActions as Actions } from '../../state/useLocalActions'
import { Button, IconButton, ProgressBar, Spinner } from '../ui'

interface LocalActionsProps {
  repo: Repo
  linkedPath: string | undefined
  actions: Actions
  /** A narrow pane: Open folder and Fetch show only their icon. */
  compact?: boolean
}

/** Clone, link, open, fetch and unlink for one repository. */
export function LocalActions({ repo, linkedPath, actions, compact = false }: LocalActionsProps) {
  const { busy } = actions
  const working = busy !== null

  if (busy === 'clone') {
    return (
      <div className="flex max-w-[480px] flex-col gap-1.5" role="group" aria-label="Clone progress">
        <ProgressBar percent={actions.progress?.percent ?? null} label="Clone progress" />
        <p className="m-0 text-[12px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
          {actions.progress?.line ?? 'Cloning…'}
        </p>
      </div>
    )
  }

  if (linkedPath) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {compact ? (
          <>
            <IconButton
              label="Open folder"
              icon="folder"
              disabled={working}
              onClick={actions.openFolder}
            />
            <IconButton
              label={busy === 'fetch' ? 'Fetching…' : 'Fetch'}
              icon="refresh"
              disabled={working}
              onClick={actions.fetch}
            />
          </>
        ) : (
          <>
            <Button icon="folder" disabled={working} onClick={actions.openFolder}>
              Open folder
            </Button>
            <Button icon="refresh" disabled={working} onClick={actions.fetch}>
              {busy === 'fetch' ? 'Fetching…' : 'Fetch'}
            </Button>
          </>
        )}
        {busy === 'fetch' ? <Spinner label="Fetching" /> : null}
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
        <span className="hash min-w-0 flex-1 truncate text-muted-foreground" title={linkedPath}>
          {linkedPath}
        </span>
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
