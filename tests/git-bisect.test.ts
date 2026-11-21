import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { bisectMark, bisectReset, bisectStart, merge, readBisect } from '../src/main/git'
import { parseBisectLog } from '../src/shared/bisect'
import { emptyRepo, git } from './helpers'

/** Ten commits; from c6 on the file says "bad". Returns the hashes, oldest first. */
function history(): { dir: string; hashes: string[] } {
  const dir = emptyRepo()
  const hashes: string[] = []
  for (let i = 1; i <= 10; i++) {
    writeFileSync(join(dir, 'f.txt'), i >= 6 ? 'bad\n' : 'ok\n')
    writeFileSync(join(dir, 'n.txt'), `${i}\n`)
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', `c${i}`)
    hashes.push(git(dir, 'rev-parse', 'HEAD'))
  }
  return { dir, hashes }
}

const isBad = (dir: string): boolean => readFileSync(join(dir, 'f.txt'), 'utf8').startsWith('bad')

test('parseBisectLog reads marks and the result line', () => {
  const a = 'a'.repeat(40)
  const b = 'b'.repeat(40)
  const log = `git bisect start\ngit bisect bad ${a}\ngit bisect good ${b}\ngit bisect skip ${b}\n# first bad commit: [${a}] c6\n`
  assert.deepEqual(parseBisectLog(log), {
    bad: a,
    good: [b],
    skipped: [b],
    result: { hash: a, subject: 'c6' }
  })
  assert.deepEqual(parseBisectLog(''), { bad: null, good: [], skipped: [], result: null })
})

test('bisect finds the first bad commit, then reset returns to the branch', async () => {
  const { dir, hashes } = history()
  assert.equal(await readBisect(dir), null)
  let state = await bisectStart(dir, hashes[9], hashes[0])
  for (let i = 0; i < 6 && !state.result; i++) {
    state = await bisectMark(dir, isBad(dir) ? 'bad' : 'good')
  }
  assert.equal(state.result?.hash, hashes[5])
  assert.equal(state.result?.subject, 'c6')
  assert.equal((await readBisect(dir))?.result?.hash, hashes[5])
  await assert.rejects(bisectMark(dir, 'good'), /already found/)
  await bisectReset(dir)
  assert.equal(await readBisect(dir), null)
  assert.equal(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main')
})

test('skip moves to another commit and the bisect still ends', async () => {
  const { dir, hashes } = history()
  let state = await bisectStart(dir, hashes[9], hashes[4])
  // Skip a commit away from the culprit: skipping its neighbour makes git give up.
  let skipped = false
  for (let i = 0; i < 10 && !state.result; i++) {
    if (!skipped && state.current !== hashes[5]) {
      const before = state.current
      state = await bisectMark(dir, 'skip')
      assert.notEqual(state.current, before)
      assert.equal(state.skipped.length, 1)
      skipped = true
    } else {
      state = await bisectMark(dir, isBad(dir) ? 'bad' : 'good')
    }
  }
  assert.ok(skipped)
  assert.equal(state.result?.hash, hashes[5])
})

test('abort mid-way restores the branch', async () => {
  const { dir, hashes } = history()
  await bisectStart(dir, hashes[9], hashes[0])
  assert.notEqual(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main')
  await bisectReset(dir)
  assert.equal(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main')
  await assert.rejects(bisectReset(dir), /no bisect/)
})

test('bisect refuses bad input, a second bisect and another operation', async () => {
  const { dir, hashes } = history()
  await assert.rejects(bisectStart(dir, hashes[9], hashes[9]), /different/)
  await assert.rejects(bisectStart(dir, '--bad', hashes[0]), /Invalid/)
  await assert.rejects(bisectStart(dir, 'f'.repeat(40), hashes[0]), /does not exist/)
  await assert.rejects(bisectMark(dir, 'good'), /no bisect/)
  await bisectStart(dir, hashes[9], hashes[0])
  await assert.rejects(bisectStart(dir, hashes[9], hashes[0]), /bisect is in progress/)
  await assert.rejects(merge(dir, 'main'), /bisect is in progress/)
})
