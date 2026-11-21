import assert from 'node:assert/strict'
import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { blame, fileHistory, HISTORY_PAGE_SIZE } from '../src/main/git'
import { parseBlame } from '../src/shared/blame'
import { commit, emptyRepo, git } from './helpers'

const H1 = 'a'.repeat(40)
const H2 = 'b'.repeat(40)
const SAMPLE = [
  `${H1} 1 1 2`,
  'author Ann',
  'author-time 100',
  'boundary',
  'filename f.txt',
  '\tone',
  `${H1} 2 2`,
  '\ttwo',
  `${'0'.repeat(40)} 3 3 1`,
  'author Not Committed Yet',
  'author-time 300',
  'filename f.txt',
  '\tthree',
  `${H2} 1 4 1`,
  'author Bob',
  'author-time 200',
  'filename f.txt',
  '\tfour'
].join('\n')

test('parseBlame reads groups, repeated hashes, boundary and uncommitted lines', () => {
  const lines = parseBlame(SAMPLE)
  assert.deepEqual(
    lines.map((l) => [l.line, l.text, l.author, l.date, l.uncommitted, l.boundary]),
    [
      [1, 'one', 'Ann', 100, false, true],
      [2, 'two', 'Ann', 100, false, true],
      [3, 'three', 'Not Committed Yet', 300, true, false],
      [4, 'four', 'Bob', 200, false, false]
    ]
  )
  assert.deepEqual(parseBlame(''), [])
})

test('fileHistory follows a rename and pages', async () => {
  const dir = emptyRepo()
  commit(dir, 'old.txt', 'first')
  writeFileSync(join(dir, 'old.txt'), 'changed\n')
  git(dir, 'commit', '-qam', 'edit')
  git(dir, 'mv', 'old.txt', 'new.txt')
  git(dir, 'commit', '-qm', 'rename')
  const page = await fileHistory(dir, 'new.txt', 0)
  assert.deepEqual(
    page.entries.map((e) => [e.subject, e.path]),
    [
      ['rename', 'new.txt'],
      ['edit', 'old.txt'],
      ['first', 'old.txt']
    ]
  )
  assert.equal(page.hasMore, false)
  assert.deepEqual((await fileHistory(dir, 'new.txt', 1)).entries, [])
})

test('fileHistory pages at the page size and lists a deleted file', async () => {
  const dir = emptyRepo()
  for (let i = 0; i < HISTORY_PAGE_SIZE + 1; i++) {
    writeFileSync(join(dir, 'f.txt'), `${i}\n`)
    git(dir, 'add', '.')
    git(dir, 'commit', '-qm', `c${i}`)
  }
  git(dir, 'rm', '-q', 'f.txt')
  git(dir, 'commit', '-qm', 'gone')
  const first = await fileHistory(dir, 'f.txt', 0)
  assert.equal(first.entries.length, HISTORY_PAGE_SIZE)
  assert.equal(first.hasMore, true)
  assert.equal(first.entries[0].subject, 'gone')
  const second = await fileHistory(dir, 'f.txt', 1)
  assert.equal(second.entries.length, 2)
  assert.equal(second.hasMore, false)
})

test('blame marks boundary, committed and uncommitted lines', async () => {
  const dir = emptyRepo()
  const first = commit(dir, 'f.txt', 'first')
  writeFileSync(join(dir, 'f.txt'), 'first\nsecond\n')
  git(dir, 'commit', '-qam', 'second')
  const second = git(dir, 'rev-parse', 'HEAD')
  writeFileSync(join(dir, 'f.txt'), 'first\nsecond\nthird\n')

  const atHead = await blame(dir, 'f.txt', second)
  assert.equal(atHead.binary, false)
  assert.deepEqual(
    atHead.lines.map((l) => [l.text, l.hash, l.boundary, l.uncommitted]),
    [
      ['first', first, true, false],
      ['second', second, false, false]
    ]
  )
  const worktree = await blame(dir, 'f.txt', null)
  assert.equal(worktree.lines.length, 3)
  assert.equal(worktree.lines[2].uncommitted, true)
  await assert.rejects(blame(dir, 'f.txt', '--oops'), /Invalid commit hash/)
})

test('blame reports a binary file without lines', async () => {
  const dir = emptyRepo()
  writeFileSync(join(dir, 'b.dat'), Buffer.from([0, 1, 2, 0, 255, 10, 0]))
  git(dir, 'add', '.')
  git(dir, 'commit', '-qm', 'bin')
  assert.deepEqual(await blame(dir, 'b.dat', null), { binary: true, lines: [] })
})

test('blame of a path that is gone from the revision fails', async () => {
  const dir = emptyRepo()
  commit(dir, 'f.txt', 'first')
  const head = git(dir, 'rev-parse', 'HEAD')
  renameSync(join(dir, 'f.txt'), join(dir, 'g.txt'))
  rmSync(join(dir, 'g.txt'))
  await assert.rejects(blame(dir, 'nope.txt', head))
})
