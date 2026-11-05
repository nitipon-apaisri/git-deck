import { useMemo, useState } from 'react'
import { aggregateProject } from '@shared/projects'
import type { Account, Project, Repo, RepoSummary } from '@shared/types'
import { timeAgo } from '../../lib/format'
import { hostTileOf } from '../../lib/presets'
import {
  CONTRIBUTORS_NOTE,
  DEFAULT_SORT,
  buildRows,
  countText,
  coverage,
  latestActivity,
  nextSort,
  partialNote,
  progressText,
  sortRows,
  type ProjectRow,
  type SortKey,
  type SortState
} from '../../lib/projectRows'
import { remoteIdOf } from '../../lib/projectForm'
import { useFetchAll } from '../../state/useFetchAll'
import { useNow } from '../../state/useNow'
import type { ProjectSummaries } from '../../state/projectSummaries'
import {
  Badge,
  Button,
  HostTile,
  Icon,
  IconButton,
  ProgressBar,
  ProjectIcon,
  Spinner,
  StatCard
} from '../ui'
import { FetchAllDialog } from './FetchAllDialog'
import styles from './ProjectOverview.module.css'

interface ProjectOverviewProps {
  project: Project
  accounts: Account[]
  /** Every loaded repository by key. */
  repos: ReadonlyMap<string, Repo>
  /** repo key -> local folder */
  links: Record<string, string>
  summaries: ProjectSummaries
  /** Project keys with no repository behind them. */
  unavailable: ReadonlySet<string>
  /** Project keys whose account is still loading its list. */
  pending: ReadonlySet<string>
  onOpen: (repoKey: string) => void
  onOpenInSplit: (repoKey: string) => void
  onEdit: () => void
  onRemoveRepo: (repoKey: string) => void
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Repository' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'commits', label: 'Commits', numeric: true },
  { key: 'contributors', label: 'Contributors', numeric: true },
  { key: 'open', label: 'Open PRs / MRs', numeric: true },
  { key: 'last', label: 'Last activity' },
  { key: 'local', label: 'Local' }
]

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** The project's page: totals, a sortable table of its repositories and bulk actions. */
export function ProjectOverview({
  project,
  accounts,
  repos,
  links,
  summaries,
  unavailable,
  pending,
  onOpen,
  onOpenInSplit,
  onEdit,
  onRemoveRepo
}: ProjectOverviewProps) {
  const now = useNow()
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const fetchAll = useFetchAll()

  const rows = useMemo(
    () => buildRows(project.repoKeys, repos, summaries.entries, links),
    [project.repoKeys, repos, summaries.entries, links]
  )
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort])
  const total = useMemo(() => {
    const data: Record<string, RepoSummary | undefined> = {}
    for (const row of rows) if (row.summary) data[row.key] = row.summary
    return aggregateProject(project.repoKeys, data)
  }, [rows, project.repoKeys])
  const known = useMemo(() => coverage(rows), [rows])
  const latest = useMemo(() => latestActivity(rows), [rows])

  const accountOf = (id: string): Account | undefined => accounts.find((a) => a.id === id)
  const hostCount = new Set(rows.flatMap((r) => (r.repo ? [r.repo.accountId] : []))).size
  const unavailableCount = rows.filter((r) => unavailable.has(r.key)).length
  const targets = rows.flatMap((r) =>
    r.repo && r.linkedPath ? [{ key: r.key, name: r.repo.fullName, path: r.linkedPath }] : []
  )
  const loading = summaries.progress !== null
  const empty = project.repoKeys.length === 0

  const missingOf = (count: number): number => project.repoKeys.length - count
  const note = partialNote(total) ?? undefined
  const noneLoaded = total.loadedCount === 0
  const figure = (value: number): string => (noneLoaded ? '–' : countText(value))

  const subtitle = [
    `${project.repoKeys.length} ${project.repoKeys.length === 1 ? 'repository' : 'repositories'}`,
    hostCount > 0 ? `${hostCount} ${hostCount === 1 ? 'host' : 'hosts'}` : null,
    unavailableCount > 0 ? `${unavailableCount} unavailable` : null
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className={styles.overview} aria-label={`${project.name} overview`}>
      <header className={styles.header}>
        <ProjectIcon icon={project.icon} color={project.color} size="lg" />
        <div className={styles.title}>
          <h1 className={styles.name}>{project.name}</h1>
          <span className={styles.sub}>{subtitle}</span>
        </div>
        <div className={styles.actions}>
          <Button
            icon="refresh"
            disabled={targets.length === 0}
            title={
              targets.length === 0 ? 'No repository in this project is cloned locally' : undefined
            }
            onClick={() => fetchAll.start(targets)}
          >
            Fetch all linked
          </Button>
          <Button icon="refresh" disabled={loading || empty} onClick={summaries.refreshAll}>
            Refresh summaries
          </Button>
          <Button icon="edit" onClick={onEdit}>
            Edit project
          </Button>
        </div>
      </header>

      {empty ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>No repositories in this project yet</h2>
          <p className={styles.emptyText}>
            Add repositories from any connected host to see their totals here.
          </p>
          <Button variant="primary" icon="plus" onClick={onEdit}>
            Add repositories
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.stats}>
            <StatCard
              value={project.repoKeys.length}
              label="Repositories"
              note={
                hostCount > 0 ? `on ${hostCount} ${hostCount === 1 ? 'host' : 'hosts'}` : undefined
              }
            />
            <StatCard
              value={figure(total.commits)}
              label="Commits"
              partial={!noneLoaded && missingOf(known.commits) > 0}
              explain={note}
              note={
                noneLoaded
                  ? undefined
                  : `${known.commits} of ${project.repoKeys.length} repos counted`
              }
            />
            <StatCard
              value={figure(total.contributors)}
              label="Contributors"
              approximate={!noneLoaded}
              partial={!noneLoaded && missingOf(known.contributors) > 0}
              explain={CONTRIBUTORS_NOTE}
              note={noneLoaded ? undefined : 'approx., top 25 per repo'}
            />
            <StatCard
              value={figure(total.openChangeRequests)}
              label="Open PRs / MRs"
              partial={!noneLoaded && missingOf(known.open) > 0}
              explain={note}
              note={noneLoaded ? undefined : `across ${known.open} repos`}
            />
            <StatCard
              value={total.lastActivityAt ? timeAgo(Date.parse(total.lastActivityAt), now) : '–'}
              label="Last activity"
              note={latest?.repo?.name}
            />
          </div>

          <div className={styles.tableHead}>
            <h2 className={styles.tableTitle}>Repositories</h2>
            {loading && summaries.progress ? (
              <>
                <span className={styles.progressText} aria-live="polite">
                  {progressText(summaries.progress)}
                </span>
                <span className={styles.progressBar}>
                  <ProgressBar
                    label="Summaries loading"
                    percent={(summaries.progress.done / summaries.progress.total) * 100}
                  />
                </span>
              </>
            ) : (
              <span className={styles.progressText}>
                Summaries loaded {total.loadedCount} / {total.repoCount}
              </span>
            )}
          </div>

          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {COLUMNS.map((col) => {
                    const active = sort.key === col.key
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        className={col.numeric ? styles.numeric : undefined}
                        aria-sort={
                          active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                        }
                      >
                        <button
                          type="button"
                          className={styles.sortButton}
                          data-active={active || undefined}
                          onClick={() => setSort(nextSort(sort, col.key))}
                        >
                          {col.label}
                          {active ? (
                            <Icon name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size="xs" />
                          ) : null}
                        </button>
                      </th>
                    )
                  })}
                  <th scope="col" className={styles.actionCol}>
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <Row
                    key={row.key}
                    row={row}
                    account={row.repo ? accountOf(row.repo.accountId) : undefined}
                    now={now}
                    loading={summaries.pending.has(row.key)}
                    error={summaries.failed[row.key]}
                    waiting={pending.has(row.key)}
                    onOpen={onOpen}
                    onOpenInSplit={onOpenInSplit}
                    onRemove={onRemoveRepo}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {fetchAll.state.items.length > 0 ? (
        <FetchAllDialog state={fetchAll.state} onClose={fetchAll.close} />
      ) : null}
    </section>
  )
}

