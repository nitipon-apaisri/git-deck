// Pure helpers for the Home screen. No DOM: runs under tsx.

export interface HeatDay {
  date: string
  count: number
}

/** A grid cell: one day, or `null` padding so the first week starts on its weekday (Sunday = row 0). */
export type HeatCell = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 } | null

/** 0 for no contributions, else 1 to 4 by quarter of the busiest day. */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0
  return Math.min(4, Math.ceil((count / max) * 4)) as 1 | 2 | 3 | 4
}

/** Cells in column-major order for a 7-row grid. */
export function heatCells(days: readonly HeatDay[]): HeatCell[] {
  if (days.length === 0) return []
  const max = Math.max(...days.map((d) => d.count))
  const first = new Date(`${days[0].date}T00:00:00Z`).getUTCDay()
  const pad: HeatCell[] = Number.isNaN(first) ? [] : Array.from({ length: first }, () => null)
  return [...pad, ...days.map((d) => ({ ...d, level: heatLevel(d.count, max) }))]
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] // prettier-ignore

/** One label per month, on the first column that starts in it. A month shorter than 2 columns at the left edge is skipped so labels do not collide. */
export function monthLabels(cells: readonly HeatCell[]): { col: number; label: string }[] {
  const out: { col: number; label: string }[] = []
  let prev = -1
  for (let col = 0; col * 7 < cells.length; col++) {
    const day = cells.slice(col * 7, col * 7 + 7).find((c) => c !== null)
    if (!day) continue
    const month = Number(day.date.slice(5, 7)) - 1
    if (month === prev) continue
    prev = month
    out.push({ col, label: MONTHS[month].slice(0, 3) })
  }
  if (out.length > 1 && out[1].col - out[0].col < 2) out.shift()
  return out
}

/** Tooltip text: "3 contributions on November 12", or "No events on …". */
export function heatTip(count: number, date: string, noun: string): string {
  const day = `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`
  return `${count === 0 ? 'No' : count} ${count === 1 ? noun : `${noun}s`} on ${day}`
}
