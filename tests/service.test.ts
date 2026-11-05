import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { IPC } from '../src/shared/api'
import * as realGit from '../src/main/git'
import { buildHandlers, respond } from '../src/main/ipcTable'
import type { GitProvider } from '../src/main/providers/types'
import {
  cleanMessage,
  createService,
  parseRepoKey,
  sanitizeFolderName,
  type GitOps,
  type Ui
} from '../src/main/service'
import { Store, type TokenCrypto } from '../src/main/store'
import { setInsecureHosts, verifyResultFor } from '../src/main/tls'
import type { Account, AccountInput, Repo, RepoSummary } from '../src/shared/types'
import { branchyRepo, emptyRepo, git, tempDir } from './helpers'

const TOKEN = 'test-token-abc'
const crypto: TokenCrypto = {
  isAvailable: () => true,
  encrypt: (s) => Buffer.from(`enc:${s.split('').reverse().join('')}`),
  decrypt: (b) => b.toString().slice(4).split('').reverse().join('')
}

const account: Account = {
  id: 'acc1',
  type: 'github',
  label: 'Octo',
  baseUrl: 'https://github.com',
  host: 'github.com',
  username: 'octo',
  allowInsecureTls: false
}

const repo = (id: string, name: string, extra: Partial<Repo> = {}): Repo => ({
  key: `acc1:${id}`,
  accountId: 'acc1',
  remoteId: id,
  name,
  fullName: `octo/${name}`,
  namespace: 'octo',
  description: '',
  visibility: 'private',
  defaultBranch: 'main',
  webUrl: `https://github.com/octo/${name}`,
  httpUrl: `https://github.com/octo/${name}.git`,
  sshUrl: `git@github.com:octo/${name}.git`,
  stars: 0,
  forks: 0,
  openIssues: 0,
  updatedAt: '2026-01-01T00:00:00Z',
  archived: false,
  fork: false,
  ...extra
})

