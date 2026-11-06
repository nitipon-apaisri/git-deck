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
import { isLocalRepo } from '../../lib/localRepos'
import { remoteIdOf } from '../../lib/projectForm'
import { useFetchAll } from '../../state/useFetchAll'
import { useNow } from '../../state/useNow'
import type { ProjectSummaries } from '../../state/projectSummaries'
import {
  Badge,
  Button,
  ErrorBanner,
  HostTile,
  Icon,
  IconButton,
  ProgressBar,
  ProjectIcon,
  Spinner,
  StatCard
} from '../ui'
import { FetchAllDialog } from './FetchAllDialog'

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
  const failedCount = project.repoKeys.filter((k) => summaries.failed[k] !== undefined).length
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
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-4"
      aria-label={`${project.name} overview`}
    >
      <header className="flex flex-wrap items-center gap-[14px] px-6 pt-5">
        <ProjectIcon icon={project.icon} color={project.color} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="m-0 truncate text-[22px] leading-7 font-semibold">{project.name}</h1>
          <span className="text-muted-foreground">{subtitle}</span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
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
        <div className="flex flex-col items-start gap-2 p-6">
          <h2 className="m-0 text-[15px] leading-[22px] font-semibold">
            No repositories in this project yet
          </h2>
          <p className="m-0 mb-2 text-muted-foreground">
            Add repositories from any connected host to see their totals here.
          </p>
          <Button variant="primary" icon="plus" onClick={onEdit}>
            Add repositories
          </Button>
        </div>
      ) : (
        <>
          {failedCount > 0 && !loading ? (
            <div className="px-6 pt-[18px]">
              <ErrorBanner onRetry={summaries.retryFailed}>
                {failedCount === 1
                  ? 'The summary of 1 repository could not be loaded.'
                  : `The summaries of ${failedCount} repositories could not be loaded.`}{' '}
                Totals count only what is known.
              </ErrorBanner>
            </div>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5 px-6 pt-[18px]">
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

          <div className="flex items-center gap-3 px-6 pt-[22px] pb-2">
            <h2 className="m-0 text-[14px] leading-5 font-semibold">Repositories</h2>
            {loading && summaries.progress ? (
              <>
                <span className="text-[12px] text-muted-foreground" aria-live="polite">
                  {progressText(summaries.progress)}
                </span>
                <span className="w-[120px]">
                  <ProgressBar
                    label="Summaries loading"
                    percent={(summaries.progress.done / summaries.progress.total) * 100}
                  />
                </span>
              </>
            ) : (
              <span className="text-[12px] text-muted-foreground">
                Summaries loaded {total.loadedCount} / {total.repoCount}
              </span>
            )}
          </div>

          <div className="overflow-x-auto px-6">
            <table className="w-full min-w-[860px] border-collapse [&_td]:h-[52px] [&_td]:border-b [&_td]:border-border [&_td]:px-1.5 [&_td]:text-left [&_td]:align-middle [&_td]:font-normal [&_th]:h-[30px] [&_th]:border-b [&_th]:border-border [&_th]:px-1.5 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-normal [&_th]:text-muted-foreground">
              <thead>
                <tr>
                  {COLUMNS.map((col) => {
                    const active = sort.key === col.key
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        className={col.numeric ? 'text-right!' : undefined}
                        aria-sort={
                          active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                        }
                      >
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-inherit hover:text-foreground data-[active]:text-foreground"
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
                  <th scope="col" className="w-11">
                    <span className="absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]">
                      Actions
                    </span>
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
      <tr className="text-muted-foreground">
        <td>
          <span className="flex min-w-0 items-center gap-2.5">
            {waiting ? <Spinner label="Loading repositories" /> : <Icon name="alert" size="sm" />}
            <span className="flex min-w-0 flex-col">
              <span className="overflow-hidden p-0 text-left font-medium text-ellipsis whitespace-nowrap">
                {remoteIdOf(row.key)}
              </span>
              <span className="truncate text-[12px] text-muted-foreground">
                {waiting
                  ? 'Waiting for the repository list'
                  : 'Unavailable: access lost or account removed'}
              </span>
            </span>
          </span>
        </td>
        <td>–</td>
        <td className="text-right!">–</td>
        <td className="text-right!">–</td>
        <td className="text-right!">–</td>
        <td>–</td>
        <td>–</td>
        <td className="w-11">
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
    <tr className="cursor-pointer hover:bg-accent" onClick={() => onOpen(row.key)}>
      <td>
        <span className="flex min-w-0 items-center gap-2.5">
          {tile ? <HostTile tile={tile.tile} host={tile.host} size={24} /> : null}
          <span className="flex min-w-0 flex-col">
            <button
              type="button"
              className="cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left font-medium text-ellipsis whitespace-nowrap"
              title={repo.fullName}
            >
              {repo.name}
            </button>
            <span className="truncate text-[12px] text-muted-foreground">
              {isLocalRepo(repo)
                ? 'Local'
                : `${account?.label ?? repo.accountId} · ${repo.namespace}`}
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
      <td className="text-muted-foreground">{capitalize(repo.visibility)}</td>
      <td className="text-right!">{countText(summary?.commitCount)}</td>
      <td className="text-right!">{countText(summary?.contributorCount)}</td>
      <td className="text-right!">{countText(summary?.openChangeRequests)}</td>
      <td
        className="text-muted-foreground"
        title={Number.isNaN(last) ? undefined : new Date(last).toLocaleString()}
      >
        {Number.isNaN(last) ? '–' : timeAgo(last, now)}
      </td>
      <td>
        {row.linkedPath ? (
          <span
            className="inline-flex items-center gap-1.5 text-[var(--success-text)]"
            title={row.linkedPath}
          >
            <span className="size-[7px] rounded-full bg-[var(--success)]" aria-hidden="true" />
            Cloned
          </span>
        ) : (
          <Badge>Not cloned</Badge>
        )}
      </td>
      <td className="w-11">
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
