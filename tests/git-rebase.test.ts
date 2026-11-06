import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  abortOperation,
  continueOperation,
  getDiff,
  getOperation,
  rebase,
  skipOperation,
  stageHunk,
  unstageHunk
} from '../src/main/git'
import { hunkFingerprint } from '../src/shared/diff'
import type { HunkRequest } from '../src/shared/types'
import { commit, emptyRepo, git, tempDir } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

/** main has moved on by `main.txt`, feature (two commits) branched from the first commit. */
function divergedRepo(): { dir: string; mainHash: string } {
  const dir = emptyRepo()
  commit(dir, 'base.txt', 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  commit(dir, 'f1.txt', 'feature one')
  commit(dir, 'f2.txt', 'feature two')
  git(dir, 'checkout', '-q', 'main')
  const mainHash = commit(dir, 'main.txt', 'main work')
  git(dir, 'checkout', '-q', 'feature')
  return { dir, mainHash }
}

/** Both branches rewrite shared.txt in two commits each, so every replayed commit conflicts. */
function conflictRepo(): string {
  const dir = emptyRepo()
  commit(dir, 'shared.txt', 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  commit(dir, 'shared.txt', 'feature one')
  commit(dir, 'shared.txt', 'feature two')
  git(dir, 'checkout', '-q', 'main')
  commit(dir, 'shared.txt', 'main side')
  git(dir, 'checkout', '-q', 'feature')
  return dir
}

const resolveWith = (dir: string, text: string): void =>
  writeFileSync(join(dir, 'shared.txt'), `${text}\n`)

// Rebase

test('rebase: a clean rebase replays the branch on top of the target', async () => {
  const { dir, mainHash } = divergedRepo()
  assert.deepEqual(await rebase(dir, 'main'), { conflicted: false })
  assert.equal(git(dir, 'merge-base', 'main', 'feature'), mainHash)
  assert.deepEqual(git(dir, 'log', '--format=%s', 'main..feature').split('\n'), [
    'feature two',
    'feature one'
  ])
  assert.equal(await getOperation(dir), null)
})

test('rebase: onto a commit hash and onto a remote branch', async () => {
  const { dir, mainHash } = divergedRepo()
  assert.deepEqual(await rebase(dir, mainHash), { conflicted: false })
  assert.equal(git(dir, 'merge-base', 'main', 'feature'), mainHash)

  const second = divergedRepo()
  const bare = tempDir('gitdeck-bare-')
  git(bare, 'init', '-q', '--bare', '-b', 'main')
  git(second.dir, 'remote', 'add', 'origin', bare)
  git(second.dir, 'push', '-q', 'origin', 'main')
  git(second.dir, 'fetch', '-q', 'origin')
  assert.deepEqual(await rebase(second.dir, 'origin/main'), { conflicted: false })
  assert.equal(git(second.dir, 'merge-base', 'origin/main', 'feature'), second.mainHash)
})

test('rebase: bad input, a detached HEAD, local edits and the same branch are refused', async () => {
  const { dir } = divergedRepo()
  await assert.rejects(rebase(dir, '--abort'), /Invalid branch or commit/)
  await assert.rejects(rebase(dir, '-i'), /Invalid branch or commit/)
  await assert.rejects(rebase(dir, 'nope'), /no branch or commit named/)
  await assert.rejects(rebase(dir, 'abcdef0'), /no branch or commit named/)
  await assert.rejects(rebase(dir, 'feature'), /onto itself/)
  writeFileSync(join(dir, 'f1.txt'), 'dirty\n')
  await assert.rejects(rebase(dir, 'main'), /Commit or stash/)
  git(dir, 'checkout', '--', '.')
  writeFileSync(join(dir, 'untracked.txt'), 'new\n')
  assert.deepEqual(await rebase(dir, 'main'), { conflicted: false }, 'untracked files are fine')
  git(dir, 'checkout', '-q', '--detach')
  await assert.rejects(rebase(dir, 'main'), /detached/)
})

test('rebase: a conflict stops, shows as a rebase and abort restores the branch', async () => {
  const dir = conflictRepo()
  const before = git(dir, 'rev-parse', 'HEAD')
  assert.deepEqual(await rebase(dir, 'main'), { conflicted: true })
  const state = await getOperation(dir)
  assert.equal(state?.kind, 'rebase')
  assert.deepEqual(state?.conflicted, ['shared.txt'])
  assert.match(state?.target ?? '', /^[0-9a-f]{7}$/)
  await assert.rejects(rebase(dir, 'main'), /already in progress/)
  await abortOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before)
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD'), 'feature')
})

test('rebase: each conflicting commit is fixed and continued until the rebase ends', async () => {
  const dir = conflictRepo()
  await rebase(dir, 'main')
  await assert.rejects(continueOperation(dir), /conflict markers/)
  resolveWith(dir, 'one fixed')
  await continueOperation(dir)
  // The second commit conflicts in turn: still a rebase, not an error.
  const next = await getOperation(dir)
  assert.equal(next?.kind, 'rebase')
  assert.deepEqual(next?.conflicted, ['shared.txt'])
  resolveWith(dir, 'two fixed')
  await continueOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD'), 'feature')
  assert.deepEqual(git(dir, 'log', '--format=%s', 'main..feature').split('\n'), [
    'feature two',
    'feature one'
  ])
})

test('rebase: skip drops the commit that conflicts', async () => {
  const dir = conflictRepo()
  await rebase(dir, 'main')
  await skipOperation(dir)
  // Skipping the first commit leaves the second, which conflicts again.
  assert.equal((await getOperation(dir))?.kind, 'rebase')
  await skipOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(git(dir, 'rev-parse', 'feature'), git(dir, 'rev-parse', 'main'))
})

test('skip only works on a rebase', async () => {
  const dir = conflictRepo()
  await assert.rejects(skipOperation(dir), /no merge, cherry-pick, revert or rebase/)
})

test('skip refuses a merge in progress', async () => {
  const dir = conflictRepo()
  git(dir, 'checkout', '-q', 'main')
  try {
    git(dir, 'merge', '--no-edit', 'feature')
  } catch {
    // The conflict is the point.
  }
  assert.equal((await getOperation(dir))?.kind, 'merge')
  await assert.rejects(skipOperation(dir), /Only a rebase/)
})

// Hunk staging

const LINES = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`)

function hunkRepo(): string {
  const dir = emptyRepo()
  writeFileSync(join(dir, 'f.txt'), LINES.join('\n') + '\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'init')
  // Two edits far apart make two hunks.
  const edited = [...LINES]
  edited[1] = 'line 2 changed'
  edited[37] = 'line 38 changed'
  writeFileSync(join(dir, 'f.txt'), edited.join('\n') + '\n')
  return dir
}

async function hunks(dir: string, source: 'worktree' | 'staged'): Promise<HunkRequest[]> {
  const diff = await getDiff(dir, { source, path: 'f.txt' })
  return diff.hunks.map((h, index) => ({
    path: 'f.txt',
    source,
    index,
    fingerprint: hunkFingerprint(h.lines)
  }))
}

test('hunks: one hunk is staged and unstaged without touching the other', async () => {
  const dir = hunkRepo()
  const [first, second] = await hunks(dir, 'worktree')
  assert.ok(first && second)
  await stageHunk(dir, first)
  assert.match(git(dir, 'diff', '--cached'), /line 2 changed/)
  assert.doesNotMatch(git(dir, 'diff', '--cached'), /line 38 changed/)
  assert.match(git(dir, 'diff'), /line 38 changed/)
  assert.doesNotMatch(git(dir, 'diff'), /line 2 changed/)

  const [staged] = await hunks(dir, 'staged')
  await unstageHunk(dir, staged)
  assert.equal(git(dir, 'diff', '--cached'), '')
  assert.match(git(dir, 'diff'), /line 2 changed/)
  assert.match(git(dir, 'diff'), /line 38 changed/)
})

test('hunks: the second hunk can be staged alone, and the work tree is never changed', async () => {
  const dir = hunkRepo()
  const before = git(dir, 'diff')
  const [, second] = await hunks(dir, 'worktree')
  await stageHunk(dir, second)
  assert.match(git(dir, 'diff', '--cached'), /line 38 changed/)
  assert.doesNotMatch(git(dir, 'diff', '--cached'), /line 2 changed/)
  assert.equal(git(dir, 'diff', 'HEAD'), before, 'the files on disk are the same')
})

test('hunks: a diff that changed since it was read is refused', async () => {
  const dir = hunkRepo()
  const [first] = await hunks(dir, 'worktree')
  const edited = [...LINES]
  edited[1] = 'line 2 changed differently'
  edited[37] = 'line 38 changed'
  writeFileSync(join(dir, 'f.txt'), edited.join('\n') + '\n')
  await assert.rejects(stageHunk(dir, first), /changed since/)
  await assert.rejects(stageHunk(dir, { ...first, index: 9 }), /changed since/)
  assert.equal(git(dir, 'diff', '--cached'), '')
})

test('hunks: bad requests, untracked, conflicted and renamed files are refused', async () => {
  const dir = hunkRepo()
  const [first] = await hunks(dir, 'worktree')
  await assert.rejects(stageHunk(dir, { ...first, source: 'staged' }), /Only an unstaged hunk/)
  await assert.rejects(unstageHunk(dir, first), /Only a staged hunk/)
  await assert.rejects(stageHunk(dir, { ...first, index: -1 }), /Invalid hunk/)
  await assert.rejects(stageHunk(dir, { ...first, index: 1.5 }), /Invalid hunk/)
  await assert.rejects(stageHunk(dir, { ...first, fingerprint: '--all' }), /Invalid hunk/)
  await assert.rejects(stageHunk(dir, { ...first, path: '--cached' }), /has no changes/)
  await assert.rejects(stageHunk(dir, { ...first, path: '../outside.txt' }), /has no changes/)
  await assert.rejects(unstageHunk(dir, { ...first, source: 'staged' }), /nothing staged/)

  writeFileSync(join(dir, 'new.txt'), 'a\nb\n')
  await assert.rejects(
    stageHunk(dir, { path: 'new.txt', source: 'worktree', index: 0, fingerprint: '00000000' }),
    /tracked file/
  )

  git(dir, 'checkout', '--', '.')
  git(dir, 'mv', 'f.txt', 'g.txt')
  await assert.rejects(
    unstageHunk(dir, { path: 'g.txt', source: 'staged', index: 0, fingerprint: '00000000' }),
    /renamed file/
  )
})

test('hunks: a staged new file and a deleted file round trip', async () => {
  const dir = hunkRepo()
  git(dir, 'checkout', '--', '.')
  writeFileSync(join(dir, 'new.txt'), 'one\ntwo\n')
  git(dir, 'add', 'new.txt')
  const diff = await getDiff(dir, { source: 'staged', path: 'new.txt' })
  await unstageHunk(dir, {
    path: 'new.txt',
    source: 'staged',
    index: 0,
    fingerprint: hunkFingerprint(diff.hunks[0].lines)
  })
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), '')

  git(dir, 'rm', '-q', '--', 'f.txt')
  const staged = await getDiff(dir, { source: 'staged', path: 'f.txt' })
  await unstageHunk(dir, {
    path: 'f.txt',
    source: 'staged',
    index: 0,
    fingerprint: hunkFingerprint(staged.hunks[0].lines)
  })
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), '')
})

test('hunks: a file without a trailing newline keeps its marker', async () => {
  const dir = emptyRepo()
  writeFileSync(join(dir, 'n.txt'), 'a\nb')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'init')
  writeFileSync(join(dir, 'n.txt'), 'a\nc')
  const diff = await getDiff(dir, { source: 'worktree', path: 'n.txt' })
  await stageHunk(dir, {
    path: 'n.txt',
    source: 'worktree',
    index: 0,
    fingerprint: hunkFingerprint(diff.hunks[0].lines)
  })
  assert.equal(git(dir, 'diff'), '')
  assert.match(git(dir, 'diff', '--cached'), /No newline at end of file/)
})
