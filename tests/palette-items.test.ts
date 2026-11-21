import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildPaletteItems,
  filterPaletteItems,
  PALETTE_LIMIT,
  type PaletteInput,
  type PaneCommands
} from '../src/renderer/src/lib/paletteItems'

const calls: string[] = []
const pane = (over: Partial<PaneCommands> = {}): PaneCommands => ({
  linked: true,
  currentBranch: 'main',
  branches: ['main', 'feat/login'],
  fetch: () => calls.push('fetch'),
  pull: () => calls.push('pull'),
  checkout: (b) => calls.push(`checkout ${b}`),
  toggleTerminal: () => calls.push('terminal'),
  reveal: (h) => calls.push(`reveal ${h}`),
  loadTags: async () => [],
  ...over
})
const input = (over: Partial<PaletteInput> = {}): PaletteInput => ({
  repos: [
    { key: 'a/1', fullName: 'acme/api' },
    { key: 'a/2', fullName: 'acme/web' }
  ],
  pane: pane(),
  tags: [{ name: 'v1.0', hash: 'abc' }],
  openRepo: (k) => calls.push(`open ${k}`),
  openSettings: () => calls.push('settings'),
  switchTheme: () => calls.push('theme'),
  themeLabel: 'Dark',
  ...over
})
const ids = (input_: PaletteInput, q = ''): string[] =>
  filterPaletteItems(buildPaletteItems(input_), q).map((i) => i.id)

test('a linked pane adds fetch, pull, terminal, other branches and tags', () => {
  assert.deepEqual(ids(input()), [
    'fetch',
    'pull',
    'terminal',
    'settings',
    'theme',
    'repo:a/1',
    'repo:a/2',
    'branch:feat/login', // the checked-out branch is left out
    'tag:v1.0'
  ])
})

test('no open repository: only app actions and repos', () => {
  assert.deepEqual(ids(input({ pane: null, tags: [] })), [
    'settings',
    'theme',
    'repo:a/1',
    'repo:a/2'
  ])
})

test('a pane that is not cloned has no git actions', () => {
  const got = ids(input({ pane: pane({ linked: false }) }))
  assert.ok(!got.includes('fetch') && !got.includes('branch:feat/login'))
})

test('each pane gets its own branch items and runs on that pane', () => {
  calls.length = 0
  const second = pane({ branches: ['dev'], currentBranch: null })
  const items = buildPaletteItems(input({ pane: second }))
  assert.ok(!items.some((i) => i.id === 'branch:feat/login'))
  items.find((i) => i.id === 'branch:dev')?.run()
  items.find((i) => i.id === 'tag:v1.0')?.run()
  assert.deepEqual(calls, ['checkout dev', 'reveal abc'])
})

test('ranking: prefix, then word start, then inside', () => {
  const p = pane({ branches: ['xlogin', 'login-fix', 'fix-login', 'main'] })
  assert.deepEqual(
    ids(input({ pane: p, repos: [], tags: [] }), 'login').filter((i) => i.startsWith('branch')),
    ['branch:login-fix', 'branch:fix-login', 'branch:xlogin']
  )
})

test('the query ignores case and surrounding spaces; no match is empty', () => {
  assert.deepEqual(ids(input(), '  ACME/W '), ['repo:a/2'])
  assert.deepEqual(ids(input(), 'zzz'), [])
})

test('results are capped', () => {
  const repos = Array.from({ length: 500 }, (_, i) => ({ key: `k${i}`, fullName: `org/r${i}` }))
  assert.equal(ids(input({ repos }), '').length, PALETTE_LIMIT)
  assert.equal(ids(input({ repos }), 'org').length, PALETTE_LIMIT)
})
