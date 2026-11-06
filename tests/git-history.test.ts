import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  abortOperation,
  addRemote,
  assertRemoteUrl,
  continueOperation,
  createTag,
  deleteRemoteTag,
  deleteTag,
  getOperation,
  getRemotes,
  getResetImpact,
  getTagRemote,
  listTags,
  pushTag,
  removeRemote,
  renameRemote,
  reset,
  revert
} from '../src/main/git'
import { commit, emptyRepo, git, tempDir } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

const read = (dir: string, file: string): string => readFileSync(join(dir, file), 'utf8')

function twoCommits(): { dir: string; first: string; second: string } {
  const dir = emptyRepo()
  const first = commit(dir, 'a.txt', 'first')
  const second = commit(dir, 'b.txt', 'second')
  return { dir, first, second }
}

// Tags

test('tags: lightweight and annotated tags are created, listed and deleted', async () => {
  const { dir, first, second } = twoCommits()
  await createTag(dir, 'light', first, null)
  await createTag(dir, 'v1', null, 'Release one\n\nwith a body')
  const tags = await listTags(dir)
  const light = tags.find((t) => t.name === 'light')
  const annotated = tags.find((t) => t.name === 'v1')
  assert.deepEqual(
    { hash: light?.hash, annotated: light?.annotated, message: light?.message },
    { hash: first, annotated: false, message: null }
  )
  assert.deepEqual(
    { hash: annotated?.hash, annotated: annotated?.annotated, message: annotated?.message },
    { hash: second, annotated: true, message: 'Release one' }
  )
  await deleteTag(dir, 'light')
  assert.deepEqual(
    (await listTags(dir)).map((t) => t.name),
    ['v1']
  )
})

test('tags: bad names, hashes and duplicates are refused', async () => {
  const { dir } = twoCommits()
  await assert.rejects(createTag(dir, '--delete', null, null), /not a valid tag name/)
  await assert.rejects(createTag(dir, 'a b', null, null), /not a valid tag name/)
  await assert.rejects(createTag(dir, 'x..y', null, null), /not a valid tag name/)
  await assert.rejects(createTag(dir, 'ok', '--all', null), /Invalid commit hash/)
  await assert.rejects(createTag(dir, 'ok', 'abcdef0', null), /does not exist/)
  await createTag(dir, 'once', null, null)
  await assert.rejects(createTag(dir, 'once', null, null), /already exists/)
  await assert.rejects(deleteTag(dir, 'missing'), /There is no tag/)
  await assert.rejects(deleteTag(dir, '-d'), /not a valid tag name/)
})

test('tags: an empty repository has nothing to tag', async () => {
  await assert.rejects(createTag(emptyRepo(), 'v1', null, null), /no commit to tag/)
})

test('tags: a message that looks like an option stays text', async () => {
  const { dir } = twoCommits()
  await createTag(dir, 'v1', null, '--amend')
  assert.equal((await listTags(dir))[0].message, '--amend')
})

function withRemote(): { dir: string; bare: string } {
  const { dir } = twoCommits()
  const bare = tempDir('gitdeck-bare-')
  git(bare, 'init', '-q', '--bare', '-b', 'main')
  git(dir, 'remote', 'add', 'origin', bare)
  git(dir, 'push', '-q', 'origin', 'main')
  return { dir, bare }
}

test('tags: a tag is pushed to the remote and deleted there', async () => {
  const { dir, bare } = withRemote()
  await createTag(dir, 'v1', null, 'one')
  await pushTag(dir, 'v1')
  assert.equal(git(bare, 'tag', '-l'), 'v1')
  await deleteRemoteTag(dir, 'v1')
  assert.equal(git(bare, 'tag', '-l'), '')
  // The local tag is untouched.
  assert.equal(git(dir, 'tag', '-l'), 'v1')
  await assert.rejects(pushTag(dir, 'nope'), /There is no tag/)
  await assert.rejects(pushTag(dir, '-f'), /not a valid tag name/)
})

