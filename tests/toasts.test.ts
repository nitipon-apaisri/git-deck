import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_TOASTS, toastsReducer, type Toast } from '../src/renderer/src/lib/toasts'

const toast = (id: number): Toast => ({ id, repo: 'r', action: 'push failed', message: 'no' })

test('a new toast goes on top and the stack is capped', () => {
  let state: Toast[] = []
  for (let id = 1; id <= MAX_TOASTS + 1; id++) {
    state = toastsReducer(state, { type: 'add', toast: toast(id) })
  }
  assert.equal(state.length, MAX_TOASTS)
  assert.equal(state[0].id, MAX_TOASTS + 1)
  assert.equal(state.at(-1)?.id, 2) // the oldest one went
})

test('dismiss removes one toast and ignores an unknown id', () => {
  const state = [toast(2), toast(1)]
  assert.deepEqual(toastsReducer(state, { type: 'dismiss', id: 1 }), [toast(2)])
  assert.deepEqual(toastsReducer(state, { type: 'dismiss', id: 9 }), state)
})
