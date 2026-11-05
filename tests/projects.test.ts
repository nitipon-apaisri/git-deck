import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addRepos,
  aggregateProject,
  createProject,
  DEFAULT_COLOR,
  PROJECT_COLORS,
  PROJECT_ICONS,
  pruneAccount,
  removeRepos,
  updateProject,
  type Clock
} from '../src/shared/projects'
import type { Contributor, RepoSummary } from '../src/shared/types'

let n = 0
const clock: Clock = { now: () => 1000 + n, newId: () => `id-${++n}` }

const summary = (over: Partial<RepoSummary> = {}): RepoSummary => ({
  commitCount: 10,
  contributorCount: 1,
  contributors: [],
  branchCount: 1,
  tagCount: 0,
  openChangeRequests: 1,
  languages: [],
  license: null,
  createdAt: null,
  lastActivityAt: null,
  sizeKb: null,
  topics: [],
  ...over
})
const person = (email: string, login = ''): Contributor => ({
  name: '',
  login,
  email,
  avatarUrl: '',
  commits: 1
})

test('createProject trims, applies defaults and de-duplicates repo keys', () => {
  const p = createProject([], { name: '  Backend  ', repoKeys: ['a:1', 'a:2', 'a:1'] }, clock)
  assert.equal(p.name, 'Backend')
  assert.equal(p.icon, 'folder')
  assert.equal(p.color, DEFAULT_COLOR)
  assert.equal(p.color, PROJECT_COLORS[0])
  assert.deepEqual(p.repoKeys, ['a:1', 'a:2'])
  assert.equal(p.createdAt, p.updatedAt)
})

test('name rules: required, max 60, unique ignoring case', () => {
  const existing = [createProject([], { name: 'Alpha' }, clock)]
  assert.throws(() => createProject(existing, { name: '   ' }), /required/)
  assert.throws(() => createProject(existing, { name: 'x'.repeat(61) }), /at most 60/)
  assert.doesNotThrow(() => createProject(existing, { name: 'x'.repeat(60) }))
  assert.throws(() => createProject(existing, { name: ' alpha ' }), /already exists/)
})

test('icon and colour rules', () => {
  assert.equal(createProject([], { name: 'a', icon: '🚀' }).icon, '🚀')
  assert.equal(createProject([], { name: 'b', icon: PROJECT_ICONS[3] }).icon, PROJECT_ICONS[3])
  assert.throws(() => createProject([], { name: 'c', icon: 'nope' }), /icon/)
  assert.throws(() => createProject([], { name: 'd', icon: '🚀🚀' }), /icon/)
  assert.throws(() => createProject([], { name: 'e', icon: 'a' }), /icon/)
  assert.throws(() => createProject([], { name: 'f', color: '#ff0000' }), /color/)
  assert.equal(createProject([], { name: 'g', color: 'rose' }).color, 'rose')
})

test('updateProject allows keeping its own name and rejects others', () => {
  const a = createProject([], { name: 'Alpha' }, clock)
  const b = createProject([a], { name: 'Beta' }, clock)
  const all = [a, b]
  assert.equal(updateProject(all, a.id, { name: 'ALPHA' }, clock).name, 'ALPHA')
  assert.throws(() => updateProject(all, a.id, { name: 'beta' }), /already exists/)
  assert.throws(() => updateProject(all, 'missing', {}), /not found/)
  const u = updateProject(all, a.id, { icon: 'rocket', color: 'teal' }, clock)
  assert.equal(u.name, 'Alpha')
  assert.equal(u.icon, 'rocket')
  assert.ok(u.updatedAt >= a.updatedAt)
})

test('addRepos and removeRepos de-duplicate and keep order', () => {
  const p = createProject([], { name: 'p', repoKeys: ['a:1', 'a:2'] }, clock)
  const added = addRepos(p, ['a:3', 'a:1', 'a:3'], clock)
  assert.deepEqual(added.repoKeys, ['a:1', 'a:2', 'a:3'])
  assert.deepEqual(removeRepos(added, ['a:2', 'zzz'], clock).repoKeys, ['a:1', 'a:3'])
  assert.deepEqual(p.repoKeys, ['a:1', 'a:2'], 'inputs are not mutated')
})

test('pruneAccount removes only that account, keeps projects and untouched objects', () => {
  const p1 = createProject([], { name: 'one', repoKeys: ['a:1', 'b:1', 'a:2'] }, clock)
  const p2 = createProject([p1], { name: 'two', repoKeys: ['b:9'] }, clock)
  const out = pruneAccount([p1, p2], 'a')
  assert.deepEqual(out[0].repoKeys, ['b:1'])
  assert.equal(out[1], p2)
  assert.equal(out.length, 2)
  // 'a' must not match an account whose id merely starts with 'a'.
  assert.deepEqual(
    pruneAccount([createProject([], { name: 'x', repoKeys: ['ab:1'] })], 'a')[0].repoKeys,
    ['ab:1']
  )
})

test('aggregateProject sums known values and flags partial on null counts', () => {
  const out = aggregateProject(['a:1', 'a:2'], {
    'a:1': summary({
      commitCount: 10,
      openChangeRequests: 2,
      lastActivityAt: '2026-01-01T00:00:00Z'
    }),
    'a:2': summary({
      commitCount: null,
      openChangeRequests: 3,
      lastActivityAt: '2026-03-01T00:00:00Z'
    })
  })
  assert.equal(out.commits, 10)
  assert.equal(out.openChangeRequests, 5)
  assert.equal(out.lastActivityAt, '2026-03-01T00:00:00Z')
  assert.equal(out.partial, true)
  assert.equal(out.loadedCount, 2)
  assert.equal(out.repoCount, 2)
})

test('aggregateProject treats a missing summary as partial and not loaded', () => {
  const out = aggregateProject(['a:1', 'a:2'], { 'a:1': summary() })
  assert.equal(out.loadedCount, 1)
  assert.equal(out.repoCount, 2)
  assert.equal(out.partial, true)
  const full = aggregateProject(['a:1'], { 'a:1': summary() })
  assert.equal(full.partial, false)
  assert.equal(full.lastActivityAt, null)
  assert.deepEqual(aggregateProject([], {}), {
    repoCount: 0,
    loadedCount: 0,
    commits: 0,
    contributors: 0,
    openChangeRequests: 0,
    lastActivityAt: null,
    partial: false
  })
})

test('aggregateProject de-duplicates contributors by lowercase email, else login', () => {
  const out = aggregateProject(['a:1', 'b:1'], {
    'a:1': summary({
      contributors: [person('Dev@Example.com'), person('', 'ghost'), person('', '')]
    }),
    'b:1': summary({
      contributors: [person('dev@example.com'), person('', 'GHOST'), person('x@y.z')]
    })
  })
  assert.equal(out.contributors, 3)
})

test('aggregateProject only counts each repo’s top 25 contributors', () => {
  const many = Array.from({ length: 40 }, (_, i) => person(`u${i}@x.io`))
  assert.equal(
    aggregateProject(['a:1'], { 'a:1': summary({ contributors: many }) }).contributors,
    25
  )
})
