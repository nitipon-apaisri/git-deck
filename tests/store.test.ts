import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createProject } from '../src/shared/projects'
import { Store, type TokenCrypto } from '../src/main/store'
import type { Account } from '../src/shared/types'
import { tempDir } from './helpers'

const fakeCrypto = (available = true): TokenCrypto => ({
  isAvailable: () => available,
  encrypt: (s) => Buffer.from(`enc:${s.split('').reverse().join('')}`),
  decrypt: (b) => b.toString().slice(4).split('').reverse().join('')
})

const account = (id: string): Account => ({
  id,
  type: 'github',
  label: id,
  baseUrl: 'https://api.github.com',
  host: 'github.com',
  username: 'me',
  allowInsecureTls: false
})

async function newStore(available = true): Promise<{ store: Store; dir: string }> {
  const dir = tempDir()
  const store = new Store(dir, fakeCrypto(available))
  await store.load()
  return { store, dir }
}

test('tokens are encrypted on disk and round-trip through a reload', async () => {
  const { store, dir } = await newStore()
  await store.saveAccount(account('a'), 'ghp_SECRETTOKEN')
  const raw = await readFile(join(dir, 'config.json'), 'utf8')
  assert.ok(!raw.includes('ghp_SECRETTOKEN'))
  assert.ok(!raw.includes('NEKOTTERCES'))

  const again = new Store(dir, fakeCrypto())
  await again.load()
  assert.equal(again.getToken('a'), 'ghp_SECRETTOKEN')
  assert.equal(again.listAccounts().length, 1)
})

test('refuses to store a token when secure storage is unavailable', async () => {
  const { store, dir } = await newStore(false)
  await assert.rejects(store.saveAccount(account('a'), 'tok'), /Secure storage is unavailable/)
  assert.equal(store.listAccounts().length, 0)
  assert.equal(store.secureStorageAvailable(), false)
  const raw = await readFile(join(dir, 'config.json'), 'utf8').catch(() => '')
  assert.ok(!raw.includes('tok'))
})

test('writes are atomic: no temp files are left behind', async () => {
  const { store, dir } = await newStore()
  await Promise.all([
    store.saveAccount(account('a'), 't1'),
    store.setLink('a:1', '/x'),
    store.setCachedRepos('a', [])
  ])
  const files = (await readdir(dir)).sort()
  assert.deepEqual(files, ['cache.json', 'config.json'])
  JSON.parse(await readFile(join(dir, 'config.json'), 'utf8'))
})

test('removeAccount clears token, cache, links and project membership but keeps projects', async () => {
  const { store } = await newStore()
  await store.saveAccount(account('a'), 'ta')
  await store.saveAccount(account('b'), 'tb')
  await store.setLink('a:1', '/a1')
  await store.setLink('b:1', '/b1')
  await store.setCachedRepos('a', [])
  await store.setCachedRepos('b', [])
  const summary = {
    commitCount: 1,
    contributorCount: 1,
    contributors: [],
    branchCount: 1,
    tagCount: 0,
    openChangeRequests: 0,
    languages: [],
    license: null,
    createdAt: null,
    lastActivityAt: null,
    sizeKb: null,
    topics: []
  }
  await store.setCachedSummary('a:1', summary)
  await store.setCachedSummary('b:1', summary)
  await store.setProjects([createProject([], { name: 'p', repoKeys: ['a:1', 'b:1'] })])

  await store.removeAccount('a')

  assert.equal(store.getToken('a'), null)
  assert.equal(store.getToken('b'), 'tb')
  assert.deepEqual(store.getLinks(), { 'b:1': '/b1' })
  assert.equal(store.getCachedRepos('a'), null)
  assert.ok(store.getCachedRepos('b'))
  assert.equal(store.getCachedSummary('a:1'), null)
  assert.ok(store.getCachedSummary('b:1'))
  assert.deepEqual(store.getProjects()[0].repoKeys, ['b:1'])
})

test('cached repos are not dropped by a refresh that no longer lists them', async () => {
  const { store } = await newStore()
  await store.setProjects([createProject([], { name: 'p', repoKeys: ['a:1'] })])
  await store.setCachedRepos('a', [])
  assert.deepEqual(store.getProjects()[0].repoKeys, ['a:1'])
})

test('local repositories: add is idempotent, removal drops the link, accounts leave them alone', async () => {
  const { store, dir } = await newStore()
  const local = {
    key: 'local:abc123abc123',
    accountId: 'local',
    remoteId: 'abc123abc123',
    name: 'demo',
    fullName: 'demo',
    namespace: 'local',
    description: '/tmp/demo',
    visibility: 'private',
    defaultBranch: 'main',
    webUrl: '',
    httpUrl: '',
    sshUrl: '',
    stars: 0,
    forks: 0,
    openIssues: 0,
    updatedAt: '',
    archived: false,
    fork: false
  } as const
  await store.saveAccount(account('a1'), 'tok')
  await store.addLocalRepo({ ...local }, '/tmp/demo')
  await store.addLocalRepo({ ...local }, '/tmp/demo')
  assert.equal(store.getLocalRepos().length, 1)
  await store.removeAccount('a1')
  const reloaded = new Store(dir, fakeCrypto())
  await reloaded.load()
  assert.equal(reloaded.getLocalRepos().length, 1)
  assert.equal(reloaded.getLinks()[local.key], '/tmp/demo')
  await reloaded.removeLocalRepo(local.key)
  assert.equal(reloaded.getLocalRepos().length, 0)
  assert.equal(reloaded.getLinks()[local.key], undefined)
})

test('a config file written before local repositories existed still loads', async () => {
  const dir = tempDir()
  await writeFile(
    join(dir, 'config.json'),
    JSON.stringify({ accounts: [], tokens: {}, links: {}, projects: [] })
  )
  const store = new Store(dir, fakeCrypto())
  await store.load()
  assert.deepEqual(store.getLocalRepos(), [])
})
