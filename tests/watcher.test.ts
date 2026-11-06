import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  ignoredInGitDir,
  ignoredInWorktree,
  watchRepo,
  WATCH_DEBOUNCE_MS
} from '../src/main/watcher'
import { commit, emptyRepo, git } from './helpers'

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, WATCH_DEBOUNCE_MS + 400))

test('ignore rules keep objects, locks and node_modules out', () => {
  assert.equal(ignoredInGitDir('objects/ab/cdef'), true)
  assert.equal(ignoredInGitDir('index.lock'), true)
  assert.equal(ignoredInGitDir('HEAD'), false)
  assert.equal(ignoredInGitDir('refs/heads/main'), false)
  assert.equal(ignoredInWorktree('.git/index'), true)
  assert.equal(ignoredInWorktree('web/node_modules/x/y.js'), true)
  assert.equal(ignoredInWorktree('src/a.ts'), false)
})

test('a file edit, a commit and a checkout each fire one debounced callback', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'one')
  let calls = 0
  const stop = await watchRepo(dir, () => (calls += 1))
  try {
    await settle()
    calls = 0

    writeFileSync(join(dir, 'a.txt'), 'edited\n')
    writeFileSync(join(dir, 'a.txt'), 'edited again\n')
    await settle()
    assert.equal(calls, 1, 'a burst of edits is one callback')

    calls = 0
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'two')
    await settle()
    assert.ok(calls >= 1, 'a commit fires')

    calls = 0
    git(dir, 'checkout', '-q', '-b', 'feature')
    await settle()
    assert.ok(calls >= 1, 'a checkout fires')
  } finally {
    stop()
  }
  calls = 0
  writeFileSync(join(dir, 'a.txt'), 'after stop\n')
  await settle()
  assert.equal(calls, 0, 'nothing fires after stop')
})
