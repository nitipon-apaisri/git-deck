import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  abortOperation,
  cherryPick,
  continueOperation,
  getOperation,
  listStashes,
  merge,
  parseStashSubject,
  stashApply,
  stashDrop,
  stashPop,
  stashPush
} from '../src/main/git'
import { commit, emptyRepo, git } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

const read = (dir: string, file: string): string => readFileSync(join(dir, file), 'utf8')

/** main and feature both rewrite shared.txt, so combining them conflicts. */
function conflictRepo(): { dir: string; featureHash: string } {
  const dir = emptyRepo()
  commit(dir, 'shared.txt', 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  const featureHash = commit(dir, 'shared.txt', 'from feature')
  git(dir, 'checkout', '-q', 'main')
  commit(dir, 'shared.txt', 'from main')
  return { dir, featureHash }
}

test('parseStashSubject reads named and WIP stashes', () => {
  assert.deepEqual(parseStashSubject('On main: half done'), {
    branch: 'main',
    message: 'half done'
  })
  assert.deepEqual(parseStashSubject('WIP on dev: abc1234 subject'), {
    branch: 'dev',
    message: 'WIP: abc1234 subject'
  })
  assert.deepEqual(parseStashSubject('odd'), { branch: null, message: 'odd' })
})

test('stash round trip: push, list, apply, pop and drop', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  await assert.rejects(stashPush(dir, '', false), /no changes to stash/)

  writeFileSync(join(dir, 'a.txt'), 'edited\n')
  writeFileSync(join(dir, 'new.txt'), 'untracked\n')
  await stashPush(dir, 'my work', false)
  assert.equal(read(dir, 'a.txt'), 'first\n')
  assert.ok(existsSync(join(dir, 'new.txt')), 'untracked file stays without the option')

  let list = await listStashes(dir)
  assert.equal(list.length, 1)
  assert.equal(list[0].message, 'my work')
  assert.equal(list[0].branch, 'main')
  assert.match(list[0].hash, /^[0-9a-f]{40}$/)

  await stashApply(dir, 0, list[0].hash)
  assert.equal(read(dir, 'a.txt'), 'edited\n')
  assert.equal((await listStashes(dir)).length, 1, 'apply keeps the stash')

  git(dir, 'checkout', '--', 'a.txt')
  await stashPop(dir, 0, list[0].hash)
  assert.equal(read(dir, 'a.txt'), 'edited\n')
  assert.equal((await listStashes(dir)).length, 0, 'pop removes the stash')

  await stashPush(dir, '', true)
  assert.ok(!existsSync(join(dir, 'new.txt')), 'include-untracked stashes new files')
  list = await listStashes(dir)
  assert.equal(list.length, 1)
  assert.match(list[0].message, /^WIP: /)
  await stashDrop(dir, 0, list[0].hash)
  assert.equal((await listStashes(dir)).length, 0)
})

test('stash calls refuse a stale or invalid entry', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  writeFileSync(join(dir, 'a.txt'), 'one\n')
  await stashPush(dir, 'one', false)
  const [old] = await listStashes(dir)
  writeFileSync(join(dir, 'a.txt'), 'two\n')
  await stashPush(dir, 'two', false)
  // "one" moved to index 1, so index 0 with its hash no longer matches.
  await assert.rejects(stashDrop(dir, 0, old.hash), /list changed/)
  await assert.rejects(stashDrop(dir, -1, old.hash), /Invalid stash/)
  await assert.rejects(stashDrop(dir, 0, '--all'), /Invalid stash/)
  assert.equal((await listStashes(dir)).length, 2)
})

test('a stash message that looks like an option is stored as text', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  writeFileSync(join(dir, 'a.txt'), 'x\n')
  await stashPush(dir, '--include-untracked', false)
  assert.equal((await listStashes(dir))[0].message, '--include-untracked')
})

test('a clean cherry-pick applies the commit', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  git(dir, 'checkout', '-q', '-b', 'feature')
  const hash = commit(dir, 'b.txt', 'feature work')
  git(dir, 'checkout', '-q', 'main')
  assert.deepEqual(await cherryPick(dir, hash), { conflicted: false })
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'feature work')
  assert.equal(await getOperation(dir), null)
})

