import { useId, useState } from 'react'
import type { Account, Repo } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { useLocalInfo, useRepoSummary } from '../../state/repoData'
import { useLocalActions } from '../../state/useLocalActions'
import { useNow } from '../../state/useNow'
import { Icon, IconButton, Island, Spinner, Tabs, panelId, tabId } from '../ui'
import { GitGraph } from '../graph/GitGraph'
import { InfoTab } from './InfoTab'
import { LocalActions } from './LocalActions'
import { OverviewTab } from './OverviewTab'
import { RepoHeader } from './RepoHeader'
import styles from './RepoPane.module.css'

type TabName = 'overview' | 'graph' | 'info'

const TABS: { id: TabName; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'graph', label: 'Graph' },
  { id: 'info', label: 'Info' }
]

interface RepoPaneProps {
  repo: Repo
  /** The account the repository belongs to, `null` if it was just removed. */
  account: Account | null
  /** Local folder this repository is linked to, if any. */
  linkedPath: string | undefined
  /** This pane has the focus in Split View. Phase 8 styles it. */
  active: boolean
  onActivate: () => void
  /** Called after a clone, link or unlink, so the workspace re-reads the links. */
  onLinksChanged: () => void
  className?: string
}

/**
 * One repository: header, local actions and tabs. It owns everything it shows: the
 * tab, the summary, clone and fetch state. Nothing is global, so two of these can
 * sit side by side in Split View.
 */
export function RepoPane({
  repo,
  account,
  linkedPath,
  active,
  onActivate,
  onLinksChanged,
  className
}: RepoPaneProps) {
  const idPrefix = useId()
  const now = useNow()
  const [tab, setTab] = useState<TabName>('overview')
  // The graph mounts on the first visit and then stays, so its scroll position, loaded
  // pages and selected commit survive a trip to another tab.
  const [graphSeen, setGraphSeen] = useState(false)
  const [webError, setWebError] = useState<string | null>(null)

  const { summary, fetchedAt, loading, error, reload } = useRepoSummary(repo.key)
  const actions = useLocalActions(repo.key, linkedPath, onLinksChanged)
  // Only read the folder while the Info tab is showing it.
  const local = useLocalInfo(tab === 'info' ? (linkedPath ?? null) : null, actions.reloadToken)

  async function openWeb(): Promise<void> {
    setWebError(null)
    try {
      await window.api.openExternal(repo.webUrl)
    } catch (err) {
      setWebError(errorMessage(err))
    }
  }

  const problem = actions.error ?? webError
  const status = error
    ? summary
      ? 'Showing saved data'
      : 'Could not load'
    : fetchedAt
      ? `Updated ${timeAgo(fetchedAt, now)}`
      : loading
        ? 'Loading…'
        : ''

  return (
    <Island
      as="section"
      aria-label={repo.fullName}
      className={[styles.pane, className ?? ''].filter(Boolean).join(' ')}
      data-active={active}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      <div className={styles.top}>
        <RepoHeader repo={repo} account={account} onOpenWeb={() => void openWeb()} />
        <LocalActions repo={repo} linkedPath={linkedPath} actions={actions} />
        {problem ? (
          <p className={styles.notice} role="alert">
            <Icon name="alert" size="sm" />
            {problem}
          </p>
        ) : null}
      </div>

      <div className={styles.tabs}>
        <Tabs
          tabs={TABS}
          value={tab}
          onChange={(id) => {
            setTab(id as TabName)
            if (id === 'graph') setGraphSeen(true)
          }}
          label="Repository"
          idPrefix={idPrefix}
          trailing={
            <div className={styles.status}>
              {loading ? <Spinner label="Refreshing the summary" /> : null}
              <span
                className={styles.statusText}
                title={fetchedAt ? new Date(fetchedAt).toLocaleString() : undefined}
              >
                {status}
              </span>
              <IconButton
                label="Reload summary"
                icon="refresh"
                disabled={loading}
                onClick={reload}
              />
            </div>
          }
        />
      </div>

      <div
        className={styles.panel}
        role="tabpanel"
        id={panelId(idPrefix, tab)}
        aria-labelledby={tabId(idPrefix, tab)}
        tabIndex={0}
        data-tab={tab}
      >
        {error && tab !== 'graph' ? (
          <p className={styles.notice} role="alert">
            <Icon name="alert" size="sm" />
            {summary ? 'Could not refresh the summary: ' : 'Could not load the summary: '}
            {error}
          </p>
        ) : null}
        {graphSeen ? (
          <div className={styles.graphWrap} hidden={tab !== 'graph'}>
            <GitGraph
              path={linkedPath ?? null}
              defaultBranch={repo.defaultBranch}
              visible={tab === 'graph'}
              reloadToken={actions.reloadToken}
              fetching={actions.busy === 'fetch'}
              onFetch={actions.fetch}
            />
          </div>
        ) : null}
        {tab === 'overview' ? (
          <OverviewTab
            repo={repo}
            accountType={account?.type ?? 'github'}
            summary={summary}
            loading={loading}
          />
        ) : tab === 'info' ? (
          <InfoTab
            repo={repo}
            account={account}
            summary={summary}
            linkedPath={linkedPath}
            local={local}
          />
        ) : null}
      </div>
    </Island>
  )
}
