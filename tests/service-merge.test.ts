import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
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
  commit(dir, 'shared.txt', 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  const featureHash = commit(dir, 'shared.txt', 'from feature')
  git(dir, 'checkout', '-q', 'main')
  commit(dir, 'shared.txt', 'from main')

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
  return { api, dir, featureHash, confirmed: () => confirmed }
}

test('stash, merge and operation calls need a linked folder and valid arguments', async () => {
  const s = await setup()
  const other = emptyRepo()
  await assert.rejects(s.api.local.stashes(other), /not linked/)
  await assert.rejects(s.api.local.stashPush(other, '', false), /not linked/)
  await assert.rejects(s.api.local.stashDrop(other, 0, 'abcdef0'), /not linked/)
  await assert.rejects(s.api.local.cherryPick(other, s.featureHash), /not linked/)
  await assert.rejects(s.api.local.merge(other, 'feature', false), /not linked/)
  await assert.rejects(s.api.local.operation(other), /not linked/)
  await assert.rejects(s.api.local.continueOperation(other), /not linked/)
  await assert.rejects(s.api.local.abortOperation(other), /not linked/)

  await assert.rejects(s.api.local.stashPush(s.dir, 5 as never, false), /not valid/)
  await assert.rejects(s.api.local.stashPush(s.dir, 'x'.repeat(501), false), /not valid/)
  await assert.rejects(s.api.local.stashPush(s.dir, '', 'yes' as never), /true or false/)
  await assert.rejects(s.api.local.stashApply(s.dir, -1, 'abcdef0'), /not valid/)
  await assert.rejects(s.api.local.stashPop(s.dir, 1.5, 'abcdef0'), /not valid/)
  await assert.rejects(s.api.local.stashPop(s.dir, 0, '--all'), /not valid/)
  await assert.rejects(s.api.local.cherryPick(s.dir, 7 as never), /Invalid commit/)
  await assert.rejects(s.api.local.merge(s.dir, '', false), /not valid/)
  await assert.rejects(s.api.local.merge(s.dir, 'feature', 'yes' as never), /true or false/)
  assert.equal(s.confirmed(), 0)
})

test('stash drop asks first and does nothing when declined', async () => {
  const s = await setup([false, true])
  writeFileSync(join(s.dir, 'shared.txt'), 'edit\n')
  await s.api.local.stashPush(s.dir, 'keep', false)
  const [entry] = await s.api.local.stashes(s.dir)
  assert.equal(await s.api.local.stashDrop(s.dir, entry.index, entry.hash), false)
  assert.equal((await s.api.local.stashes(s.dir)).length, 1)
  assert.equal(await s.api.local.stashDrop(s.dir, entry.index, entry.hash), true)
  assert.equal((await s.api.local.stashes(s.dir)).length, 0)
})

test('a conflicting merge is reported, then aborted only after confirming', async () => {
  const s = await setup([false, true])
  assert.deepEqual(await s.api.local.merge(s.dir, 'feature', false), { conflicted: true })
  const state = await s.api.local.operation(s.dir)
  assert.equal(state?.kind, 'merge')
  assert.deepEqual(state?.conflicted, ['shared.txt'])
  assert.equal(await s.api.local.abortOperation(s.dir), false)
  assert.equal((await s.api.local.operation(s.dir))?.kind, 'merge', 'declined: still in progress')
  assert.equal(await s.api.local.abortOperation(s.dir), true)
  assert.equal(await s.api.local.operation(s.dir), null)
})

test('a conflicting cherry-pick can be resolved and continued through the service', async () => {
  const s = await setup()
  assert.deepEqual(await s.api.local.cherryPick(s.dir, s.featureHash), { conflicted: true })
  writeFileSync(join(s.dir, 'shared.txt'), 'resolved\n')
  await s.api.local.continueOperation(s.dir)
  assert.equal(await s.api.local.operation(s.dir), null)
  assert.equal(git(s.dir, 'log', '-1', '--format=%s'), 'from feature')
})

test('abort with nothing in progress reports it without asking', async () => {
  const s = await setup()
  git(s.dir, 'checkout', '-q', 'main')
  await assert.rejects(s.api.local.abortOperation(s.dir), /no merge or cherry-pick/)
  assert.equal(s.confirmed(), 0)
})