const emptySummary: RepoSummary = {
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

function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

interface Rig {
  dir: string
  store: Store
  api: ReturnType<typeof createService>['api']
  sync: () => void
  provider: GitProvider & { calls: Record<string, number> }
  picks: (string | null)[]
  confirms: boolean[]
  confirmed: number
  revealed: string[]
  opened: string[]
  progress: { repoKey: string; line: string; percent: number | null }[]
  fetchEnvs: { cwd: string; env: Record<string, string> }[]
  cloneCalls: { url: string; dest: string; env: Record<string, string> }[]
  cloneGate?: Promise<void>
}

async function rig(opts: { seed?: boolean } = { seed: true }): Promise<Rig> {
  const dir = tempDir()
  const store = new Store(dir, crypto)
  await store.load()
  const calls: Record<string, number> = {}
  const count = (k: string): void => void (calls[k] = (calls[k] ?? 0) + 1)
  const r = {
    dir,
    store,
    picks: [] as (string | null)[],
    confirms: [] as boolean[],
    confirmed: 0,
    revealed: [] as string[],
    opened: [] as string[],
    progress: [] as Rig['progress'],
    fetchEnvs: [] as Rig['fetchEnvs'],
    cloneCalls: [] as Rig['cloneCalls']
  } as Rig
  r.provider = {
    calls,
    verify: async () => {
      count('verify')
      return { username: 'octo', avatarUrl: 'https://x/a.png' }
    },
    listRepos: async () => {
      count('listRepos')
      return [repo('1', 'hello')]
    },
    getSummary: async () => {
      count('getSummary')
      return emptySummary
    }
  }
  const ui: Ui = {
    pickFolder: async () => r.picks.shift() ?? null,
    confirm: async () => {
      r.confirmed++
      return r.confirms.shift() ?? false
    },
    reveal: (p) => void r.revealed.push(p),
    openExternal: async (u) => void r.opened.push(u)
  }
  const gitOps: GitOps = {
    ...realGit,
    gitFetch: async (cwd, env = {}) => void r.fetchEnvs.push({ cwd, env }),
    cloneRepo: async (url, dest, env = {}, onLine = () => {}) => {
      r.cloneCalls.push({ url, dest, env })
      await r.cloneGate
      await mkdir(dest, { recursive: true })
      git(dest, 'init', '-q', '-b', 'main')
      onLine("Cloning into 'x'...")
      onLine('Receiving objects:  42% (21/50)')
    }
  }
  const service = createService({
    store,
    ui,
    emitCloneProgress: (p) => r.progress.push(p),
    createProvider: () => r.provider,
    git: gitOps
  })
  r.api = service.api
  r.sync = service.syncInsecureHosts
  if (opts.seed) {
    await store.saveAccount(account, TOKEN)
    await store.setCachedRepos('acc1', [repo('1', 'hello'), repo('2', 'other')])
  }
  return r
}

afterEach(() => setInsecureHosts([]))

const input = (extra: Partial<AccountInput> = {}): AccountInput => ({
  type: 'gitlab',
  label: 'Work',
  baseUrl: 'git.corp.example',
  token: TOKEN,
  allowInsecureTls: false,
  ...extra
})

// Pure helpers

test('parseRepoKey accepts accountId:remoteId only', () => {
  assert.deepEqual(parseRepoKey('acc1:42'), { accountId: 'acc1', remoteId: '42' })
  for (const bad of ['', 'nocolon', ':1', 'a:', 'a:b:c', 'a b:1', 42, null, '../x:1'])
    assert.throws(() => parseRepoKey(bad), /Invalid repository key/)
})

test('sanitizeFolderName keeps clones inside the chosen parent', () => {
  assert.equal(sanitizeFolderName('hello'), 'hello')
  assert.equal(sanitizeFolderName('../evil'), '_evil')
  assert.equal(sanitizeFolderName('a/b\\c'), 'a_b_c')
  assert.equal(sanitizeFolderName('...'), 'repo')
})

test('cleanMessage strips tokens and URL credentials', () => {
  const msg = cleanMessage(new Error(`fatal: https://oauth2:${TOKEN}@host/x failed, ${TOKEN}`), [
    TOKEN
  ])
  assert.ok(!msg.includes(TOKEN) && !msg.includes('oauth2:'))
  assert.equal(cleanMessage('weird', []), 'Something went wrong')
})

// Accounts

test('accounts.add verifies, stores the token only encrypted and syncs insecure hosts', async () => {
  const r = await rig({ seed: false })
  const added = await r.api.accounts.add(input({ allowInsecureTls: true }))
  assert.equal(added.username, 'octo')
  assert.equal(added.baseUrl, 'https://git.corp.example')
  assert.equal(added.host, 'git.corp.example')
  assert.equal(r.provider.calls['verify'], 1)
  assert.equal(r.store.getToken(added.id), TOKEN)
  assert.ok(!(await readFile(join(r.dir, 'config.json'), 'utf8')).includes(TOKEN))
  assert.equal(verifyResultFor('git.corp.example'), 0)
  await r.api.accounts.remove(added.id)
  assert.equal(verifyResultFor('git.corp.example'), -3)
})

test('accounts.add rejects bad input and duplicates', async () => {
  const r = await rig({ seed: false })
  await assert.rejects(r.api.accounts.add(input({ baseUrl: 'ftp://x' })), /http/)
  await assert.rejects(r.api.accounts.add(input({ token: '  ' })), /token is required/)
  await assert.rejects(r.api.accounts.add(input({ token: 'a b' })), /spaces/)
  await assert.rejects(r.api.accounts.add(input({ token: 'x'.repeat(600) })), /too long/)
  await assert.rejects(r.api.accounts.add({ ...input(), type: 'svn' as never }), /GitHub or GitLab/)
  await assert.rejects(r.api.accounts.add(null as never), /Invalid account/)
  await r.api.accounts.add(input())
  await assert.rejects(r.api.accounts.add(input({ label: 'Again' })), /already added/)
  assert.equal((await r.api.accounts.list()).length, 1)
})

test('accounts.add refuses when secure storage is unavailable', async () => {
  const dir = tempDir()
  const store = new Store(dir, { ...crypto, isAvailable: () => false })
  await store.load()
  const { api } = createService({
    store,
    ui: {} as Ui,
    emitCloneProgress: () => {},
    createProvider: () => ({
      verify: async () => ({ username: 'octo' }),
      listRepos: async () => [],
      getSummary: async () => emptySummary
    })
  })
  await assert.rejects(api.accounts.add(input()), /Secure storage is unavailable/)
  assert.equal(await api.secureStorageAvailable(), false)
  assert.deepEqual(await api.accounts.list(), [])
})

test('accounts.test allows an insecure host only while it runs', async () => {
  const r = await rig({ seed: false })
  let during = -1
  r.provider.verify = async () => {
    during = verifyResultFor('git.corp.example')
    return { username: 'octo' }
  }
  await r.api.accounts.test(input({ allowInsecureTls: true }))
  assert.equal(during, 0)
  assert.equal(verifyResultFor('git.corp.example'), -3)
  assert.equal((await r.api.accounts.list()).length, 0)
})

test('errors reaching the renderer never contain the token or URL credentials', async () => {
  const r = await rig()
  r.provider.listRepos = async () => {
    throw new Error(`clone https://oauth2:${TOKEN}@github.com/x failed with ${TOKEN}`)
  }
  await assert.rejects(r.api.repos.fetch('acc1'), (e: Error) => {
    assert.ok(!e.message.includes(TOKEN) && !e.message.includes('oauth2:'))
    return true
  })
  const fresh = await rig({ seed: false })
  const typed = 'typed-secret-123'
  fresh.provider.verify = async () => {
    throw new Error(`rejected ${typed}`)
  }
  await assert.rejects(fresh.api.accounts.add(input({ token: typed })), (e: Error) => {
    assert.ok(!e.message.includes(typed))
    return true
  })
})

// Repos and summaries

test('repos.fetch shares one in-flight request and fills the cache', async () => {
  const r = await rig()
  const gate = deferred()
  r.provider.listRepos = async () => {
    r.provider.calls['listRepos'] = (r.provider.calls['listRepos'] ?? 0) + 1
    await gate.promise
    return [repo('9', 'fresh')]
  }
  const a = r.api.repos.fetch('acc1')
  const b = r.api.repos.fetch('acc1')
  gate.resolve()
  const [x, y] = await Promise.all([a, b])
  assert.equal(r.provider.calls['listRepos'], 1)
  assert.equal(x.data[0].name, 'fresh')
  assert.deepEqual(x, y)
  assert.equal((await r.api.repos.cached('acc1'))?.data[0].name, 'fresh')
})

test('repos.fetch does not resurrect the cache of an account removed meanwhile', async () => {
  const r = await rig()
  const gate = deferred()
  r.provider.listRepos = async () => {
    await gate.promise
    return [repo('9', 'fresh')]
  }
  const pending = r.api.repos.fetch('acc1')
  await r.api.accounts.remove('acc1')
  gate.resolve()
  await assert.rejects(pending, /Account not found/)
  assert.equal(r.store.getCachedRepos('acc1'), null)
})

test('summary.fetch needs a cached repo, dedupes and caches', async () => {
  const r = await rig()
  await assert.rejects(r.api.summary.fetch('acc1:404'), /Repository not found/)
  await assert.rejects(r.api.summary.fetch('nope'), /Invalid repository key/)
  await assert.rejects(r.api.summary.fetch('ghost:1'), /Account not found/)
  const [a, b] = await Promise.all([r.api.summary.fetch('acc1:1'), r.api.summary.fetch('acc1:1')])
  assert.equal(r.provider.calls['getSummary'], 1)
  assert.deepEqual(a, b)
  assert.equal((await r.api.summary.cached('acc1:1'))?.data.commitCount, 1)
  assert.equal(await r.api.summary.cached('acc1:2'), null)
})

// Linking

test('link: picker cancelled gives null, a non-repo folder is an error', async () => {
  const r = await rig()
  assert.equal(await r.api.local.link('acc1:1'), null)
  r.picks.push(tempDir())
  await assert.rejects(r.api.local.link('acc1:1'), /not inside a git repository/)
  assert.deepEqual(await r.api.local.links(), {})
})

test('link: a matching remote links without asking, a mismatch asks first', async () => {
  const r = await rig()
  const match = emptyRepo()
  git(match, 'remote', 'add', 'origin', 'https://user:pw@github.com/Octo/Hello.git')
  r.picks.push(match)
  assert.equal(await r.api.local.link('acc1:1'), realpathSync(match))
  assert.equal(r.confirmed, 0)

  const other = emptyRepo()
  git(other, 'remote', 'add', 'origin', 'https://github.com/someone/else.git')
  r.picks.push(other)
  r.confirms.push(false)
  assert.equal(await r.api.local.link('acc1:2'), null)
  assert.equal(r.confirmed, 1)
  assert.equal((await r.api.local.links())['acc1:2'], undefined)

  r.picks.push(other)
  r.confirms.push(true)
  assert.equal(await r.api.local.link('acc1:2'), realpathSync(other))
  await r.api.local.unlink('acc1:2')
  assert.equal((await r.api.local.links())['acc1:2'], undefined)
})

test('link stores the repo root even when a subfolder was picked', async () => {
  const r = await rig()
  const dir = branchyRepo()
  git(dir, 'remote', 'add', 'origin', 'https://github.com/octo/hello.git')
  await mkdir(join(dir, 'sub'))
  r.picks.push(join(dir, 'sub'))
  assert.equal(await r.api.local.link('acc1:1'), realpathSync(dir))
})

// Path-taking calls

test('path arguments must be linked folders', async () => {
  const r = await rig()
  const stranger = emptyRepo()
  for (const call of [
    () => r.api.local.info(stranger),
    () => r.api.local.graph(stranger, 0, 10),
    () => r.api.local.commit(stranger, 'abcdef1'),
    () => r.api.local.fetch(stranger),
    () => r.api.local.reveal(stranger),
    () => r.api.local.info('/etc')
  ])
    await assert.rejects(call(), /not linked/)
  assert.equal(r.fetchEnvs.length, 0)
  assert.deepEqual(r.revealed, [])
})

test('info, graph, commit and reveal work on a linked folder', async () => {
  const r = await rig()
  const dir = branchyRepo()
  git(dir, 'remote', 'add', 'origin', 'https://github.com/octo/hello.git')
  r.picks.push(dir)
  const root = (await r.api.local.link('acc1:1')) as string
  assert.equal((await r.api.local.info(root)).path, root)
  const graph = await r.api.local.graph(root, 0, 100)
  assert.ok(graph.length > 2)
  const detail = await r.api.local.commit(root, graph[0].hash)
  assert.equal(detail.hash, graph[0].hash)
  await assert.rejects(r.api.local.commit(root, 'not-a-hash'), /hash/i)
  await r.api.local.reveal(root)
  assert.deepEqual(r.revealed, [root])
  for (const [skip, limit] of [
    [-1, 10],
    [0, 0],
    [0, 5000],
    [1.5, 10],
    ['0', 10]
  ])
    await assert.rejects(r.api.local.graph(root, skip as number, limit as number))
})

test('local.fetch passes a scoped auth env and shares one in-flight fetch', async () => {
  const r = await rig()
  const dir = emptyRepo()
  git(dir, 'remote', 'add', 'origin', 'https://github.com/octo/hello.git')
  r.picks.push(dir)
  const root = (await r.api.local.link('acc1:1')) as string
  await Promise.all([r.api.local.fetch(root), r.api.local.fetch(root)])
  assert.equal(r.fetchEnvs.length, 1)
  const { cwd, env } = r.fetchEnvs[0]
  assert.equal(cwd, root)
  assert.equal(env['GIT_CONFIG_KEY_0'], 'http.https://github.com/.extraHeader')
  assert.match(env['GIT_CONFIG_VALUE_0'], /^Authorization: Basic /)
  assert.ok(
    !Object.values(env).some((v) => v.includes(TOKEN)),
    'token is base64-encoded, not plain'
  )
})

// Clone

test('clone: progress carries the repo key, the link is stored, HTTPS gets auth', async () => {
  const r = await rig()
  const parent = tempDir()
  r.picks.push(parent)
  const root = await r.api.local.clone('acc1:1', 'https')
  assert.equal(root, realpathSync(join(parent, 'hello')))
  assert.deepEqual(r.progress, [
    { repoKey: 'acc1:1', line: "Cloning into 'x'...", percent: null },
    { repoKey: 'acc1:1', line: 'Receiving objects:  42% (21/50)', percent: 42 }
  ])
  assert.equal((await r.api.local.links())['acc1:1'], root)
  assert.equal(r.cloneCalls[0].url, 'https://github.com/octo/hello.git')
  assert.match(r.cloneCalls[0].env['GIT_CONFIG_VALUE_0'], /^Authorization: Basic /)
})

test('clone over SSH uses the SSH URL and no auth env', async () => {
  const r = await rig()
  r.picks.push(tempDir())
  await r.api.local.clone('acc1:1', 'ssh')
  assert.equal(r.cloneCalls[0].url, 'git@github.com:octo/hello.git')
  assert.deepEqual(r.cloneCalls[0].env, {})
})

test('clone refuses a non-empty destination, a cancelled picker is null, bad inputs fail', async () => {
  const r = await rig()
  assert.equal(await r.api.local.clone('acc1:1', 'https'), null)
  const parent = tempDir()
  await mkdir(join(parent, 'hello'))
  await writeFile(join(parent, 'hello', 'file.txt'), 'x')
  r.picks.push(parent)
  await assert.rejects(r.api.local.clone('acc1:1', 'https'), /already exists and is not empty/)
  assert.equal(r.cloneCalls.length, 0)
  await assert.rejects(r.api.local.clone('acc1:1', 'ftp' as never), /https or ssh/)

  // An empty existing folder is fine.
  const parent2 = tempDir()
  await mkdir(join(parent2, 'hello'))
  r.picks.push(parent2)
  assert.ok(await r.api.local.clone('acc1:1', 'https'))
})

test('clone refuses URLs that are not plain https or ssh', async () => {
  const r = await rig()
  await r.store.setCachedRepos('acc1', [
    repo('1', 'hello', { httpUrl: 'ext::sh -c touch /tmp/x', sshUrl: '--upload-pack=evil' })
  ])
  r.picks.push(tempDir(), tempDir())
  await assert.rejects(r.api.local.clone('acc1:1', 'https'), /no HTTPS clone URL/)
  await assert.rejects(r.api.local.clone('acc1:1', 'ssh'), /no SSH clone URL/)
  assert.equal(r.cloneCalls.length, 0)
})

test('clone guards against a second clone of the same repo and recovers after', async () => {
  const r = await rig()
  const gate = deferred()
  r.cloneGate = gate.promise
  r.picks.push(tempDir())
  const first = r.api.local.clone('acc1:1', 'https')
  await new Promise((resolve) => setImmediate(resolve))
  await assert.rejects(r.api.local.clone('acc1:1', 'https'), /already being cloned/)
  // Another repo is not blocked.
  r.picks.push(tempDir())
  const second = r.api.local.clone('acc1:2', 'https')
  gate.resolve()
  await Promise.all([first, second])
  r.picks.push(tempDir())
  assert.ok(await r.api.local.clone('acc1:1', 'https'))
})

// openExternal

test('openExternal accepts http and https only', async () => {
  const r = await rig()
  await r.api.openExternal('https://example.com/x')
  await r.api.openExternal('http://example.com')
  for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'ssh://host', 'not a url', 5])
    await assert.rejects(r.api.openExternal(bad as string), /http and https/)
  assert.deepEqual(r.opened, ['https://example.com/x', 'http://example.com'])
})

