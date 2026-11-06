import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
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

async function setup(confirms: boolean[] = []) {
  const dir = emptyRepo()
  const first = commit(dir, 'a.txt', 'first')
  const second = commit(dir, 'a.txt', 'second')
  const bare = tempDir('gitdeck-bare-')
  git(bare, 'init', '-q', '--bare', '-b', 'main')
  git(dir, 'remote', 'add', 'origin', bare)
  git(dir, 'push', '-q', 'origin', 'main')

  const store = new Store(tempDir(), crypto)
  await store.load()
  await store.setLink('local:1', dir)
  let confirmed = 0
  const ui: Ui = {
    pickFolder: async () => null,
    confirm: async () => {
      confirmed++
      return confirms.shift() ?? false
    },
    reveal: () => {},
    openExternal: async () => {}
  }
  const { api } = createService({ store, ui, emitProgress: () => {}, emitRepoChanged: () => {} })
  return { api, dir, bare, first, second, confirmed: () => confirmed }
}

test('history calls need a linked folder and valid arguments', async () => {
  const s = await setup()
  const other = emptyRepo()
  const l = s.api.local
  await assert.rejects(l.tags(other), /not linked/)
  await assert.rejects(l.createTag(other, 'v1', null, null), /not linked/)
  await assert.rejects(l.deleteTag(other, 'v1'), /not linked/)
  await assert.rejects(l.pushTag(other, 'v1'), /not linked/)
  await assert.rejects(l.deleteRemoteTag(other, 'v1'), /not linked/)
  await assert.rejects(l.revert(other, s.first), /not linked/)
  await assert.rejects(l.reset(other, s.first, 'soft'), /not linked/)
  await assert.rejects(l.remotes(other), /not linked/)
  await assert.rejects(l.addRemote(other, 'x', 'https://example.com/x.git'), /not linked/)
  await assert.rejects(l.renameRemote(other, 'a', 'b'), /not linked/)
  await assert.rejects(l.removeRemote(other, 'origin'), /not linked/)

  await assert.rejects(l.createTag(s.dir, 5 as never, null, null), /not valid/)
  await assert.rejects(l.createTag(s.dir, '', null, null), /not valid/)
  await assert.rejects(l.createTag(s.dir, 'v1', 7 as never, null), /Invalid commit/)
  await assert.rejects(l.createTag(s.dir, 'v1', null, 9 as never), /not valid/)
  await assert.rejects(l.createTag(s.dir, 'v1', null, 'x'.repeat(5001)), /not valid/)
  await assert.rejects(l.revert(s.dir, 7 as never), /Invalid commit/)
  await assert.rejects(l.reset(s.dir, 7 as never, 'soft'), /Invalid commit/)
  await assert.rejects(l.reset(s.dir, s.first, 'nuke' as never), /Unknown reset mode/)
  await assert.rejects(l.addRemote(s.dir, '', 'https://example.com/x.git'), /not valid/)
  await assert.rejects(l.addRemote(s.dir, 'x', 5 as never), /not valid/)
  assert.equal(s.confirmed(), 0)
})

test('tags: create, list, push, then delete locally and on the remote after confirming', async () => {
  const s = await setup([false, true, false, true])
  await s.api.local.createTag(s.dir, 'v1', null, 'one')
  await s.api.local.createTag(s.dir, 'old', s.first, null)
  assert.deepEqual((await s.api.local.tags(s.dir)).map((t) => t.name).sort(), ['old', 'v1'])
  await s.api.local.pushTag(s.dir, 'v1')
  assert.equal(git(s.bare, 'tag', '-l'), 'v1')

  assert.equal(await s.api.local.deleteRemoteTag(s.dir, 'v1'), false)
  assert.equal(git(s.bare, 'tag', '-l'), 'v1', 'declined: still on the remote')
  assert.equal(await s.api.local.deleteRemoteTag(s.dir, 'v1'), true)
  assert.equal(git(s.bare, 'tag', '-l'), '')

  assert.equal(await s.api.local.deleteTag(s.dir, 'old'), false)
  assert.equal(await s.api.local.deleteTag(s.dir, 'old'), true)
  assert.deepEqual(
    (await s.api.local.tags(s.dir)).map((t) => t.name),
    ['v1']
  )
})

