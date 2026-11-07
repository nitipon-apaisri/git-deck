import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as realGit from '../src/main/git'
import { createService, type GitOps, type Ui } from '../src/main/service'
import { Store, type TokenCrypto } from '../src/main/store'
import type { GitProgress } from '../src/shared/api'
import type { Account } from '../src/shared/types'
import { commit, emptyRepo, git, tempDir } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

const TOKEN = 'glpat-test-token-xyz'
const crypto: TokenCrypto = {
  isAvailable: () => true,
  encrypt: (s) => Buffer.from(s),
  decrypt: (b) => b.toString()
}
const account: Account = {
  id: 'acc1',
  type: 'gitlab',
  label: 'Work',
  baseUrl: 'https://gitlab.example.com',
  host: 'gitlab.example.com',
  username: 'me',
  allowInsecureTls: false
}

interface Calls {
  push: { env: Record<string, string>; force: boolean | undefined }[]
  pull: { env: Record<string, string>; mode: string }[]
}

/** A linked clone of a bare remote. `stub` replaces pull and push with recorders. */
async function setup(opts: { stub: boolean; confirms?: boolean[] }) {
  const seed = emptyRepo()
  commit(seed, 'a.txt', 'first')
  const remote = tempDir('gitdeck-remote-')
  git(remote, 'init', '-q', '--bare', '-b', 'main')
  git(seed, 'remote', 'add', 'origin', remote)
  git(seed, 'push', '-q', 'origin', 'main')
  const dir = tempDir('gitdeck-work-')
  git(dir, 'clone', '-q', remote, '.')

  const store = new Store(tempDir(), crypto)
  await store.load()
  await store.saveAccount(account, TOKEN)
  await store.setLink('acc1:1', dir)

  const calls: Calls = { push: [], pull: [] }
  const progress: GitProgress[] = []
  const confirms = [...(opts.confirms ?? [])]
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
  let gate: Promise<void> = Promise.resolve()
  const gitOps: GitOps = opts.stub
    ? {
        ...realGit,
        push: async (_cwd, o, env = {}, onLine = () => {}) => {
          calls.push.push({ env, force: o?.forceWithLease })
          onLine('Writing objects:  50% (1/2)')
          await gate
        },
        pull: async (_cwd, mode, env = {}) => void calls.pull.push({ env, mode })
      }
    : realGit
  const { api } = createService({
    store,
    ui,
    emitProgress: (p) => progress.push(p),
    emitRepoChanged: () => {},
    git: gitOps
  })
  return {
    api,
    dir,
    remote,
    calls,
    progress,
    confirmed: () => confirmed,
    hold: (p: Promise<void>) => void (gate = p)
  }
}

test('branch calls need a linked folder and valid arguments', async () => {
  const s = await setup({ stub: false })
  const other = emptyRepo()
  await assert.rejects(s.api.local.branches(other), /not linked/)
  await assert.rejects(s.api.local.checkout(other, { kind: 'branch', name: 'main' }), /not linked/)
  await assert.rejects(s.api.local.pull(other, 'ff-only'), /not linked/)
  await assert.rejects(s.api.local.push(other, false), /not linked/)
  await assert.rejects(s.api.local.deleteBranch(other, 'x'), /not linked/)
  await assert.rejects(s.api.local.checkout(s.dir, null as never), /not valid/)
  await assert.rejects(s.api.local.checkout(s.dir, { kind: 'x' } as never), /not valid/)
  await assert.rejects(
    s.api.local.checkout(s.dir, { kind: 'branch', name: 5 } as never),
    /not valid/
  )
  await assert.rejects(
    s.api.local.checkout(s.dir, { kind: 'commit', hash: 1 } as never),
    /Invalid commit/
  )
  await assert.rejects(s.api.local.createBranch(s.dir, 'a\0b', null, false), /not valid/)
  await assert.rejects(s.api.local.createBranch(s.dir, 'ok', null, 'yes' as never), /true or false/)
  await assert.rejects(
    s.api.local.createBranch(s.dir, '-bad', null, false),
    /not a valid branch name/
  )
  await assert.rejects(s.api.local.renameBranch(s.dir, 'main', ''), /not valid/)
  await assert.rejects(s.api.local.pull(s.dir, 'rebase' as never), /Unknown pull mode/)
  await assert.rejects(s.api.local.push(s.dir, 'yes' as never), /true or false/)
  assert.equal(s.confirmed(), 0)
})

