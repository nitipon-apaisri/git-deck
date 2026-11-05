import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_ICONS } from '../src/shared/projects'
import {
  diffRepoKeys,
  filterIcons,
  iconLabel,
  isBuiltInIcon,
  nameProblem,
  pickerGroups,
  readEmojiField,
  remoteIdOf,
  replaceProject
} from '../src/renderer/src/lib/projectForm'
import {
  emptyFetchAll,
  fetchAllReducer,
  fetchTotals,
  fetchTotalsText
} from '../src/renderer/src/lib/fetchAll'
import type { Project, Repo } from '../src/shared/types'

const project = (id: string, name: string, repoKeys: string[] = []): Project => ({
  id,
  name,
  icon: 'folder',
  color: 'blue',
  repoKeys,
  createdAt: 0,
  updatedAt: 0
})

const repo = (accountId: string, id: string, fullName: string, description = ''): Repo => ({
  key: `${accountId}:${id}`,
  accountId,
  remoteId: id,
  name: fullName.split('/').pop() ?? fullName,
  fullName,
  namespace: fullName.split('/')[0],
  description,
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
})

// Name

test('nameProblem: empty is quiet until touched, then required', () => {
  assert.equal(nameProblem('', [], undefined, false), null)
  assert.equal(nameProblem('  ', [], undefined, false), null)
  assert.match(nameProblem('', [], undefined, true) ?? '', /required/)
})

test('nameProblem: too long and duplicate (case-insensitive) say so', () => {
  assert.match(nameProblem('x'.repeat(61), [], undefined, true) ?? '', /at most 60/)
  assert.equal(nameProblem('x'.repeat(60), [], undefined, true), null)
  const others = [project('a', 'Payments')]
  assert.match(nameProblem(' payments ', others, undefined, true) ?? '', /already exists/)
})

test('nameProblem: a project may keep its own name when editing', () => {
  const others = [project('a', 'Payments'), project('b', 'Infra')]
  assert.equal(nameProblem('Payments', others, 'a', true), null)
  assert.match(nameProblem('Infra', others, 'a', true) ?? '', /already exists/)
})

// Icons

test('filterIcons: no query gives all 30, a query matches id and label', () => {
  assert.equal(filterIcons('').length, PROJECT_ICONS.length)
  assert.equal(filterIcons('   ').length, PROJECT_ICONS.length)
  assert.deepEqual(filterIcons('bar chart'), ['bar-chart'])
  assert.deepEqual(filterIcons('BAR-'), ['bar-chart'])
  assert.ok(filterIcons('o').includes('rocket'))
  assert.deepEqual(filterIcons('zzz'), [])
})

test('iconLabel and isBuiltInIcon', () => {
  assert.equal(iconLabel('bar-chart'), 'bar chart')
  assert.equal(isBuiltInIcon('rocket'), true)
  assert.equal(isBuiltInIcon('🚀'), false)
})

test('readEmojiField: empty, one emoji, or invalid', () => {
  assert.deepEqual(readEmojiField(''), { kind: 'empty' })
  assert.deepEqual(readEmojiField('  '), { kind: 'empty' })
  assert.deepEqual(readEmojiField('🚀'), { kind: 'ok', icon: '🚀' })
  assert.deepEqual(readEmojiField(' 🚀 '), { kind: 'ok', icon: '🚀' })
  // A family emoji is one grapheme.
  assert.equal(readEmojiField('👨‍👩‍👧').kind, 'ok')
  assert.equal(readEmojiField('🚀🚀').kind, 'invalid')
  assert.equal(readEmojiField('a').kind, 'invalid')
  assert.equal(readEmojiField('rocket').kind, 'invalid')
})

// Repositories

test('diffRepoKeys: what to add and what to remove', () => {
  assert.deepEqual(diffRepoKeys(['a:1', 'a:2'], ['a:2', 'a:3']), { add: ['a:3'], remove: ['a:1'] })
  assert.deepEqual(diffRepoKeys(['a:1'], ['a:1']), { add: [], remove: [] })
  assert.deepEqual(diffRepoKeys([], ['a:1', 'a:1']), { add: ['a:1'], remove: [] })
})

