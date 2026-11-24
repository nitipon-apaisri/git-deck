import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isUnchanged,
  moveRow,
  patchRow,
  rebaseProblem,
  rowsFromPlan,
  toTodo
} from '../src/renderer/src/lib/rebaseView'

const plan = {
  commits: [
    { hash: 'a'.repeat(40), subject: 'one', message: 'one\n\nbody' },
    { hash: 'b'.repeat(40), subject: 'two', message: 'two' },
    { hash: 'c'.repeat(40), subject: 'three', message: 'three' }
  ],
  pushed: []
}

test('rows start as picks in plan order, unchanged', () => {
  const rows = rowsFromPlan(plan)
  assert.deepEqual(
    rows.map((r) => r.action),
    ['pick', 'pick', 'pick']
  )
  assert.equal(isUnchanged(rows, plan), true)
  assert.equal(rebaseProblem(rows), null)
})

test('a reword starts from the whole message, body included', () => {
  assert.equal(rowsFromPlan(plan)[0].message, 'one\n\nbody')
})

test('moveRow swaps neighbours and ignores the ends', () => {
  const rows = rowsFromPlan(plan)
  assert.deepEqual(
    moveRow(rows, 0, 1).map((r) => r.subject),
    ['two', 'one', 'three']
  )
  assert.equal(moveRow(rows, 0, -1), rows)
  assert.equal(moveRow(rows, 2, 1), rows)
  assert.equal(isUnchanged(moveRow(rows, 0, 1), plan), false)
})

test('problems: leading squash, empty reword, all dropped', () => {
  const rows = rowsFromPlan(plan)
  assert.match(rebaseProblem(patchRow(rows, 0, { action: 'squash' })) ?? '', /first commit/)
  assert.match(rebaseProblem(patchRow(rows, 0, { action: 'fixup' })) ?? '', /first commit/)
  assert.equal(
    rebaseProblem(patchRow(patchRow(rows, 0, { action: 'drop' }), 1, { action: 'squash' })) !==
      null,
    true
  )
  assert.match(
    rebaseProblem(patchRow(rows, 1, { action: 'reword', message: ' ' })) ?? '',
    /message/
  )
  const dropped = rows.map((r) => ({ ...r, action: 'drop' as const }))
  assert.match(rebaseProblem(dropped) ?? '', /at least one/)
})

test('toTodo sends a message only for a reword', () => {
  const rows = patchRow(rowsFromPlan(plan), 1, { action: 'reword', message: 'new' })
  const todo = toTodo(rows)
  assert.deepEqual(todo[1], { hash: 'b'.repeat(40), action: 'reword', message: 'new' })
  assert.equal('message' in todo[0], false)
})
