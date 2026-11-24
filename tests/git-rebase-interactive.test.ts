import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  abortOperation,
  continueOperation,
  getOperation,
  rebasePlan,
  rebaseRun
} from '../src/main/git'
import type { RebaseTodoItem } from '../src/shared/types'
import { commit, emptyRepo, git } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

/** base, then a, b, c on main. */
function repo(): { dir: string; base: string; hashes: string[] } {
  const dir = emptyRepo()
  const base = commit(dir, 'base.txt', 'base')
  const hashes = ['a', 'b', 'c'].map((n) => commit(dir, `${n}.txt`, n))
  return { dir, base, hashes }
}

const subjects = (dir: string): string[] => git(dir, 'log', '--format=%s', '--reverse').split('\n')
const todo = (hashes: string[], ...actions: RebaseTodoItem['action'][]): RebaseTodoItem[] =>
  hashes.map((hash, i) => ({ hash, action: actions[i] ?? 'pick' }))

test('plan lists commits oldest first and none as pushed', async () => {
  const { dir, base, hashes } = repo()
  const plan = await rebasePlan(dir, base)
  assert.deepEqual(
    plan.commits.map((c) => c.hash),
    hashes
  )
  assert.deepEqual(plan.pushed, [])
})

test('reorder, drop, fixup and squash', async () => {
  const { dir, base, hashes } = repo()
  const [a, b, c] = hashes
  assert.deepEqual(await rebaseRun(dir, base, todo([c, a, b]), false), { conflicted: false })
  assert.deepEqual(subjects(dir), ['base', 'c', 'a', 'b'])

  const r = repo()
  await rebaseRun(r.dir, r.base, todo(r.hashes, 'pick', 'drop', 'pick'), false)
  assert.deepEqual(subjects(r.dir), ['base', 'a', 'c'])

  const f = repo()
  await rebaseRun(f.dir, f.base, todo(f.hashes, 'pick', 'fixup', 'squash'), false)
  assert.equal(git(f.dir, 'rev-list', '--count', `${f.base}..HEAD`), '1')
  assert.match(git(f.dir, 'log', '-1', '--format=%B'), /^a/)
})

test('reword keeps a message with quotes and newlines out of the command line', async () => {
  const { dir, base, hashes } = repo()
  const message = `it's "new"; $(touch pwned)\n\nbody`
  const items = todo(hashes)
  items[1] = { ...items[1], action: 'reword', message }
  await rebaseRun(dir, base, items, false)
  assert.equal(git(dir, 'log', '--format=%B', '-n1', 'HEAD~1'), message)
  assert.deepEqual(subjects(dir).length, 4)
})

test('refused: dirty tree, unknown hash, incomplete todo, leading squash, pushed, bad base', async () => {
  const { dir, base, hashes } = repo()
  await assert.rejects(rebaseRun(dir, base, todo(hashes, 'squash'), false), /first commit/)
  await assert.rejects(rebaseRun(dir, base, todo(hashes).slice(1), false), /every commit/)
  await assert.rejects(
    rebaseRun(
      dir,
      base,
      [...todo(hashes).slice(0, 2), { hash: 'f'.repeat(40), action: 'pick' }],
      false
    ),
    /not valid/
  )
  await assert.rejects(
    rebaseRun(
      dir,
      base,
      [{ hash: hashes[0], action: 'reword', message: ' ' }, ...todo(hashes).slice(1)],
      false
    ),
    /needs a message/
  )
  await assert.rejects(rebasePlan(dir, '--oneline'), /Invalid commit/)
  await assert.rejects(rebasePlan(dir, hashes[2]), /no commits/)
  writeFileSync(join(dir, 'a.txt'), 'dirty')
  await assert.rejects(rebaseRun(dir, base, todo(hashes), false), /Commit or stash/)
  git(dir, 'checkout', '-q', '--', '.')
  git(dir, 'update-ref', 'refs/remotes/origin/main', hashes[1])
  assert.deepEqual((await rebasePlan(dir, base)).pushed, hashes.slice(0, 2))
  await assert.rejects(rebaseRun(dir, base, todo(hashes), false), /already pushed/)
  assert.deepEqual(await rebaseRun(dir, base, todo(hashes), true), { conflicted: false })
})

test('refused: a merge commit in the range', async () => {
  const dir = emptyRepo()
  const base = commit(dir, 'base.txt', 'base')
  git(dir, 'checkout', '-q', '-b', 'side')
  commit(dir, 's.txt', 's')
  git(dir, 'checkout', '-q', 'main')
  commit(dir, 'm.txt', 'm')
  git(dir, 'merge', '-q', '--no-ff', '-m', 'merge', 'side')
  await assert.rejects(rebasePlan(dir, base), /merge commit/)
})

/** b and c both rewrite shared.txt, so reordering them conflicts. */
function conflictRepo(): { dir: string; base: string; hashes: string[] } {
  const dir = emptyRepo()
  const base = commit(dir, 'shared.txt', 'base')
  const hashes = [commit(dir, 'shared.txt', 'one'), commit(dir, 'shared.txt', 'two')]
  return { dir, base, hashes }
}

test('a conflict stops, then continue finishes', async () => {
  const { dir, base, hashes } = conflictRepo()
  const result = await rebaseRun(dir, base, todo([hashes[1], hashes[0]]), false)
  assert.deepEqual(result, { conflicted: true })
  assert.equal((await getOperation(dir))?.kind, 'rebase')
  writeFileSync(join(dir, 'shared.txt'), 'fixed\n')
  git(dir, 'add', 'shared.txt')
  await continueOperation(dir)
  // The second replay conflicts again; resolve it too.
  for (let i = 0; i < 3 && (await getOperation(dir)); i++) {
    writeFileSync(join(dir, 'shared.txt'), `fixed ${i}\n`)
    git(dir, 'add', 'shared.txt')
    await continueOperation(dir)
  }
  assert.equal(await getOperation(dir), null)
})

test('a conflict stops, then abort restores the branch', async () => {
  const { dir, base, hashes } = conflictRepo()
  const before = git(dir, 'rev-parse', 'HEAD')
  await rebaseRun(dir, base, todo([hashes[1], hashes[0]]), false)
  await abortOperation(dir)
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before)
  assert.equal(await getOperation(dir), null)
})
