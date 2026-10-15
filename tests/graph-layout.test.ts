import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { getGraph } from '../src/main/git'
import { GraphLayout, type GraphRow } from '../src/shared/graph-layout'
import type { GraphCommit } from '../src/shared/types'
import { branchyRepo, rm } from './helpers'

const c = (hash: string, ...parents: string[]): GraphCommit => ({
  hash, parents, author: '', email: '', date: 0, refs: [], subject: hash
})

function check(rows: GraphRow[]): void {
  // Track which hash each lane is waiting for and make sure no commit sits on an open lane.
  const waiting = new Map<number, string>()
  rows.forEach((row, i) => {
    const w = waiting.get(row.lane)
    assert.ok(w === undefined || w === row.commit.hash, `row ${i} shares lane ${row.lane} with open line`)
    for (const [lane, h] of [...waiting]) if (h === row.commit.hash) waiting.delete(lane)
    row.commit.parents.forEach((p) => {
      const bottom = row.edges.filter((e) => e.part === 'bottom')
      assert.ok(bottom.length >= 1)
      const lane = [...waiting].find(([, h]) => h === p)?.[0]
      if (lane === undefined) {
        // find the lane from a bottom edge not yet claimed
        const target = bottom.map((e) => e.to).find((t) => !waiting.has(t))
        assert.notEqual(target, undefined)
        waiting.set(target!, p)
      }
    })
  })
}

describe('GraphLayout', () => {
  it('lays out a linear history in one lane', () => {
    const rows = new GraphLayout().addAll([c('c', 'b'), c('b', 'a'), c('a')])
    assert.ok(rows.every((r) => r.lane === 0 && r.width === 1))
    assert.deepEqual(rows[1].edges.map((e) => e.part).sort(), ['bottom', 'top'])
  })

  it('merge commits produce a bottom edge to a second lane', () => {
    const layout = new GraphLayout()
    const rows = layout.addAll([c('m', 'a', 'b'), c('b', 'r'), c('a', 'r'), c('r')])
    const merge = rows[0]
    const bottoms = merge.edges.filter((e) => e.part === 'bottom')
    assert.equal(bottoms.length, 2)
    assert.deepEqual(bottoms.map((e) => e.to).sort(), [0, 1])
    assert.ok(bottoms.some((e) => e.from === 0 && e.to === 1))
    assert.equal(layout.maxLanes, 2)
    // b sits on lane 1, a on lane 0; root r joins both lines
    assert.equal(rows[1].lane, 1)
    assert.equal(rows[2].lane, 0)
    assert.equal(rows[3].edges.filter((e) => e.part === 'top').length, 2)
  })

  it('appends pages while keeping state', () => {
    const layout = new GraphLayout()
    const first = layout.addAll([c('m', 'a', 'b')])
    const second = layout.addAll([c('b', 'r'), c('a', 'r'), c('r')])
    assert.equal(first[0].width, 2)
    assert.equal(second[0].lane, 1)
    assert.equal(second[0].edges.some((e) => e.part === 'through' && e.from === 0), true)
  })

  it('frees lanes after a root commit', () => {
    const rows = new GraphLayout().addAll([c('x'), c('y')])
    assert.equal(rows[1].lane, 0)
  })
})

describe('GraphLayout on a real repo', () => {
  const dir = branchyRepo()
  after(() => rm(dir))

  it('keeps invariants and shows the merge', async () => {
    const commits = await getGraph(dir, 0, 100)
    const rows = new GraphLayout().addAll(commits)
    check(rows)
    const merge = rows.find((r) => r.commit.subject === 'M')!
    const bottoms = merge.edges.filter((e) => e.part === 'bottom')
    assert.equal(bottoms.length, 2)
    assert.notEqual(bottoms[0].to, bottoms[1].to)
    const lanes = new Set(rows.map((r) => r.lane))
    assert.equal(lanes.size, 2)
  })
})
