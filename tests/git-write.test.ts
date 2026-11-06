import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  createCommit,
  discardPaths,
  getDiff,
  getStatus,
  parseStatus,
  stageAll,
  stagePaths,
  unstagePaths
} from '../src/main/git'
import { parseUnifiedDiff } from '../src/shared/diff'
import { commit, emptyRepo, git } from './helpers'

// The product code inherits the environment, so give it an identity and no user config.
process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

const write = (dir: string, file: string, text: string): void => {
  mkdirSync(join(dir, file, '..'), { recursive: true })
  writeFileSync(join(dir, file), text)
}

test('parseStatus reads branch, changes, renames, conflicts and untracked files', () => {
  const raw = [
    '# branch.oid abc',
    '# branch.head main',
    '1 M. N... 100644 100644 100644 aaa bbb staged.txt',
    '1 .M N... 100644 100644 100644 aaa bbb worktree file.txt',
    '1 AM N... 000000 100644 100644 000 bbb both.txt',
    '2 R. N... 100644 100644 100644 aaa bbb R100 new.txt',
    'old.txt',
    'u UU N... 100644 100644 100644 100644 a b c conflict.txt',
    '? new dir/untracked.txt',
    ''
  ].join('\0')
  const status = parseStatus(raw)
  assert.equal(status.branch, 'main')
  const by = Object.fromEntries(status.entries.map((e) => [e.path, e]))
  assert.deepEqual([by['staged.txt'].index, by['staged.txt'].worktree], ['modified', null])
  assert.equal(by['worktree file.txt'].worktree, 'modified')
  assert.deepEqual([by['both.txt'].index, by['both.txt'].worktree], ['added', 'modified'])
  assert.equal(by['new.txt'].index, 'renamed')
  assert.equal(by['new.txt'].origPath, 'old.txt')
  assert.equal(by['conflict.txt'].conflicted, true)
  assert.equal(by['new dir/untracked.txt'].untracked, true)
  assert.equal(parseStatus('# branch.head (detached)\0').branch, null)
  assert.deepEqual(parseStatus('').entries, [])
})

test('parseUnifiedDiff numbers lines and counts changes', () => {
  const patch = [
    'diff --git a/f b/f',
    '--- a/f',
    '+++ b/f',
    '@@ -1,3 +1,3 @@',
    ' one',
    '-two',
    '+TWO',
    ' three',
    '\\ No newline at end of file',
    ''
  ].join('\n')
  const diff = parseUnifiedDiff('f', patch)
  assert.equal(diff.additions, 1)
  assert.equal(diff.deletions, 1)
  assert.equal(diff.hunks.length, 1)
  const lines = diff.hunks[0].lines
  assert.deepEqual(
    lines.map((l) => [l.type, l.oldNo, l.newNo]),
    [
      ['context', 1, 1],
      ['del', 2, null],
      ['add', null, 2],
      ['context', 3, 3],
      ['note', null, null]
    ]
  )
  assert.equal(parseUnifiedDiff('b', 'Binary files a/b and b/b differ\n').binary, true)
  assert.equal(parseUnifiedDiff('big', 'x'.repeat(2 * 1024 * 1024)).tooLarge, true)
})

test('getStatus lists staged, unstaged and untracked files one by one', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  write(dir, 'a.txt', 'changed\n')
  write(dir, 'sub/new.txt', 'new\n')
  write(dir, 'staged.txt', 'staged\n')
  git(dir, 'add', 'staged.txt')
  const status = await getStatus(dir)
  assert.equal(status.branch, 'main')
  const by = Object.fromEntries(status.entries.map((e) => [e.path, e]))
  assert.equal(by['a.txt'].worktree, 'modified')
  assert.equal(by['staged.txt'].index, 'added')
  assert.equal(by['sub/new.txt'].untracked, true)
})

test('stage and unstage move a file between the lists', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  write(dir, 'a.txt', 'changed\n')
  await stagePaths(dir, ['a.txt'])
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), 'a.txt')
  await unstagePaths(dir, ['a.txt'])
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), '')
  assert.equal(git(dir, 'diff', '--name-only'), 'a.txt')
})

test('unstage works before the first commit', async () => {
  const dir = emptyRepo()
  write(dir, 'a.txt', 'x\n')
  await stagePaths(dir, ['a.txt'])
  await unstagePaths(dir, ['a.txt'])
  assert.equal(git(dir, 'status', '--porcelain'), '?? a.txt')
})

test('stage handles deletions', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  rmSync(join(dir, 'a.txt'))
  await stagePaths(dir, ['a.txt'])
  assert.equal(git(dir, 'diff', '--cached', '--name-status'), 'D\ta.txt')
})

