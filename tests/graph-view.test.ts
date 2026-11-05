import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { GraphRow } from '../src/shared/graph-layout'
import type { GraphCommit, GraphRef } from '../src/shared/types'
import {
  emptyPaging,
  pagingReducer,
  type GraphPaging,
  type GraphPagingAction
} from '../src/renderer/src/lib/graphPaging'
import {
  LOAD_AHEAD_ROWS,
  OVERSCAN,
  ROW_HEIGHT,
  additionsText,
  authorLabel,
  badgeViews,
  bodyText,
  commitDateText,
  deletionsText,
  edgePath,
  fileTotals,
  fileTotalsText,
  graphWidth,
  isHeadCommit,
  laneTone,
  laneX,
  loadedText,
  moveIndex,
  needsNextPage,
  scrollToRow,
  splitBadges,
  visibleRange,
  widestLane
} from '../src/renderer/src/lib/graphView'

const ref = (name: string, kind: GraphRef['kind'], current?: boolean): GraphRef => ({
  name,
  kind,
  ...(current ? { current } : {})
})

const row = (hash: string): GraphRow => ({
  commit: {
    hash,
    parents: [],
    author: 'A',
    email: 'a@x',
    date: 0,
    refs: [],
    subject: hash
  } satisfies GraphCommit,
  lane: 0,
  color: 0,
  edges: [],
  width: 1
})
const rows = (n: number, from = 0): GraphRow[] =>
  Array.from({ length: n }, (_, i) => row(`h${from + i}`))

// geometry

test('lane geometry follows the design: 16px lanes, 28px rows', () => {
  assert.equal(laneX(0), 14)
  assert.equal(laneX(2) - laneX(1), 16)
  assert.equal(graphWidth(1), 28)
  assert.equal(graphWidth(3), 60)
  assert.equal(graphWidth(0), 28)
})

test('through edges are vertical lines and straight top/bottom edges are too', () => {
  assert.equal(edgePath({ part: 'through', from: 1, to: 1, color: 0 }), 'M30 0V28')
  assert.equal(edgePath({ part: 'top', from: 0, to: 0, color: 0 }), 'M14 0V14')
  assert.equal(edgePath({ part: 'bottom', from: 0, to: 0, color: 0 }), 'M14 14V28')
})

test('merging edges are cubic curves with control points at the half-row midpoint', () => {
  // top: from lane 1 (x=30) at y=0 into the node at lane 0 (x=14, y=14), midpoint y=7
  assert.equal(edgePath({ part: 'top', from: 1, to: 0, color: 0 }), 'M30 0C30 7 14 7 14 14')
  // bottom: from the node at lane 0 down to lane 2 (x=46), midpoint y=21
  assert.equal(edgePath({ part: 'bottom', from: 0, to: 2, color: 0 }), 'M14 14C14 21 46 21 46 28')
})

test('laneTone repeats 1..6', () => {
  assert.deepEqual([0, 1, 5, 6, 7, 12].map(laneTone), [1, 2, 6, 1, 2, 1])
  assert.equal(laneTone(-1), 6)
})

test('widestLane is at least one', () => {
  assert.equal(widestLane([]), 1)
  assert.equal(widestLane([1, 4, 2]), 4)
})

// virtual list

test('visibleRange draws the viewport plus overscan on both sides', () => {
  // 10 rows fit; scrolled to row 50
  const r = visibleRange(50 * ROW_HEIGHT, 10 * ROW_HEIGHT, 1000)
  assert.deepEqual(r, { start: 50 - OVERSCAN, end: 60 + OVERSCAN })
})

test('visibleRange clamps to the data and handles an unmeasured viewport', () => {
  assert.deepEqual(visibleRange(0, 10 * ROW_HEIGHT, 1000), { start: 0, end: 10 + OVERSCAN })
  assert.deepEqual(visibleRange(0, 10 * ROW_HEIGHT, 5), { start: 0, end: 5 })
  // scrolled past the end (the list just got shorter): nothing to draw, never start > end
  assert.deepEqual(visibleRange(99999, 280, 30), { start: 30, end: 30 })
  assert.deepEqual(visibleRange(0, 0, 100), { start: 0, end: 0 })
  assert.deepEqual(visibleRange(0, 280, 0), { start: 0, end: 0 })
  assert.deepEqual(visibleRange(-50, 280, 100).start, 0)
})