test('tags: push works with a detached HEAD and refuses an unclear remote', async () => {
  const { dir, bare } = withRemote()
  await createTag(dir, 'v1', null, null)
  git(dir, 'checkout', '-q', '--detach')
  await pushTag(dir, 'v1')
  assert.equal(git(bare, 'tag', '-l'), 'v1')
  git(dir, 'remote', 'rename', 'origin', 'upstream')
  git(dir, 'remote', 'add', 'second', bare)
  await assert.rejects(getTagRemote(dir), /none is named origin/)
  assert.deepEqual(await getTagRemote(emptyRepoWithRemote()).then((r) => r.remote), 'only')
})

function emptyRepoWithRemote(): string {
  const dir = emptyRepo()
  git(dir, 'remote', 'add', 'only', tempDir('gitdeck-bare-'))
  return dir
}

// Revert

test('revert: a clean revert adds a commit that undoes the change', async () => {
  const { dir, second } = twoCommits()
  assert.deepEqual(await revert(dir, second), { conflicted: false })
  assert.match(git(dir, 'log', '-1', '--format=%s'), /^Revert "second"/)
  assert.equal(existsSync(join(dir, 'b.txt')), false)
})

test('revert: bad input, a merge commit and a detached HEAD are refused', async () => {
  const { dir, second } = twoCommits()
  await assert.rejects(revert(dir, '--abort'), /Invalid commit hash/)
  await assert.rejects(revert(dir, 'abcdef0'), /does not exist/)
  git(dir, 'checkout', '-q', '-b', 'feature')
  commit(dir, 'f.txt', 'feature')
  git(dir, 'checkout', '-q', 'main')
  commit(dir, 'm.txt', 'main side')
  git(dir, 'merge', '-q', '--no-ff', '-m', 'merge', 'feature')
  const mergeHash = git(dir, 'rev-parse', 'HEAD')
  await assert.rejects(revert(dir, mergeHash), /merge commit/)
  git(dir, 'checkout', '-q', '--detach')
  await assert.rejects(revert(dir, second), /detached/)
})

function conflictingRevert(): { dir: string; target: string } {
  const dir = emptyRepo()
  commit(dir, 'shared.txt', 'base')
  const target = commit(dir, 'shared.txt', 'changed once')
  commit(dir, 'shared.txt', 'changed again')
  return { dir, target }
}

test('revert: a conflict stops, shows as a revert and can be aborted', async () => {
  const { dir, target } = conflictingRevert()
  const before = git(dir, 'rev-parse', 'HEAD')
  assert.deepEqual(await revert(dir, target), { conflicted: true })
  const state = await getOperation(dir)
  assert.equal(state?.kind, 'revert')
  assert.deepEqual(state?.conflicted, ['shared.txt'])
  await assert.rejects(revert(dir, target), /already in progress/)
  await abortOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before)
})

test('revert: a conflict can be fixed and continued', async () => {
  const { dir, target } = conflictingRevert()
  await revert(dir, target)
  await assert.rejects(continueOperation(dir), /conflict markers/)
  writeFileSync(join(dir, 'shared.txt'), 'fixed\n')
  await continueOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.match(git(dir, 'log', '-1', '--format=%s'), /^Revert/)
  assert.equal(read(dir, 'shared.txt'), 'fixed\n')
})

test('revert: local edits in the way are an error, not a half-state', async () => {
  const { dir, second } = twoCommits()
  writeFileSync(join(dir, 'b.txt'), 'edited\n')
  await assert.rejects(revert(dir, second))
  assert.equal(await getOperation(dir), null)
  assert.equal(read(dir, 'b.txt'), 'edited\n')
})

// Reset

