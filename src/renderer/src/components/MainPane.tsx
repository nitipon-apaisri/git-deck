import type { Repo } from '@shared/types'
import { Icon, Island, Spinner } from './ui'
import styles from './MainPane.module.css'

interface MainPaneProps {
  hasAccounts: boolean
  repo: Repo | null
  /** A repository is selected but the lists have not loaded it yet. */
  waiting: boolean
  linkedPath: string | undefined
}

export function MainPane({ hasAccounts, repo, waiting, linkedPath }: MainPaneProps) {
  return (
    <Island as="main" aria-label="Repository" className={styles.main}>
      {repo ? (
        <div className={styles.header}>
          <h1 className={styles.title}>{repo.fullName}</h1>
          <p className={styles.meta}>
            <span className={styles.metaItem}>
              {repo.visibility === 'private' ? <Icon name="lock" size="sm" /> : null}
              {repo.visibility === 'private'
                ? 'Private'
                : repo.visibility === 'internal'
                  ? 'Internal'
                  : 'Public'}
            </span>
            {repo.archived ? <span>Archived</span> : null}
            {repo.fork ? <span>Fork</span> : null}
            {repo.defaultBranch ? (
              <span className={styles.metaItem}>
                <Icon name="git-branch" size="sm" />
                <span className="hash">{repo.defaultBranch}</span>
              </span>
            ) : null}
            <span>{linkedPath ? 'Cloned locally' : 'Not cloned'}</span>
          </p>
          {repo.description ? <p className={styles.description}>{repo.description}</p> : null}
        </div>
      ) : (
        <div className={styles.empty}>
          {waiting ? (
            <>
              <Spinner label="Loading repositories" />
              <p className={styles.emptyText}>Loading repositories</p>
            </>
          ) : hasAccounts ? (
            <>
              <h1 className={styles.emptyTitle}>Select a repository</h1>
              <p className={styles.emptyText}>Choose one from the list on the left.</p>
            </>
          ) : (
            <>
              <h1 className={styles.emptyTitle}>Connect an account</h1>
              <p className={styles.emptyText}>
                Add a GitHub or GitLab account to browse your repositories.
              </p>
            </>
          )}
        </div>
      )}
    </Island>
  )
}