test('a partial row at either edge is still drawn', () => {
  const r = visibleRange(ROW_HEIGHT / 2, ROW_HEIGHT, 100, ROW_HEIGHT, 0)
  assert.deepEqual(r, { start: 0, end: 2 })
})

const view = (over: Partial<Parameters<typeof needsNextPage>[0]> = {}) => ({
  scrollTop: 0,
  viewportHeight: 10 * ROW_HEIGHT,
  rowCount: 500,
  done: false,
  loading: false,
  error: false,
  ...over
})

test('needsNextPage fires within about 20 rows of the end', () => {
  const total = 500 * ROW_HEIGHT
  const viewportHeight = 10 * ROW_HEIGHT
  const farAway = total - viewportHeight - (LOAD_AHEAD_ROWS + 1) * ROW_HEIGHT
  const close = total - viewportHeight - LOAD_AHEAD_ROWS * ROW_HEIGHT
  assert.equal(needsNextPage(view({ scrollTop: farAway })), false)
  assert.equal(needsNextPage(view({ scrollTop: close })), true)
  assert.equal(needsNextPage(view({ scrollTop: total })), true)
})

test('needsNextPage fires when the content is shorter than the viewport', () => {
  assert.equal(needsNextPage(view({ rowCount: 5, viewportHeight: 900 })), true)
})

test('needsNextPage stays quiet while loading, when done, after an error or unmeasured', () => {
  const near = { rowCount: 5 }
  assert.equal(needsNextPage(view({ ...near, loading: true })), false)
  assert.equal(needsNextPage(view({ ...near, done: true })), false)
  assert.equal(needsNextPage(view({ ...near, error: true })), false)
  assert.equal(needsNextPage(view({ ...near, viewportHeight: 0 })), false)
})

test('moveIndex steps, pages and jumps, and starts from the top with no selection', () => {
  assert.equal(moveIndex('ArrowDown', null, 10, 5), 0)
  assert.equal(moveIndex('ArrowDown', 3, 10, 5), 4)
  assert.equal(moveIndex('ArrowDown', 9, 10, 5), 9)
  assert.equal(moveIndex('ArrowUp', 3, 10, 5), 2)
  assert.equal(moveIndex('ArrowUp', 0, 10, 5), 0)
  assert.equal(moveIndex('ArrowUp', null, 10, 5), 0)
  assert.equal(moveIndex('PageDown', 3, 10, 5), 8)
  assert.equal(moveIndex('PageDown', 8, 10, 5), 9)
  assert.equal(moveIndex('PageUp', 3, 10, 5), 0)
  assert.equal(moveIndex('Home', 5, 10, 5), 0)
  assert.equal(moveIndex('End', 5, 10, 5), 9)
})

test('moveIndex ignores other keys and an empty list', () => {
  assert.equal(moveIndex('a', 1, 10, 5), null)
  assert.equal(moveIndex('Enter', 1, 10, 5), null)
  assert.equal(moveIndex('ArrowDown', null, 0, 5), null)
})

test('scrollToRow scrolls only as far as needed', () => {
  const vh = 10 * ROW_HEIGHT
  assert.equal(scrollToRow(5, 0, vh), 0) // already visible
  assert.equal(scrollToRow(20, 0, vh), 20 * ROW_HEIGHT + ROW_HEIGHT - vh) // below: align to bottom
  assert.equal(scrollToRow(2, 10 * ROW_HEIGHT, vh), 2 * ROW_HEIGHT) // above: align to top
})

// refs

test('badgeViews orders HEAD, branches, remotes, tags and keeps git order inside a kind', () => {
  const refs = [
    ref('v1', 'tag'),
    ref('origin/main', 'remote'),
    ref('zeta', 'branch'),
    ref('main', 'branch', true),
    ref('HEAD', 'head')
  ]
  assert.deepEqual(
    badgeViews(refs, 'main').map((b) => b.name),
    ['HEAD', 'zeta', 'main', 'origin/main', 'v1']
  )
})

