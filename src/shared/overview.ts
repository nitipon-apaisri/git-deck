// Shared rules for the Overview cards. Pure: runs under tsx.
import type { ActivityDay } from './types'

export const ACTIVITY_DAYS = 365

/** `YYYY-MM-DD` of a date in local time. */
export function localDate(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Every day of the window, oldest first and ending today, with the count of each. */
export function fillDays(counts: ReadonlyMap<string, number>, now = new Date()): ActivityDay[] {
  const days: ActivityDay[] = []
  for (let back = ACTIVITY_DAYS - 1; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
    const date = localDate(d)
    days.push({ date, count: counts.get(date) ?? 0 })
  }
  return days
}

/** Counts `YYYY-MM-DD…` strings by their date part. */
export function countDates(dates: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const raw of dates) {
    const date = raw.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return counts
}

/** README size cap, from the clone or the host. */
export const MAX_README_BYTES = 512 * 1024

/** Cuts text to `MAX_README_BYTES` of UTF-8. A character split at the cut becomes U+FFFD. */
export function capReadme(text: string): { markdown: string; truncated: boolean } {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length <= MAX_README_BYTES) return { markdown: text, truncated: false }
  return {
    markdown: new TextDecoder().decode(bytes.subarray(0, MAX_README_BYTES)),
    truncated: true
  }
}

/** Latest tags shown on the About card. */
export const MAX_TAGS = 3
