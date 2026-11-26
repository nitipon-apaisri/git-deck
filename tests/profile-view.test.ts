import assert from 'node:assert/strict'
import { test } from 'node:test'
import { heatCells, heatLevel } from '../src/renderer/src/lib/profileView'

test('heatLevel: zero is empty, the busiest day is the top level', () => {
  assert.equal(heatLevel(0, 10), 0)
  assert.equal(heatLevel(1, 10), 1)
  assert.equal(heatLevel(5, 10), 2)
  assert.equal(heatLevel(10, 10), 4)
  assert.equal(heatLevel(3, 0), 0)
})

test('heatCells: pads the first week to its weekday and keeps the order', () => {
  // 2026-03-04 is a Wednesday, so three blank cells come first.
  const cells = heatCells([
    { date: '2026-03-04', count: 4 },
    { date: '2026-03-05', count: 0 }
  ])
  assert.equal(cells.length, 5)
  assert.deepEqual(cells.slice(0, 3), [null, null, null])
  assert.equal(cells[3]?.level, 4)
  assert.equal(cells[4]?.level, 0)
  assert.deepEqual(heatCells([]), [])
})
