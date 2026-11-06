import { useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { Account, Repo } from '@shared/types'
import { errorMessage } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { isLocalRepo } from '../../lib/localRepos'
import { isNarrow } from '../../lib/splitLayout'
import type { TabName } from '../../lib/splitState'
import { useLocalInfo, useRepoSummary } from '../../state/repoData'
import { useElementSize } from '../../state/useElementSize'
import { useLocalActions } from '../../state/useLocalActions'
import { useNow } from '../../state/useNow'
import { ErrorBanner, Icon, IconButton, Island, Spinner, Tabs, panelId, tabId } from '../ui'
import { GitGraph } from '../graph/GitGraph'
import { ChangesTab } from './ChangesTab'
import { InfoTab } from './InfoTab'
import { LocalActions } from './LocalActions'
import { OverviewTab } from './OverviewTab'
import { RepoHeader } from './RepoHeader'

const TABS: { id: TabName; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'graph', label: 'Graph' },
  { id: 'changes', label: 'Changes' },
  { id: 'info', label: 'Info' }
]
/** A local repository has no host summary, so no Overview. */
const LOCAL_TABS = TABS.filter((t) => t.id !== 'overview')

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
  tab: savedTab,
  onTabChange,
  onActivate,
  onLinksChanged,
  paneNumber,
  split,
  onClose,
  className
}: RepoPaneProps) {
  const isLocal = isLocalRepo(repo)
  // A saved "overview" tab means nothing here: start on the graph.
  const tab = isLocal && savedTab === 'overview' ? 'graph' : savedTab
  const idPrefix = useId()
  const now = useNow()
  const { ref, width } = useElementSize<HTMLElement>()
  const narrow = isNarrow(width)
  // A swap moves this pane in the DOM, and the browser then resets the panel's scroll.
  const panel = useRef<HTMLDivElement>(null)
  const panelTop = useRef(0)
  useLayoutEffect(() => {
    if (panel.current) panel.current.scrollTop = panelTop.current
  }, [paneNumber])
  // The graph mounts on the first visit and then stays, so its scroll position, loaded
  // pages and selected commit survive a trip to another tab.
  const [graphSeen, setGraphSeen] = useState(tab === 'graph')
  if (tab === 'graph' && !graphSeen) setGraphSeen(true)
  // Same for Changes: the commit message being written survives a trip to another tab.
  const [changesSeen, setChangesSeen] = useState(tab === 'changes')
  if (tab === 'changes' && !changesSeen) setChangesSeen(true)
  const [webError, setWebError] = useState<string | null>(null)

  const { summary, fetchedAt, loading, error, reload } = useRepoSummary(isLocal ? null : repo.key)
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
      className={cn('flex-1', className)}
      data-active={active}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      <div className="flex flex-col gap-3 px-6 pt-4">
        <RepoHeader
          repo={repo}
          account={account}
          local={isLocal}
          compact={narrow}
          onOpenWeb={() => void openWeb()}
          onClose={split ? onClose : undefined}
        />
        <LocalActions repo={repo} linkedPath={linkedPath} actions={actions} compact={narrow} />
        {problem ? (
          <p
            className="m-0 flex items-start gap-2 rounded-md bg-[var(--warning-bg)] px-3 py-2 text-[var(--warning-text)] [overflow-wrap:anywhere] [&_svg]:mt-0.5 [&_svg]:flex-none"
            role="alert"
          >
            <Icon name="alert" size="sm" />
            {problem}
          </p>
        ) : null}
      </div>

      <div className="mx-6 mt-3">
        <Tabs
          tabs={isLocal ? LOCAL_TABS : TABS}
          value={tab}
          onChange={(id) => onTabChange(id as TabName)}
          label="Repository"
          idPrefix={idPrefix}
          trailing={
            isLocal ? undefined : (
              <div className="flex items-center gap-1.5 pb-1">
                {loading ? <Spinner label="Refreshing the summary" /> : null}
                <span
                  className="text-[12px] whitespace-nowrap text-muted-foreground"
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
            )
          }
        />
      </div>

      <div
        ref={panel}
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-6 pt-4 pb-6',
          // The graph scrolls inside itself, so the panel does not.
          tab === 'graph' && 'overflow-hidden'
        )}
        onScroll={(e) => {
          if (e.currentTarget.clientHeight > 0) panelTop.current = e.currentTarget.scrollTop
        }}
        role="tabpanel"
        id={panelId(idPrefix, tab)}
        aria-labelledby={tabId(idPrefix, tab)}
        tabIndex={0}
        data-tab={tab}
      >
        {error && tab !== 'graph' ? (
          <ErrorBanner onRetry={reload} retrying={loading} className="mb-3">
            {summary ? 'Could not refresh the summary: ' : 'Could not load the summary: '}
            {error}
          </ErrorBanner>
        ) : null}
        {graphSeen ? (
          <div className="flex min-h-0 flex-1 [&[hidden]]:hidden" hidden={tab !== 'graph'}>
            <GitGraph
              path={linkedPath ?? null}
              defaultBranch={repo.defaultBranch}
              visible={tab === 'graph'}
              reloadToken={actions.reloadToken}
              fetching={actions.busy === 'fetch'}
              onFetch={actions.fetch}
              narrow={narrow}
              place={paneNumber}
            />
          </div>
        ) : null}
        {changesSeen ? (
          <div className="flex min-w-0 flex-col [&[hidden]]:hidden" hidden={tab !== 'changes'}>
            <ChangesTab
              path={linkedPath ?? null}
              reloadToken={actions.reloadToken}
              onChanged={actions.refresh}
              visible={tab === 'changes'}
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
