import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  emptyResource,
  resourceReducer,
  type Resource,
  type ResourceAction
} from '../src/renderer/src/lib/resource'
import {
  aheadBehindText,
  branchCountText,
  branchText,
  changeRequestLabel,
  contributorRows,
  countText,
  dirtyText,
  isoDateText,
  languageSegments,
  percentText,
  plural,
  sizeText,
  statItems,
  unixDateText
} from '../src/renderer/src/lib/repoView'
import type { LocalInfo, Repo, RepoSummary } from '../src/shared/types'

const repo = (over: Partial<Repo> = {}): Repo => ({
  key: 'a:1',
  accountId: 'a',
  remoteId: '1',
  name: 'deck',
  fullName: 'acme/deck',
  namespace: 'acme',
  description: '',
  visibility: 'public',
  defaultBranch: 'main',
  webUrl: 'https://example.com/acme/deck',
  httpUrl: 'https://example.com/acme/deck.git',
  sshUrl: 'git@example.com:acme/deck.git',
  stars: 12,
  forks: 3,
  openIssues: 4,
  updatedAt: '2026-01-01T00:00:00Z',
  archived: false,
  fork: false,
  ...over
})

const summary = (over: Partial<RepoSummary> = {}): RepoSummary => ({
  commitCount: 1200,
  contributorCount: 7,
  contributors: [],
  branchCount: 5,
  tagCount: null,
  openChangeRequests: 0,
  languages: [],
  license: null,
  createdAt: null,
  lastActivityAt: null,
  sizeKb: null,
  topics: [],
  ...over
})

const info = (over: Partial<LocalInfo> = {}): LocalInfo => ({
  path: '/x',
  currentBranch: 'main',
  headHash: '1234567890abcdef',
  detached: false,
  remotes: [],
  localBranches: 2,
  remoteBranches: 9,
  tags: 1,
  latestTags: [],
  commitCount: 10,
  firstCommitAt: null,
  lastCommitAt: null,
  dirtyFiles: 0,
  ahead: 0,
  behind: 0,
  sizeKb: 10,
  ...over
})

test('countText groups thousands and shows a dash for unknown', () => {
  assert.equal(countText(1234567), '1,234,567')
  assert.equal(countText(0), '0')
  assert.equal(countText(null), '—')
  assert.equal(countText(undefined), '—')
})

test('plural handles one and many', () => {
  assert.equal(plural(1, 'file'), '1 file')
  assert.equal(plural(0, 'file'), '0 files')
  assert.equal(plural(2000, 'file'), '2,000 files')
})

test('changeRequestLabel follows the provider', () => {
  assert.equal(changeRequestLabel('github'), 'Open PRs')
  assert.equal(changeRequestLabel('gitlab'), 'Open MRs')
})

test('sizeText picks a readable unit', () => {
  assert.equal(sizeText(null), '—')
  assert.equal(sizeText(512), '512 KB')
  assert.equal(sizeText(1024), '1 MB')
  assert.equal(sizeText(1536), '1.5 MB')
  assert.equal(sizeText(1024 * 1024 * 2), '2 GB')
})

test('date helpers format fixed locale and zone, and survive bad input', () => {
  assert.equal(isoDateText('2026-11-05T23:30:00Z', 'en-GB', 'UTC'), '5 Nov 2026')
  assert.equal(isoDateText(null), '—')
  assert.equal(isoDateText('not a date'), '—')
  assert.equal(unixDateText(1_700_000_000, 'en-GB', 'UTC'), '14 Nov 2023')
  assert.equal(unixDateText(null), '—')
})

test('statItems shows a dash while loading and null once the load failed', () => {
  const loading = statItems(repo(), null, 'github', true)
  assert.equal(loading.find((i) => i.id === 'commits')?.value, '—')
  assert.equal(loading.find((i) => i.id === 'stars')?.value, 12)

  const failed = statItems(repo(), null, 'github', false)
  assert.equal(failed.find((i) => i.id === 'commits')?.value, null)
  assert.equal(failed.find((i) => i.id === 'forks')?.value, 3)
})

test('statItems keeps unknown pieces null and zero as zero', () => {
  const items = statItems(repo(), summary(), 'gitlab', false)
  const by = Object.fromEntries(items.map((i) => [i.id, i]))
  assert.equal(by.commits.value, 1200)
  assert.equal(by.tags.value, null)
  assert.equal(by.changes.value, 0)
  assert.equal(by.changes.label, 'Open MRs')
  assert.equal(items.length, 8)
})

test('contributorRows sorts, cuts and scales bars to the top contributor', () => {
  const list = [
    { name: 'B', login: 'b', email: '', avatarUrl: '', commits: 5 },
    { name: '', login: 'a', email: '', avatarUrl: '', commits: 20 },
    { name: 'C', login: 'c', email: '', avatarUrl: '', commits: 10 }
  ]
  const rows = contributorRows(list, 2)
  assert.deepEqual(
    rows.map((r) => [r.name, r.commits, r.share]),
    [
      ['a', 20, 1],
      ['C', 10, 0.5]
    ]
  )
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length)
  assert.deepEqual(contributorRows([], 10), [])
})

