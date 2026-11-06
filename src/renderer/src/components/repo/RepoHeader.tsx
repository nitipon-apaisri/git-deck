import type { Account, Repo } from '@shared/types'
import { visibilityLabel } from '../../lib/repoView'
import { Badge, Button, Icon, IconButton } from '../ui'
import styles from './RepoHeader.module.css'

interface RepoHeaderProps {
  repo: Repo
  account: Account | null
  /** Opened from a folder: no host, so no visibility, web link or account. */
  local?: boolean
  /** A narrow pane: buttons show only their icon. */
  compact?: boolean
  onOpenWeb: () => void
  /** Shows a close button when set (Split View only). */
  onClose?: () => void
}

export function RepoHeader({
  repo,
  account,
  local = false,
  compact = false,
  onOpenWeb,
  onClose
}: RepoHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{repo.name}</h1>
            {local ? (
              <Badge>Local</Badge>
            ) : (
              <Badge>
                {repo.visibility === 'private' ? <Icon name="lock" size="xs" /> : null}
                {visibilityLabel(repo.visibility)}
              </Badge>
            )}
            {repo.archived ? <Badge tone="warning">Archived</Badge> : null}
            {repo.fork ? <Badge>Fork</Badge> : null}
          </div>
          <p className={styles.path}>
            {local ? 'Not on a host' : `${account ? `${account.label} · ` : ''}${repo.fullName}`}
          </p>
        </div>
        <div className={styles.buttons}>
          {local ? null : compact ? (
            <IconButton label="Open on web" icon="external" onClick={onOpenWeb} />
          ) : (
            <Button icon="external" onClick={onOpenWeb}>
              Open on web
            </Button>
          )}
          {onClose ? <IconButton label="Close pane" icon="x" onClick={onClose} /> : null}
        </div>
      </div>
      {repo.description && !local ? <p className={styles.description}>{repo.description}</p> : null}
    </header>
  )
}
