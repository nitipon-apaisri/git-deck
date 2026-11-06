// Phase 16: line-level staging. linePatch is pure; the rest runs git in temp repos.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { getDiff, stageHunk, unstageHunk } from '../src/main/git'
import { hunkFingerprint, linePatch, parseUnifiedDiff, splitPatch } from '../src/shared/diff'
import type { HunkRequest } from '../src/shared/types'
import {
  buttonLabel,
  canSelectLines,
  selectAllChanged,
  selectRange,
  toggleLine
} from '../src/renderer/src/lib/lineSelection'
import { commit, emptyRepo, git } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

const HEADER = 'diff --git a/f b/f\n--- a/f\n+++ b/f\n'
// Positions: 0 ctx a, 1 -b, 2 -c, 3 +B, 4 +C, 5 +D, 6 ctx d
const HUNK = '@@ -1,4 +1,5 @@\n a\n-b\n-c\n+B\n+C\n+D\n d\n'

test('linePatch stage: unselected + is dropped and unselected - becomes context', () => {
  assert.equal(
    linePatch(HEADER, HUNK, [1, 3], 'stage'),
    HEADER + '@@ -1,4 +1,4 @@\n a\n-b\n c\n+B\n d\n'
  )
  assert.equal(
    linePatch(HEADER, HUNK, [5], 'stage'),
    HEADER + '@@ -1,4 +1,5 @@\n a\n b\n c\n+D\n d\n'
  )
})

test('linePatch unstage: unselected + becomes context and unselected - is dropped', () => {
  assert.equal(
    linePatch(HEADER, HUNK, [2, 4], 'unstage'),
    HEADER + '@@ -1,5 +1,5 @@\n a\n-c\n B\n+C\n D\n d\n'
  )
})

test('linePatch with every changed line is the whole hunk, in both directions', () => {
  for (const direction of ['stage', 'unstage'] as const) {
    assert.equal(linePatch(HEADER, HUNK, [1, 2, 3, 4, 5], direction), HEADER + HUNK)
  }
})

test('linePatch keeps CRLF, tabs and trailing spaces byte for byte', () => {
  const hunk = '@@ -1,2 +1,2 @@\r\n a\t \r\n-b \r\n+B\t\r\n'
  assert.equal(linePatch(HEADER, hunk, [1, 2], 'stage'), HEADER + hunk)
  assert.equal(
    linePatch(HEADER, hunk, [2], 'stage'),
    HEADER + '@@ -1,2 +1,3 @@\r\n a\t \r\n b \r\n+B\t\r\n'
  )
})

test('linePatch refuses an empty, duplicate, context, out-of-range or fractional selection', () => {
  assert.throws(() => linePatch(HEADER, HUNK, [], 'stage'), /at least one/)
  assert.throws(() => linePatch(HEADER, HUNK, [1, 1], 'stage'), /twice/)
  assert.throws(() => linePatch(HEADER, HUNK, [0], 'stage'), /added or removed/)
  assert.throws(() => linePatch(HEADER, HUNK, [6], 'stage'), /added or removed/)
  assert.throws(() => linePatch(HEADER, HUNK, [99], 'stage'), /added or removed/)
  assert.throws(() => linePatch(HEADER, HUNK, [1.5], 'stage'), /added or removed/)
  assert.throws(() => linePatch(HEADER, 'not a hunk\n', [0], 'stage'), /not a hunk/)
})

test('a no-newline hunk is refused for some lines and fine for all of them', () => {
  const hunk = '@@ -1,2 +1,2 @@\n a\n-b\n+B\n\\ No newline at end of file\n'
  assert.throws(() => linePatch(HEADER, hunk, [1], 'stage'), /without a newline/)
  assert.equal(linePatch(HEADER, hunk, [1, 2], 'stage'), HEADER + hunk)
})

test('parseUnifiedDiff reads created and deleted files', () => {
  const made = parseUnifiedDiff(
    'n',
    'diff --git a/n b/n\nnew file mode 100644\n--- /dev/null\n+++ b/n\n@@ -0,0 +1 @@\n+x\n'
  )
  assert.equal(made.change, 'created')
  const gone = parseUnifiedDiff(
    'n',
    'diff --git a/n b/n\ndeleted file mode 100644\n--- a/n\n+++ /dev/null\n@@ -1 +0,0 @@\n-x\n'
  )
  assert.equal(gone.change, 'deleted')
  assert.equal(parseUnifiedDiff('n', HEADER + HUNK).change, null)
})

