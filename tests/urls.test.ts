import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isAppUrl } from '../src/main/urls'

test('dev: same origin only, not a lookalike prefix', () => {
  const dev = 'http://localhost:5173'
  assert.equal(isAppUrl('http://localhost:5173/index.html', dev), true)
  assert.equal(isAppUrl('http://localhost:5173.evil.com/', dev), false)
  assert.equal(isAppUrl('file:///x/index.html', dev), false)
  assert.equal(isAppUrl('not a url', dev), false)
})

test('prod: file urls only', () => {
  assert.equal(isAppUrl('file:///app/index.html', undefined), true)
  assert.equal(isAppUrl('https://example.com', undefined), false)
})