test('create, switch, rename and list branches through the service', async () => {
  const s = await setup({ stub: false })
  await s.api.local.createBranch(s.dir, 'topic', null, true)
  let list = await s.api.local.branches(s.dir)
  assert.equal(list.current, 'topic')
  await s.api.local.renameBranch(s.dir, 'topic', 'topic2')
  await s.api.local.checkout(s.dir, { kind: 'branch', name: 'main' })
  list = await s.api.local.branches(s.dir)
  assert.deepEqual(list.local.map((b) => b.name).sort(), ['main', 'topic2'])
  assert.equal(list.current, 'main')
})

test('deleteBranch asks first, does nothing when declined and refuses the current branch', async () => {
  const s = await setup({ stub: false, confirms: [false, true, true] })
  await s.api.local.createBranch(s.dir, 'done', null, false)
  assert.equal(await s.api.local.deleteBranch(s.dir, 'done'), false)
  assert.ok((await s.api.local.branches(s.dir)).local.some((b) => b.name === 'done'))
  assert.equal(await s.api.local.deleteBranch(s.dir, 'done'), true)
  assert.ok(!(await s.api.local.branches(s.dir)).local.some((b) => b.name === 'done'))
  await assert.rejects(s.api.local.deleteBranch(s.dir, 'main'), /checked out/)
  assert.equal(s.confirmed(), 3)
})

test('push and pull send the account token for its own host only, as env', async () => {
  const s = await setup({ stub: true })
  git(s.dir, 'remote', 'set-url', 'origin', 'https://gitlab.example.com/me/repo.git')
  await s.api.local.push(s.dir, false)
  await s.api.local.pull(s.dir, 'merge')
  assert.equal(s.calls.push.length, 1)
  assert.equal(s.calls.pull[0].mode, 'merge')
  const env = s.calls.push[0].env
  assert.equal(env['GIT_CONFIG_KEY_0'], 'http.https://gitlab.example.com/.extraHeader')
  assert.match(env['GIT_CONFIG_VALUE_0'], /^Authorization: Basic /)
  assert.ok(!JSON.stringify(Object.keys(env)).includes(TOKEN))
})

test('a remote on another host fails clearly and never reaches git with a token', async () => {
  const s = await setup({ stub: true })
  git(s.dir, 'remote', 'set-url', 'origin', 'https://other.example.org/me/repo.git')
  for (const run of [
    () => s.api.local.push(s.dir, false),
    () => s.api.local.pull(s.dir, 'ff-only')
  ]) {
    await assert.rejects(run(), (err: Error) => {
      assert.match(err.message, /other\.example\.org.*gitlab\.example\.com/)
      assert.ok(!err.message.includes(TOKEN))
      return true
    })
  }
  assert.equal(s.calls.push.length + s.calls.pull.length, 0)
})

test('an SSH or local-path remote gets no token', async () => {
  const s = await setup({ stub: true })
  await s.api.local.push(s.dir, false) // the clone's origin is a local path
  git(s.dir, 'remote', 'set-url', 'origin', 'git@gitlab.example.com:me/repo.git')
  await s.api.local.push(s.dir, false)
  assert.deepEqual(
    s.calls.push.map((c) => c.env),
    [{}, {}]
  )
})

test('a forced push asks first and passes the lease flag; declining pushes nothing', async () => {
  const s = await setup({ stub: true, confirms: [false, true] })
  assert.equal(await s.api.local.push(s.dir, true), false)
  assert.equal(s.calls.push.length, 0)
  assert.equal(await s.api.local.push(s.dir, true), true)
  assert.equal(s.calls.push[0].force, true)
  assert.equal(await s.api.local.push(s.dir, false), true)
  assert.equal(s.calls.push[1].force, false)
  assert.equal(s.confirmed(), 2, 'a plain push never asks')
})

