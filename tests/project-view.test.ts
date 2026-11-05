import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runPool } from '../src/renderer/src/lib/pool'
import {
  buildRows,
  countText,
  DEFAULT_SORT,
  nextSort,
  partialNote,
  progressText,
  sortRows,
  staleKeys,
  STALE_AFTER_MS
} from '../src/renderer/src/lib/projectRows'
import {
  ALL_SCOPE,
  accountIdOf,
  parseScope,
  projectView,
  projectsHolding,
  resolveScope
} from '../src/renderer/src/lib/projectScope'
import { emptySummaries, progressOf, summaryReducer } from '../src/renderer/src/lib/summaryStore'
import type { Cached, Project, Repo, RepoSummary } from '../src/shared/types'

const repo = (accountId: string, id: string, extra: Partial<Repo> = {}): Repo => ({
  key: `${accountId}:${id}`,
  accountId,
  remoteId: id,
  name: id,
  fullName: `ns/${id}`,
  namespace: 'ns',
  description: '',
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
  fork: false,
  ...extra
})

const project = (repoKeys: string[], extra: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'P',
  icon: 'folder',
  color: 'blue',
  repoKeys,
  createdAt: 0,
  updatedAt: 0,
  ...extra
})

const summary = (extra: Partial<RepoSummary> = {}): RepoSummary => ({
  commitCount: 10,
  contributorCount: 2,
  contributors: [],
  branchCount: 1,
  tagCount: 0,
  openChangeRequests: 1,
  languages: [],
  license: null,
  createdAt: null,
  lastActivityAt: '2026-01-01T00:00:00Z',
  sizeKb: null,
  topics: [],
  ...extra
})

const cached = (extra: Partial<RepoSummary> = {}, fetchedAt = 1000): Cached<RepoSummary> => ({
  data: summary(extra),
  fetchedAt
})

// Scope

test('parseScope: missing or blank is "all"', () => {
  assert.equal(parseScope(null), ALL_SCOPE)
  assert.equal(parseScope('  '), ALL_SCOPE)
  assert.equal(parseScope('abc-123'), 'abc-123')
})

test('resolveScope: a deleted project falls back to no project', () => {
  const projects = [project([])]
  assert.equal(resolveScope('all', projects), null)
  assert.equal(resolveScope('p1', projects), projects[0])
  assert.equal(resolveScope('gone', projects), null)
})

test('accountIdOf takes the part before the first colon', () => {
  assert.equal(accountIdOf('a1:42'), 'a1')
  assert.equal(accountIdOf('a1:group/x:y'), 'a1')
  assert.equal(accountIdOf('nocolon'), 'nocolon')
})

test('projectView: members are grouped by account and the rest are unavailable', () => {
  const lists = { a: [repo('a', '1'), repo('a', '2')], b: [repo('b', '9')] }
  const view = projectView(
    project(['a:2', 'b:9', 'a:gone', 'zz:1']),
    lists,
    { a: { settled: true }, b: { settled: true } },
    true
  )
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(view.reposByAccount).map(([id, r]) => [id, r.map((x) => x.key)])
    ),
    { a: ['a:2'], b: ['b:9'] }
  )
  // a:gone: its list loaded without it. zz:1: the account is removed.
  assert.deepEqual(view.unavailable, ['a:gone', 'zz:1'])
  assert.deepEqual(view.pending, [])
})

test('projectView: an account still loading its first list does not flash as unavailable', () => {
  const view = projectView(project(['a:1']), {}, { a: { settled: false } }, true)
  assert.deepEqual(view.unavailable, [])
  assert.deepEqual(view.pending, ['a:1'])
})

test('projectView: nothing is unavailable before the accounts are known', () => {
  const view = projectView(project(['a:1', 'b:2']), {}, {}, false)
  assert.deepEqual(view.unavailable, [])
  assert.deepEqual(view.pending, ['a:1', 'b:2'])
})

test('projectView: a failed list leaves its repositories unavailable, not pending', () => {
  const view = projectView(project(['a:1']), {}, { a: { settled: true } }, true)
  assert.deepEqual(view.unavailable, ['a:1'])
})

test('projectsHolding lists the projects that have a repository', () => {
  const projects = [project(['a:1'], { id: 'x' }), project(['a:2'], { id: 'y' })]
  assert.deepEqual(
    projectsHolding(projects, 'a:2').map((p) => p.id),
    ['y']
  )
})

