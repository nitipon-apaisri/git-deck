import assert from 'node:assert/strict'
import { existsSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  addWorktree,
  listWorktrees,
  lockWorktree,
  pruneWorktrees,
  removeWorktree,
  worktreeDirty
} from '../src/main/git'
import { parseWorktrees } from '../src/shared/worktrees'
import { commit, emptyRepo, git, tempDir } from './helpers'

test('parseWorktrees reads main, linked, detached, locked and prunable records', () => {
  const text = [
    'worktree /r',
    'HEAD aaa',
    'branch refs/heads/main',
    '',
    'worktree /r-wt',
    'HEAD bbb',
    'branch refs/heads/feat/x',
    'locked in use',
    '',
    'worktree /r-det',
    'HEAD ccc',
    'detached',
    'locked',
    '',
    'worktree /gone',
    'HEAD ddd',
    'detached',
    'prunable gitdir file points to non-existent location',
    ''
  ].join('\n')
  const [main, wt, det, gone] = parseWorktrees(text)
  assert.deepEqual([main.path, main.branch, main.isMain], ['/r', 'main', true])
  assert.deepEqual([wt.branch, wt.locked, wt.isMain], ['feat/x', 'in use', false])
  assert.deepEqual([det.detached, det.branch, det.locked], [true, null, ''])
  assert.match(gone.prunable ?? '', /non-existent/)
  assert.deepEqual(parseWorktrees(''), [])
})

test('add, list, lock, remove and prune a worktree', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  git(dir, 'branch', 'existing')
  const base = realpathSync(tempDir())
  const wt1 = join(base, 'one')
  const wt2 = join(base, 'two')

  await addWorktree(dir, wt1, 'new-branch', true)
  await addWorktree(dir, wt2, 'existing', false)
  await assert.rejects(addWorktree(dir, join(base, 'x'), 'existing', true), /already exists/)
  await assert.rejects(addWorktree(dir, join(base, 'y'), 'nope', false), /no branch/)

  const list = await listWorktrees(dir)
  assert.deepEqual(
    list.map((w) => [w.branch, w.isMain]),
    [
      ['main', true],
      ['new-branch', false],
      ['existing', false]
    ]
  )

  await lockWorktree(dir, wt1, true)
  assert.equal((await listWorktrees(dir))[1].locked, '')
  await assert.rejects(removeWorktree(dir, wt1, false))
  await lockWorktree(dir, wt1, false)

  writeFileSync(join(wt2, 'dirty.txt'), 'x')
  assert.equal(await worktreeDirty(wt2), true)
  await assert.rejects(removeWorktree(dir, wt2, false))
  await removeWorktree(dir, wt2, true)
  assert.equal(existsSync(wt2), false)

  // A folder deleted behind git's back is prunable, then gone after prune.
  rmSync(wt1, { recursive: true })
  assert.ok((await listWorktrees(dir))[1].prunable)
  await pruneWorktrees(dir)
  assert.equal((await listWorktrees(dir)).length, 1)
})
