import { useMemo, useState } from 'react'
import type { Account, Repo } from '@shared/types'
import { Avatar } from './Avatar'
import { ProviderIcon } from './BrandIcons'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export interface AccountState {
  repos: Repo[]
  loading: boolean
  error: string | null
}

interface Props {
  accounts: Account[]
  states: Record<string, AccountState>
  links: Record<string, string>
  selected: string | null
  search: string
  searchRef: React.RefObject<HTMLInputElement | null>
  onSearch: (q: string) => void
  onSelect: (repoKey: string) => void
  onDashboard: () => void
  onManageAccounts: () => void
  onRetry: (accountId: string) => void
}

interface Group {
  namespace: string
  repos: Repo[]
}

function groupByNamespace(repos: Repo[], username: string): Group[] {
  const map = new Map<string, Repo[]>()
  for (const r of repos) map.set(r.namespace, [...(map.get(r.namespace) ?? []), r])
  const own = username.toLowerCase()
  return [...map.entries()]
    .map(([namespace, rs]) => ({ namespace, repos: rs.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => {
      const ao = a.namespace.toLowerCase() === own
      const bo = b.namespace.toLowerCase() === own
      return ao === bo ? a.namespace.localeCompare(b.namespace) : ao ? -1 : 1
    })
}

export function Sidebar(p: Props): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const q = p.search.trim().toLowerCase()
  const searching = q !== ''

  const toggle = (key: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const visible = useMemo(
    () =>
      p.accounts.map((a) => {
        const all = p.states[a.id]?.repos ?? []
        const repos = searching
          ? all.filter((r) => [r.name, r.fullName, r.description].some((f) => f.toLowerCase().includes(q)))
          : all
        return { account: a, total: all.length, groups: groupByNamespace(repos, a.username) }
      }),
    [p.accounts, p.states, q, searching]
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="search">
          <Icon name="search" size={14} />
          <input
            ref={p.searchRef}
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Search repositories  ⌘K"
            spellCheck={false}
          />
        </div>
        <Button variant="ghost" size="icon" onClick={p.onManageAccounts} aria-label="Accounts" title="Accounts">
          <Icon name="settings" />
        </Button>
      </div>

      <div className="tree">
        <div className={`row dash-link${p.selected === null ? ' selected' : ''}`} onClick={p.onDashboard}>
          <Icon name="home" size={14} />
          <span>Dashboard</span>
        </div>

        {p.accounts.length === 0 && (
          <div className="empty">
            <p>No accounts connected yet.</p>
            <Button onClick={p.onManageAccounts}>
              <Icon name="plus" /> Connect GitHub / GitLab
            </Button>
          </div>
        )}

        {visible.map(({ account, total, groups }) => {
          const st = p.states[account.id]
          const open = searching || !collapsed.has(account.id)
          return (
            <section key={account.id}>
              <div className="row host" onClick={() => toggle(account.id)}>
                <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
                <ProviderIcon type={account.type} size={15} />
                <span className="host-label">{account.label}</span>
                <span className="count">{total}</span>
                {st?.loading && <span className="spinner" title="Loading…" />}
                {st?.error && (
                  <Button variant="ghost" size="icon" className="size-6 text-destructive hover:text-destructive"
 
 title={`${st.error} (click to retry)`}
 aria-label="Retry loading repositories"
 onClick={(e) => {
                      e.stopPropagation()
                      p.onRetry(account.id)
                    }}
                  >
                    <Icon name="alert" size={14} />
                  </Button>
                )}
              </div>
              {open && total === 0 && st?.loading && (
                <div className="sk-rows">
                  <Skeleton className="sk-line" />
                  <Skeleton className="sk-line" />
                  <Skeleton className="sk-line" />
                </div>
              )}
              {open &&
                groups.map((g) => {
                  const gKey = `${account.id}/${g.namespace}`
                  const gOpen = searching || !collapsed.has(gKey)
                  return (
                    <div key={gKey}>
                      <div className="row ns" onClick={() => toggle(gKey)}>
                        <Icon name={gOpen ? 'chevronDown' : 'chevronRight'} size={12} />
                        <Avatar name={g.namespace} size={16} />
                        <span className="ellipsis">{g.namespace}</span>
                        <span className="count">{g.repos.length}</span>
                      </div>
                      {gOpen &&
                        g.repos.map((r) => (
                          <div
                            key={r.key}
                            className={`row repo${r.key === p.selected ? ' selected' : ''}`}
                            onClick={() => p.onSelect(r.key)}
                            title={r.description || r.fullName}
                          >
                            <span className="ellipsis">{r.name}</span>
                            {r.visibility !== 'public' && <Icon name="lock" size={12} />}
                            {r.archived && <Badge>archived</Badge>}
                            {r.fork && <Badge>fork</Badge>}
                            {p.links[r.key] && <span className="dot" title="Linked to a local clone" />}
                          </div>
                        ))}
                    </div>
                  )
                })}
              {open && searching && groups.length === 0 && <div className="row muted">No matches</div>}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
