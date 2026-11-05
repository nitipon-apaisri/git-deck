import { HttpError } from '../http'

/** The value of a fulfilled `allSettled` entry, else `fallback`. */
export function ok<T, F>(result: PromiseSettledResult<T>, fallback: F): T | F {
  return result.status === 'fulfilled' ? result.value : fallback
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