test('a hard reset asks first, soft and mixed do not', async () => {
  const s = await setup([false, true])
  assert.equal(await s.api.local.reset(s.dir, s.first, 'soft'), true)
  assert.equal(s.confirmed(), 0)
  assert.equal(git(s.dir, 'rev-parse', 'HEAD'), s.first)
  git(s.dir, 'commit', '-q', '-m', 'again')
  const again = git(s.dir, 'rev-parse', 'HEAD')
  assert.equal(await s.api.local.reset(s.dir, s.first, 'mixed'), true)
  assert.equal(s.confirmed(), 0)

  writeFileSync(join(s.dir, 'a.txt'), 'local edit\n')
  assert.equal(await s.api.local.reset(s.dir, again, 'hard'), false)
  assert.equal(readFileSync(join(s.dir, 'a.txt'), 'utf8'), 'local edit\n', 'declined: untouched')
  assert.equal(await s.api.local.reset(s.dir, again, 'hard'), true)
  assert.equal(git(s.dir, 'rev-parse', 'HEAD'), again)
  assert.equal(git(s.dir, 'status', '--porcelain'), '')
  assert.equal(s.confirmed(), 2)
})

test('a conflicting revert is reported, then aborted only after confirming', async () => {
  const s = await setup([false, true])
  commit(s.dir, 'a.txt', 'third')
  assert.deepEqual(await s.api.local.revert(s.dir, s.second), { conflicted: true })
  assert.equal((await s.api.local.operation(s.dir))?.kind, 'revert')
  assert.equal(await s.api.local.abortOperation(s.dir), false)
  assert.equal((await s.api.local.operation(s.dir))?.kind, 'revert', 'declined: still stopped')
  assert.equal(await s.api.local.abortOperation(s.dir), true)
  assert.equal(await s.api.local.operation(s.dir), null)
})

test('a clean revert goes through the service', async () => {
  const s = await setup()
  commit(s.dir, 'b.txt', 'adds b')
  const hash = git(s.dir, 'rev-parse', 'HEAD')
  assert.deepEqual(await s.api.local.revert(s.dir, hash), { conflicted: false })
  assert.match(git(s.dir, 'log', '-1', '--format=%s'), /^Revert/)
})

test('remotes: add and rename need no confirm, remove asks and keeps no token', async () => {
  const s = await setup([false, true])
  await s.api.local.addRemote(s.dir, 'fork', 'https://example.com/me/x.git')
  await s.api.local.renameRemote(s.dir, 'fork', 'mine')
  assert.deepEqual((await s.api.local.remotes(s.dir)).map((r) => r.name).sort(), ['mine', 'origin'])
  await assert.rejects(
    s.api.local.addRemote(s.dir, 'bad', 'https://tok3n@example.com/x.git'),
    /token/
  )
  assert.equal(s.confirmed(), 0)
  assert.equal(await s.api.local.removeRemote(s.dir, 'mine'), false)
  assert.equal(await s.api.local.removeRemote(s.dir, 'mine'), true)
  assert.deepEqual(
    (await s.api.local.remotes(s.dir)).map((r) => r.name),
    ['origin']
  )
  assert.doesNotMatch(readFileSync(join(s.dir, '.git/config'), 'utf8'), /tok3n/)
})

// Phase 14b

import { hunkFingerprint } from '../src/shared/diff'

async function rebaseSetup(confirms: boolean[] = []) {
  const s = await setup(confirms)
  git(s.dir, 'checkout', '-q', '-b', 'feature', s.first)
  commit(s.dir, 'a.txt', 'feature edit')
  git(s.dir, 'checkout', '-q', 'main')
  return s
}