test('reset: soft keeps index and files, mixed keeps files, hard resets both', async () => {
  const { dir, first, second } = twoCommits()
  await reset(dir, first, 'soft')
  assert.equal(git(dir, 'rev-parse', 'HEAD'), first)
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), 'b.txt')
  commit(dir, 'b.txt', 'second again')
  await reset(dir, first, 'mixed')
  assert.equal(git(dir, 'diff', '--cached', '--name-only'), '')
  assert.equal(git(dir, 'status', '--porcelain'), '?? b.txt')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'again')
  await reset(dir, first, 'hard')
  assert.equal(git(dir, 'status', '--porcelain'), '')
  assert.equal(existsSync(join(dir, 'b.txt')), false)
  assert.ok(second)
})

test('reset: bad mode, hash and an operation in progress are refused', async () => {
  const { dir, first } = twoCommits()
  await assert.rejects(reset(dir, first, 'merge' as never), /Unknown reset mode/)
  await assert.rejects(reset(dir, '--hard', 'hard'), /Invalid commit hash/)
  await assert.rejects(reset(dir, 'abcdef0', 'hard'), /does not exist/)
  const { dir: cdir, target } = conflictingRevert()
  await revert(cdir, target)
  await assert.rejects(reset(cdir, target, 'hard'), /already in progress/)
})

test('reset: the impact counts commits and changed tracked files, not untracked ones', async () => {
  const { dir, first } = twoCommits()
  writeFileSync(join(dir, 'a.txt'), 'edited\n')
  writeFileSync(join(dir, 'new.txt'), 'untracked\n')
  assert.deepEqual(await getResetImpact(dir, first), { commits: 1, files: 1 })
})

// Remotes

test('remotes: add, rename and remove', async () => {
  const dir = emptyRepo()
  await addRemote(dir, 'origin', 'https://example.com/a/b.git')
  await addRemote(dir, 'fork', 'git@example.com:me/b.git')
  assert.deepEqual(await getRemotes(dir), [
    { name: 'fork', url: 'git@example.com:me/b.git' },
    { name: 'origin', url: 'https://example.com/a/b.git' }
  ])
  await renameRemote(dir, 'fork', 'mine')
  await removeRemote(dir, 'origin')
  assert.deepEqual(
    (await getRemotes(dir)).map((r) => r.name),
    ['mine']
  )
})

test('remotes: names and URLs that could cause harm are refused', async () => {
  const dir = emptyRepo()
  await assert.rejects(addRemote(dir, '--mirror', 'https://example.com/x.git'), /not valid/)
  await assert.rejects(addRemote(dir, 'a b', 'https://example.com/x.git'), /not valid/)
  await assert.rejects(addRemote(dir, 'ok', '--upload-pack=evil'), /not valid/)
  await assert.rejects(addRemote(dir, 'ok', 'ext::sh -c touch% /tmp/pwned'), /not valid/)
  await assert.rejects(addRemote(dir, 'ok', 'https://tok3n@example.com/x.git'), /token/)
  await assert.rejects(addRemote(dir, 'ok', 'https://user:pw@example.com/x.git'), /token/)
  await assert.rejects(addRemote(dir, 'ok', 'ssh://user:pw@example.com/x.git'), /token/)
  await assert.rejects(addRemote(dir, 'ok', 'not a url'), /not valid/)
  assert.deepEqual(await getRemotes(dir), [])
  assert.doesNotThrow(() => assertRemoteUrl('ssh://git@example.com:2222/x.git'))
  assert.doesNotThrow(() => assertRemoteUrl('/tmp/some/bare.git'))
})

test('remotes: duplicates, missing remotes and no token in .git/config', async () => {
  const dir = emptyRepo()
  await addRemote(dir, 'origin', 'https://example.com/x.git')
  await assert.rejects(addRemote(dir, 'origin', 'https://example.com/y.git'), /already exists/)
  await assert.rejects(renameRemote(dir, 'nope', 'x'), /There is no remote/)
  await assert.rejects(renameRemote(dir, 'origin', 'origin'), /already exists/)
  await assert.rejects(removeRemote(dir, 'nope'), /There is no remote/)
  assert.doesNotMatch(read(dir, '.git/config'), /@|token/i)
})
