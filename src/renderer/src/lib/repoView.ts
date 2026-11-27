// Pure view-model helpers for the repository pane. No DOM, so they run under tsx.
import type {
  AccountType,
  ActivityDay,
  Contributor,
  LanguageShare,
  LocalInfo,
  Visibility
} from '../../../shared/types'

export const TOP_CONTRIBUTORS = 5

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

export interface ActivityStats {
  commits: number
  activeDays: number
  /** Weekday with the most commits, `null` with none. */
  busiestDay: string | null
  /** Days in a row with a commit, ending today (or yesterday, if today has none yet). */
  streak: number
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Every stat on the Commits card, from the per-day counts (oldest first). */
export function activityStats(days: readonly ActivityDay[]): ActivityStats {
  const byWeekday = Array<number>(7).fill(0)
  let commits = 0
  let activeDays = 0
  for (const d of days) {
    commits += d.count
    if (d.count > 0) activeDays++
    const weekday = new Date(`${d.date}T00:00:00Z`).getUTCDay()
    if (!Number.isNaN(weekday)) byWeekday[weekday] += d.count
  }
  let end = days.length - 1
  if (end >= 0 && days[end].count === 0) end--
  let streak = 0
  while (end - streak >= 0 && days[end - streak].count > 0) streak++
  const top = Math.max(...byWeekday)
  return {
    commits,
    activeDays,
    busiestDay: top > 0 ? WEEKDAYS[byWeekday.indexOf(top)] : null,
    streak
  }
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
