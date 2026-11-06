import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DIFF_LINE_LIMIT,
  canStageHunks,
  commitBlocker,
  countText,
  diffTotalsText,
  groupStatus,
  keepSelection,
  limitHunks,
  rowLetter,
  rowWord,
  splitPath,
  stagedKind,
  unstagedKind,
  visibleLineCount
} from '../src/renderer/src/lib/changesView'
import type { DiffHunk, StatusEntry } from '../src/shared/types'

const entry = (over: Partial<StatusEntry> & { path: string }): StatusEntry => ({
  origPath: null,
  index: null,
  worktree: null,
  untracked: false,
  conflicted: false,
  ...over
})

test('groupStatus puts a file in both lists when it was staged and edited again', () => {
  const groups = groupStatus([
    entry({ path: 'both.ts', index: 'modified', worktree: 'modified' }),
    entry({ path: 'staged.ts', index: 'added' }),
    entry({ path: 'edited.ts', worktree: 'modified' }),
    entry({ path: 'new.ts', untracked: true }),
    entry({ path: 'clash.ts', conflicted: true })
  ])
  assert.deepEqual(
    groups.staged.map((e) => e.path),
    ['both.ts', 'staged.ts']
  )
  assert.deepEqual(
    groups.unstaged.map((e) => e.path),
    ['both.ts', 'edited.ts', 'new.ts']
  )
  assert.deepEqual(
    groups.conflicted.map((e) => e.path),
    ['clash.ts']
  )
})

test('every kind has a letter and a word, so status is never colour alone', () => {
  assert.equal(rowLetter(stagedKind(entry({ path: 'a', index: 'deleted' }))), 'D')
  assert.equal(rowWord(unstagedKind(entry({ path: 'a', untracked: true }))), 'New file')
  assert.equal(rowLetter('conflicted'), '!')
  assert.equal(rowWord(unstagedKind(entry({ path: 'a', worktree: 'renamed' }))), 'Renamed')
})

test('splitPath separates the folder from the file name', () => {
  assert.deepEqual(splitPath('src/app/main.ts'), { dir: 'src/app/', name: 'main.ts' })
  assert.deepEqual(splitPath('README.md'), { dir: '', name: 'README.md' })
})

test('commitBlocker says why Commit is off, in words', () => {
  const base = { message: 'Fix it', staged: 1, conflicts: 0, amend: false }
  assert.equal(commitBlocker(base), null)
  assert.equal(commitBlocker({ ...base, conflicts: 1 }), 'Resolve the conflicts first')
  assert.equal(commitBlocker({ ...base, staged: 0 }), 'Stage at least one file')
  assert.equal(commitBlocker({ ...base, message: '  \n ' }), 'Write a commit message')
  // Amend can keep the old message, or the old files.
  const amend = { ...base, amend: true }
  assert.equal(
    commitBlocker({ ...amend, staged: 0, message: '' }),
    'Change the message or stage a file'
  )
  assert.equal(commitBlocker({ ...amend, staged: 0, message: 'Reword' }), null)
  assert.equal(commitBlocker({ ...amend, staged: 2, message: '' }), null)
})

test('keepSelection drops a file that left the list it was picked from', () => {
  const groups = groupStatus([entry({ path: 'a.ts', index: 'modified' })])
  const staged = { source: 'staged', path: 'a.ts' } as const
  assert.deepEqual(keepSelection(staged, groups), staged)
  assert.equal(keepSelection({ source: 'worktree', path: 'a.ts' }, groups), null)
  assert.equal(keepSelection({ source: 'staged', path: 'gone.ts' }, groups), null)
  assert.equal(keepSelection(null, groups), null)
})

test('text helpers', () => {
  assert.equal(countText(1, 'changed file'), '1 changed file')
  assert.equal(countText(1200, 'changed file'), '1,200 changed files')
  assert.equal(diffTotalsText(3, 1), '+3 −1')
  assert.equal(visibleLineCount(10), 10)
  assert.equal(visibleLineCount(DIFF_LINE_LIMIT + 500), DIFF_LINE_LIMIT)
})

test('limitHunks cuts the last hunk and drops the ones after it', () => {
  const line = { type: 'context', text: 'x', oldNo: 1, newNo: 1 } as const
  const hunk = (n: number): DiffHunk => ({ header: `@@ ${n}`, lines: Array(n).fill(line) })
  const hunks = [hunk(3), hunk(4), hunk(5)]
  assert.deepEqual(
    limitHunks(hunks, 100).map((h) => h.lines.length),
    [3, 4, 5]
  )
  assert.deepEqual(
    limitHunks(hunks, 5).map((h) => h.lines.length),
    [3, 2]
  )
  assert.deepEqual(
    limitHunks(hunks, 3).map((h) => h.lines.length),
    [3]
  )
  assert.deepEqual(limitHunks(hunks, 0), [])
})

test('hunks can be staged for a tracked, unconflicted, unrenamed file with a change on that side', () => {
  const entry = {
    untracked: false,
    conflicted: false,
    origPath: null,
    index: null,
    worktree: 'modified' as const
  }
  assert.equal(canStageHunks(entry, 'worktree'), true)
  assert.equal(canStageHunks(entry, 'staged'), false, 'nothing staged')
  assert.equal(canStageHunks({ ...entry, index: 'added', worktree: null }, 'staged'), true)
  assert.equal(canStageHunks({ ...entry, untracked: true }, 'worktree'), false)
  assert.equal(canStageHunks({ ...entry, conflicted: true }, 'worktree'), false)
  assert.equal(canStageHunks({ ...entry, origPath: 'old.txt' }, 'worktree'), false)
  assert.equal(canStageHunks(undefined, 'worktree'), false)
})
