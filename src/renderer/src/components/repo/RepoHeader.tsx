import type { Account, Repo } from '@shared/types'
import { visibilityLabel } from '../../lib/repoView'
import { Badge, Button, Icon, IconButton } from '../ui'
import styles from './RepoHeader.module.css'

interface RepoHeaderProps {
  repo: Repo
  account: Account | null
  /** A narrow pane: buttons show only their icon. */
  compact?: boolean
  onOpenWeb: () => void
  /** Shows a close button when set (Split View only). */
  onClose?: () => void
}

export function RepoHeader({
  repo,
  account,
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
            <Badge>
              {repo.visibility === 'private' ? <Icon name="lock" size="xs" /> : null}
              {visibilityLabel(repo.visibility)}
            </Badge>
            {repo.archived ? <Badge tone="warning">Archived</Badge> : null}
            {repo.fork ? <Badge>Fork</Badge> : null}
          </div>
          <p className={styles.path}>
            {account ? `${account.label} · ` : ''}
            {repo.fullName}
          </p>
        </div>
        <div className={styles.buttons}>
          {compact ? (
            <IconButton label="Open on web" icon="external" onClick={onOpenWeb} />
          ) : (
            <Button icon="external" onClick={onOpenWeb}>
              Open on web
            </Button>
          )}
          {onClose ? <IconButton label="Close pane" icon="x" onClick={onClose} /> : null}
        </div>
      </div>
      {repo.description ? <p className={styles.description}>{repo.description}</p> : null}
    </header>
  )
}