// Pool

test('runPool never runs more than `limit` at once and runs everything', async () => {
  let running = 0
  let peak = 0
  const seen: number[] = []
  await runPool(
    [1, 2, 3, 4, 5, 6, 7],
    async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      seen.push(n)
      running--
    },
    { limit: 3 }
  )
  assert.equal(peak, 3)
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5, 6, 7])
})

test('runPool: one failure does not stop the others and is reported', async () => {
  const errors: [number, string][] = []
  const done: number[] = []
  await runPool(
    [1, 2, 3],
    async (n) => {
      if (n === 2) throw new Error('boom')
    },
    {
      limit: 2,
      onSettled: (item, error, count) => {
        done.push(count)
        if (error) errors.push([item, (error as Error).message])
      }
    }
  )
  assert.deepEqual(errors, [[2, 'boom']])
  assert.deepEqual(done, [1, 2, 3])
})

test('runPool stops starting items once cancelled', async () => {
  let cancel = false
  const started: number[] = []
  await runPool(
    [1, 2, 3, 4, 5],
    async (n) => {
      started.push(n)
      if (n === 2) cancel = true
    },
    { limit: 1, cancelled: () => cancel }
  )
  assert.deepEqual(started, [1, 2])
})

test('runPool copes with no items and a bad limit', async () => {
  await runPool([], async () => assert.fail('no work'), { limit: 3 })
  const seen: number[] = []
  await runPool([1, 2], async (n) => void seen.push(n), { limit: 0 })
  assert.deepEqual(seen, [1, 2])
})

// Rows

const rows = () => {
  const repos = new Map([
    ['a:1', repo('a', '1', { fullName: 'ns/zeta', visibility: 'public' })],
    ['a:2', repo('a', '2', { fullName: 'ns/alpha' })],
    ['a:3', repo('a', '3', { fullName: 'ns/mid', visibility: 'internal' })]
  ])
  return buildRows(
    ['a:1', 'a:2', 'a:3', 'a:gone'],
    repos,
    {
      'a:1': cached({ commitCount: 50, lastActivityAt: '2026-03-01T00:00:00Z' }),
      'a:2': cached({ commitCount: null, lastActivityAt: '2026-05-01T00:00:00Z' }),
      'a:3': cached({ commitCount: 5, lastActivityAt: null })
    },
    { 'a:2': '/work/alpha' }
  )
}

test('buildRows marks unavailable repositories and links', () => {
  const built = rows()
  assert.equal(built[3].repo, null)
  assert.equal(built[3].summary, null)
  assert.equal(built[1].linkedPath, '/work/alpha')
  assert.equal(built[0].linkedPath, null)
})

const keysOf = (list: ReturnType<typeof rows>): string[] => list.map((r) => r.key)

test('sortRows: numbers descending put unknowns and unavailable last', () => {
  assert.deepEqual(keysOf(sortRows(rows(), { key: 'commits', dir: 'desc' })), [
    'a:1',
    'a:3',
    'a:2',
    'a:gone'
  ])
})

test('sortRows: flipping the direction keeps unknowns and unavailable last', () => {
  assert.deepEqual(keysOf(sortRows(rows(), { key: 'commits', dir: 'asc' })), [
    'a:3',
    'a:1',
    'a:2',
    'a:gone'
  ])
})

test('sortRows: by name is A to Z on the full name, case-insensitive', () => {
  assert.deepEqual(keysOf(sortRows(rows(), { key: 'name', dir: 'asc' })), [
    'a:2',
    'a:3',
    'a:1',
    'a:gone'
  ])
})

test('sortRows: default is last activity, newest first, no date last', () => {
  assert.deepEqual(keysOf(sortRows(rows(), DEFAULT_SORT)), ['a:2', 'a:1', 'a:3', 'a:gone'])
})

test('sortRows: visibility orders public, internal, private', () => {
  assert.deepEqual(keysOf(sortRows(rows(), { key: 'visibility', dir: 'asc' })), [
    'a:1',
    'a:3',
    'a:2',
    'a:gone'
  ])
})

test('sortRows: local puts cloned repositories first when descending', () => {
  assert.deepEqual(keysOf(sortRows(rows(), { key: 'local', dir: 'desc' })).slice(0, 1), ['a:2'])
})

