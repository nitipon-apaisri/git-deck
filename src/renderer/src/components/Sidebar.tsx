import { useMemo, useState } from 'react'
import type { Account } from '@shared/types'
import { timeAgo } from '../lib/format'
import { hostTileOf } from '../lib/presets'
import { buildTree, flattenTree, type AccountNode, type TreeRow as Row } from '../lib/sidebarTree'
import type { AccountRepos } from '../lib/workspaceReducer'
import { readStored, writeStored } from '../state/storage'
import { useNow } from '../state/useNow'
import { Button, HostTile, Icon, IconButton, Island, Spinner, TreeRow } from './ui'
import styles from './Sidebar.module.css'

const COLLAPSED_KEY = 'gitdeck.collapsed'

function readCollapsed(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(readStored(COLLAPSED_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

interface SidebarProps {
  accounts: Account[]
  byAccount: Record<string, AccountRepos>
  /** repo key -> local folder */
  links: Record<string, string>
  selectedKey: string | null
  /** repo key -> the pane (1 or 2) that shows it. Empty when split view is off. */
  paneMarks: Record<string, 1 | 2>
  onSelect: (repoKey: string) => void
  onOpenInSplit: (repoKey: string) => void
  onConnect: () => void
  onRefresh: (accountId: string) => void
  onRefreshAll: () => void
}

export function Sidebar({
  accounts,
  byAccount,
  links,
  selectedKey,
  paneMarks,
  onSelect,
  onOpenInSplit,
  onConnect,
  onRefresh,
  onRefreshAll
}: SidebarProps) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed)
  const now = useNow()
  const searching = query.trim() !== ''

  const nodes = useMemo(() => {
    const repos = Object.fromEntries(Object.entries(byAccount).map(([id, a]) => [id, a.repos]))
    return buildTree(accounts, repos, query)
  }, [accounts, byAccount, query])
  const rows = useMemo(
    () => flattenTree(nodes, collapsed, searching),
    [nodes, collapsed, searching]
  )

  function toggle(key: string): void {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      writeStored(COLLAPSED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const anyLoading = Object.values(byAccount).some((a) => a.loading)
  const lastFetched = Object.values(byAccount).reduce<number | null>(
    (latest, a) =>
      a.fetchedAt !== null && (latest === null || a.fetchedAt > latest) ? a.fetchedAt : latest,
    null
  )

  return (
    <Island as="aside" aria-label="Repositories" className={styles.sidebar}>
      {accounts.length === 0 ? (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>No accounts yet</h2>
          <p className={styles.emptyText}>
            Connect GitHub or GitLab to see your repositories here.
          </p>
          <Button variant="primary" icon="plus" onClick={onConnect}>
            Connect GitHub / GitLab
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.search}>
            <label className={styles.searchBox}>
              <Icon name="search" size="sm" />
              <input
                type="search"
                className={styles.searchInput}
                aria-label="Filter repositories"
                placeholder="Filter repositories"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <nav className={styles.list} aria-label="Accounts and repositories">
            {rows.map((row) => (
              <SidebarRow
                key={row.key}
                row={row}
                searching={searching}
                byAccount={byAccount}
                links={links}
                selectedKey={selectedKey}
                paneMarks={paneMarks}
                onSelect={onSelect}
                onOpenInSplit={onOpenInSplit}
                onToggle={toggle}
                onRefresh={onRefresh}
              />
            ))}
            {searching && nodes.length === 0 ? (
              <p className={styles.noMatch}>No repositories match “{query.trim()}”.</p>
            ) : null}
          </nav>
        </>
      )}
      <div className={styles.footer}>
        <Button variant="ghost" icon="plus" onClick={onConnect}>
          Connect account
        </Button>
        <span
          className={styles.updated}
          title={lastFetched !== null ? `Updated ${timeAgo(lastFetched, now)}` : undefined}
        >
          {anyLoading ? 'Updating…' : lastFetched !== null ? timeAgo(lastFetched, now) : ''}
        </span>
        {accounts.length > 0 ? (
          <IconButton label="Refresh all" icon="refresh" onClick={onRefreshAll} />
        ) : null}
      </div>
    </Island>
  )
}

interface SidebarRowProps {
  row: Row
  searching: boolean
  byAccount: Record<string, AccountRepos>
  links: Record<string, string>
  selectedKey: string | null
  paneMarks: Record<string, 1 | 2>
  onSelect: (repoKey: string) => void
  onOpenInSplit: (repoKey: string) => void
  onToggle: (key: string) => void
  onRefresh: (accountId: string) => void
}

function SidebarRow({
  row,
  searching,
  byAccount,
  links,
  selectedKey,
  paneMarks,
  onSelect,
  onOpenInSplit,
  onToggle,
  onRefresh
}: SidebarRowProps) {
  if (row.kind === 'host') {
    const { account } = row.node
    return (
      <HostRow
        node={row.node}
        expanded={row.expanded}
        searching={searching}
        state={byAccount[account.id]}
        onToggle={() => onToggle(row.key)}
        onRefresh={() => onRefresh(account.id)}
      />
    )
  }
  if (row.kind === 'namespace') {
    return (
      <TreeRow
        level="namespace"
        expanded={row.expanded}
        onClick={() => onToggle(row.key)}
        leading={<Icon name={row.expanded ? 'chevron-down' : 'chevron-right'} size="sm" />}
      >
        {row.node.name}
      </TreeRow>
    )
  }
  const { repo } = row
  const mark = paneMarks[repo.key]
  return (
    <TreeRow
      level="repo"
      selected={repo.key === selectedKey}
      onClick={() => onSelect(repo.key)}
      title={repo.fullName}
      leading={<Icon name="repo" size="sm" />}
      action={
        <IconButton
          label={`Open ${repo.name} in split view`}
          icon="columns"
          className={styles.rowAction}
          onClick={() => onOpenInSplit(repo.key)}
        />
      }
      trailing={
        <>
          {mark ? (
            <span
              className={styles.paneMark}
              role="img"
              aria-label={`Shown in pane ${mark}`}
              title={`Shown in pane ${mark}`}
            >
              {mark}
            </span>
          ) : null}
          {repo.archived ? <span className={styles.pill}>archived</span> : null}
          {repo.fork ? <span className={styles.pill}>fork</span> : null}
          {repo.visibility === 'private' ? <Icon name="lock" size="sm" label="Private" /> : null}
          {links[repo.key] ? (
            <span
              className={styles.linked}
              role="img"
              aria-label="Cloned locally"
              title="Cloned locally"
            />
          ) : null}
        </>
      }
    >
      {repo.name}
    </TreeRow>
  )
}

interface HostRowProps {
  node: AccountNode
  expanded: boolean
  searching: boolean
  state: AccountRepos | undefined
  onToggle: () => void
  onRefresh: () => void
}

function HostRow({ node, expanded, searching, state, onToggle, onRefresh }: HostRowProps) {
  const { account } = node
  const { tile, host } = hostTileOf(account.type, account.baseUrl)
  const known = state !== undefined && (state.fetchedAt !== null || state.repos.length > 0)
  const count = searching ? node.matched : node.total
  return (
    <TreeRow
      level="host"
      expanded={expanded}
      onClick={onToggle}
      leading={
        <>
          <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size="sm" />
          <HostTile tile={tile} host={host} />
        </>
      }
      trailing={
        <>
          {state?.loading ? <Spinner label={`Loading ${account.label}`} /> : null}
          {state?.error ? (
            <IconButton
              label={`Could not load repositories: ${state.error} Retry`}
              icon="alert"
              className={styles.errorButton}
              onClick={onRefresh}
            />
          ) : null}
          {known ? <span>{count}</span> : null}
        </>
      }
    >
      {account.label} <span className={styles.sub}>{account.host}</span>
    </TreeRow>
  )
}