test('cherry-pick rejects bad input, a merge commit and a commit already applied', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  await assert.rejects(cherryPick(dir, '--abort'), /Invalid commit hash/)
  await assert.rejects(cherryPick(dir, 'abcdef0'), /does not exist/)

  git(dir, 'checkout', '-q', '-b', 'feature')
  const pick = commit(dir, 'b.txt', 'feature work')
  git(dir, 'checkout', '-q', 'main')
  commit(dir, 'c.txt', 'main work')
  git(dir, 'merge', '-q', '--no-ff', '-m', 'merge feature', 'feature')
  const mergeHash = git(dir, 'rev-parse', 'HEAD')
  await assert.rejects(cherryPick(dir, mergeHash), /merge commit/)
  // feature's change is already on main, so picking it again is empty.
  await assert.rejects(cherryPick(dir, pick), /already in the branch/)
  assert.equal(await getOperation(dir), null, 'the empty pick was aborted')
})

test('a conflicting cherry-pick stops, then abort restores the branch', async () => {
  const { dir, featureHash } = conflictRepo()
  const before = git(dir, 'rev-parse', 'HEAD')
  assert.deepEqual(await cherryPick(dir, featureHash), { conflicted: true })
  const state = await getOperation(dir)
  assert.equal(state?.kind, 'cherry-pick')
  assert.equal(state?.target, featureHash.slice(0, 7))
  assert.deepEqual(state?.conflicted, ['shared.txt'])
  await assert.rejects(cherryPick(dir, featureHash), /already in progress/)
  await assert.rejects(merge(dir, 'feature'), /already in progress/)

  await abortOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before)
  assert.equal(read(dir, 'shared.txt'), 'from main\n')
})

test('a conflicting cherry-pick can be resolved and continued', async () => {
  const { dir, featureHash } = conflictRepo()
  await cherryPick(dir, featureHash)
  await assert.rejects(continueOperation(dir), /conflict markers: shared\.txt/)
  writeFileSync(join(dir, 'shared.txt'), 'resolved\n')
  await continueOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'from feature')
  assert.equal(read(dir, 'shared.txt'), 'resolved\n')
  assert.equal(git(dir, 'status', '--porcelain'), '')
})

test('a clean merge fast-forwards, or makes a merge commit with noFf', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  git(dir, 'checkout', '-q', '-b', 'feature')
  const tip = commit(dir, 'b.txt', 'feature work')
  git(dir, 'checkout', '-q', 'main')
  assert.deepEqual(await merge(dir, 'feature'), { conflicted: false })
  assert.equal(git(dir, 'rev-parse', 'HEAD'), tip, 'fast-forward')

  git(dir, 'checkout', '-q', '-b', 'more')
  commit(dir, 'c.txt', 'more work')
  git(dir, 'checkout', '-q', 'main')
  await merge(dir, 'more', { noFf: true })
  assert.equal(git(dir, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3)
  assert.match(git(dir, 'log', '-1', '--format=%s'), /^Merge branch 'more'/)
})

test('merge rejects an unknown branch and one that looks like an option', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  await assert.rejects(merge(dir, 'nope'), /no branch named/)
  await assert.rejects(merge(dir, '--abort'), /Invalid branch name/)
})

test('a merge that cannot start because of local edits is an error, not a stop', async () => {
  const dir = emptyRepo()
  commit(dir, 'shared.txt', 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  commit(dir, 'shared.txt', 'from feature')
  git(dir, 'checkout', '-q', 'main')
  writeFileSync(join(dir, 'shared.txt'), 'dirty\n')
  await assert.rejects(merge(dir, 'feature'), /overwritten/)
  assert.equal(await getOperation(dir), null)
})

test('a conflicting merge stops, then abort restores the branch', async () => {
  const { dir } = conflictRepo()
  const before = git(dir, 'rev-parse', 'HEAD')
  assert.deepEqual(await merge(dir, 'feature'), { conflicted: true })
  const state = await getOperation(dir)
  assert.equal(state?.kind, 'merge')
  assert.deepEqual(state?.conflicted, ['shared.txt'])
  await abortOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before)
  assert.equal(read(dir, 'shared.txt'), 'from main\n')
})

test('a conflicting merge can be resolved and continued, and an old state is found again', async () => {
  const { dir } = conflictRepo()
  await merge(dir, 'feature', { noFf: true })
  // A fresh call (as on opening the repo) finds the state from the files git left.
  assert.equal((await getOperation(dir))?.kind, 'merge')
  writeFileSync(join(dir, 'shared.txt'), 'both\n')
  await continueOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(git(dir, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3)
  assert.equal(read(dir, 'shared.txt'), 'both\n')
})

test('continue and abort refuse when nothing is in progress', async () => {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  await assert.rejects(continueOperation(dir), /no merge, cherry-pick or revert/)
  await assert.rejects(abortOperation(dir), /no merge, cherry-pick or revert/)
})
