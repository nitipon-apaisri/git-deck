import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Account, LocalStatus, Repo } from '@shared/types'
import { mapLimit } from '@shared/pool'
import { errorMessage } from '../lib/errors'
import { formatCount, timeAgo } from '../lib/format'
import { ProviderIcon } from './BrandIcons'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  accounts: Account[]
  repos: Repo[]
  links: Record<string, string>
  recent: string[]
  onOpen: (repoKey: string) => void
  onManageAccounts: () => void
}

interface Flag {
  text: string
  tone: 'warn' | 'info' | 'error'
}

function flagsFor(s: LocalStatus): Flag[] {
  if (!s.info) return [{ text: s.error ?? 'Unreadable', tone: 'error' }]
  const { dirtyFiles, ahead, behind, detached } = s.info
  const flags: Flag[] = []
  if (dirtyFiles) flags.push({ text: `${dirtyFiles} uncommitted`, tone: 'warn' })
  if (ahead) flags.push({ text: `↑ ${ahead} ahead`, tone: 'info' })
  if (behind) flags.push({ text: `↓ ${behind} behind`, tone: 'info' })
  if (detached) flags.push({ text: 'detached HEAD', tone: 'warn' })
  return flags
}

export function Dashboard({ accounts, repos, links, recent, onOpen, onManageAccounts }: Props): React.JSX.Element {
  const [statuses, setStatuses] = useState<LocalStatus[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const linkCount = Object.keys(links).length

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setStatuses(await window.api.local.statusAll())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-read whenever the set of linked folders changes.
  useEffect(() => {
    void load()
  }, [load, linkCount])

  const fetchAll = async (): Promise<void> => {
    const targets = (statuses ?? []).filter((s) => s.info)
    setFetching(true)
    setNotice(null)
    const failures = (
      await mapLimit(targets, 3, async (s) => {
        try {
          await window.api.local.fetch(s.path)
          return false
        } catch {
          return true
        }
      })
    ).filter(Boolean).length
    setNotice(failures ? `Fetch failed for ${failures} of ${targets.length} repositories.` : null)
    setFetching(false)
    await load()
  }

  const repoByKey = useMemo(() => new Map(repos.map((r) => [r.key, r])), [repos])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const flagged = useMemo(
    () =>
      (statuses ?? [])
        .map((s) => ({ s, flags: flagsFor(s) }))
        .filter((x) => x.flags.length > 0)
        .sort((a, b) => b.flags.length - a.flags.length),
    [statuses]
  )
  const dirtyRepos = (statuses ?? []).filter((s) => s.info?.dirtyFiles).length
  const unsynced = (statuses ?? []).filter((s) => s.info?.ahead || s.info?.behind).length

  const active = useMemo(
    () => [...repos].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 8),
    [repos]
  )
  const recentRepos = recent.map((k) => repoByKey.get(k)).filter((r): r is Repo => r !== undefined)

  if (accounts.length === 0) {
    return (
      <div className="dashboard">
        <div className="dash-empty">
          <h2>Welcome to GitDeck</h2>
          <p className="muted">Connect a GitHub or GitLab account to see all your repositories in one place.</p>
          <Button onClick={onManageAccounts}>
            <Icon name="plus" /> Connect an account
          </Button>
        </div>
      </div>
    )
  }

  const stats: [string, string, string?][] = [
    ['Accounts', formatCount(accounts.length)],
    ['Repositories', formatCount(repos.length), `${formatCount(linkCount)} linked`],
    ['Uncommitted', statuses ? formatCount(dirtyRepos) : '—', 'repositories'],
    ['Out of sync', statuses ? formatCount(unsynced) : '—', 'ahead or behind']
  ]

  const repoRow = (r: Repo, right: string): React.JSX.Element => {
    const account = accountById.get(r.accountId)
    return (
      <li key={r.key}>
        <button type="button" className="dash-row" onClick={() => onOpen(r.key)}>
          {account && <ProviderIcon type={account.type} size={15} />}
          <span className="dash-row-name">{r.name}</span>
          <span className="muted dash-row-ns">{r.namespace}</span>
          <span className="muted dash-row-end">{right}</span>
        </button>
      </li>
    )
  }

  return (
    <div className="dashboard">
      <header className="dash-head">
        <div>
          <h2 className="dash-title">Dashboard</h2>
          <p className="muted">Across {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}</p>
        </div>
        <span className="spacer" />
        {/* <Button variant="outline" onClick={() => void fetchAll()} disabled={fetching || loading || linkCount === 0}>
          <Icon name="refresh" /> {fetching ? 'Fetching…' : 'Fetch all'}
        </Button> */}
        <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading || fetching} aria-label="Refresh status" title="Refresh status">
          <Icon name="refresh" />
        </Button>
      </header>

      <div className="stat-grid">
        {stats.map(([label, value, sub]) => (
          <div className="stat" key={label}>
            <div className="stat-value">{value}</div>
            <div className="muted">{label}</div>
            {sub && <div className="muted stat-sub">{sub}</div>}
          </div>
        ))}
      </div>

      {error && (
        <div className="banner banner-error">
          <Icon name="alert" /> <span>{error}</span>
          <Button variant="outline" onClick={() => void load()}>Retry</Button>
        </div>
      )}
      {notice && (
        <div className="banner banner-warn">
          <Icon name="alert" /> <span>{notice}</span>
        </div>
      )}

      <section>
        <h3>Needs attention</h3>
        {linkCount === 0 ? (
          <p className="muted dash-note">Link a repository to a local clone from its header to track uncommitted work and unpushed commits here.</p>
        ) : statuses === null && loading ? (
          <div className="sk-rows">
            <Skeleton className="sk-line" />
            <Skeleton className="sk-line" />
            <Skeleton className="sk-line" />
          </div>
        ) : flagged.length === 0 ? (
          <p className="dash-note dash-ok">
            <Icon name="check" size={14} /> All {linkCount} linked {linkCount === 1 ? 'repository is' : 'repositories are'} clean and in sync.
          </p>
        ) : (
          <ul className="dash-list">
            {flagged.map(({ s, flags }) => {
              const r = repoByKey.get(s.repoKey)
              const account = r ? accountById.get(r.accountId) : undefined
              return (
                <li key={s.repoKey}>
                  <button type="button" className="dash-row" onClick={() => onOpen(s.repoKey)} disabled={!r}>
                    {account && <ProviderIcon type={account.type} size={15} />}
                    <span className="dash-row-name">{r?.fullName ?? s.repoKey}</span>
                    {s.info?.currentBranch && <span className="muted dash-row-ns">{s.info.currentBranch}</span>}
                    <span className="dash-flags">
                      {flags.map((f) => (
                        <span key={f.text} className={`flag flag-${f.tone}`}>
                          {f.text}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="dash-cols">
        {recentRepos.length > 0 && (
          <section>
            <h3>Recently opened</h3>
            <ul className="dash-list">{recentRepos.map((r) => repoRow(r, links[r.key] ? 'linked' : ''))}</ul>
          </section>
        )}
        {active.length > 0 && (
          <section>
            <h3>Recently active</h3>
            <ul className="dash-list">{active.map((r) => repoRow(r, timeAgo(r.updatedAt)))}</ul>
          </section>
        )}
      </div>
    </div>
  )
}
