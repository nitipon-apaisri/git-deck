import { useState } from 'react'
import type { Account, Repo } from '@shared/types'
import { useSummary } from '../hooks/useSummary'
import { timeAgo } from '../lib/format'
import { Icon } from './Icon'
import { GitGraph } from './GitGraph'
import { Info } from './Info'
import { Overview } from './Overview'
import { RepoHeader } from './RepoHeader'

type Tab = 'overview' | 'graph' | 'info'

interface Props {
  repo: Repo
  account: Account
  linkedPath: string | null
  onLinkChange: (repoKey: string, path: string | null) => void
}

export function RepoView({ repo, account, linkedPath, onLinkChange }: Props): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('overview')
  const [reloadToken, setReloadToken] = useState(0)
  const { summary, loading, error, reload } = useSummary(repo.key)

  return (
    <div className="repo-view">
      <RepoHeader repo={repo} linkedPath={linkedPath} onLinkChange={onLinkChange} onFetched={() => setReloadToken((n) => n + 1)} />

      <nav className="tabs">
        {(['overview', 'graph', 'info'] as const).map((t) => (
          <button key={t} className={`tab${tab === t ? ' tab-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Overview' : t === 'graph' ? 'Graph' : 'Info'}
          </button>
        ))}
        <span className="spacer" />
        <span className="muted updated">
          {loading ? 'Updating…' : summary ? `Updated ${timeAgo(summary.fetchedAt)}` : ''}
        </span>
        <button className="icon-btn" onClick={reload} disabled={loading} aria-label="Reload summary" title="Reload summary">
          <Icon name="refresh" />
        </button>
      </nav>

      {error && (
        <div className="banner banner-error inline-banner">
          <Icon name="alert" /> <span>{error}</span>
          <button className="btn" onClick={reload}>Retry</button>
        </div>
      )}

      <div className="tab-body">
        {tab === 'overview' && !summary && loading ? (
          <div className="skeleton sk-block" />
        ) : tab === 'overview' ? (
          <Overview repo={repo} summary={summary?.data ?? null} provider={account.type} />
        ) : tab === 'graph' ? (
          <GitGraph path={linkedPath} reloadToken={reloadToken} onFetched={() => setReloadToken((n) => n + 1)} />
        ) : (
          <Info repo={repo} host={account.host} summary={summary?.data ?? null} linkedPath={linkedPath} reloadToken={reloadToken} />
        )}
      </div>
    </div>
  )
}