test('sortRows does not change its input and keeps ties in project order', () => {
  const input = rows()
  const before = keysOf(input)
  const sorted = sortRows(input, { key: 'open', dir: 'desc' })
  assert.deepEqual(keysOf(input), before)
  assert.deepEqual(keysOf(sorted), ['a:1', 'a:2', 'a:3', 'a:gone'])
})

test('nextSort: same column flips, a new one starts in its natural order', () => {
  assert.deepEqual(nextSort({ key: 'last', dir: 'desc' }, 'last'), { key: 'last', dir: 'asc' })
  assert.deepEqual(nextSort({ key: 'last', dir: 'desc' }, 'name'), { key: 'name', dir: 'asc' })
  assert.deepEqual(nextSort({ key: 'name', dir: 'asc' }, 'commits'), {
    key: 'commits',
    dir: 'desc'
  })
})

test('countText shows an en dash for unknown, never 0', () => {
  assert.equal(countText(null), '–')
  assert.equal(countText(undefined), '–')
  assert.equal(countText(0), '0')
  assert.equal(countText(12430), '12,430')
})

test('staleKeys: missing, old and available only', () => {
  const now = 10 * STALE_AFTER_MS
  const have = {
    'a:fresh': cached({}, now - 1000),
    'a:old': cached({}, now - STALE_AFTER_MS - 1),
    'a:edge': cached({}, now - STALE_AFTER_MS)
  }
  const keys = ['a:fresh', 'a:old', 'a:edge', 'a:missing', 'a:unavailable']
  const available = new Set(['a:fresh', 'a:old', 'a:edge', 'a:missing'])
  // Exactly one hour old is not yet stale.
  assert.deepEqual(staleKeys(keys, have, now, available), ['a:old', 'a:missing'])
})

test('progressText and partialNote', () => {
  assert.equal(progressText({ done: 12, total: 30 }), '12 / 30 loaded')
  const base = {
    repoCount: 9,
    loadedCount: 9,
    commits: 0,
    contributors: 0,
    openChangeRequests: 0,
    lastActivityAt: null,
    partial: false
  }
  assert.equal(partialNote(base), null)
  assert.match(
    partialNote({ ...base, loadedCount: 8, partial: true }) ?? '',
    /1 of 9 repository has no summary/
  )
  assert.match(
    partialNote({ ...base, loadedCount: 6, partial: true }) ?? '',
    /3 of 9 repositories have/
  )
  assert.match(partialNote({ ...base, partial: true }) ?? '', /could not be read/)
})

// Summary store

test('summaryReducer: cached never replaces a newer entry', () => {
  let s = summaryReducer(emptySummaries(), {
    type: 'fetched',
    key: 'a:1',
    entry: cached({ commitCount: 99 }, 2000)
  })
  s = summaryReducer(s, { type: 'cached', entries: { 'a:1': cached({ commitCount: 1 }, 1000) } })
  assert.equal(s.entries['a:1'].data.commitCount, 99)
  const same = summaryReducer(s, { type: 'cached', entries: {} })
  assert.equal(same, s)
})

test('summaryReducer: a batch tracks progress and ends when empty', () => {
  let s = summaryReducer(emptySummaries(), { type: 'batch', keys: ['a:1', 'a:2', 'a:3'] })
  assert.deepEqual(progressOf(s), { done: 0, total: 3 })
  s = summaryReducer(s, { type: 'fetched', key: 'a:1', entry: cached() })
  s = summaryReducer(s, { type: 'failed', key: 'a:2', error: 'nope' })
  assert.deepEqual(progressOf(s), { done: 2, total: 3 })
  assert.equal(s.failed['a:2'], 'nope')
  s = summaryReducer(s, { type: 'fetched', key: 'a:3', entry: cached() })
  assert.equal(progressOf(s), null)
})

test('summaryReducer: a new batch replaces the old one and a later success clears a failure', () => {
  let s = summaryReducer(emptySummaries(), { type: 'batch', keys: ['a:1', 'a:2'] })
  s = summaryReducer(s, { type: 'failed', key: 'a:1', error: 'x' })
  s = summaryReducer(s, { type: 'batch', keys: ['a:1'] })
  assert.deepEqual(s.pending, ['a:1'])
  assert.equal(s.total, 1)
  s = summaryReducer(s, { type: 'fetched', key: 'a:1', entry: cached() })
  assert.equal(s.failed['a:1'], undefined)
  s = summaryReducer(s, { type: 'batch', keys: [] })
  assert.equal(progressOf(s), null)
})
