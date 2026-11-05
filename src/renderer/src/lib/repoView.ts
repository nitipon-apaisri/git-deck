// Pure view-model helpers for the repository pane. No DOM, so they run under tsx.
import type {
  AccountType,
  Contributor,
  LanguageShare,
  LocalInfo,
  Repo,
  RepoSummary,
  Visibility
} from '../../../shared/types'

export const TOP_CONTRIBUTORS = 10

const number = new Intl.NumberFormat('en-US')

/** A count with thousands separators, or `—` when it is not known. */
export function countText(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : number.format(value)
}

export function plural(count: number, noun: string): string {
  return `${number.format(count)} ${noun}${count === 1 ? '' : 's'}`
}

export function visibilityLabel(visibility: Visibility): string {
  return visibility === 'private' ? 'Private' : visibility === 'internal' ? 'Internal' : 'Public'
}

export function changeRequestLabel(type: AccountType): string {
  return type === 'gitlab' ? 'Open MRs' : 'Open PRs'
}

export function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

/** `1.5 MB` style size from kilobytes, or `—` when unknown. */
export function sizeText(kb: number | null): string {
  if (kb === null) return '—'
  const trim = (n: number): string => n.toFixed(1).replace(/\.0$/, '')
  if (kb < 1024) return `${number.format(Math.round(kb))} KB`
  if (kb < 1024 * 1024) return `${trim(kb / 1024)} MB`
  return `${trim(kb / (1024 * 1024))} GB`
}

function dateText(ms: number, locale: string, timeZone?: string): string {
  if (!Number.isFinite(ms)) return '—'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone
  }).format(ms)
}

/** `5 Nov 2026` from an ISO timestamp, or `—`. */
export function isoDateText(iso: string | null, locale = 'en-GB', timeZone?: string): string {
  return iso ? dateText(Date.parse(iso), locale, timeZone) : '—'
}

/** Same, from unix seconds as git reports them. */
export function unixDateText(seconds: number | null, locale = 'en-GB', timeZone?: string): string {
  return seconds === null ? '—' : dateText(seconds * 1000, locale, timeZone)
}

export interface StatItem {
  id: string
  label: string
  /** A number, `—` while loading, or `null` when the host could not say. */
  value: number | string | null
}

/**
 * The overview cards. `summary` is `null` while nothing has loaded: that shows `—`
 * while a load is running and "Unavailable" (null) once it has failed.
 */
export function statItems(
  repo: Repo,
  summary: RepoSummary | null,
  accountType: AccountType,
  loading: boolean
): StatItem[] {
  const fromSummary = (pick: (s: RepoSummary) => number | null): number | string | null =>
    summary ? pick(summary) : loading ? '—' : null
  return [
    { id: 'commits', label: 'Commits', value: fromSummary((s) => s.commitCount) },
    { id: 'contributors', label: 'Contributors', value: fromSummary((s) => s.contributorCount) },
    { id: 'branches', label: 'Branches', value: fromSummary((s) => s.branchCount) },
    { id: 'tags', label: 'Tags', value: fromSummary((s) => s.tagCount) },
    {
      id: 'changes',
      label: changeRequestLabel(accountType),
      value: fromSummary((s) => s.openChangeRequests)
    },
    { id: 'stars', label: 'Stars', value: repo.stars },
    { id: 'forks', label: 'Forks', value: repo.forks },
    { id: 'issues', label: 'Open issues', value: repo.openIssues }
  ]
}

export interface ContributorRow {
  key: string
  name: string
  avatarUrl: string
  commits: number
  /** 0 to 1, relative to the top contributor, so the first bar is always full. */
  share: number
}

/** Most commits first, cut to `limit`. Bars are relative to the top contributor. */
export function contributorRows(contributors: Contributor[], limit: number): ContributorRow[] {
  const sorted = [...contributors].sort((a, b) => b.commits - a.commits)
  const top = sorted[0]?.commits ?? 0
  return sorted.slice(0, limit).map((c, index) => ({
    key: `${c.login || c.email || c.name}:${index}`,
    name: c.name || c.login || c.email || 'Unknown',
    avatarUrl: c.avatarUrl,
    commits: c.commits,
    share: top > 0 ? c.commits / top : 0
  }))
}

export function percentText(percent: number): string {
  if (percent <= 0) return '0%'
  if (percent < 0.1) return '<0.1%'
  return percent >= 10 ? `${Math.round(percent)}%` : `${percent.toFixed(1).replace(/\.0$/, '')}%`
}

export interface LanguageSegment {
  name: string
  percent: number
  label: string
  /** 1 to 8, picks `--proj-*`. The legend carries the name, so colour is never alone. */
  tone: number
}

export const LANGUAGE_TONES = 8

export function languageSegments(languages: LanguageShare[]): LanguageSegment[] {
  return [...languages]
    .filter((l) => l.percent > 0)
    .sort((a, b) => b.percent - a.percent)
    .map((l, index) => ({
      name: l.name,
      percent: l.percent,
      label: percentText(l.percent),
      tone: (index % LANGUAGE_TONES) + 1
    }))
}

/** `Detached HEAD at 1a2b3c4`, or the branch name. */
export function branchText(info: LocalInfo): string {
  if (info.detached) {
    return info.headHash ? `Detached HEAD at ${shortHash(info.headHash)}` : 'Detached HEAD'
  }
  return info.currentBranch ?? 'No commits yet'
}

export function aheadBehindText(ahead: number | null, behind: number | null): string {
  if (ahead === null && behind === null) return 'No upstream branch'
  const parts: string[] = []
  if (ahead) parts.push(`${number.format(ahead)} ahead`)
  if (behind) parts.push(`${number.format(behind)} behind`)
  return parts.length ? parts.join(', ') : 'Up to date'
}

export function dirtyText(files: number | null): string {
  if (files === null) return '—'
  return files === 0 ? 'Clean' : `${plural(files, 'uncommitted file')}`
}

export function branchCountText(local: number | null, remote: number | null): string {
  if (local === null && remote === null) return '—'
  return `${countText(local)} local, ${countText(remote)} remote`
}
