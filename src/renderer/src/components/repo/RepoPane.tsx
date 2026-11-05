import { useId, useState } from 'react'
import type { Account, Repo } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { isNarrow } from '../../lib/splitLayout'
import type { TabName } from '../../lib/splitState'
import { useLocalInfo, useRepoSummary } from '../../state/repoData'
import { useElementSize } from '../../state/useElementSize'
import { useLocalActions } from '../../state/useLocalActions'
import { useNow } from '../../state/useNow'
import { Icon, IconButton, Island, Spinner, Tabs, panelId, tabId } from '../ui'
import { GitGraph } from '../graph/GitGraph'
import { InfoTab } from './InfoTab'
import { LocalActions } from './LocalActions'
import { OverviewTab } from './OverviewTab'
import { RepoHeader } from './RepoHeader'
import styles from './RepoPane.module.css'

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
  /** This pane has the focus in Split View. */
  active: boolean
  /** The open tab. Split View keeps it, so it survives a restart. */
  tab: TabName
  onTabChange: (tab: TabName) => void
  onActivate: () => void
  /** Called after a clone, link or unlink, so the workspace re-reads the links. */
  onLinksChanged: () => void
  /** 1 or 2: which pane this is. */
  paneNumber: 1 | 2
  /** Split View is on, so the pane says which one it is and can be closed. */
  split: boolean
  /** The close button's action (Split View only). */
  onClose?: () => void
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
  tab,
  onTabChange,
  onActivate,
  onLinksChanged,
  paneNumber,
  split,
  onClose,
  className
}: RepoPaneProps) {
  const idPrefix = useId()
  const now = useNow()
  const { ref, width } = useElementSize<HTMLElement>()
  const narrow = isNarrow(width)
  // The graph mounts on the first visit and then stays, so its scroll position, loaded
  // pages and selected commit survive a trip to another tab.
  const [graphSeen, setGraphSeen] = useState(tab === 'graph')
  if (tab === 'graph' && !graphSeen) setGraphSeen(true)
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
      ref={ref}
      aria-label={split ? `Pane ${paneNumber}: ${repo.fullName}` : repo.fullName}
      tabIndex={-1}
      data-pane={paneNumber - 1}
      data-narrow={narrow ? 'true' : undefined}
      className={[styles.pane, className ?? ''].filter(Boolean).join(' ')}
      data-active={active}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      <div className={styles.top}>
        <RepoHeader
          repo={repo}
          account={account}
          compact={narrow}
          onOpenWeb={() => void openWeb()}
          onClose={split ? onClose : undefined}
        />
        <LocalActions repo={repo} linkedPath={linkedPath} actions={actions} compact={narrow} />
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
          onChange={(id) => onTabChange(id as TabName)}
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
              narrow={narrow}
            />
          </div>
        ) : null}
        {tab === 'overview' ? (
          <OverviewTab
            repo={repo}
            accountType={account?.type ?? 'github'}
            summary={summary}
            loading={loading}
            narrow={narrow}
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
