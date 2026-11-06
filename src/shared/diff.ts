// Parses the unified diff `git diff` prints for one file. Pure, so tests run it directly.
import type { DiffHunk, DiffLine, FileDiff } from './types'

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/** Patches bigger than this are not shown. */
export const MAX_PATCH_BYTES = 1024 * 1024

export function parseUnifiedDiff(path: string, patch: string): FileDiff {
  const result: FileDiff = {
    path,
    binary: false,
    tooLarge: false,
    additions: 0,
    deletions: 0,
    hunks: []
  }
  if (patch.length > MAX_PATCH_BYTES) {
    result.tooLarge = true
    return result
  }
  let hunk: DiffHunk | null = null
  let oldNo = 0
  let newNo = 0
  for (const line of patch.split('\n')) {
    const header = HUNK_RE.exec(line)
    if (header) {
      hunk = { header: line, lines: [] }
      result.hunks.push(hunk)
      oldNo = Number(header[1])
      newNo = Number(header[2])
      continue
    }
    if (!hunk) {
      if (/^Binary files .* differ$/.test(line) || line === 'GIT binary patch') result.binary = true
      continue
    }
    const mark = line[0]
    const text = line.slice(1)
    let entry: DiffLine
    if (mark === '+') {
      entry = { type: 'add', text, oldNo: null, newNo: newNo++ }
      result.additions++
    } else if (mark === '-') {
      entry = { type: 'del', text, oldNo: oldNo++, newNo: null }
      result.deletions++
    } else if (mark === ' ') {
      entry = { type: 'context', text, oldNo: oldNo++, newNo: newNo++ }
    } else if (mark === '\\') {
      entry = { type: 'note', text: line.slice(2), oldNo: null, newNo: null }
    } else {
      // A blank line at the end of the patch, or anything git adds that we do not know.
      continue
    }
    hunk.lines.push(entry)
  }
  return result
}