test('badgeViews picks the look: default branch and its remote twin are main', () => {
  const [head, feature, main, remoteMain, remoteOther, tag] = badgeViews(
    [
      ref('HEAD', 'head'),
      ref('feature/x', 'branch'),
      ref('main', 'branch', true),
      ref('origin/main', 'remote'),
      ref('origin/release/2.4', 'remote'),
      ref('v1', 'tag')
    ],
    'main'
  )
  assert.equal(head.kind, 'head')
  assert.equal(feature.kind, 'feature')
  assert.equal(main.kind, 'main')
  assert.equal(remoteMain.kind, 'main')
  assert.equal(remoteOther.kind, 'project')
  assert.equal(tag.kind, 'tag')
  assert.equal(main.current, true)
  assert.equal(feature.current, false)
})

test('a remote that only ends like the default branch is not its twin', () => {
  const [badge] = badgeViews([ref('origin/domain', 'remote')], 'main')
  assert.equal(badge.kind, 'project')
  // with no known default branch nothing is main
  assert.equal(badgeViews([ref('origin/main', 'remote')], '')[0].kind, 'project')
})

test('splitBadges shows three then counts the rest', () => {
  const badges = badgeViews(
    ['a', 'b', 'c', 'd', 'e'].map((n) => ref(n, 'branch')),
    'main'
  )
  const { shown, more } = splitBadges(badges)
  assert.equal(shown.length, 3)
  assert.equal(more, 2)
  assert.deepEqual(splitBadges(badges.slice(0, 2)), { shown: badges.slice(0, 2), more: 0 })
  assert.deepEqual(splitBadges([]), { shown: [], more: 0 })
})

test('isHeadCommit sees HEAD, also when detached', () => {
  assert.equal(isHeadCommit([ref('HEAD', 'head'), ref('main', 'branch', true)]), true)
  assert.equal(isHeadCommit([ref('HEAD', 'head')]), true)
  assert.equal(isHeadCommit([ref('main', 'branch')]), false)
  assert.equal(isHeadCommit([]), false)
})

// text

test('commitDateText is relative for a month, then a date', () => {
  const now = Date.UTC(2026, 10, 6, 12, 0, 0)
  const sec = (ms: number): number => Math.floor((now - ms) / 1000)
  assert.equal(commitDateText(sec(10_000), now), 'just now')
  assert.equal(commitDateText(sec(5 * 60_000), now), '5 min ago')
  assert.equal(commitDateText(sec(3 * 3600_000), now), '3 h ago')
  assert.equal(commitDateText(sec(10 * 24 * 3600_000), now), '10 d ago')
  assert.match(commitDateText(sec(90 * 24 * 3600_000), now), /^\d{1,2} \w{3} 2026$/)
})

test('authorLabel falls back to the email and then to Unknown', () => {
  assert.equal(authorLabel('  Ada ', 'a@x'), 'Ada')
  assert.equal(authorLabel('', 'a@x'), 'a@x')
  assert.equal(authorLabel(' ', ''), 'Unknown')
})

test('fileTotals counts binary files apart and keeps them out of the sums', () => {
  const totals = fileTotals([
    { path: 'a', additions: 3, deletions: 1 },
    { path: 'img.png', additions: null, deletions: null },
    { path: 'b', additions: 10, deletions: 0 }
  ])
  assert.deepEqual(totals, { files: 3, additions: 13, deletions: 1, binary: 1 })
  assert.equal(fileTotalsText(totals), '3 files changed, +13 −1')
  assert.equal(
    fileTotalsText(fileTotals([{ path: 'a', additions: 1, deletions: 2 }])),
    '1 file changed, +1 −2'
  )
  assert.equal(fileTotalsText(fileTotals([])), 'No file changes')
})

test('per-file count text marks binary files', () => {
  assert.equal(additionsText(12), '+12')
  assert.equal(additionsText(0), '+0')
  assert.equal(additionsText(null), 'binary')
  assert.equal(deletionsText(4), '−4')
  assert.equal(deletionsText(null), '')
})