test('unstaging a rename restores both sides', async () => {
  const dir = emptyRepo()
  commit(dir, 'b.txt', 'second')
  renameSync(join(dir, 'b.txt'), join(dir, 'c.txt'))
  git(dir, 'add', '-A')
  const status = await getStatus(dir)
  const renamed = status.entries.find((e) => e.path === 'c.txt')
  assert.equal(renamed?.index, 'renamed')
  await unstagePaths(dir, ['c.txt'])
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), '')
})

test('stageAll stages everything including new files', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  write(dir, 'a.txt', 'changed\n')
  write(dir, 'n.txt', 'n\n')
  await stageAll(dir)
  assert.equal(git(dir, 'diff', '--cached', '--name-only').split('\n').sort().join(), 'a.txt,n.txt')
})

test('paths git does not list are rejected, including flags and outside paths', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  await assert.rejects(stagePaths(dir, ['--all']), /has no changes/)
  await assert.rejects(stagePaths(dir, ['../outside.txt']), /has no changes/)
  await assert.rejects(stagePaths(dir, ['a.txt']), /has no changes/)
  await assert.rejects(stagePaths(dir, []), /No files selected/)
  await assert.rejects(discardPaths(dir, ['-fd']), /has no changes/)
})

test('discard restores tracked files, deletes untracked ones and keeps staged work', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  commit(dir, 'keep.txt', 'keep')
  write(dir, 'a.txt', 'changed\n')
  write(dir, 'junk.txt', 'junk\n')
  write(dir, 'keep.txt', 'staged\n')
  git(dir, 'add', 'keep.txt')
  await discardPaths(dir, ['a.txt', 'junk.txt'])
  assert.equal(readFileSync(join(dir, 'a.txt'), 'utf8'), 'first\n')
  assert.equal(existsSync(join(dir, 'junk.txt')), false)
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), 'keep.txt')
})

test('getDiff covers worktree, staged, untracked, commit and binary files', async () => {
  const dir = emptyRepo()
  const hash = commit(dir, 'a.txt', 'first')
  write(dir, 'a.txt', 'first\nsecond\n')
  const worktree = await getDiff(dir, { source: 'worktree', path: 'a.txt' })
  assert.equal(worktree.additions, 1)
  assert.equal(worktree.hunks[0].lines.at(-1)?.text, 'second')

  await stagePaths(dir, ['a.txt'])
  const staged = await getDiff(dir, { source: 'staged', path: 'a.txt' })
  assert.equal(staged.additions, 1)
  // Staged work leaves nothing in the work-tree diff.
  assert.equal((await getDiff(dir, { source: 'worktree', path: 'a.txt' })).hunks.length, 0)

  write(dir, 'new.txt', 'one\ntwo\n')
  const untracked = await getDiff(dir, { source: 'worktree', path: 'new.txt' })
  assert.equal(untracked.additions, 2)
  assert.equal(untracked.deletions, 0)

  writeFileSync(join(dir, 'bin.dat'), Buffer.from([0, 1, 2, 0, 255]))
  const binary = await getDiff(dir, { source: 'worktree', path: 'bin.dat' })
  assert.equal(binary.binary, true)

  const old = await getDiff(dir, { source: 'commit', hash, path: 'a.txt' })
  assert.equal(old.additions, 1)
  await assert.rejects(
    getDiff(dir, { source: 'commit', hash: 'nope', path: 'a.txt' }),
    /Invalid commit hash/
  )
})

test('createCommit commits staged work, keeps # lines and supports amend', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  write(dir, 'a.txt', 'changed\n')
  await stagePaths(dir, ['a.txt'])
  await createCommit(dir, '  Subject line\n\n# not a comment\nbody  ', false)
  assert.equal(git(dir, 'log', '-1', '--format=%B').trim(), 'Subject line\n\n# not a comment\nbody')
  const count = git(dir, 'rev-list', '--count', 'HEAD')

  await createCommit(dir, 'Reworded', true)
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'Reworded')
  assert.equal(git(dir, 'rev-list', '--count', 'HEAD'), count)

  write(dir, 'b.txt', 'b\n')
  await stagePaths(dir, ['b.txt'])
  await createCommit(dir, '', true)
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'Reworded')
  assert.equal(
    git(dir, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort().join(),
    'a.txt,b.txt'
  )
})

test('createCommit refuses an empty message and an empty index', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  await assert.rejects(createCommit(dir, '   ', false), /Write a commit message/)
  await assert.rejects(createCommit(dir, 'nothing staged', false), /nothing|no changes/i)
})
