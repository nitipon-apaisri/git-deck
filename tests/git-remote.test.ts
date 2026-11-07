import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  checkout,
  createBranch,
  deleteBranch,
  deleteRemoteBranch,
  getRemoteBranchTarget,
  getRemoteTarget,
  listBranches,
  pull,
  push,
  renameBranch
} from '../src/main/git'
import { commit, emptyRepo, git, tempDir } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

/** A bare remote with one commit on main, and a clone of it. */
function cloned(): { remote: string; work: string } {
  const seed = emptyRepo()
  commit(seed, 'a.txt', 'first')
  const remote = tempDir('gitdeck-remote-')
  git(remote, 'init', '-q', '--bare', '-b', 'main')
  git(seed, 'remote', 'add', 'origin', remote)
  git(seed, 'push', '-q', 'origin', 'main')
  const work = tempDir('gitdeck-work-')
  git(work, 'clone', '-q', remote, '.')
  return { remote, work }
}

/** A second clone that pushes a commit, so `work` falls behind. */
function pushFromElsewhere(remote: string, file = 'other.txt'): void {
  const other = tempDir('gitdeck-other-')
  git(other, 'clone', '-q', remote, '.')
  commit(other, file, `from elsewhere ${file}`)
  git(other, 'push', '-q', 'origin', 'main')
}

// Branches

test('listBranches reports the current branch, tracking counts and remote branches', async () => {
  const { remote, work } = cloned()
  git(work, 'checkout', '-q', '-b', 'topic')
  commit(work, 'b.txt', 'topic work')
  git(work, 'push', '-q', '-u', 'origin', 'topic')
  commit(work, 'c.txt', 'unpushed')
  const other = tempDir()
  git(other, 'clone', '-q', remote, '.')
  git(other, 'checkout', '-q', 'topic')
  commit(other, 'd.txt', 'remote only')
  git(other, 'push', '-q', 'origin', 'topic')
  git(work, 'fetch', '-q')

  const list = await listBranches(work)
  assert.equal(list.current, 'topic')
  assert.equal(list.detached, false)
  assert.deepEqual(list.remotes, ['origin'])
  assert.deepEqual(list.remote, ['origin/main', 'origin/topic'])
  const topic = list.local.find((b) => b.name === 'topic')
  assert.deepEqual(
    {
      ahead: topic?.ahead,
      behind: topic?.behind,
      upstream: topic?.upstream,
      current: topic?.current
    },
    { ahead: 1, behind: 1, upstream: 'origin/topic', current: true }
  )
  assert.equal(list.local[0].name, 'topic', 'the current branch sorts first')
})

test('listBranches marks a branch whose upstream was deleted as gone', async () => {
  const { work } = cloned()
  git(work, 'checkout', '-q', '-b', 'topic')
  git(work, 'push', '-q', '-u', 'origin', 'topic')
  git(work, 'push', '-q', 'origin', '--delete', 'topic')
  git(work, 'fetch', '-q', '--prune')
  const topic = (await listBranches(work)).local.find((b) => b.name === 'topic')
  assert.equal(topic?.gone, true)
})

test('checkout switches branches, tracks a remote branch and detaches a commit', async () => {
  const { remote, work } = cloned()
  const other = tempDir()
  git(other, 'clone', '-q', remote, '.')
  git(other, 'checkout', '-q', '-b', 'feature')
  commit(other, 'f.txt', 'feature')
  git(other, 'push', '-q', 'origin', 'feature')
  git(work, 'fetch', '-q')

  await checkout(work, { kind: 'remote', name: 'origin/feature' })
  assert.equal(git(work, 'branch', '--show-current'), 'feature')
  assert.equal(git(work, 'config', 'branch.feature.remote'), 'origin')
  assert.equal(git(work, 'config', 'branch.feature.merge'), 'refs/heads/feature')

  await checkout(work, { kind: 'branch', name: 'main' })
  assert.equal(git(work, 'branch', '--show-current'), 'main')
  // The local branch exists now: choosing the remote one switches instead of failing.
  await checkout(work, { kind: 'remote', name: 'origin/feature' })
  assert.equal(git(work, 'branch', '--show-current'), 'feature')

  const first = git(work, 'rev-parse', 'main')
  await checkout(work, { kind: 'commit', hash: first })
  assert.equal(git(work, 'branch', '--show-current'), '')
  assert.equal((await listBranches(work)).detached, true)
})

test('checkout rejects unknown branches, bad hashes and option-like names', async () => {
  const { work } = cloned()
  await assert.rejects(checkout(work, { kind: 'branch', name: 'nope' }), /no branch named/)
  await assert.rejects(checkout(work, { kind: 'branch', name: '--orphan' }), /no branch named/)
  await assert.rejects(checkout(work, { kind: 'remote', name: 'origin/nope' }), /no remote branch/)
  await assert.rejects(checkout(work, { kind: 'commit', hash: '--detach' }), /Invalid commit hash/)
  await assert.rejects(checkout(work, { kind: 'commit', hash: 'zzzzzzz' }), /Invalid commit hash/)
  await assert.rejects(checkout(work, { kind: 'bogus' } as never), /Unknown checkout target/)
})