test('progress lines are tagged with the operation and the repository', async () => {
  const s = await setup({ stub: true })
  await s.api.local.push(s.dir, false)
  assert.deepEqual(s.progress, [
    { repoKey: 'acc1:1', op: 'push', line: 'Writing objects:  50% (1/2)', percent: 50 }
  ])
})

test('a second push or pull while one runs is refused', async () => {
  const s = await setup({ stub: true })
  let release = (): void => {}
  s.hold(new Promise<void>((resolve) => (release = resolve)))
  const first = s.api.local.push(s.dir, false)
  await new Promise((r) => setTimeout(r, 20))
  await assert.rejects(s.api.local.push(s.dir, false), /already running/)
  release()
  await first
  await s.api.local.push(s.dir, false)
})

test('pull and push work end to end against a bare remote, with no token in the config', async () => {
  const s = await setup({ stub: false })
  git(s.dir, 'checkout', '-q', '-b', 'topic')
  commit(s.dir, 't.txt', 'topic')
  assert.equal(await s.api.local.push(s.dir, false), true)
  assert.equal(git(s.remote, 'rev-parse', 'topic'), git(s.dir, 'rev-parse', 'HEAD'))
  const other = tempDir()
  git(other, 'clone', '-q', s.remote, '.')
  git(other, 'checkout', '-q', 'topic')
  commit(other, 'o.txt', 'elsewhere')
  git(other, 'push', '-q', 'origin', 'topic')
  git(s.dir, 'fetch', '-q')
  await s.api.local.pull(s.dir, 'ff-only')
  assert.equal(git(s.dir, 'rev-parse', 'HEAD'), git(other, 'rev-parse', 'HEAD'))
  assert.ok(!git(s.dir, 'config', '--list').includes(TOKEN))
})

test('deleteBranch asks again before it loses unmerged work', async () => {
  const s = await setup({ stub: false, confirms: [true, false, true, true] })
  await s.api.local.createBranch(s.dir, 'wip', null, true)
  git(s.dir, 'commit', '-q', '--allow-empty', '-m', 'only here')
  await s.api.local.checkout(s.dir, { kind: 'branch', name: 'main' })
  // First confirm yes, the force confirm no: the branch stays.
  assert.equal(await s.api.local.deleteBranch(s.dir, 'wip'), false)
  assert.ok((await s.api.local.branches(s.dir)).local.some((b) => b.name === 'wip'))
  // Both yes: it goes.
  assert.equal(await s.api.local.deleteBranch(s.dir, 'wip'), true)
  assert.ok(!(await s.api.local.branches(s.dir)).local.some((b) => b.name === 'wip'))
  assert.equal(s.confirmed(), 4)
})

test('deleteRemoteBranch asks first and removes the branch on the remote only', async () => {
  const s = await setup({ stub: false, confirms: [false, true, true, true] })
  await s.api.local.createBranch(s.dir, 'topic', null, true)
  git(s.dir, 'commit', '-q', '--allow-empty', '-m', 'topic work')
  git(s.dir, 'push', '-q', 'origin', 'topic')
  await s.api.local.checkout(s.dir, { kind: 'branch', name: 'main' })
  assert.equal(await s.api.local.deleteRemoteBranch(s.dir, 'origin/topic'), false)
  assert.match(git(s.remote, 'branch', '--list', 'topic'), /topic/, 'declined: still there')
  assert.equal(await s.api.local.deleteRemoteBranch(s.dir, 'origin/topic'), true)
  assert.equal(git(s.remote, 'branch', '--list', 'topic'), '')
  assert.ok((await s.api.local.branches(s.dir)).local.some((b) => b.name === 'topic'))
  await assert.rejects(s.api.local.deleteRemoteBranch(emptyRepo(), 'origin/topic'), /not linked/)
  await assert.rejects(s.api.local.deleteRemoteBranch(s.dir, 'origin/nope'), (err: Error) => {
    assert.match(err.message, /no remote branch/)
    assert.ok(!err.message.includes(TOKEN))
    return true
  })
})