test('rebase and hunk calls need a linked folder and valid arguments', async () => {
  const s = await setup()
  const other = emptyRepo()
  const l = s.api.local
  const hunk = { path: 'a.txt', source: 'worktree' as const, index: 0, fingerprint: '00000000' }
  await assert.rejects(l.rebase(other, 'main'), /not linked/)
  await assert.rejects(l.skipOperation(other), /not linked/)
  await assert.rejects(l.stageHunk(other, hunk), /not linked/)
  await assert.rejects(l.unstageHunk(other, hunk), /not linked/)
  await assert.rejects(l.rebase(s.dir, 5 as never), /not valid/)
  await assert.rejects(l.rebase(s.dir, ''), /not valid/)
  await assert.rejects(l.stageHunk(s.dir, null as never), /not valid/)
  await assert.rejects(l.stageHunk(s.dir, { ...hunk, source: 'other' as never }), /not valid/)
  await assert.rejects(l.stageHunk(s.dir, { ...hunk, index: '0' as never }), /not valid/)
  await assert.rejects(l.stageHunk(s.dir, { ...hunk, path: '' }), /not valid/)
  assert.equal(s.confirmed(), 0)
})

test('a conflicting rebase is skipped only after confirming, then aborted after confirming', async () => {
  const s = await rebaseSetup([false, true])
  git(s.dir, 'checkout', '-q', 'feature')
  assert.deepEqual(await s.api.local.rebase(s.dir, 'main'), { conflicted: true })
  assert.equal((await s.api.local.operation(s.dir))?.kind, 'rebase')
  assert.equal(await s.api.local.skipOperation(s.dir), false)
  assert.equal((await s.api.local.operation(s.dir))?.kind, 'rebase', 'declined: still stopped')
  assert.equal(await s.api.local.skipOperation(s.dir), true)
  assert.equal(await s.api.local.operation(s.dir), null)
  assert.equal(git(s.dir, 'symbolic-ref', '--short', 'HEAD'), 'feature')
})

test('skip refuses when there is no rebase, and does not ask', async () => {
  const s = await setup()
  await assert.rejects(s.api.local.skipOperation(s.dir), /no merge, cherry-pick, revert or rebase/)
  assert.equal(s.confirmed(), 0)
})

test('a clean rebase goes through the service', async () => {
  const s = await setup()
  git(s.dir, 'checkout', '-q', '-b', 'topic', s.first)
  commit(s.dir, 'c.txt', 'topic work')
  assert.deepEqual(await s.api.local.rebase(s.dir, 'main'), { conflicted: false })
  assert.equal(git(s.dir, 'merge-base', 'main', 'topic'), git(s.dir, 'rev-parse', 'main'))
})

test('a hunk is staged and unstaged through the service', async () => {
  const s = await setup()
  writeFileSync(join(s.dir, 'a.txt'), 'edited\n')
  const unstaged = await s.api.local.diff(s.dir, { source: 'worktree', path: 'a.txt' })
  const request = {
    path: 'a.txt',
    source: 'worktree' as const,
    index: 0,
    fingerprint: hunkFingerprint(unstaged.hunks[0].lines)
  }
  await s.api.local.stageHunk(s.dir, request)
  assert.match(git(s.dir, 'diff', '--cached'), /edited/)
  const staged = await s.api.local.diff(s.dir, { source: 'staged', path: 'a.txt' })
  await s.api.local.unstageHunk(s.dir, {
    ...request,
    source: 'staged',
    fingerprint: hunkFingerprint(staged.hunks[0].lines)
  })
  assert.equal(git(s.dir, 'diff', '--cached'), '')
  await assert.rejects(
    s.api.local.stageHunk(s.dir, { ...request, fingerprint: 'ffffffff' }),
    /changed since/
  )
})