interface RowProps {
  row: ProjectRow
  account: Account | undefined
  now: number
  loading: boolean
  error: string | undefined
  /** The account's list is still on its way. */
  waiting: boolean
  onOpen: (repoKey: string) => void
  onOpenInSplit: (repoKey: string) => void
  onRemove: (repoKey: string) => void
}

function Row({
  row,
  account,
  now,
  loading,
  error,
  waiting,
  onOpen,
  onOpenInSplit,
  onRemove
}: RowProps) {
  const { repo, summary } = row
  if (!repo) {
    return (
      <tr className={styles.dim}>
        <td>
          <span className={styles.repoCell}>
            {waiting ? <Spinner label="Loading repositories" /> : <Icon name="alert" size="sm" />}
            <span className={styles.repoText}>
              <span className={styles.repoName}>{remoteIdOf(row.key)}</span>
              <span className={styles.where}>
                {waiting
                  ? 'Waiting for the repository list'
                  : 'Unavailable: access lost or account removed'}
              </span>
            </span>
          </span>
        </td>
        <td>–</td>
        <td className={styles.numeric}>–</td>
        <td className={styles.numeric}>–</td>
        <td className={styles.numeric}>–</td>
        <td>–</td>
        <td>–</td>
        <td className={styles.actionCol}>
          {!waiting ? (
            <IconButton
              label={`Remove ${remoteIdOf(row.key)} from project`}
              icon="x"
              onClick={() => onRemove(row.key)}
            />
          ) : null}
        </td>
      </tr>
    )
  }
  const tile = account ? hostTileOf(account.type, account.baseUrl) : null
  const last = summary?.lastActivityAt ? Date.parse(summary.lastActivityAt) : NaN
  return (
    <tr className={styles.row} onClick={() => onOpen(row.key)}>
      <td>
        <span className={styles.repoCell}>
          {tile ? <HostTile tile={tile.tile} host={tile.host} size={24} /> : null}
          <span className={styles.repoText}>
            <button type="button" className={styles.repoName} title={repo.fullName}>
              {repo.name}
            </button>
            <span className={styles.where}>
              {account?.label ?? repo.accountId} · {repo.namespace}
            </span>
          </span>
          {loading ? <Spinner label={`Loading ${repo.name}`} /> : null}
          {error ? (
            <span title={`Could not load the summary: ${error}`}>
              <Icon name="alert" size="sm" label="Summary could not be loaded" />
            </span>
          ) : null}
        </span>
      </td>
      <td className={styles.muted}>{capitalize(repo.visibility)}</td>
      <td className={styles.numeric}>{countText(summary?.commitCount)}</td>
      <td className={styles.numeric}>{countText(summary?.contributorCount)}</td>
      <td className={styles.numeric}>{countText(summary?.openChangeRequests)}</td>
      <td
        className={styles.muted}
        title={Number.isNaN(last) ? undefined : new Date(last).toLocaleString()}
      >
        {Number.isNaN(last) ? '–' : timeAgo(last, now)}
      </td>
      <td>
        {row.linkedPath ? (
          <span className={styles.local} title={row.linkedPath}>
            <span className={styles.dot} aria-hidden="true" />
            Cloned
          </span>
        ) : (
          <Badge>Not cloned</Badge>
        )}
      </td>
      <td className={styles.actionCol}>
        <IconButton
          label={`Open ${repo.name} in split view`}
          icon="columns"
          onClick={(e) => {
            e.stopPropagation()
            onOpenInSplit(row.key)
          }}
        />
      </td>
    </tr>
  )
}