test('checkout stops on conflicting local changes and leaves them alone', async () => {
  const { work } = cloned()
  git(work, 'checkout', '-q', '-b', 'topic')
  commit(work, 'a.txt', 'topic version')
  git(work, 'checkout', '-q', 'main')
  writeFileSync(join(work, 'a.txt'), 'uncommitted\n')
  await assert.rejects(
    checkout(work, { kind: 'branch', name: 'topic' }),
    /overwritten|local changes/i
  )
  assert.equal(readFileSync(join(work, 'a.txt'), 'utf8'), 'uncommitted\n')
})

test('createBranch from HEAD, a branch or a commit, with or without switching', async () => {
  const { work } = cloned()
  const first = git(work, 'rev-parse', 'HEAD')
  await createBranch(work, 'one', null, false)
  assert.equal(git(work, 'branch', '--show-current'), 'main')
  assert.equal(git(work, 'rev-parse', 'one'), first)
  await createBranch(work, 'two', 'one', true)
  assert.equal(git(work, 'branch', '--show-current'), 'two')
  await createBranch(work, 'three', first.slice(0, 10), false)
  await createBranch(work, 'feature/nested', 'origin/main', false)
  assert.deepEqual((await listBranches(work)).local.map((b) => b.name).sort(), [
    'feature/nested',
    'main',
    'one',
    'three',
    'two'
  ])
})

test('createBranch rejects bad names, duplicates and unknown starting points', async () => {
  const { work } = cloned()
  for (const bad of ['', '-x', '--force', 'a b', 'a..b', 'a~1', 'x.lock', '@', '@{-1}', 'a:b'])
    await assert.rejects(createBranch(work, bad, null, false), /not a valid branch name/, bad)
  await assert.rejects(createBranch(work, 'main', null, false), /already exists/)
  await assert.rejects(createBranch(work, 'ok', 'nope', false), /not a branch or a commit/)
  await assert.rejects(createBranch(work, 'ok', '--detach', false), /not a branch or a commit/)
})

test('renameBranch moves the branch and its tracking, and refuses clashes', async () => {
  const { work } = cloned()
  await createBranch(work, 'old', null, true)
  await renameBranch(work, 'old', 'renamed')
  assert.equal(git(work, 'branch', '--show-current'), 'renamed')
  await assert.rejects(renameBranch(work, 'nope', 'x'), /no branch named/)
  await assert.rejects(renameBranch(work, 'renamed', '-bad'), /not a valid branch name/)
  await assert.rejects(renameBranch(work, 'renamed', 'main'), /already exists/i)
})

test('deleteBranch removes a merged branch and never the current one', async () => {
  const { work } = cloned()
  await createBranch(work, 'done', null, false)
  await deleteBranch(work, 'done')
  assert.ok(!(await listBranches(work)).local.some((b) => b.name === 'done'))
  await assert.rejects(deleteBranch(work, 'main'), /checked out/)
  await assert.rejects(deleteBranch(work, 'nope'), /no branch named/)
  await assert.rejects(deleteBranch(work, '--force'), /no branch named/)
})

test('deleteBranch refuses unmerged work instead of losing it', async () => {
  const { work } = cloned()
  await createBranch(work, 'wip', null, true)
  commit(work, 'w.txt', 'unmerged')
  git(work, 'checkout', '-q', 'main')
  await assert.rejects(deleteBranch(work, 'wip'), /not fully merged/)
  assert.ok((await listBranches(work)).local.some((b) => b.name === 'wip'))
})

test('deleteBranch with force removes unmerged work, but still not the current branch', async () => {
  const { work } = cloned()
  await createBranch(work, 'wip', null, true)
  commit(work, 'w.txt', 'unmerged')
  git(work, 'checkout', '-q', 'main')
  await deleteBranch(work, 'wip', true)
  assert.ok(!(await listBranches(work)).local.some((b) => b.name === 'wip'))
  await assert.rejects(deleteBranch(work, 'main', true), /checked out/)
})

test('deleteRemoteBranch removes a branch on the remote and leaves the local one', async () => {
  const { work, remote } = cloned()
  await createBranch(work, 'topic', null, true)
  commit(work, 't.txt', 'topic work')
  git(work, 'push', '-q', 'origin', 'topic')
  git(work, 'checkout', '-q', 'main')
  assert.match(git(remote, 'branch', '--list', 'topic'), /topic/)
  assert.deepEqual(await getRemoteBranchTarget(work, 'origin/topic'), {
    remote: 'origin',
    branch: 'topic',
    url: git(work, 'remote', 'get-url', 'origin')
  })
  await deleteRemoteBranch(work, 'origin/topic')
  assert.equal(git(remote, 'branch', '--list', 'topic'), '')
  assert.ok((await listBranches(work)).local.some((b) => b.name === 'topic'))
})

test('deleteRemoteBranch refuses names that are not a remote branch', async () => {
  const { work } = cloned()
  await assert.rejects(deleteRemoteBranch(work, 'main'), /not a remote branch/)
  await assert.rejects(deleteRemoteBranch(work, 'origin/nope'), /no remote branch/)
  await assert.rejects(deleteRemoteBranch(work, 'origin/--force'), /not a valid branch name/)
  await assert.rejects(deleteRemoteBranch(work, 'origin/HEAD'), /./)
})

