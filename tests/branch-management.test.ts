import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as realGit from '../src/main/git'
import { createService, type Ui } from '../src/main/service'
import { Store, type TokenCrypto } from '../src/main/store'
import { commit, emptyRepo, git, tempDir } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

const crypto: TokenCrypto = {
  isAvailable: () => true,
  encrypt: (s) => Buffer.from(s),
  decrypt: (b) => b.toString()
}

/** A clone of a bare remote, plus a second clone that can move the remote ahead. */
async function setup(confirms: boolean[] = []) {
  const seed = emptyRepo()
  commit(seed, 'a.txt', 'first')
  const remote = tempDir('gitdeck-remote-')
  git(remote, 'init', '-q', '--bare', '-b', 'main')
  git(seed, 'remote', 'add', 'origin', remote)
  git(seed, 'push', '-q', 'origin', 'main')
  const dir = tempDir('gitdeck-work-')
  git(dir, 'clone', '-q', remote, '.')
  const other = tempDir('gitdeck-other-')
  git(other, 'clone', '-q', remote, '.')
  const store = new Store(tempDir(), crypto)
  await store.load()
  await store.setLink('acc1:1', dir)
  const ui: Ui = {
    pickFolder: async () => null,
    confirm: async () => confirms.shift() ?? false,
    reveal: () => {},
    openExternal: async () => {}
  }
  const { api } = createService({
    store,
    ui,
    emitProgress: () => {},
    emitRepoChanged: () => {},
    git: realGit
  })
  return { api, dir, other, remote }
}

test('fast-forward moves a branch that is behind, without checking it out', async () => {
  const s = await setup()
  git(s.dir, 'branch', 'topic', 'main')
  git(s.dir, 'push', '-q', '-u', 'origin', 'topic')
  git(s.other, 'checkout', '-q', '-b', 'topic', 'origin/main')
  const tip = commit(s.other, 'b.txt', 'ahead')
  git(s.other, 'push', '-q', 'origin', 'topic')
  await s.api.local.fastForwardBranch(s.dir, 'topic')
  assert.equal(git(s.dir, 'rev-parse', 'topic'), tip)
  assert.equal(git(s.dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main')
})

test('fast-forward is refused when the branches diverged, with no token in the error', async () => {
  const s = await setup()
  git(s.dir, 'branch', 'topic', 'main')
  git(s.dir, 'push', '-q', '-u', 'origin', 'topic')
  git(s.other, 'checkout', '-q', '-b', 'topic', 'origin/main')
  commit(s.other, 'b.txt', 'remote side')
  git(s.other, 'push', '-q', 'origin', 'topic')
  git(s.dir, 'checkout', '-q', 'topic')
  const local = commit(s.dir, 'c.txt', 'local side')
  git(s.dir, 'checkout', '-q', 'main')
  await assert.rejects(s.api.local.fastForwardBranch(s.dir, 'topic'), /cannot be fast-forwarded/)
  assert.equal(git(s.dir, 'rev-parse', 'topic'), local)
  await assert.rejects(s.api.local.fastForwardBranch(s.dir, 'main'), /checked out/)
  git(s.dir, 'branch', 'lonely')
  await assert.rejects(s.api.local.fastForwardBranch(s.dir, 'lonely'), /no upstream/)
})

test('pushBranch sets the upstream when there is none', async () => {
  const s = await setup()
  git(s.dir, 'branch', 'fresh')
  await s.api.local.pushBranch(s.dir, 'fresh')
  assert.equal(git(s.dir, 'config', 'branch.fresh.merge'), 'refs/heads/fresh')
  assert.match(git(s.remote, 'branch', '--list', 'fresh'), /fresh/)
})

test('bulk delete reports each branch, keeps going after a failure and protects current and default', async () => {
  const s = await setup([true])
  git(s.dir, 'branch', 'merged')
  git(s.dir, 'checkout', '-q', '-b', 'unmerged')
  commit(s.dir, 'u.txt', 'unmerged work')
  git(s.dir, 'checkout', '-q', '-b', 'current', 'main')
  const items = ['merged', 'unmerged', 'current', 'main', 'ghost'].map((name) => ({
    name,
    remote: false
  }))
  const results = await s.api.local.deleteBranches(s.dir, items, false)
  assert.ok(results)
  const by = Object.fromEntries(results.map((r) => [r.name, r]))
  assert.equal(by.merged.ok, true)
  assert.equal(by.unmerged.ok, false)
  assert.match(by.unmerged.error ?? '', /not fully merged/)
  assert.match(by.current.error ?? '', /checked-out/)
  assert.match(by.main.error ?? '', /default/)
  assert.equal(by.ghost.ok, false)
  // Force deletes the unmerged one.
  const forced = await s.api.local.deleteBranches(
    s.dir,
    [{ name: 'unmerged', remote: false }],
    true
  )
  assert.equal(forced?.[0].ok, true)
  assert.equal(git(s.dir, 'branch', '--list', 'unmerged'), '')
})

test('remote bulk delete asks with the count, and does nothing when declined', async () => {
  const s = await setup([false, true])
  for (const b of ['x', 'y']) {
    git(s.dir, 'branch', b)
    git(s.dir, 'push', '-q', 'origin', b)
  }
  git(s.dir, 'fetch', '-q')
  const items = [
    { name: 'origin/x', remote: true },
    { name: 'origin/y', remote: true },
    { name: 'origin/main', remote: true }
  ]
  assert.equal(await s.api.local.deleteBranches(s.dir, items, false), null)
  assert.match(git(s.remote, 'branch', '--list', 'x'), /x/)
  const results = await s.api.local.deleteBranches(s.dir, items, false)
  assert.deepEqual(
    results?.map((r) => r.ok),
    [true, true, false]
  )
  assert.equal(git(s.remote, 'branch', '--list', 'x'), '')
  await assert.rejects(s.api.local.deleteBranches(s.dir, [], false), /between 1 and 500/)
})

test('listBranches reports the default branch', async () => {
  const s = await setup()
  assert.equal((await s.api.local.branches(s.dir)).defaultBranch, 'main')
})