test('bodyText drops the subject line that the panel shows as its title', () => {
  assert.equal(
    bodyText('Fix the thing\n\nLonger story\nmore', 'Fix the thing'),
    'Longer story\nmore'
  )
  assert.equal(bodyText('Fix the thing\n', 'Fix the thing'), '')
  assert.equal(bodyText('Something else entirely', 'Fix the thing'), 'Something else entirely')
  assert.equal(bodyText('', ''), '')
})

test('loadedText', () => {
  assert.equal(loadedText(0, true), '0 commits loaded')
  assert.equal(loadedText(1, true), '1 commit loaded')
  assert.equal(loadedText(1200, true), '1,200 commits loaded')
  assert.equal(loadedText(500, false), '500 commits loaded…')
})

// paging reducer

const run = (actions: GraphPagingAction[], from?: GraphPaging): GraphPaging =>
  actions.reduce(pagingReducer, from ?? emptyPaging())

test('paging: a reset starts loading a folder, with no folder it does not', () => {
  const s = run([{ type: 'reset', gen: 1, path: '/a' }])
  assert.equal(s.loading, true)
  assert.equal(s.path, '/a')
  assert.equal(run([{ type: 'reset', gen: 1, path: null }]).loading, false)
})

test('paging: full pages append and keep going, a short page finishes', () => {
  const s = run([
    { type: 'reset', gen: 1, path: '/a' },
    { type: 'page', gen: 1, rows: rows(3), requested: 3 },
    { type: 'loading', gen: 1 },
    { type: 'page', gen: 1, rows: rows(2, 3), requested: 3 }
  ])
  assert.deepEqual(
    s.rows.map((r) => r.commit.hash),
    ['h0', 'h1', 'h2', 'h3', 'h4']
  )
  assert.equal(s.done, true)
  assert.equal(s.loading, false)
  const mid = run([
    { type: 'reset', gen: 1, path: '/a' },
    { type: 'page', gen: 1, rows: rows(3), requested: 3 }
  ])
  assert.equal(mid.done, false)
})

test('paging: an empty repository is done with no rows', () => {
  const s = run([
    { type: 'reset', gen: 1, path: '/a' },
    { type: 'page', gen: 1, rows: [], requested: 500 }
  ])
  assert.equal(s.done, true)
  assert.equal(s.rows.length, 0)
  assert.equal(s.error, null)
})

test('paging: a page from an older generation is dropped', () => {
  const s = run([
    { type: 'reset', gen: 1, path: '/a' },
    { type: 'reset', gen: 2, path: '/b' },
    { type: 'page', gen: 1, rows: rows(3), requested: 3 },
    { type: 'failed', gen: 1, error: 'late' },
    { type: 'loading', gen: 1 }
  ])
  assert.equal(s.gen, 2)
  assert.equal(s.path, '/b')
  assert.equal(s.rows.length, 0)
  assert.equal(s.error, null)
  assert.equal(s.loading, true)
})

test('paging: a reload of the same folder clears the old rows and the old error', () => {
  const failed = run([
    { type: 'reset', gen: 1, path: '/a' },
    { type: 'page', gen: 1, rows: rows(3), requested: 3 },
    { type: 'failed', gen: 1, error: 'boom' }
  ])
  assert.equal(failed.error, 'boom')
  const again = run([{ type: 'reset', gen: 2, path: '/a' }], failed)
  assert.equal(again.rows.length, 0)
  assert.equal(again.error, null)
  assert.equal(again.done, false)
})

test('paging: a failed page keeps the rows and stops loading', () => {
  const s = run([
    { type: 'reset', gen: 1, path: '/a' },
    { type: 'page', gen: 1, rows: rows(3), requested: 3 },
    { type: 'loading', gen: 1 },
    { type: 'failed', gen: 1, error: 'offline' }
  ])
  assert.equal(s.rows.length, 3)
  assert.equal(s.loading, false)
  assert.equal(s.error, 'offline')
  // a retry clears the error
  assert.equal(run([{ type: 'loading', gen: 1 }], s).error, null)
})
