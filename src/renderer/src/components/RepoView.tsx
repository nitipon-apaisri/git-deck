import { useState } from 'react'
import type { Account, Repo } from '@shared/types'
import { useSummary } from '../hooks/useSummary'
import { timeAgo } from '../lib/format'
import { Icon } from './Icon'
import { GitGraph } from './GitGraph'
import { Info } from './Info'
import { Overview } from './Overview'
import { RepoHeader } from './RepoHeader'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

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

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="tabs-bar">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>
        <span className="spacer" />
        <span className="muted updated">
          {loading ? 'Updating…' : summary ? `Updated ${timeAgo(summary.fetchedAt)}` : ''}
        </span>
        <Button variant="ghost" size="icon" onClick={reload} disabled={loading} aria-label="Reload summary" title="Reload summary">
          <Icon name="refresh" />
        </Button>
      </Tabs>

      {error && (
        <div className="banner banner-error inline-banner">
          <Icon name="alert" /> <span>{error}</span>
          <Button variant="outline" onClick={reload}>Retry</Button>
        </div>
      )}

      <div className="tab-body">
        {tab === 'overview' && !summary && loading ? (
          <Skeleton className="sk-block" />
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