test('replaceProject replaces in place and appends a new one', () => {
  const list = [project('a', 'A'), project('b', 'B')]
  const changed = replaceProject(list, { ...list[0], name: 'A2' })
  assert.deepEqual(
    changed.map((p) => p.name),
    ['A2', 'B']
  )
  assert.equal(replaceProject(list, project('c', 'C')).length, 3)
})

test('pickerGroups: groups by account, sorted, filtered by name or description', () => {
  const lists = {
    a: [repo('a', '1', 'org/zeta'), repo('a', '2', 'org/alpha', 'handles payments')],
    b: [repo('b', '9', 'team/beta')]
  }
  const all = pickerGroups(['a', 'b'], lists, new Set(), '')
  assert.deepEqual(
    all.groups.map((g) => [g.accountId, g.repos.map((r) => r.name)]),
    [
      ['a', ['alpha', 'zeta']],
      ['b', ['beta']]
    ]
  )
  const found = pickerGroups(['a', 'b'], lists, new Set(), 'PAYMENTS')
  assert.deepEqual(
    found.groups.map((g) => g.accountId),
    ['a']
  )
  assert.deepEqual(pickerGroups(['a', 'b'], lists, new Set(), 'nothing').groups, [])
})

test('pickerGroups: chosen keys that no list has come back as missing, so they can be unticked', () => {
  const lists = { a: [repo('a', '1', 'org/one')] }
  const chosen = new Set(['a:1', 'a:gone', 'zz:7'])
  assert.deepEqual(pickerGroups(['a'], lists, chosen, '').missing, ['a:gone', 'zz:7'])
  assert.deepEqual(pickerGroups(['a'], lists, chosen, 'gone').missing, ['a:gone'])
})

test('remoteIdOf is the part after the account', () => {
  assert.equal(remoteIdOf('a1:42'), '42')
  assert.equal(remoteIdOf('a1:group/x'), 'group/x')
})

// Fetch all

const targets = [
  { key: 'a:1', name: 'org/one', path: '/w/one' },
  { key: 'a:2', name: 'org/two', path: '/w/two' },
  { key: 'a:3', name: 'org/three', path: '/w/three' }
]

test('fetchAllReducer: queued, running, done and failed with a message', () => {
  let s = fetchAllReducer(emptyFetchAll(), { type: 'start', targets })
  assert.deepEqual(
    s.items.map((i) => i.status),
    ['queued', 'queued', 'queued']
  )
  s = fetchAllReducer(s, { type: 'running', key: 'a:1' })
  s = fetchAllReducer(s, { type: 'done', key: 'a:1' })
  s = fetchAllReducer(s, { type: 'running', key: 'a:2' })
  s = fetchAllReducer(s, { type: 'failed', key: 'a:2', error: 'no remote' })
  assert.deepEqual(
    s.items.map((i) => [i.status, i.error]),
    [
      ['done', null],
      ['failed', 'no remote'],
      ['queued', null]
    ]
  )
  assert.deepEqual(fetchTotals(s), { total: 3, done: 1, failed: 1, finished: false })
  s = fetchAllReducer(s, { type: 'done', key: 'a:3' })
  const totals = fetchTotals(s)
  assert.equal(totals.finished, true)
  assert.equal(fetchTotalsText(totals), '2 fetched, 1 failed')
})

test('fetchTotalsText for progress and a clean run; close clears the list', () => {
  let s = fetchAllReducer(emptyFetchAll(), { type: 'start', targets })
  assert.equal(fetchTotalsText(fetchTotals(s)), '0 of 3 done')
  for (const t of targets) s = fetchAllReducer(s, { type: 'done', key: t.key })
  assert.equal(fetchTotalsText(fetchTotals(s)), 'All 3 fetched')
  s = fetchAllReducer(s, { type: 'close' })
  assert.deepEqual(s.items, [])
  assert.equal(fetchTotals(s).finished, false)
})

test('fetchAllReducer ignores an unknown key', () => {
  const s = fetchAllReducer(emptyFetchAll(), { type: 'start', targets })
  const next = fetchAllReducer(s, { type: 'done', key: 'nope' })
  assert.deepEqual(next.items, s.items)
})
