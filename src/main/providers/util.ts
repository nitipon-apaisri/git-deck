import type { RepoSummary } from '../../shared/types'
import { HttpError } from '../http'

export const emptySummary = (): RepoSummary => ({
  commitCount: null,
  contributorCount: null,
  contributors: [],
  branchCount: null,
  tagCount: null,
  openChangeRequests: null,
  languages: [],
  license: null,
  createdAt: null,
  lastActivityAt: null,
  sizeKb: null,
  topics: []
})

/** Unwraps an allSettled result; a failed piece becomes the fallback. */
export function settled<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === 'fulfilled' ? r.value : fallback
}

export function isStatus(r: PromiseSettledResult<unknown>, status: number): boolean {
  return r.status === 'rejected' && r.reason instanceof HttpError && r.reason.status === status
}

export const str = (v: unknown): string => (typeof v === 'string' ? v : '')
export const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function topLanguages(percentByName: Record<string, number>, max = 8): { name: string; percent: number }[] {
  return Object.entries(percentByName)
    .map(([name, percent]) => ({ name, percent: Math.round(percent * 10) / 10 }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, max)
}
