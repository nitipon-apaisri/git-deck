// Pure formatting helpers.

/** "just now", "2 min ago", "3 h ago", "5 d ago". `now` is injected for tests. */
export function timeAgo(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

/** One or two capital letters for an avatar fallback. */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const letters =
    words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[1]][0]]
  return letters.join('').toUpperCase()
}

/** Stable 1..4 bucket for choosing `--avatar-n`. */
export function avatarIndex(seed: string): 1 | 2 | 3 | 4 {
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return ((hash % 4) + 1) as 1 | 2 | 3 | 4
}

/** Shortens in the middle so both ends of a ref name stay readable. */
export function truncateMiddle(text: string, max: number): string {
  const chars = [...text]
  if (chars.length <= max || max < 5) return text
  const keep = max - 1
  const head = Math.ceil(keep / 2)
  const tail = Math.floor(keep / 2)
  return `${chars.slice(0, head).join('')}…${chars.slice(chars.length - tail).join('')}`
}
