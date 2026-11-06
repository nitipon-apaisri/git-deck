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
    change: null,
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
      if (line.startsWith('new file mode ')) result.change = 'created'
      else if (line.startsWith('deleted file mode ')) result.change = 'deleted'
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

/**
 * A short fingerprint of a hunk's lines (FNV-1a over type and text). Both sides compute it, so
 * main can tell that the hunk it is about to apply is the one the user saw.
 */
export function hunkFingerprint(lines: DiffLine[]): string {
  let hash = 0x811c9dc5
  for (const line of lines) {
    const chunk = `${line.type}\u0000${line.text}\u0001`
    for (let i = 0; i < chunk.length; i++) {
      hash ^= chunk.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Splits a one-file patch into the part before the first hunk (the `diff --git` and mode lines)
 * and each hunk's raw text. A line that starts with `@@` is always a hunk header, because
 * content lines start with a space, `+`, `-` or a backslash.
 */
export function splitPatch(patch: string): { header: string; hunks: string[] } {
  const lines = patch.split('\n')
  const starts: number[] = []
  lines.forEach((line, i) => {
    if (HUNK_RE.test(line)) starts.push(i)
  })
  if (starts.length === 0) return { header: patch, hunks: [] }
  const header = lines.slice(0, starts[0]).join('\n') + '\n'
  const hunks = starts.map((start, n) => {
    const end = n + 1 < starts.length ? starts[n + 1] : lines.length
    const body = lines.slice(start, end).join('\n')
    return body.endsWith('\n') ? body : body + '\n'
  })
  return { header, hunks }
}

const HUNK_HEAD_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/

/**
 * Builds a patch for some lines of one hunk, from the hunk's raw text so no byte changes.
 * `selected` holds positions in the hunk's content lines (the same positions as
 * `DiffHunk.lines`). To stage, an unselected `+` is dropped and an unselected `-` becomes
 * context. To unstage (the patch is applied with `--reverse`) an unselected `+` becomes context
 * and an unselected `-` is dropped. Header counts are recomputed from the lines kept.
 */
export function linePatch(
  header: string,
  hunkText: string,
  selected: number[],
  direction: 'stage' | 'unstage'
): string {
  if (selected.length === 0) throw new Error('Select at least one changed line')
  if (new Set(selected).size !== selected.length) throw new Error('A line is selected twice')
  const rows = hunkText.split('\n')
  if (rows.at(-1) === '') rows.pop()
  const head = HUNK_HEAD_RE.exec((rows[0] ?? '').replace(/\r$/, ''))
  if (!head) throw new Error('This is not a hunk')
  const body = rows.slice(1)
  const picked = new Set(selected)
  for (const n of picked) {
    const mark = body[n]?.[0]
    if (!Number.isInteger(n) || (mark !== '+' && mark !== '-')) {
      throw new Error('Only an added or removed line can be selected')
    }
  }
  const changed = body.filter((r) => r[0] === '+' || r[0] === '-').length
  const partial = picked.size < changed
  const out: string[] = []
  let oldCount = 0
  let newCount = 0
  body.forEach((row, i) => {
    const mark = row[0]
    if (mark === '\\') {
      if (partial)
        throw new Error('A change at the end of a file without a newline is staged whole')
      out.push(row)
      return
    }
    const chosen = picked.has(i)
    let kept = row
    if (mark === '+' && !chosen) {
      if (direction === 'stage') return
      kept = ' ' + row.slice(1)
    } else if (mark === '-' && !chosen) {
      if (direction === 'unstage') return
      kept = ' ' + row.slice(1)
    }
    out.push(kept)
    if (kept[0] !== '+') oldCount++
    if (kept[0] !== '-') newCount++
  })
  const eol = (rows[0] ?? '').endsWith('\r') ? '\r' : ''
  const title = head[3].replace(/\r$/, '')
  const top = `@@ -${head[1]},${oldCount} +${head[2]},${newCount} @@${title}${eol}`
  return header + [top, ...out].join('\n') + '\n'
}
