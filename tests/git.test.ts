import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getCommitDetail,
  getGraph,
  getLocalInfo,
  parseDecorations,
  repoRoot,
  stripCredentials
} from '../src/main/git'
import { branchyRepo, emptyRepo, git, tempDir } from './helpers'

test('parseDecorations reads full ref names and drops */HEAD and stash', () => {
  const refs = parseDecorations(
    'HEAD -> refs/heads/main, tag: refs/tags/v1, refs/remotes/origin/main, refs/remotes/origin/HEAD, refs/stash, refs/heads/dev'
  )
  assert.deepEqual(refs, [
    { name: 'HEAD', kind: 'head' },
    { name: 'main', kind: 'branch', current: true },
    { name: 'v1', kind: 'tag' },
    { name: 'origin/main', kind: 'remote' },
    { name: 'dev', kind: 'branch' }
  ])
  assert.deepEqual(parseDecorations('HEAD'), [{ name: 'HEAD', kind: 'head' }])
  assert.deepEqual(parseDecorations(''), [])
})

test('stripCredentials removes userinfo from http(s) urls only', () => {
  assert.equal(stripCredentials('https://user:secret@host/x.git'), 'https://host/x.git')
  assert.equal(stripCredentials('https://tok@host/x.git'), 'https://host/x.git')
  assert.equal(stripCredentials('git@host:x/y.git'), 'git@host:x/y.git')
})

test('repoRoot finds the toplevel and returns null outside a repo', async () => {
  const dir = branchyRepo()
  assert.equal(await repoRoot(dir), git(dir, 'rev-parse', '--show-toplevel'))
  assert.equal(await repoRoot(tempDir()), null)
})

test('getGraph on an empty repo returns []', async () => {
  assert.deepEqual(await getGraph(emptyRepo(), 0, 50), [])
})

test('getGraph returns commits with parents and decorations', async () => {
  const dir = branchyRepo()
  const commits = await getGraph(dir, 0, 50)
  assert.equal(commits.length, 5)
  assert.equal(commits[0].subject, 'add binary')
  const merge = commits.find((c) => c.subject === 'merge feature')!
  assert.equal(merge.parents.length, 2)
  assert.ok(merge.refs.some((r) => r.kind === 'tag' && r.name === 'v2.0'))
  assert.ok(commits[0].refs.some((r) => r.kind === 'branch' && r.name === 'main' && r.current))
  assert.ok(commits[0].refs.some((r) => r.kind === 'head'))
  assert.ok(commits.some((c) => c.refs.some((r) => r.name === 'feature')))
  assert.ok(commits.some((c) => c.refs.some((r) => r.kind === 'tag' && r.name === 'v1.0')))
  // Topo order: every parent appears after its child.
  const index = new Map(commits.map((c, i) => [c.hash, i]))
  for (const c of commits) for (const p of c.parents) assert.ok(index.get(p)! > index.get(c.hash)!)
})

test('getGraph pages with skip and limit', async () => {
  const dir = branchyRepo()
  const all = await getGraph(dir, 0, 50)
  const page = await getGraph(dir, 2, 2)
  assert.deepEqual(
    page.map((c) => c.hash),
    all.slice(2, 4).map((c) => c.hash)
  )
})

test('getLocalInfo reports branches, tags, counts and strips credentials', async () => {
  const dir = branchyRepo()
  git(dir, 'remote', 'add', 'origin', 'https://user:secret@example.com/a/b.git')
  const info = await getLocalInfo(dir)
  assert.equal(info.currentBranch, 'main')
  assert.equal(info.detached, false)
  assert.equal(info.localBranches, 2)
  assert.equal(info.remoteBranches, 0)
  assert.equal(info.tags, 2)
  assert.equal(info.latestTags.length, 2)
  assert.equal(info.commitCount, 5)
  assert.equal(info.dirtyFiles, 0)
  assert.equal(info.ahead, null)
  assert.deepEqual(info.remotes, [{ name: 'origin', url: 'https://example.com/a/b.git' }])
  assert.ok(info.firstCommitAt && info.lastCommitAt && info.lastCommitAt >= info.firstCommitAt)
  assert.ok(!JSON.stringify(info).includes('secret'))
})

test('getLocalInfo on an empty repo yields nulls, not errors', async () => {
  const info = await getLocalInfo(emptyRepo())
  assert.equal(info.headHash, null)
  assert.equal(info.commitCount, null)
  assert.equal(info.detached, false)
  assert.equal(info.tags, 0)
})

test('getCommitDetail returns body and numstat, null for binary', async () => {
  const dir = branchyRepo()
  const [head] = await getGraph(dir, 0, 1)
  const detail = await getCommitDetail(dir, head.hash)
  assert.equal(detail.body, 'add binary')
  assert.deepEqual(detail.files, [{ path: 'bin.dat', additions: null, deletions: null }])

  const merge = (await getGraph(dir, 0, 50)).find((c) => c.subject === 'merge feature')!
  const md = await getCommitDetail(dir, merge.hash)
  assert.deepEqual(md.files, [{ path: 'b.txt', additions: 1, deletions: 0 }])
})

test('getCommitDetail rejects a malformed hash', async () => {
  await assert.rejects(getCommitDetail(branchyRepo(), '--output=/tmp/x'), /Invalid commit hash/)
})
