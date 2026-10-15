import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { getCommitDetail, getGraph, getLocalInfo, parseRefs, repoRoot, stripCredentials } from '../src/main/git'
import { branchyRepo, emptyRepo, git, rm } from './helpers'

const dirs: string[] = []
const track = (d: string): string => (dirs.push(d), d)
after(() => dirs.forEach(rm))

describe('parseRefs', () => {
  it('parses full ref names and drops */HEAD and stash', () => {
    const refs = parseRefs(
      'HEAD -> refs/heads/main, tag: refs/tags/v1, refs/remotes/origin/main, refs/remotes/origin/HEAD, refs/stash'
    )
    assert.deepEqual(refs, [
      { name: 'main', kind: 'branch', current: true },
      { name: 'v1', kind: 'tag' },
      { name: 'origin/main', kind: 'remote' }
    ])
  })
  it('handles a detached HEAD', () => {
    assert.deepEqual(parseRefs('HEAD, refs/heads/x'), [
      { name: 'HEAD', kind: 'head' },
      { name: 'x', kind: 'branch' }
    ])
  })
})

describe('stripCredentials', () => {
  it('removes userinfo from URLs', () => {
    assert.equal(stripCredentials('https://user:secret@host/a/b.git'), 'https://host/a/b.git')
    assert.equal(stripCredentials('git@github.com:a/b.git'), 'git@github.com:a/b.git')
  })
})

describe('git service on a branchy repo', () => {
  const dir = track(branchyRepo())

  it('repoRoot resolves the top level', async () => {
    assert.equal((await repoRoot(dir)).endsWith(dir.split('/').pop()!), true)
  })

  it('getGraph returns commits in topo order with refs', async () => {
    const g = await getGraph(dir, 0, 100)
    assert.deepEqual(g.map((c) => c.subject), ['D', 'M', 'C', 'B', 'A'])
    const byHash = new Map(g.map((c) => [c.hash, c]))
    g.forEach((c, i) =>
      c.parents.forEach((p) => assert.ok(g.findIndex((x) => x.hash === p) > i, 'parent after child'))
    )
    assert.equal(byHash.size, 5)
    const d = g[0]
    assert.deepEqual(d.refs, [{ name: 'main', kind: 'branch', current: true }])
    assert.ok(g[1].parents.length === 2)
    assert.ok(g[2].refs.some((r) => r.name === 'feature'))
    assert.ok(g[4].refs.some((r) => r.kind === 'tag' && r.name === 'v1'))
    assert.equal(d.author, 'Test')
    assert.equal(d.email, 'test@example.com')
  })

  it('getGraph paginates', async () => {
    const page = await getGraph(dir, 2, 2)
    assert.deepEqual(page.map((c) => c.subject), ['C', 'B'])
  })

  it('getLocalInfo reports repository facts', async () => {
    writeFileSync(join(dir, 'dirty.txt'), 'x')
    const info = await getLocalInfo(dir)
    assert.equal(info.currentBranch, 'main')
    assert.equal(info.detached, false)
    assert.equal(info.localBranches, 2)
    assert.equal(info.remoteBranches, 0)
    assert.equal(info.tags, 1)
    assert.deepEqual(info.latestTags, ['v1'])
    assert.equal(info.commitCount, 5)
    assert.equal(info.dirtyFiles, 1)
    assert.equal(info.ahead, null)
    assert.ok(info.firstCommitAt && info.lastCommitAt)
    assert.ok(info.sizeKb !== null)
    rm(join(dir, 'dirty.txt'))
  })

  it('getLocalInfo strips credentials from remotes', async () => {
    git(dir, 'remote', 'add', 'origin', 'https://u:tok@example.com/a/b.git')
    const info = await getLocalInfo(dir)
    assert.deepEqual(info.remotes, [{ name: 'origin', url: 'https://example.com/a/b.git' }])
    git(dir, 'remote', 'remove', 'origin')
  })

  it('getCommitDetail returns body and numstat', async () => {
    const g = await getGraph(dir, 0, 10)
    const b = g.find((c) => c.subject === 'B')!
    const detail = await getCommitDetail(dir, b.hash)
    assert.equal(detail.body, 'B')
    assert.deepEqual(detail.files, [{ path: 'b.txt', additions: 2, deletions: 0 }])
    const m = await getCommitDetail(dir, g[1].hash)
    assert.deepEqual(m.files.map((f) => f.path), ['c.txt'])
  })

  it('getCommitDetail marks binary files and rejects bad hashes', async () => {
    writeFileSync(join(dir, 'bin.dat'), Buffer.from([0, 1, 2, 0, 255]))
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'bin')
    const head = git(dir, 'rev-parse', 'HEAD')
    const d = await getCommitDetail(dir, head)
    assert.deepEqual(d.files, [{ path: 'bin.dat', additions: null, deletions: null }])
    await assert.rejects(getCommitDetail(dir, '--output=x'), /Invalid commit hash/)
  })
})

describe('git service on an empty repo', () => {
  const dir = track(emptyRepo())
  it('getGraph returns []', async () => {
    assert.deepEqual(await getGraph(dir, 0, 10), [])
  })
  it('getLocalInfo yields nulls instead of throwing', async () => {
    const info = await getLocalInfo(dir)
    assert.equal(info.headHash, null)
    assert.equal(info.commitCount, null)
    assert.equal(info.currentBranch, 'main')
  })
})
