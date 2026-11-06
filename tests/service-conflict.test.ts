import assert from 'node:assert/strict'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createService, type Ui } from '../src/main/service'
import { Store, type TokenCrypto } from '../src/main/store'
import { emptyRepo, git, tempDir } from './helpers'

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

const BASE = 'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\n'

function save(dir: string, message: string): void {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
}

/** shared.txt conflicts on a merge, and gone.txt is deleted on main but edited on feature. */
async function setup(confirms: boolean[] = []) {
  const dir = emptyRepo()
  writeFileSync(join(dir, 'shared.txt'), BASE)
  writeFileSync(join(dir, 'gone.txt'), BASE)
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  writeFileSync(join(dir, 'shared.txt'), BASE.replace('two', 'two feature'))
  writeFileSync(join(dir, 'gone.txt'), BASE.replace('two', 'edited'))
  save(dir, 'feature')
  git(dir, 'checkout', '-q', 'main')
  writeFileSync(join(dir, 'shared.txt'), BASE.replace('two', 'two main'))
  unlinkSync(join(dir, 'gone.txt'))
  save(dir, 'main')

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
  return { api, dir, confirmed: () => confirmed }
}

test('conflict calls need a linked folder and valid arguments', async () => {
  const s = await setup()
  const other = emptyRepo()
  const request = { path: 'shared.txt', fingerprint: 'a'.repeat(40), choices: [] }
  await assert.rejects(s.api.local.conflictFile(other, 'shared.txt'), /not linked/)
  await assert.rejects(s.api.local.resolveConflict(other, request), /not linked/)
  await assert.rejects(s.api.local.resolveConflictFile(other, 'shared.txt', 'ours'), /not linked/)

  await assert.rejects(s.api.local.conflictFile(s.dir, 5 as never), /not valid/)
  await assert.rejects(s.api.local.conflictFile(s.dir, 'a\0b'), /not valid/)
  await assert.rejects(s.api.local.resolveConflict(s.dir, null as never), /not valid/)
  await assert.rejects(
    s.api.local.resolveConflict(s.dir, { ...request, fingerprint: 'nope' }),
    /not valid/
  )
  await assert.rejects(
    s.api.local.resolveConflict(s.dir, { ...request, choices: ['bogus' as never] }),
    /not valid/
  )
  await assert.rejects(
    s.api.local.resolveConflict(s.dir, {
      ...request,
      choices: [{ text: 'x'.repeat(1024 * 1024 + 1) }]
    }),
    /not valid/
  )
  await assert.rejects(
    s.api.local.resolveConflictFile(s.dir, 'shared.txt', 'rm -rf' as never),
    /not valid/
  )
  assert.equal(s.confirmed(), 0)
})

test('the whole flow through the api: regions, delete with a confirm, then Continue', async () => {
  const s = await setup([false, true])
  assert.deepEqual(await s.api.local.merge(s.dir, 'feature', false), { conflicted: true })

  const file = await s.api.local.conflictFile(s.dir, 'shared.txt')
  assert.equal(file.segments?.filter((x) => x.type === 'conflict').length, 1)
  const saved = await s.api.local.resolveConflict(s.dir, {
    path: 'shared.txt',
    fingerprint: file.fingerprint as string,
    choices: ['both']
  })
  assert.equal(saved.staged, true)
  assert.equal(
    readFileSync(join(s.dir, 'shared.txt'), 'utf8'),
    BASE.replace('two', 'two main\ntwo feature')
  )

  const gone = await s.api.local.conflictFile(s.dir, 'gone.txt')
  assert.equal(gone.kind, 'deleted-by-us')
  // Declining the confirm leaves the file in conflict.
  assert.equal(await s.api.local.resolveConflictFile(s.dir, 'gone.txt', 'delete'), false)
  assert.equal(existsSync(join(s.dir, 'gone.txt')), true)
  assert.deepEqual((await s.api.local.operation(s.dir))?.conflicted, ['gone.txt'])
  assert.equal(await s.api.local.resolveConflictFile(s.dir, 'gone.txt', 'delete'), true)
  assert.equal(existsSync(join(s.dir, 'gone.txt')), false)
  assert.equal(s.confirmed(), 2)

  await s.api.local.continueOperation(s.dir)
  assert.equal(await s.api.local.operation(s.dir), null)
})

test('keep and the side actions need no confirm', async () => {
  const s = await setup()
  await s.api.local.merge(s.dir, 'feature', false)
  assert.equal(await s.api.local.resolveConflictFile(s.dir, 'gone.txt', 'keep'), true)
  assert.equal(await s.api.local.resolveConflictFile(s.dir, 'shared.txt', 'ours'), true)
  assert.equal(s.confirmed(), 0)
  await s.api.local.continueOperation(s.dir)
  assert.equal(await s.api.local.operation(s.dir), null)
})
