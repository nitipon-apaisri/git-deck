import type { Account, Repo } from '@shared/types'
import { visibilityLabel } from '../../lib/repoView'
import { Badge, Button, Icon } from '../ui'
import styles from './RepoHeader.module.css'

interface RepoHeaderProps {
  repo: Repo
  account: Account | null
  onOpenWeb: () => void
}

export function RepoHeader({ repo, account, onOpenWeb }: RepoHeaderProps) {
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
        <Button icon="external" onClick={onOpenWeb}>
          Open on web
        </Button>
      </div>
      {repo.description ? <p className={styles.description}>{repo.description}</p> : null}
    </header>
  )
}
