import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  remoteFormProblem,
  resetModeHint,
  tagDetail,
  tagKind,
  tagStartLabel
} from '../src/renderer/src/lib/historyView'

test('tags are described by kind, commit and message', () => {
  assert.equal(tagKind({ annotated: true }), 'annotated')
  assert.equal(tagKind({ annotated: false }), 'lightweight')
  assert.equal(
    tagDetail({ annotated: true, hash: 'abcdef0123456', message: 'Release one' }),
    'annotated · abcdef0 · Release one'
  )
  assert.equal(
    tagDetail({ annotated: false, hash: 'abcdef0123456', message: null }),
    'lightweight · abcdef0'
  )
})

test('a new tag says where it points', () => {
  assert.equal(tagStartLabel('abcdef0123456'), 'abcdef0')
  assert.equal(tagStartLabel(null), 'the current commit')
})

test('each reset mode says what happens to the changes', () => {
  assert.match(resetModeHint('soft'), /staged/)
  assert.match(resetModeHint('mixed'), /unstaged/)
  assert.match(resetModeHint('hard'), /discards/)
})

test('the remote form catches an empty field, a space and a token in the URL', () => {
  assert.match(remoteFormProblem('', 'https://example.com/x.git') ?? '', /name/)
  assert.match(remoteFormProblem('a b', 'https://example.com/x.git') ?? '', /spaces/)
  assert.match(remoteFormProblem('origin', '') ?? '', /URL/)
  assert.match(remoteFormProblem('origin', 'https://tok@example.com/x.git') ?? '', /token/)
  assert.equal(remoteFormProblem('origin', 'https://example.com/x.git'), null)
  assert.equal(remoteFormProblem(' origin ', ' git@example.com:me/x.git '), null)
})