// Projects

test('projects: create validates and returns the project', async () => {
  const r = await rig()
  const p = await r.api.projects.create({ name: '  Platform ', repoKeys: ['acc1:1', 'acc1:1'] })
  assert.equal(p.name, 'Platform')
  assert.deepEqual(p.repoKeys, ['acc1:1'])
  await assert.rejects(r.api.projects.create({ name: 'platform' }), /already exists/)
  await assert.rejects(r.api.projects.create({ name: '  ' }), /required/)
  await assert.rejects(r.api.projects.create({ name: 'X', icon: 'nope' }), /icon/)
  await assert.rejects(r.api.projects.create({ name: 'Y', color: 'nope' }), /color/)
  await assert.rejects(
    r.api.projects.create({ name: 'Z', repoKeys: ['bad'] }),
    /Invalid repository key/
  )
  await assert.rejects(
    r.api.projects.create({ name: 'Z', repoKeys: ['ghost:1'] }),
    /no longer exists/
  )
  await assert.rejects(r.api.projects.create({ name: 5 as never }), /Invalid project name/)
  assert.equal((await r.api.projects.list()).length, 1)
})

test('projects: update, add, remove repos and delete', async () => {
  const r = await rig()
  const a = await r.api.projects.create({ name: 'A' })
  const b = await r.api.projects.create({ name: 'B' })
  const renamed = await r.api.projects.update(a.id, { name: 'Alpha', color: 'teal' })
  assert.equal(renamed.name, 'Alpha')
  assert.equal(renamed.color, 'teal')
  await assert.rejects(r.api.projects.update(a.id, { name: 'b' }), /already exists/)
  await assert.rejects(r.api.projects.update('missing', { name: 'Q' }), /not found/)
  const added = await r.api.projects.addRepos(a.id, ['acc1:1', 'acc1:2', 'acc1:1'])
  assert.deepEqual(added.repoKeys, ['acc1:1', 'acc1:2'])
  await assert.rejects(r.api.projects.addRepos(a.id, ['ghost:1']), /no longer exists/)
  const trimmed = await r.api.projects.removeRepos(a.id, ['acc1:1', 'ghost:9'])
  assert.deepEqual(trimmed.repoKeys, ['acc1:2'])
  await r.api.projects.remove(b.id)
  await assert.rejects(r.api.projects.remove(b.id), /not found/)
  assert.deepEqual(
    (await r.api.projects.list()).map((p) => p.name),
    ['Alpha']
  )
})

