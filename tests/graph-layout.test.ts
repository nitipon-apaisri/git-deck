import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getGraph } from '../src/main/git'
import { GraphLayout } from '../src/shared/graph-layout'
import type { GraphCommit } from '../src/shared/types'
import { branchyRepo } from './helpers'

const c = (hash: string, parents: string[]): GraphCommit => ({
  hash,
  parents,
  author: '',
  email: '',
  date: 0,
  refs: [],
  subject: hash
})

test('linear history stays in lane 0 with one colour', () => {
  const rows = new GraphLayout().add([c('c', ['b']), c('b', ['a']), c('a', [])])
  assert.deepEqual(
    rows.map((r) => r.lane),
    [0, 0, 0]
  )
  assert.equal(new Set(rows.map((r) => r.color)).size, 1)
  assert.deepEqual(
    rows[2].edges.map((e) => e.part),
    ['top']
  )
})

test('merge commit draws a bottom edge to a second lane', () => {
  // m merges main-side b and feature-side f, both children of a.
  const layout = new GraphLayout()
  const rows = layout.add([c('m', ['b', 'f']), c('b', ['a']), c('f', ['a']), c('a', [])])
  const bottoms = rows[0].edges.filter((e) => e.part === 'bottom')
  assert.equal(bottoms.length, 2)
  assert.ok(bottoms.some((e) => e.from === 0 && e.to === 1))
  assert.equal(rows[2].lane, 1)
  // b is drawn with lane 1 still open: a through edge.
  assert.ok(rows[1].edges.some((e) => e.part === 'through' && e.from === 1))
  // Lanes converge at a.
  assert.equal(rows[3].lane, 0)
  assert.equal(rows[3].edges.filter((e) => e.part === 'top').length, 2)
  assert.equal(layout.maxLanes, 2)
})

test('a new branch tip takes the first free lane and a new colour', () => {
  const rows = new GraphLayout().add([c('x', ['a']), c('y', ['a']), c('a', [])])
  assert.equal(rows[0].lane, 0)
  assert.equal(rows[1].lane, 1)
  assert.notEqual(rows[0].color, rows[1].color)
})

test('pages can be appended and keep lane state', () => {
  const layout = new GraphLayout()
  const first = layout.add([c('m', ['b', 'f']), c('b', ['a'])])
  const second = layout.add([c('f', ['a']), c('a', [])])
  assert.equal(
    first[1].edges.some((e) => e.part === 'through' && e.from === 1),
    true
  )
  assert.equal(second[0].lane, 1)
})

test('colours wrap around the palette', () => {
  const layout = new GraphLayout(2)
  const rows = layout.add([c('1', []), c('2', []), c('3', [])])
  assert.deepEqual(
    rows.map((r) => r.color),
    [0, 1, 0]
  )
})

test('real repo: no commit shares a lane with an open line, parents come after children', async () => {
  const commits = await getGraph(branchyRepo(), 0, 50)
  const rows = new GraphLayout().add(commits)
  const position = new Map(commits.map((x, i) => [x.hash, i]))
  for (const [i, row] of rows.entries()) {
    for (const p of row.commit.parents) assert.ok(position.get(p)! > i)
    // An open line passing straight through this row never uses the commit's own lane.
    assert.ok(!row.edges.some((e) => e.part === 'through' && e.from === row.lane))
    assert.ok(row.width >= row.lane + 1)
  }
  const merge = rows.find((r) => r.commit.parents.length === 2)!
  const bottoms = merge.edges.filter((e) => e.part === 'bottom')
  assert.ok(bottoms.some((e) => e.to !== merge.lane))
})
