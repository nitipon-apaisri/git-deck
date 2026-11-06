import { useMemo, useState } from 'react'
import type { Account, Project, Repo } from '@shared/types'
import { timeAgo } from '../lib/format'
import { hostTileOf } from '../lib/presets'
import { LOCAL_ACCOUNT_ID, LOCAL_GROUP, isLocalRepo } from '../lib/localRepos'
import { remoteIdOf } from '../lib/projectForm'
import type { ProjectView } from '../lib/projectScope'
import { buildTree, flattenTree, type AccountNode, type TreeRow as Row } from '../lib/sidebarTree'
import type { AccountRepos } from '../lib/workspaceReducer'
import { readStored, writeStored } from '../state/storage'
import { useNow } from '../state/useNow'
import { BrandLogo } from './ui/BrandLogo'
import { RepoProjectMenu } from './projects/RepoProjectMenu'
import { ScopeSwitcher } from './projects/ScopeSwitcher'
import {
  Button,
  ErrorBanner,
  HostTile,
  Icon,
  IconButton,
  Island,
  Skeleton,
  Spinner,
  TreeRow
} from './ui'

const COLLAPSED_KEY = 'gitdeck.collapsed'

function readCollapsed(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(readStored(COLLAPSED_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Everything the sidebar needs to know about projects. */
export interface SidebarProjects {
  projects: Project[]
  /** The active project, or `null` for "All repositories". */
  scope: Project | null
  /** The project's repositories and unavailable keys. `null` without a project scope. */
  view: ProjectView | null
  overviewActive: boolean
  /** The last project change that failed, in words. */
  error: string | null
  onDismissError: () => void
  /** The project list could not be read from main. */
  loadError: string | null
  onRetryLoad: () => void
  /** `null` picks "All repositories". */
  onScope: (projectId: string | null) => void
  onNewProject: (repoKeys?: string[]) => void
  onManage: () => void
  /** Opens the project's form, where repositories are added. */
  onEditScope: () => void
  onOverview: () => void
  onToggleMember: (projectId: string, repoKey: string, member: boolean) => void
  onRemoveUnavailable: (repoKey: string) => void
}

interface SidebarProps {
  /** The first load of accounts and links is still running. */
  loading: boolean
  /** That first load failed. */
  loadError: string | null
  onRetryLoad: () => void
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
  /** Folder picker: opens a local repository. */
  onOpenLocal: () => void
  onRemoveLocal: (repoKey: string) => void
  onRefresh: (accountId: string) => void
  onRefreshAll: () => void
  projects: SidebarProjects
}

export function Sidebar({
  loading,
  loadError,
  onRetryLoad,
  accounts,
  byAccount,
  links,
  selectedKey,
  paneMarks,
  onSelect,
  onOpenInSplit,
  onConnect,
  onOpenLocal,
  onRemoveLocal,
  onRefresh,
  onRefreshAll,
  projects: proj
}: SidebarProps) {
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ repo: Repo; x: number; y: number } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed)
  const now = useNow()
  const searching = query.trim() !== ''

  const { scope, view } = proj
  const nodes = useMemo(() => {
    const repos = view
      ? view.reposByAccount
      : Object.fromEntries(Object.entries(byAccount).map(([id, a]) => [id, a.repos]))
    // Local repositories lead the list. They are not part of any project.
    const withLocal =
      !view && (repos[LOCAL_ACCOUNT_ID]?.length ?? 0) > 0 ? [LOCAL_GROUP, ...accounts] : accounts
    const tree = buildTree(withLocal, repos, query)
    // In a project, a host with none of its repositories would be an empty heading.
    return view ? tree.filter((node) => node.total > 0) : tree
  }, [accounts, byAccount, query, view])
  // Keys the lists cannot show. A search only keeps the ones whose id matches.
  const unavailable = (view?.unavailable ?? []).filter(
    (key) => !searching || key.toLowerCase().includes(query.trim().toLowerCase())
  )
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

  const hosted = Object.entries(byAccount)
    .filter(([id]) => id !== LOCAL_ACCOUNT_ID)
    .map(([, a]) => a)
  const hasLocal = (byAccount[LOCAL_ACCOUNT_ID]?.repos.length ?? 0) > 0
  const anyLoading = hosted.some((a) => a.loading)
  const lastFetched = hosted.reduce<number | null>(
    (latest, a) =>
      a.fetchedAt !== null && (latest === null || a.fetchedAt > latest) ? a.fetchedAt : latest,
    null
  )

  const isEmpty = accounts.length === 0 && !hasLocal && !scope

  return (
    <Island as="aside" aria-label="Repositories" className="w-[var(--sidebar-width)] flex-none">
      {loading ? (
        <SidebarSkeleton />
      ) : loadError ? (
        <div className="p-3">
          <ErrorBanner onRetry={onRetryLoad}>Could not load your accounts: {loadError}</ErrorBanner>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-1 flex-col items-stretch gap-2 p-4">
          <h2 className="m-0 text-[15px] leading-[22px] font-semibold">No repositories</h2>
          <p className="m-0 mb-2 text-muted-foreground">
            Open a local repository, or add an account in Settings.
          </p>
          <Button
            variant="primary"
            icon="folder"
            className="w-full justify-center"
            onClick={onOpenLocal}
          >
            Open a repository
          </Button>
          <Button className="w-full justify-center" onClick={onConnect}>
            Connect to
            <BrandLogo brand="gitlab" />
            GitLab
            <span aria-hidden="true">/</span>
            <BrandLogo brand="github" />
            GitHub
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 px-2.5 pt-2.5 pb-2">
            <ScopeSwitcher
              projects={proj.projects}
              scope={scope}
              onSelect={proj.onScope}
              onNew={() => proj.onNewProject()}
              onManage={proj.onManage}
            />
            <label className="flex h-8 items-center gap-2 rounded-md border border-[var(--border-strong)] px-2.5 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus-ring)]">
              <Icon name="search" size="sm" />
              <input
                type="search"
                className="min-w-0 flex-1 border-0 bg-transparent text-foreground outline-0 placeholder:text-muted-foreground"
                data-search-input
                onKeyDown={(e) => {
                  // Escape clears the filter, and a second one leaves the field.
                  if (e.key !== 'Escape') return
                  if (query !== '') setQuery('')
                  else e.currentTarget.blur()
                }}
                aria-label={scope ? 'Filter repositories in this project' : 'Filter repositories'}
                placeholder={scope ? 'Filter in project' : 'Filter repositories'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {proj.loadError ? (
              <ErrorBanner onRetry={proj.onRetryLoad}>
                Could not load your projects: {proj.loadError}
              </ErrorBanner>
            ) : null}
            {proj.error ? (
              <ErrorBanner onDismiss={proj.onDismissError}>{proj.error}</ErrorBanner>
            ) : null}
            {scope ? (
              <button
                type="button"
                className="flex h-[30px] cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 text-left text-foreground transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-accent aria-pressed:bg-[var(--selection)] aria-pressed:font-medium"
                aria-pressed={proj.overviewActive}
                onClick={proj.onOverview}
              >
                <Icon name="layers" size="sm" />
                Project overview
              </button>
            ) : null}
          </div>
          <nav
            className="min-h-0 flex-1 overflow-y-auto pb-2"
            aria-label="Accounts and repositories"
          >
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
                onMenu={(repo, x, y) => setMenu({ repo, x, y })}
                onRemoveLocal={onRemoveLocal}
              />
            ))}
            {unavailable.length > 0 ? (
              <>
                <div className="mt-2.5 flex h-[30px] items-center gap-2 px-3 text-[12px] font-medium text-[var(--warning-text)]">
                  <Icon name="alert" size="sm" />
                  Unavailable ({unavailable.length})
                </div>
                {unavailable.map((key) => (
                  <TreeRow
                    key={key}
                    level="repo"
                    onClick={() => undefined}
                    title="No loaded repository list has this one: access lost or account removed"
                    leading={<Icon name="repo" size="sm" />}
                    trailing={
                      <IconButton
                        label={`Remove ${remoteIdOf(key)} from project`}
                        icon="x"
                        className="size-6"
                        onClick={() => proj.onRemoveUnavailable(key)}
                      />
                    }
                  >
                    <span className="text-muted-foreground">{remoteIdOf(key)}</span>
                  </TreeRow>
                ))}
              </>
            ) : null}
            {scope && !searching && scope.repoKeys.length === 0 ? (
              <p className="m-0 px-4 py-3 text-muted-foreground">
                This project has no repositories yet.
              </p>
            ) : null}
            {searching && nodes.length === 0 && unavailable.length === 0 ? (
              <p className="m-0 px-4 py-3 text-muted-foreground">
                No repositories match “{query.trim()}”{scope ? ' in this project' : ''}.
              </p>
            ) : null}
          </nav>
        </>
      )}
      {isEmpty ? null : (
        <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
          {scope ? (
            <Button variant="ghost" icon="plus" onClick={proj.onEditScope}>
              Add repositories
            </Button>
          ) : (
            <>
              <Button variant="ghost" icon="plus" onClick={onConnect}>
                Connect account
              </Button>
              <Button
                variant="ghost"
                icon="folder"
                aria-label="Open a local repository"
                onClick={onOpenLocal}
              >
                Open
              </Button>
            </>
          )}
          <span
            className="min-w-0 flex-1 truncate text-right text-[12px] text-muted-foreground"
            title={lastFetched !== null ? `Updated ${timeAgo(lastFetched, now)}` : undefined}
          >
            {anyLoading ? 'Updating…' : lastFetched !== null ? timeAgo(lastFetched, now) : ''}
          </span>
          {accounts.length > 0 ? (
            <IconButton label="Refresh all" icon="refresh" onClick={onRefreshAll} />
          ) : null}
        </div>
      )}
      {menu ? (
        <RepoProjectMenu
          repo={menu.repo}
          at={{ x: menu.x, y: menu.y }}
          projects={proj.projects}
          scope={scope}
          onToggle={(projectId, member) => proj.onToggleMember(projectId, menu.repo.key, member)}
          onNewProject={() => proj.onNewProject([menu.repo.key])}
          onClose={() => setMenu(null)}
        />
      ) : null}
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
  onMenu: (repo: Repo, x: number, y: number) => void
  onRemoveLocal: (repoKey: string) => void
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
  onRefresh,
  onMenu,
  onRemoveLocal
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
  const local = isLocalRepo(repo)
  return (
    <TreeRow
      level="repo"
      selected={repo.key === selectedKey}
      onClick={() => onSelect(repo.key)}
      leading={<Icon name={local ? 'folder' : 'repo'} size="sm" />}
      title={local ? repo.description : repo.fullName}
      onContextMenu={(e) => {
        e.preventDefault()
        if (!local) onMenu(repo, e.clientX, e.clientY)
      }}
      action={
        <>
          {local ? (
            <IconButton
              label={`Remove ${repo.name} from the list`}
              icon="x"
              className="size-6"
              onClick={() => onRemoveLocal(repo.key)}
            />
          ) : (
            <IconButton
              label={`Project options for ${repo.name}`}
              icon="more"
              className="size-6"
              aria-haspopup="menu"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                onMenu(repo, rect.left, rect.bottom + 4)
              }}
            />
          )}
          <IconButton
            label={`Open ${repo.name} in split view`}
            icon="columns"
            className="size-6"
            onClick={() => onOpenInSplit(repo.key)}
          />
        </>
      }
      trailing={
        <>
          {mark ? (
            <span
              className="grid size-4 place-items-center rounded-[var(--radius-xs)] bg-primary text-[11px] leading-none font-semibold text-primary-foreground"
              role="img"
              aria-label={`Shown in pane ${mark}`}
              title={`Shown in pane ${mark}`}
            >
              {mark}
            </span>
          ) : null}
          {repo.archived ? (
            <span className="rounded-[var(--radius-xs)] border border-border px-1.5 text-[11px] leading-4 text-muted-foreground">
              archived
            </span>
          ) : null}
          {repo.fork ? (
            <span className="rounded-[var(--radius-xs)] border border-border px-1.5 text-[11px] leading-4 text-muted-foreground">
              fork
            </span>
          ) : null}
          {!local && repo.visibility === 'private' ? (
            <Icon name="lock" size="sm" label="Private" />
          ) : null}
          {!local && links[repo.key] ? (
            <span
              className="size-[7px] rounded-full bg-[var(--success)]"
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
  if (account.id === LOCAL_ACCOUNT_ID) {
    return (
      <TreeRow
        level="host"
        expanded={expanded}
        onClick={onToggle}
        leading={
          <>
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size="sm" />
            <Icon name="folder" size="sm" />
          </>
        }
        trailing={<span>{searching ? node.matched : node.total}</span>}
      >
        {account.label}{' '}
        <span className="text-[12px] font-normal text-muted-foreground">{account.host}</span>
      </TreeRow>
    )
  }
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
              className="size-6 text-[color:var(--warning-text)]"
              onClick={onRefresh}
            />
          ) : null}
          {known ? <span>{count}</span> : null}
        </>
      }
    >
      {account.label}{' '}
      <span className="text-[12px] font-normal text-muted-foreground">{account.host}</span>
    </TreeRow>
  )
}

/** What the list looks like before the accounts have loaded: three hosts, a few repos each. */
function SidebarSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-2.5" aria-busy="true">
      <Skeleton height={36} label="Loading repositories" />
      <Skeleton height={32} />
      {[0, 1, 2].map((host) => (
        <div key={host} className="flex flex-col gap-2.5">
          <Skeleton width="55%" />
          {[0, 1, 2].map((repo) => (
            <Skeleton key={repo} width={`${80 - repo * 12}%`} className="ml-6" />
          ))}
        </div>
      ))}
    </div>
  )
}
