// Parser for `git blame --porcelain`. No electron import, so it runs under tsx tests.
import type { BlameLine } from './types'

const HEADER_RE = /^([0-9a-f]{40,64}) \d+ (\d+)(?: \d+)?$/
const ZERO_RE = /^0+$/

interface Meta {
  author: string
  date: number
  boundary: boolean
}

/**
 * Porcelain prints each commit's metadata once, before its first line, then only a header
 * for later lines. The line text is the tab-prefixed line that ends each group.
 */
export function parseBlame(raw: string): BlameLine[] {
  const metas = new Map<string, Meta>()
  const lines: BlameLine[] = []
  let hash = ''
  let lineNo = 0
  for (const row of raw.split('\n')) {
    if (row.startsWith('\t')) {
      const meta = metas.get(hash)
      if (!meta) continue
      lines.push({
        line: lineNo,
        text: row.slice(1),
        hash,
        author: meta.author,
        date: meta.date,
        uncommitted: ZERO_RE.test(hash),
        boundary: meta.boundary
      })
      continue
    }
    const header = HEADER_RE.exec(row)
    if (header) {
      hash = header[1]
      lineNo = Number(header[2])
      if (!metas.has(hash)) metas.set(hash, { author: '', date: 0, boundary: false })
      continue
    }
    const meta = metas.get(hash)
    if (!meta) continue
    if (row.startsWith('author ')) meta.author = row.slice(7)
    else if (row.startsWith('author-time ')) meta.date = Number(row.slice(12))
    else if (row === 'boundary') meta.boundary = true
  }
  return lines
}
