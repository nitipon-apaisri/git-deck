import { HttpError } from '../http'

/** The value of a fulfilled `allSettled` entry, else `fallback`. */
export function ok<T, F>(result: PromiseSettledResult<T>, fallback: F): T | F {
  return result.status === 'fulfilled' ? result.value : fallback
}

/**
 * Throws the first failure when EVERY piece of a summary failed. One or two failed pieces
 * are normal (a 403 on contributors) and become nulls, but when all of them fail the host
 * was unreachable or the token was refused. Returning an empty summary then would be cached
 * over a good one and shown as "Unavailable" with no error and no Retry.
 */
export function throwIfAllFailed(results: readonly PromiseSettledResult<unknown>[]): void {
  if (results.length === 0) return
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failed.length === results.length) throw failed[0].reason
}

/** Unwraps a body that may be empty (204) into an error. */
export function required<T>(body: T | null, what: string): T {
  if (body === null) throw new HttpError(0, `Empty response from ${what}`)
  return body
}

/** Rounds to one decimal, never negative. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

/** Escapes each segment of `owner/name` so slashes stay separators. */
export function encodePath(fullName: string): string {
  return fullName.split('/').map(encodeURIComponent).join('/')
}
