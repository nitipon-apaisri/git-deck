import assert from 'node:assert/strict'
import { test } from 'node:test'
import { heatCells, heatLevel, heatTip, monthLabels } from '../src/renderer/src/lib/profileView'

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

test('monthLabels: one label per month, skipping a short first month', () => {
  const day = (date: string) => ({ date, count: 0, level: 0 as const })
  // Sat Nov 29, then Dec 1..: Nov is one column, so it is dropped
  const cells = [
    ...Array(6).fill(null),
    day('2026-11-28'),
    ...['01', '02', '03', '04', '05', '06', '07'].map((d) => day(`2026-12-${d}`))
  ]
  assert.deepEqual(monthLabels(cells), [{ col: 1, label: 'Dec' }])
  assert.deepEqual(monthLabels([]), [])
})

test('heatTip: zero, one and many', () => {
  assert.equal(heatTip(0, '2026-11-12', 'contribution'), 'No contributions on November 12')
  assert.equal(heatTip(1, '2026-11-02', 'event'), '1 event on November 2')
  assert.equal(heatTip(3, '2026-11-12', 'event'), '3 events on November 12')
})
