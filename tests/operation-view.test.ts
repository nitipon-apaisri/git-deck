import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  conflictPreview,
  operationHint,
  operationTitle,
  stashButtonLabel,
  stashTitle
} from '../src/renderer/src/lib/operationView'
import type { OperationState } from '../src/shared/types'

const state = (extra: Partial<OperationState> = {}): OperationState => ({
  kind: 'merge',
  target: 'abc1234',
  conflicted: ['a.txt'],
  ...extra
})

test('operationTitle names the operation and the commit', () => {
  assert.equal(operationTitle(state()), 'Merge in progress (abc1234)')
  assert.equal(
    operationTitle(state({ kind: 'cherry-pick', target: null })),
    'Cherry-pick in progress'
  )
})

test('operationHint counts the files left and says when none are', () => {
  assert.match(operationHint(state()), /^1 file has conflicts\. Fix it/)
  assert.match(
    operationHint(state({ conflicted: ['a', 'b'] })),
    /^2 files have conflicts\. Fix them/
  )
  assert.match(operationHint(state({ conflicted: [] })), /Every conflict is resolved/)
})

test('conflictPreview caps the list', () => {
  const paths = ['1', '2', '3', '4', '5', '6', '7']
  assert.deepEqual(conflictPreview(paths), { shown: paths.slice(0, 5), more: 2 })
  assert.deepEqual(conflictPreview(['a']), { shown: ['a'], more: 0 })
})

test('stash labels', () => {
  assert.equal(stashTitle({ message: '  ' }), '(no message)')
  assert.equal(stashTitle({ message: 'wip' }), 'wip')
  assert.equal(stashButtonLabel(0), 'Stash')
  assert.equal(stashButtonLabel(3), 'Stash · 3')
})