test('projects survive a restart, and removing an account prunes its repos from every project', async () => {
  const r = await rig()
  const p = await r.api.projects.create({ name: 'Keep', repoKeys: ['acc1:1'] })
  const reopened = new Store(r.dir, crypto)
  await reopened.load()
  assert.equal(reopened.getProjects()[0].id, p.id)
  assert.deepEqual(reopened.getProjects()[0].repoKeys, ['acc1:1'])
  await r.api.accounts.remove('acc1')
  const [after] = await r.api.projects.list()
  assert.equal(after.name, 'Keep')
  assert.deepEqual(after.repoKeys, [])
})

test('concurrent project creates all persist', async () => {
  const r = await rig()
  await Promise.all(['A', 'B', 'C', 'D'].map((name) => r.api.projects.create({ name })))
  assert.equal((await r.api.projects.list()).length, 4)
})

// IPC table

test('every request channel has a handler, and each dispatches to the service', async () => {
  const r = await rig()
  const handlers = buildHandlers(r.api)
  const requests = Object.keys(IPC).filter((k) => k !== 'cloneProgress')
  assert.deepEqual(Object.keys(handlers).sort(), requests.sort())
  assert.equal(
    new Set(Object.values(IPC)).size,
    Object.keys(IPC).length,
    'channel names are unique'
  )
  const accounts = await handlers.accountsList([])
  assert.equal((accounts as Account[])[0].id, 'acc1')
  assert.equal(await handlers.secureStorageAvailable([]), true)
})

test('respond wraps results and errors without a stack', async () => {
  const r = await rig()
  const handlers = buildHandlers(r.api)
  assert.deepEqual(await respond(handlers.secureStorageAvailable, []), { ok: true, value: true })
  const failed = await respond(handlers.summaryFetch, ['acc1:404'])
  assert.equal(failed.ok, false)
  assert.deepEqual(Object.keys(failed), ['ok', 'error'])
})
