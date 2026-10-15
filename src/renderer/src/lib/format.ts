const nf = new Intl.NumberFormat('en-US')

export const formatCount = (n: number | null | undefined): string => (n == null ? '—' : nf.format(n))

export function formatSize(kb: number | null | undefined): string {
  if (kb == null) return '—'
  if (kb < 1024) return `${Math.round(kb)} KB`
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`
  return `${(kb / 1024 / 1024).toFixed(2)} GB`
}

/** Accepts ISO strings, unix seconds (< 1e11) or milliseconds. */
function toDate(v: string | number): Date {
  return new Date(typeof v === 'number' && v < 1e11 ? v * 1000 : v)
}

export function formatDate(v: string | number | null | undefined): string {
  if (v == null) return '—'
  const d = toDate(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function timeAgo(v: string | number | null | undefined, now = Date.now()): string {
  if (v == null) return '—'
  const t = toDate(v).getTime()
  if (Number.isNaN(t)) return '—'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'just now'
  const units: [number, string][] = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [2592000, 'month'], [31536000, 'year']]
  let label = 'minute'
  let div = 60
  for (const [secs, name] of units) {
    if (s >= secs) {
      div = secs
      label = name
    }
  }
  const n = Math.floor(s / div)
  return `${n} ${label}${n === 1 ? '' : 's'} ago`
}
