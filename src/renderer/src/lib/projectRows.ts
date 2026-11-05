// The project overview table and its summary loading, as pure functions. No DOM.
import type { Cached, ProjectSummary, Repo, RepoSummary } from '../../../shared/types'

/** A summary older than this is fetched again in the background. */
export const STALE_AFTER_MS = 60 * 60 * 1000
export const SUMMARY_CONCURRENCY = 3
export const FETCH_ALL_CONCURRENCY = 2

export interface ProjectRow {
  key: string
  /** `null` when no loaded list has this repository: access lost or account removed. */
  repo: Repo | null
  summary: RepoSummary | null
  fetchedAt: number | null
  /** The folder it is cloned to, if linked. */
  linkedPath: string | null
}

export function buildRows(
  keys: readonly string[],
  repos: ReadonlyMap<string, Repo>,
  summaries: Readonly<Record<string, Cached<RepoSummary> | undefined>>,
  links: Readonly<Record<string, string>>
): ProjectRow[] {
  return keys.map((key) => {
    const entry = summaries[key]
    return {
      key,
      repo: repos.get(key) ?? null,
      summary: entry?.data ?? null,
      fetchedAt: entry?.fetchedAt ?? null,
      linkedPath: links[key] ?? null
    }
  })
}

export type SortKey = 'name' | 'visibility' | 'commits' | 'contributors' | 'open' | 'last' | 'local'
export type SortDir = 'asc' | 'desc'
export interface SortState {
  key: SortKey
  dir: SortDir
}

export const DEFAULT_SORT: SortState = { key: 'last', dir: 'desc' }

/** Numbers and dates start with the biggest; text starts A to Z. */
const FIRST_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  visibility: 'asc',
  commits: 'desc',
  contributors: 'desc',
  open: 'desc',
  last: 'desc',
  local: 'desc'
}

/** A click on a column: the same column flips, a new one starts in its natural order. */
export function nextSort(current: SortState, clicked: SortKey): SortState {
  if (current.key === clicked) return { key: clicked, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  return { key: clicked, dir: FIRST_DIR[clicked] }
}

const VISIBILITY_ORDER = { public: 0, internal: 1, private: 2 } as const

function valueOf(row: ProjectRow, key: SortKey): number | string | null {
  const s = row.summary
  switch (key) {
    case 'name':
      return row.repo?.fullName.toLowerCase() ?? null
    case 'visibility':
      return row.repo ? VISIBILITY_ORDER[row.repo.visibility] : null
    case 'commits':
      return s?.commitCount ?? null
    case 'contributors':
      return s?.contributorCount ?? null
    case 'open':
      return s?.openChangeRequests ?? null
    case 'last': {
      const ms = s?.lastActivityAt ? Date.parse(s.lastActivityAt) : NaN
      return Number.isNaN(ms) ? null : ms
    }
    case 'local':
      return row.repo ? (row.linkedPath ? 1 : 0) : null
  }
}

/**
 * Sorted copy. Rows with no value for the column, and unavailable repositories, go last
 * in either direction, so the unknowns never lead. Ties keep the project order.
 */
export function sortRows(rows: readonly ProjectRow[], { key, dir }: SortState): ProjectRow[] {
  const sign = dir === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index, value: valueOf(row, key) }))
    .sort((a, b) => {
      // Unavailable repositories sit under everything else, whatever the column.
      if ((a.row.repo === null) !== (b.row.repo === null)) return a.row.repo === null ? 1 : -1
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index
        return a.value === null ? 1 : -1
      }
      const order =
        typeof a.value === 'string' && typeof b.value === 'string'
          ? a.value.localeCompare(b.value)
          : Number(a.value) - Number(b.value)
      return order !== 0 ? order * sign : a.index - b.index
    })
    .map((entry) => entry.row)
}

/** "12,430", or an en dash when the count is unknown. Never 0 for unknown. */
export const countText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '–' : value.toLocaleString('en-US')

// Summary loading

/** Keys that have no summary yet, or one older than an hour, in project order. */
export function staleKeys(
  keys: readonly string[],
  summaries: Readonly<Record<string, Cached<RepoSummary> | undefined>>,
  now: number,
  available: ReadonlySet<string>
): string[] {
  return keys.filter((key) => {
    if (!available.has(key)) return false
    const entry = summaries[key]
    return entry === undefined || now - entry.fetchedAt > STALE_AFTER_MS
  })
}

export interface LoadProgress {
  done: number
  total: number
}

export const progressText = ({ done, total }: LoadProgress): string => `${done} / ${total} loaded`

/** Where the contributors figure comes from, for its tooltip. */
export const CONTRIBUTORS_NOTE = 'Approximate: the top 25 contributors of each repository, merged.'

export function partialNote(summary: ProjectSummary): string | null {
  if (!summary.partial) return null
  const missing = summary.repoCount - summary.loadedCount
  if (missing > 0) {
    return `${missing} of ${summary.repoCount} ${missing === 1 ? 'repository has' : 'repositories have'} no summary yet. Totals count only what is known.`
  }
  return 'Some counts could not be read from the host. Totals count only what is known.'
}
