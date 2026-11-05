import type { Repo } from '@shared/types'
import type { LocalActions as Actions } from '../../state/useLocalActions'
import { Button, IconButton, ProgressBar, Spinner } from '../ui'
import styles from './LocalActions.module.css'

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
      <div className={styles.progress} role="group" aria-label="Clone progress">
        <ProgressBar percent={actions.progress?.percent ?? null} label="Clone progress" />
        <p className={styles.line}>{actions.progress?.line ?? 'Cloning…'}</p>
      </div>
    )
  }

  if (linkedPath) {
    return (
      <div className={styles.row}>
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
        <Button
          variant="ghost"
          disabled={working}
          onClick={actions.unlink}
          title="Forget this folder. Nothing is deleted from disk."
        >
          Unlink
        </Button>
        <span className={`${styles.path} hash`} title={linkedPath}>
          {linkedPath}
        </span>
      </div>
    )
  }

  return (
    <div className={styles.row}>
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
