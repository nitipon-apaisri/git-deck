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