test('contributorRows gives distinct keys to repeated authors and survives zero commits', () => {
  const same = { name: 'X', login: 'x', email: '', avatarUrl: '', commits: 0 }
  const rows = contributorRows([same, same], 10)
  assert.equal(new Set(rows.map((r) => r.key)).size, 2)
  assert.deepEqual(
    rows.map((r) => r.share),
    [0, 0]
  )
})

test('percentText keeps small shares visible', () => {
  assert.equal(percentText(62.4), '62%')
  assert.equal(percentText(5.25), '5.3%')
  assert.equal(percentText(5), '5%')
  assert.equal(percentText(0.04), '<0.1%')
  assert.equal(percentText(0), '0%')
})

test('languageSegments sorts by share, drops empty ones and cycles tones', () => {
  const langs = Array.from({ length: 10 }, (_, i) => ({ name: `L${i}`, percent: i + 1 }))
  langs.push({ name: 'None', percent: 0 })
  const segs = languageSegments(langs)
  assert.equal(segs.length, 10)
  assert.equal(segs[0].name, 'L9')
  assert.equal(segs[0].tone, 1)
  assert.equal(segs[8].tone, 1)
  assert.ok(segs.every((s) => s.tone >= 1 && s.tone <= 8))
})

test('branchText covers branch, detached and unborn', () => {
  assert.equal(branchText(info()), 'main')
  assert.equal(
    branchText(info({ detached: true, currentBranch: null })),
    'Detached HEAD at 1234567'
  )
  assert.equal(
    branchText(info({ detached: true, currentBranch: null, headHash: null })),
    'Detached HEAD'
  )
  assert.equal(branchText(info({ currentBranch: null, headHash: null })), 'No commits yet')
})

test('aheadBehindText', () => {
  assert.equal(aheadBehindText(null, null), 'No upstream branch')
  assert.equal(aheadBehindText(0, 0), 'Up to date')
  assert.equal(aheadBehindText(2, 0), '2 ahead')
  assert.equal(aheadBehindText(0, 3), '3 behind')
  assert.equal(aheadBehindText(1, 4), '1 ahead, 4 behind')
})

test('dirtyText and branchCountText', () => {
  assert.equal(dirtyText(null), '—')
  assert.equal(dirtyText(0), 'Clean')
  assert.equal(dirtyText(1), '1 uncommitted file')
  assert.equal(dirtyText(3), '3 uncommitted files')
  assert.equal(branchCountText(2, 9), '2 local, 9 remote')
  assert.equal(branchCountText(null, null), '—')
  assert.equal(branchCountText(2, null), '2 local, — remote')
})

// resource reducer

const run = (actions: ResourceAction<string>[], from?: Resource<string>): Resource<string> =>
  actions.reduce(resourceReducer<string>, from ?? emptyResource<string>())

test('resource: cached value shows while loading, fresh value finishes it', () => {
  const cached = run([
    { type: 'start', key: 'a' },
    { type: 'data', key: 'a', data: 'old', fetchedAt: 1, done: false }
  ])
  assert.equal(cached.data, 'old')
  assert.equal(cached.loading, true)

  const fresh = run([{ type: 'data', key: 'a', data: 'new', fetchedAt: 2, done: true }], cached)
  assert.equal(fresh.data, 'new')
  assert.equal(fresh.fetchedAt, 2)
  assert.equal(fresh.loading, false)
})

test('resource: a result for an old key is dropped', () => {
  const state = run([
    { type: 'start', key: 'a' },
    { type: 'start', key: 'b' },
    { type: 'data', key: 'a', data: 'late', fetchedAt: 9, done: true },
    { type: 'failed', key: 'a', error: 'late error' }
  ])
  assert.equal(state.key, 'b')
  assert.equal(state.data, null)
  assert.equal(state.loading, true)
  assert.equal(state.error, null)
})

test('resource: a failed refresh keeps the old data and reports the error', () => {
  const state = run([
    { type: 'start', key: 'a' },
    { type: 'data', key: 'a', data: 'old', fetchedAt: 1, done: true },
    { type: 'start', key: 'a' },
    { type: 'failed', key: 'a', error: 'offline' }
  ])
  assert.equal(state.data, 'old')
  assert.equal(state.error, 'offline')
  assert.equal(state.loading, false)
})

test('resource: a new key starts clean and a restart clears the last error', () => {
  const failed = run([
    { type: 'start', key: 'a' },
    { type: 'failed', key: 'a', error: 'offline' }
  ])
  assert.equal(run([{ type: 'start', key: 'a' }], failed).error, null)
  const other = run([{ type: 'start', key: 'b' }], failed)
  assert.equal(other.error, null)
  assert.equal(other.data, null)
  assert.deepEqual(run([{ type: 'reset' }], other), emptyResource())
})