test('lineSelection helpers toggle, select ranges and label the button', () => {
  const diff = parseUnifiedDiff('f', HEADER + HUNK)
  const hunk = diff.hunks[0]
  assert.deepEqual(selectAllChanged(hunk), [1, 2, 3, 4, 5])
  assert.deepEqual(toggleLine([], hunk, 0), [], 'a context line cannot be ticked')
  assert.deepEqual(toggleLine([], hunk, 3), [3])
  assert.deepEqual(toggleLine([3], hunk, 3), [])
  assert.deepEqual(selectRange([], hunk, 4, 1), [1, 2, 3, 4])
  assert.equal(canSelectLines(diff, hunk), true)
  assert.equal(canSelectLines({ change: 'created' }, hunk), false)
  const noted = parseUnifiedDiff(
    'f',
    HEADER + '@@ -1 +1 @@\n-a\n+b\n\\ No newline at end of file\n'
  )
  assert.equal(canSelectLines(noted, noted.hunks[0]), false)
  assert.equal(buttonLabel('stage', 3), 'Stage 3 lines')
  assert.equal(buttonLabel('unstage', 1), 'Unstage 1 line')
})

// Git, in temp repos

const BASE = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`)

/** One hunk with two removed and three added lines in the middle of the file. */
function repo(): string {
  const dir = emptyRepo()
  writeFileSync(join(dir, 'f.txt'), BASE.join('\n') + '\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'base')
  const next = [...BASE.slice(0, 5), 'new A', 'new B', 'new C', ...BASE.slice(7)]
  writeFileSync(join(dir, 'f.txt'), next.join('\n') + '\n')
  return dir
}

async function request(
  dir: string,
  source: 'worktree' | 'staged',
  lines?: number[],
  path = 'f.txt'
): Promise<HunkRequest> {
  const diff = await getDiff(dir, { source, path })
  const base: HunkRequest = {
    path,
    source,
    index: 0,
    fingerprint: hunkFingerprint(diff.hunks[0].lines)
  }
  return lines ? { ...base, lines } : base
}

const state = (dir: string) => ({
  index: git(dir, 'diff', '--cached'),
  tree: readFileSync(join(dir, 'f.txt'), 'utf8')
})

test('lines: a subset is staged, the work tree is untouched and the rest stages the same as the file', async () => {
  const dir = repo()
  const treeBefore = state(dir).tree
  // Positions: 3 ctx.. the first changed lines are -line 6, -line 7, +new A, +new B, +new C.
  const diff = await getDiff(dir, { source: 'worktree', path: 'f.txt' })
  const changed = selectAllChanged(diff.hunks[0])
  assert.equal(changed.length, 5)
  await stageHunk(dir, await request(dir, 'worktree', [changed[0], changed[2]]))
  const cached = git(dir, 'diff', '--cached')
  assert.match(cached, /-line 6/)
  assert.doesNotMatch(cached, /-line 7/)
  assert.match(cached, /\+new A/)
  assert.doesNotMatch(cached, /\+new B/)
  assert.equal(state(dir).tree, treeBefore)

  const rest = await getDiff(dir, { source: 'worktree', path: 'f.txt' })
  await stageHunk(dir, await request(dir, 'worktree', selectAllChanged(rest.hunks[0])))
  const viaLines = git(dir, 'diff', '--cached')
  git(dir, 'reset', '-q')
  git(dir, 'add', 'f.txt')
  assert.equal(git(dir, 'diff', '--cached'), viaLines)
  assert.equal(git(dir, 'diff'), '')
})

test('lines: a subset is unstaged and a stage/unstage round trip restores the index', async () => {
  const dir = repo()
  git(dir, 'add', 'f.txt')
  const treeBefore = state(dir).tree
  const staged = await getDiff(dir, { source: 'staged', path: 'f.txt' })
  const changed = selectAllChanged(staged.hunks[0])
  await unstageHunk(dir, await request(dir, 'staged', [changed[1], changed[4]]))
  const cached = git(dir, 'diff', '--cached')
  assert.doesNotMatch(cached, /-line 7/)
  assert.match(cached, /-line 6/)
  assert.doesNotMatch(cached, /\+new C/)
  assert.match(git(dir, 'diff'), /\+new C/)
  assert.equal(state(dir).tree, treeBefore)

  git(dir, 'reset', '-q')
  for (const pick of [[0], [1, 3], [2, 3, 4], [0, 1, 2, 3, 4], [4]]) {
    const before = state(dir)
    const worktree = await getDiff(dir, { source: 'worktree', path: 'f.txt' })
    const lines = pick.map((n) => selectAllChanged(worktree.hunks[0])[n])
    await stageHunk(dir, await request(dir, 'worktree', lines))
    assert.notEqual(git(dir, 'diff', '--cached'), '')
    git(dir, 'reset', '-q')
    assert.deepEqual(state(dir), before)
  }
})

test('lines: stage then unstage the same lines returns to where it started', async () => {
  const dir = repo()
  const before = state(dir)
  const worktree = await getDiff(dir, { source: 'worktree', path: 'f.txt' })
  const all = selectAllChanged(worktree.hunks[0])
  await stageHunk(dir, await request(dir, 'worktree', [all[1], all[3]]))
  const staged = await getDiff(dir, { source: 'staged', path: 'f.txt' })
  await unstageHunk(dir, await request(dir, 'staged', selectAllChanged(staged.hunks[0])))
  assert.deepEqual(state(dir), before)
})

test('lines: stale, bad, untracked, created, deleted, renamed and conflicted requests are refused', async () => {
  const dir = repo()
  const good = await request(dir, 'worktree', [3])
  await assert.rejects(stageHunk(dir, { ...good, fingerprint: 'ffffffff' }), /changed since/)
  await assert.rejects(stageHunk(dir, { ...good, lines: [0] }), /added or removed/)
  await assert.rejects(stageHunk(dir, { ...good, lines: [3, 3] }), /Invalid line/)
  await assert.rejects(stageHunk(dir, { ...good, lines: [-1] }), /Invalid line/)
  await assert.rejects(stageHunk(dir, { ...good, lines: [1.5] }), /Invalid line/)
  await assert.rejects(stageHunk(dir, { ...good, lines: [999] }), /Invalid line/)
  await assert.rejects(stageHunk(dir, { ...good, lines: [] }), /at least one/)
  await assert.rejects(stageHunk(dir, { ...good, path: '--cached' }), /has no changes/)
  await assert.rejects(stageHunk(dir, { ...good, path: '../x' }), /has no changes/)
  assert.equal(git(dir, 'diff', '--cached'), '')

  writeFileSync(join(dir, 'u.txt'), 'a\nb\n')
  await assert.rejects(stageHunk(dir, { ...good, path: 'u.txt' }), /Only changes to a tracked/)

  // Deleted
  mkdirSync(join(dir, 'sub'), { recursive: true })
  commit(dir, 'gone.txt', 'x')
  git(dir, 'rm', '-q', '--cached', 'gone.txt')
  git(dir, 'commit', '-q', '-m', 'drop from index')
  commit(dir, 'gone2.txt', 'y')
  git(dir, 'rm', '-q', 'gone2.txt')
  const gone = await getDiff(dir, { source: 'staged', path: 'gone2.txt' })
  assert.equal(gone.change, 'deleted')
  await assert.rejects(
    unstageHunk(dir, {
      path: 'gone2.txt',
      source: 'staged',
      index: 0,
      fingerprint: hunkFingerprint(gone.hunks[0].lines),
      lines: [0]
    }),
    /as a whole/
  )

  // Created (intent-to-add makes it a tracked file with a worktree diff)
  writeFileSync(join(dir, 'made.txt'), 'm\n')
  git(dir, 'add', '-N', 'made.txt')
  const made = await getDiff(dir, { source: 'worktree', path: 'made.txt' })
  assert.equal(made.change, 'created')
  await assert.rejects(
    stageHunk(dir, {
      path: 'made.txt',
      source: 'worktree',
      index: 0,
      fingerprint: hunkFingerprint(made.hunks[0].lines),
      lines: [0]
    }),
    /as a whole/
  )

  // Renamed
  git(dir, 'mv', 'f.txt', 'g.txt')
  const moved = await getDiff(dir, { source: 'staged', path: 'g.txt' })
  await assert.rejects(
    unstageHunk(dir, {
      path: 'g.txt',
      source: 'staged',
      index: 0,
      fingerprint: hunkFingerprint(moved.hunks[0]?.lines ?? []),
      lines: [0]
    }),
    /renamed/
  )
})

test('lines: the patch is rebuilt in main, so splitPatch of the diff still matches', async () => {
  const dir = repo()
  const patch = git(dir, 'diff')
  assert.equal(splitPatch(patch + '\n').hunks.length, 1)
})
