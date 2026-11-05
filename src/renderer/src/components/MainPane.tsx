import type { Account, Repo } from '@shared/types'
import { RepoPane } from './repo/RepoPane'
import { Island, Spinner } from './ui'
import styles from './MainPane.module.css'

interface MainPaneProps {
  hasAccounts: boolean
  repo: Repo | null
  account: Account | null
  /** A repository is selected but the lists have not loaded it yet. */
  waiting: boolean
  linkedPath: string | undefined
  onLinksChanged: () => void
}

const noop = (): void => undefined

/** The single-repository view. Phase 8 swaps this for the split layout. */
export function MainPane({
  hasAccounts,
  repo,
  account,
  waiting,
  linkedPath,
  onLinksChanged
}: MainPaneProps) {
  return (
    <main className={styles.main} aria-label="Repository">
      {repo ? (
        // Keyed so that switching repository starts with fresh pane state.
        <RepoPane
          key={repo.key}
          repo={repo}
          account={account}
          linkedPath={linkedPath}
          active
          onActivate={noop}
          onLinksChanged={onLinksChanged}
        />
      ) : (
        <Island className={styles.empty}>
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
        </Island>
      )}
    </main>
  )
}