// Pull

test('pull fast-forwards by default', async () => {
  const { remote, work } = cloned()
  pushFromElsewhere(remote)
  git(work, 'fetch', '-q')
  const lines: string[] = []
  await pull(work, 'ff-only', {}, (l) => lines.push(l))
  assert.equal(readFileSync(join(work, 'other.txt'), 'utf8'), 'from elsewhere other.txt\n')
  assert.equal(git(work, 'rev-parse', 'HEAD'), git(work, 'rev-parse', 'origin/main'))
})

test('pull explains a diverged branch and leaves it unchanged', async () => {
  const { remote, work } = cloned()
  pushFromElsewhere(remote)
  commit(work, 'mine.txt', 'local only')
  const before = git(work, 'rev-parse', 'HEAD')
  await assert.rejects(pull(work, 'ff-only'), /diverged/)
  assert.equal(git(work, 'rev-parse', 'HEAD'), before)
  assert.equal(git(work, 'status', '--porcelain'), '')
})

test('merge pull joins a diverged branch with a merge commit, whatever pull.rebase says', async () => {
  const { remote, work } = cloned()
  pushFromElsewhere(remote)
  commit(work, 'mine.txt', 'local only')
  git(work, 'config', 'pull.rebase', 'true')
  await pull(work, 'merge')
  assert.equal(git(work, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3)
  assert.equal(readFileSync(join(work, 'other.txt'), 'utf8').length > 0, true)
  assert.equal(readFileSync(join(work, 'mine.txt'), 'utf8').length > 0, true)
})

test('pull needs a checked-out branch with an upstream', async () => {
  const { work } = cloned()
  await createBranch(work, 'local-only', null, true)
  await assert.rejects(pull(work, 'ff-only'), /no upstream/)
  git(work, 'checkout', '-q', '--detach')
  await assert.rejects(pull(work, 'ff-only'), /detached/)
  await assert.rejects(pull(work, 'rebase' as never), /Unknown pull mode/)
  const lonely = emptyRepo()
  commit(lonely, 'a.txt', 'x')
  await assert.rejects(pull(lonely, 'ff-only'), /no remote/)
})

// Push

test('push sets the upstream for a new branch, then pushes plainly', async () => {
  const { remote, work } = cloned()
  await createBranch(work, 'topic', null, true)
  commit(work, 't.txt', 'topic')
  assert.deepEqual(await getRemoteTarget(work).then((t) => t.hasUpstream), false)
  const lines: string[] = []
  await push(work, {}, {}, (l) => lines.push(l))
  assert.ok(lines.length > 0, 'progress lines are reported')
  assert.equal(git(remote, 'rev-parse', 'topic'), git(work, 'rev-parse', 'HEAD'))
  assert.equal(git(work, 'config', 'branch.topic.remote'), 'origin')
  const target = await getRemoteTarget(work)
  assert.equal(target.hasUpstream, true)

  commit(work, 't2.txt', 'second')
  await push(work)
  assert.equal(git(remote, 'rev-parse', 'topic'), git(work, 'rev-parse', 'HEAD'))
})

test('a rejected push says why, and a lease push respects what the remote has', async () => {
  const { remote, work } = cloned()
  pushFromElsewhere(remote)
  commit(work, 'mine.txt', 'local only')
  await assert.rejects(push(work), /rejected|fetch first|non-fast-forward/)
  // The lease is the last fetched state, which is stale: still refused.
  await assert.rejects(push(work, { forceWithLease: true }), /stale info|rejected/)
  const remoteHead = git(remote, 'rev-parse', 'main')
  git(work, 'fetch', '-q')
  await push(work, { forceWithLease: true })
  assert.notEqual(git(remote, 'rev-parse', 'main'), remoteHead)
  assert.equal(git(remote, 'rev-parse', 'main'), git(work, 'rev-parse', 'HEAD'))
})

test('push picks origin among several remotes and refuses to guess otherwise', async () => {
  const { work } = cloned()
  const extra = tempDir('gitdeck-extra-')
  git(extra, 'init', '-q', '--bare', '-b', 'main')
  git(work, 'remote', 'add', 'backup', extra)
  await createBranch(work, 'topic', null, true)
  assert.equal((await getRemoteTarget(work)).remote, 'origin')
  git(work, 'remote', 'rename', 'origin', 'upstream')
  await assert.rejects(getRemoteTarget(work), /Several remotes/)
})

test('push and pull leave no token in the repository config', async () => {
  const { work } = cloned()
  await createBranch(work, 'topic', null, true)
  const secret = 'glpat-SECRET-TOKEN-123'
  const env = {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://example.invalid/.extraHeader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`oauth2:${secret}`).toString('base64')}`
  }
  await push(work, {}, env)
  await pull(work, 'ff-only', env)
  const config = readFileSync(join(work, '.git', 'config'), 'utf8')
  assert.ok(
    !config.includes(secret) && !config.includes('extraHeader') && !config.includes('Basic')
  )
})
