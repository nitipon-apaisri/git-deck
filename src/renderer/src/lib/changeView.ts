import type { AccountType, CheckState } from '../../../shared/types'

/** Data older than this is re-read when the window gets the focus. No background polling. */
export const CHANGES_STALE_MS = 60_000

export function changesStale(fetchedAt: number | null, now: number): boolean {
  return fetchedAt === null || now - fetchedAt > CHANGES_STALE_MS
}

/** The host's own page for opening a new PR/MR: this app never creates one. */
export function createUrl(host: AccountType, webUrl: string): string {
  const base = webUrl.replace(/\/+$/, '')
  return host === 'github' ? `${base}/compare` : `${base}/-/merge_requests/new`
}

export const CHECK_LABEL: Record<CheckState, string> = {
  success: 'Checks passed',
  failure: 'Checks failed',
  pending: 'Checks running',
  none: 'No CI info'
}
