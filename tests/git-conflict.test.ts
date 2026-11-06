import assert from 'node:assert/strict'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  cherryPick,
  continueOperation,
  getConflictFile,
  getOperation,
  getStatus,
  merge,
  rebase,
  resolveConflictFile,
  resolveConflictRegions,
  revert
} from '../src/main/git'
import type { ConflictFile, ConflictSegment } from '../src/shared/types'
import { commit, emptyRepo, git, tempDir } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

const lines = (...l: string[]): string => l.join('\n') + '\n'
const BASE = lines('one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine')
const withEdits = (suffix: string): string =>
  BASE.replace('two', `two ${suffix}`).replace('eight', `eight ${suffix}`)

function write(dir: string, file: string, text: string | Buffer): void {
  writeFileSync(join(dir, file), text)
}

function save(dir: string, message: string): string {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
  return git(dir, 'rev-parse', 'HEAD')
}

/** main and feature edit lines 2 and 8 of shared.txt differently: two regions. */
function mergeConflict(name = 'shared.txt'): string {
  const dir = emptyRepo()
  write(dir, name, BASE)
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  write(dir, name, withEdits('feature'))
  save(dir, 'feature edits')
  git(dir, 'checkout', '-q', 'main')
  write(dir, name, withEdits('main'))
  save(dir, 'main edits')
  return dir
}

const regionsOf = (file: ConflictFile): Extract<ConflictSegment, { type: 'conflict' }>[] =>
  (file.segments ?? []).filter(
    (s): s is Extract<ConflictSegment, { type: 'conflict' }> => s.type === 'conflict'
  )

test('a merge conflict comes back as regions with labels, actions and a fingerprint', async () => {
  const dir = mergeConflict()
  assert.deepEqual(await merge(dir, 'feature'), { conflicted: true })
  const status = await getStatus(dir)
  assert.equal(status.entries.find((e) => e.path === 'shared.txt')?.conflict, 'both-modified')

  const file = await getConflictFile(dir, 'shared.txt')
  assert.deepEqual((await getOperation(dir))?.conflictKinds, { 'shared.txt': 'both-modified' })
  assert.equal(file.kind, 'both-modified')
  assert.equal(file.unsupported, null)
  assert.equal(file.operation, 'merge')
  assert.deepEqual(file.labels, { ours: 'Current', theirs: 'Incoming' })
  assert.deepEqual(file.actions, ['ours', 'theirs', 'mark-resolved'])
  assert.match(file.fingerprint ?? '', /^[0-9a-f]{40}$/)
  assert.equal(file.eol, '\n')
  const regions = regionsOf(file)
  assert.equal(regions.length, 2)
  assert.deepEqual(regions[0].ours, ['two main'])
  assert.deepEqual(regions[0].theirs, ['two feature'])
  assert.equal(regions[0].theirsLabel, 'feature')
})

test('resolving every region stages the file, then Continue finishes the merge', async () => {
  const dir = mergeConflict()
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, 'shared.txt')
  const saved = await resolveConflictRegions(dir, {
    path: 'shared.txt',
    fingerprint: file.fingerprint as string,
    choices: ['ours', { text: 'eight custom\n' }]
  })
  assert.equal(saved.staged, true)
  assert.equal(saved.open, 0)
  assert.equal(
    readFileSync(join(dir, 'shared.txt'), 'utf8'),
    BASE.replace('two', 'two main').replace('eight', 'eight custom')
  )
  assert.deepEqual((await getOperation(dir))?.conflicted, [])

  await continueOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(git(dir, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3)
  assert.equal(git(dir, 'status', '--porcelain'), '')
})

test('a half-resolved file is saved but not staged, and Continue refuses it', async () => {
  const dir = mergeConflict()
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, 'shared.txt')
  const saved = await resolveConflictRegions(dir, {
    path: 'shared.txt',
    fingerprint: file.fingerprint as string,
    choices: ['theirs', null]
  })
  assert.equal(saved.staged, false)
  assert.equal(saved.open, 1)
  assert.equal(git(dir, 'diff', '--name-only', '--diff-filter=U'), 'shared.txt')
  await assert.rejects(continueOperation(dir), /still contain conflict markers/)

  // The returned fingerprint names the saved text, and the open region is still there.
  const again = await getConflictFile(dir, 'shared.txt')
  assert.equal(again.fingerprint, saved.fingerprint)
  assert.equal(regionsOf(again).length, 1)
  const done = await resolveConflictRegions(dir, {
    path: 'shared.txt',
    fingerprint: saved.fingerprint,
    choices: ['both']
  })
  assert.equal(done.staged, true)
  assert.equal(
    readFileSync(join(dir, 'shared.txt'), 'utf8'),
    BASE.replace('two', 'two feature').replace('eight', 'eight main\neight feature')
  )
})

test('picking one side everywhere matches git checkout --ours and --theirs byte for byte', async () => {
  for (const [choice, flag] of [
    ['ours', '--ours'],
    ['theirs', '--theirs']
  ] as const) {
    const dir = mergeConflict()
    await merge(dir, 'feature')
    const file = await getConflictFile(dir, 'shared.txt')
    await resolveConflictRegions(dir, {
      path: 'shared.txt',
      fingerprint: file.fingerprint as string,
      choices: [choice, choice]
    })
    const mine = readFileSync(join(dir, 'shared.txt'))
    git(dir, 'checkout', '-m', '--', 'shared.txt')
    git(dir, 'checkout', flag, '--', 'shared.txt')
    assert.ok(mine.equals(readFileSync(join(dir, 'shared.txt'))), choice)
  }
})

test('a CRLF file keeps its line endings when resolved', async () => {
  const dir = emptyRepo()
  const crlf = (s: string): string => s.replaceAll('\n', '\r\n')
  git(dir, 'config', 'core.autocrlf', 'false')
  write(dir, 'w.txt', crlf(BASE))
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  write(dir, 'w.txt', crlf(withEdits('feature')))
  save(dir, 'f')
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'w.txt', crlf(withEdits('main')))
  save(dir, 'm')
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, 'w.txt')
  assert.equal(file.eol, '\r\n')
  await resolveConflictRegions(dir, {
    path: 'w.txt',
    fingerprint: file.fingerprint as string,
    choices: [{ text: 'edited\n' }, 'theirs']
  })
  const text = readFileSync(join(dir, 'w.txt'), 'utf8')
  assert.equal(/(?<!\r)\n/.test(text), false, 'no bare LF')
  assert.ok(text.includes('edited\r\n'))
  assert.ok(text.includes('eight feature\r\n'))
})

test('a file that changed since it was read is refused and left alone', async () => {
  const dir = mergeConflict()
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, 'shared.txt')
  const edited = readFileSync(join(dir, 'shared.txt'), 'utf8') + 'added by hand\n'
  write(dir, 'shared.txt', edited)
  await assert.rejects(
    resolveConflictRegions(dir, {
      path: 'shared.txt',
      fingerprint: file.fingerprint as string,
      choices: ['ours', 'ours']
    }),
    /changed since it was read/
  )
  assert.equal(readFileSync(join(dir, 'shared.txt'), 'utf8'), edited)
})

test('a bad request is rejected before anything is read or written', async () => {
  const dir = mergeConflict()
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, 'shared.txt')
  const fingerprint = file.fingerprint as string
  const before = readFileSync(join(dir, 'shared.txt'), 'utf8')
  const bad = (over: object) =>
    resolveConflictRegions(dir, {
      path: 'shared.txt',
      fingerprint,
      choices: ['ours', 'ours'],
      ...over
    })
  await assert.rejects(bad({ fingerprint: 'abc' }), /not valid/)
  await assert.rejects(bad({ choices: 'ours' }), /not valid/)
  await assert.rejects(bad({ choices: ['ours', 'bogus'] }), /not valid/)
  await assert.rejects(bad({ choices: [{ text: 5 }, 'ours'] }), /not valid/)
  await assert.rejects(bad({ choices: ['ours'] }), /Expected a choice for each/)
  await assert.rejects(bad({ choices: ['base', 'ours'] }), /no common ancestor/)
  assert.equal(readFileSync(join(dir, 'shared.txt'), 'utf8'), before)
})

test('only a path that is in conflict right now is accepted', async () => {
  const dir = mergeConflict()
  write(dir, 'other.txt', 'x\n')
  await merge(dir, 'feature')
  const outside = tempDir()
  write(outside, 'secret.txt', 'secret\n')
  for (const path of [
    'other.txt',
    '-x',
    '--ours',
    '../secret.txt',
    join(outside, 'secret.txt'),
    '',
    'nope/x'
  ]) {
    await assert.rejects(getConflictFile(dir, path), /not in conflict|Invalid/, path)
    await assert.rejects(resolveConflictFile(dir, path, 'ours'), /not in conflict|Invalid/, path)
    await assert.rejects(
      resolveConflictRegions(dir, { path, fingerprint: 'a'.repeat(40), choices: [] }),
      /not in conflict|Invalid/,
      path
    )
  }
  await assert.rejects(getConflictFile(dir, 'a\0b'), /Invalid/)
  assert.equal(readFileSync(join(outside, 'secret.txt'), 'utf8'), 'secret\n')
})

test('a file named like an option is resolved with -- in front of the path', async () => {
  const dir = mergeConflict('-dash.txt')
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, '-dash.txt')
  assert.equal(file.kind, 'both-modified')
  await resolveConflictFile(dir, '-dash.txt', 'theirs')
  assert.equal(readFileSync(join(dir, '-dash.txt'), 'utf8'), withEdits('feature'))
  assert.deepEqual((await getOperation(dir))?.conflicted, [])
})

test('whole-file ours and theirs resolve and stage the file', async () => {
  for (const side of ['ours', 'theirs'] as const) {
    const dir = mergeConflict()
    await merge(dir, 'feature')
    await resolveConflictFile(dir, 'shared.txt', side)
    assert.equal(
      readFileSync(join(dir, 'shared.txt'), 'utf8'),
      withEdits(side === 'ours' ? 'main' : 'feature')
    )
    assert.deepEqual((await getOperation(dir))?.conflicted, [])
    await continueOperation(dir)
    assert.equal(await getOperation(dir), null)
  }
})

test('mark-resolved stages a hand-fixed file and refuses one with markers', async () => {
  const dir = mergeConflict()
  await merge(dir, 'feature')
  await assert.rejects(resolveConflictFile(dir, 'shared.txt', 'mark-resolved'), /conflict markers/)
  write(dir, 'shared.txt', 'fixed by hand\n')
  await resolveConflictFile(dir, 'shared.txt', 'mark-resolved')
  assert.deepEqual((await getOperation(dir))?.conflicted, [])
  await continueOperation(dir)
  assert.equal(git(dir, 'show', 'HEAD:shared.txt'), 'fixed by hand')
})

test('an action the kind does not allow is refused', async () => {
  const dir = mergeConflict()
  await merge(dir, 'feature')
  await assert.rejects(resolveConflictFile(dir, 'shared.txt', 'keep'), /not possible/)
  await assert.rejects(resolveConflictFile(dir, 'shared.txt', 'rm -rf' as never), /not possible/)
})

test('delete-versus-modify offers keep and delete, both ways round', async () => {
  for (const [deleter, kind] of [
    ['main', 'deleted-by-us'],
    ['feature', 'deleted-by-them']
  ] as const) {
    for (const action of ['keep', 'delete'] as const) {
      const dir = emptyRepo()
      write(dir, 'x.txt', BASE)
      save(dir, 'base')
      git(dir, 'checkout', '-q', '-b', 'feature')
      if (deleter === 'feature') unlinkSync(join(dir, 'x.txt'))
      else write(dir, 'x.txt', withEdits('feature'))
      save(dir, 'feature')
      git(dir, 'checkout', '-q', 'main')
      if (deleter === 'main') unlinkSync(join(dir, 'x.txt'))
      else write(dir, 'x.txt', withEdits('main'))
      save(dir, 'main')
      assert.deepEqual(await merge(dir, 'feature'), { conflicted: true })

      const file = await getConflictFile(dir, 'x.txt')
      assert.equal(file.kind, kind)
      assert.equal(file.unsupported, 'whole-file')
      assert.equal(file.segments, null)
      assert.deepEqual(file.actions, ['keep', 'delete'])
      await assert.rejects(resolveConflictFile(dir, 'x.txt', 'ours'), /not possible/)
      await assert.rejects(
        resolveConflictRegions(dir, { path: 'x.txt', fingerprint: 'a'.repeat(40), choices: [] }),
        /no conflict regions/
      )

      await resolveConflictFile(dir, 'x.txt', action)
      assert.equal(existsSync(join(dir, 'x.txt')), action === 'keep')
      assert.deepEqual((await getOperation(dir))?.conflicted, [])
      await continueOperation(dir)
      assert.equal(await getOperation(dir), null)
    }
  }
})

test('add/add has regions with an empty common ancestor', async () => {
  const dir = emptyRepo()
  commit(dir, 'base.txt', 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  write(dir, 'new.txt', lines('a', 'feature'))
  save(dir, 'feature')
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'new.txt', lines('a', 'main'))
  save(dir, 'main')
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, 'new.txt')
  assert.equal(file.kind, 'both-added')
  assert.equal(regionsOf(file).length, 1)
  assert.deepEqual(file.actions, ['ours', 'theirs', 'mark-resolved'])
  await resolveConflictFile(dir, 'new.txt', 'theirs')
  assert.equal(readFileSync(join(dir, 'new.txt'), 'utf8'), lines('a', 'feature'))
})

test('a rename on both sides leaves both-deleted and one-sided adds', async () => {
  const dir = emptyRepo()
  write(dir, 'f.txt', BASE)
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  git(dir, 'mv', 'f.txt', 'b.txt')
  save(dir, 'rename b')
  git(dir, 'checkout', '-q', 'main')
  git(dir, 'mv', 'f.txt', 'a.txt')
  save(dir, 'rename a')
  assert.deepEqual(await merge(dir, 'feature'), { conflicted: true })
  const kinds: Record<string, string | null> = {}
  for (const e of (await getStatus(dir)).entries) kinds[e.path] = e.conflict
  assert.deepEqual(kinds, {
    'a.txt': 'added-by-us',
    'b.txt': 'added-by-them',
    'f.txt': 'both-deleted'
  })
  const dd = await getConflictFile(dir, 'f.txt')
  assert.deepEqual(dd.actions, ['delete'])
  await resolveConflictFile(dir, 'f.txt', 'delete')
  await resolveConflictFile(dir, 'a.txt', 'keep')
  await resolveConflictFile(dir, 'b.txt', 'delete')
  assert.deepEqual((await getOperation(dir))?.conflicted, [])
  await continueOperation(dir)
  assert.deepEqual(git(dir, 'ls-files').split('\n'), ['a.txt'])
})

test('a binary conflict has no regions but can take a side', async () => {
  const dir = emptyRepo()
  write(dir, 'b.bin', Buffer.from([0, 1, 2, 3]))
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  write(dir, 'b.bin', Buffer.from([0, 9, 9, 9]))
  save(dir, 'feature')
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'b.bin', Buffer.from([0, 7, 7, 7]))
  save(dir, 'main')
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, 'b.bin')
  assert.equal(file.unsupported, 'binary')
  assert.equal(file.segments, null)
  await assert.rejects(
    resolveConflictRegions(dir, { path: 'b.bin', fingerprint: 'a'.repeat(40), choices: [] }),
    /binary/
  )
  await resolveConflictFile(dir, 'b.bin', 'theirs')
  assert.deepEqual([...readFileSync(join(dir, 'b.bin'))], [0, 9, 9, 9])
})

test('a file that is not UTF-8 is treated as binary so it is never rewritten', async () => {
  const dir = emptyRepo()
  write(dir, 'latin.txt', Buffer.from('caf\xe9\nbase\n', 'latin1'))
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  write(dir, 'latin.txt', Buffer.from('caf\xe9\nfeature\n', 'latin1'))
  save(dir, 'feature')
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'latin.txt', Buffer.from('caf\xe9\nmain\n', 'latin1'))
  save(dir, 'main')
  await merge(dir, 'feature')
  assert.equal((await getConflictFile(dir, 'latin.txt')).unsupported, 'binary')
})

test('a file over the size limit has no regions', async () => {
  const dir = emptyRepo()
  const big = (tail: string): string => `${'x'.repeat(100)}\n`.repeat(21_000) + tail
  write(dir, 'big.txt', big('base\n'))
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  write(dir, 'big.txt', big('feature\n'))
  save(dir, 'feature')
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'big.txt', big('main\n'))
  save(dir, 'main')
  await merge(dir, 'feature')
  assert.equal((await getConflictFile(dir, 'big.txt')).unsupported, 'too-large')
})

test('a file the parser cannot read safely is reported, not guessed at', async () => {
  const dir = mergeConflict()
  await merge(dir, 'feature')
  write(dir, 'shared.txt', '<<<<<<< a\nx\n=======\ny\n')
  const file = await getConflictFile(dir, 'shared.txt')
  assert.equal(file.unsupported, 'unparseable')
  assert.match(file.detail ?? '', /never closed/)
  assert.equal(file.segments, null)
})

test('a symlink in place of the file is never read or written through', async () => {
  const dir = mergeConflict()
  await merge(dir, 'feature')
  const outside = tempDir()
  write(outside, 'target.txt', 'outside\n')
  unlinkSync(join(dir, 'shared.txt'))
  symlinkSync(join(outside, 'target.txt'), join(dir, 'shared.txt'))
  const file = await getConflictFile(dir, 'shared.txt')
  assert.equal(file.unsupported, 'symlink')
  await assert.rejects(
    resolveConflictRegions(dir, { path: 'shared.txt', fingerprint: 'a'.repeat(40), choices: [] }),
    /plain file/
  )
  assert.equal(readFileSync(join(outside, 'target.txt'), 'utf8'), 'outside\n')
})

test('a folder that is a symlink out of the repository is not followed', async () => {
  const dir = emptyRepo()
  mkdirSync(join(dir, 'sub'))
  write(dir, 'sub/f.txt', BASE)
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  write(dir, 'sub/f.txt', withEdits('feature'))
  save(dir, 'feature')
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'sub/f.txt', withEdits('main'))
  save(dir, 'main')
  await merge(dir, 'feature')
  const outside = tempDir()
  write(outside, 'f.txt', 'outside\n')
  // Swap the folder for a link to one outside the repository.
  unlinkSync(join(dir, 'sub/f.txt'))
  rmdirSync(join(dir, 'sub'))
  symlinkSync(outside, join(dir, 'sub'))
  const file = await getConflictFile(dir, 'sub/f.txt')
  assert.equal(file.unsupported, 'symlink')
  await assert.rejects(
    resolveConflictRegions(dir, { path: 'sub/f.txt', fingerprint: 'a'.repeat(40), choices: [] }),
    /plain file/
  )
  assert.equal(readFileSync(join(outside, 'f.txt'), 'utf8'), 'outside\n')
})

test('the file mode survives a resolve', async () => {
  const dir = emptyRepo()
  write(dir, 's.sh', BASE)
  chmodSync(join(dir, 's.sh'), 0o755)
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  write(dir, 's.sh', withEdits('feature'))
  save(dir, 'feature')
  git(dir, 'checkout', '-q', 'main')
  write(dir, 's.sh', withEdits('main'))
  save(dir, 'main')
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, 's.sh')
  await resolveConflictRegions(dir, {
    path: 's.sh',
    fingerprint: file.fingerprint as string,
    choices: ['ours', 'ours']
  })
  assert.equal(statSync(join(dir, 's.sh')).mode & 0o777, 0o755)
  assert.equal(git(dir, 'ls-files', '-s', 's.sh').split(' ')[0], '100755')
  assert.equal(git(dir, 'ls-files', '--others', '--exclude-standard'), '')
})

test('a cherry-pick and a revert name their own sides', async () => {
  const dir = mergeConflict()
  const featureHash = git(dir, 'rev-parse', 'feature')
  assert.deepEqual(await cherryPick(dir, featureHash), { conflicted: true })
  const picked = await getConflictFile(dir, 'shared.txt')
  assert.equal(picked.operation, 'cherry-pick')
  assert.deepEqual(picked.labels, { ours: 'Current', theirs: 'Incoming' })
  await resolveConflictFile(dir, 'shared.txt', 'theirs')
  await continueOperation(dir)

  // Reverting an older commit now conflicts with the edit that followed it.
  const dir2 = emptyRepo()
  write(dir2, 'r.txt', BASE)
  save(dir2, 'base')
  write(dir2, 'r.txt', withEdits('first'))
  const first = save(dir2, 'first')
  write(dir2, 'r.txt', withEdits('second'))
  save(dir2, 'second')
  assert.deepEqual(await revert(dir2, first), { conflicted: true })
  const reverted = await getConflictFile(dir2, 'r.txt')
  assert.equal(reverted.operation, 'revert')
  assert.equal(reverted.kind, 'both-modified')
})

test('in a rebase the sides swap, and Continue walks through each stop', async () => {
  const dir = emptyRepo()
  write(dir, 'shared.txt', BASE)
  save(dir, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  write(dir, 'shared.txt', withEdits('feature one'))
  save(dir, 'feature one')
  write(dir, 'shared.txt', withEdits('feature two'))
  save(dir, 'feature two')
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'shared.txt', withEdits('main'))
  save(dir, 'main side')
  git(dir, 'checkout', '-q', 'feature')

  assert.deepEqual(await rebase(dir, 'main'), { conflicted: true })
  const file = await getConflictFile(dir, 'shared.txt')
  assert.equal(file.operation, 'rebase')
  assert.deepEqual(file.labels, { ours: 'Upstream', theirs: 'Your commit' })
  // Git's "ours" in a rebase is the branch rebased onto: main.
  assert.deepEqual(regionsOf(file)[0].ours, ['two main'])
  assert.deepEqual(regionsOf(file)[0].theirs, ['two feature one'])

  await resolveConflictRegions(dir, {
    path: 'shared.txt',
    fingerprint: file.fingerprint as string,
    choices: [{ text: 'merged two\n' }, { text: 'merged eight\n' }]
  })
  // Continuing replays the next commit, which conflicts in turn.
  await continueOperation(dir)
  const next = await getOperation(dir)
  assert.equal(next?.kind, 'rebase')
  assert.deepEqual(next?.conflicted, ['shared.txt'])
  const second = await getConflictFile(dir, 'shared.txt')
  assert.equal(second.operation, 'rebase')
  assert.deepEqual(regionsOf(second)[0].ours, ['merged two'])
  assert.deepEqual(regionsOf(second)[0].theirs, ['two feature two'])
  await resolveConflictFile(dir, 'shared.txt', 'theirs')
  await continueOperation(dir)
  assert.equal(await getOperation(dir), null)
  assert.equal(readFileSync(join(dir, 'shared.txt'), 'utf8'), withEdits('feature two'))
  assert.equal(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feature')
})

test('a conflicting stash pop has no operation and says Stash', async () => {
  const dir = emptyRepo()
  write(dir, 'shared.txt', BASE)
  save(dir, 'base')
  write(dir, 'shared.txt', withEdits('stashed'))
  git(dir, 'stash', 'push', '-q')
  write(dir, 'shared.txt', withEdits('committed'))
  save(dir, 'committed')
  try {
    git(dir, 'stash', 'pop', '-q')
  } catch {
    // Exits non-zero on conflict.
  }
  assert.equal(await getOperation(dir), null)
  const file = await getConflictFile(dir, 'shared.txt')
  assert.equal(file.operation, null)
  assert.deepEqual(file.labels, { ours: 'Current', theirs: 'Stash' })
  assert.equal(regionsOf(file).length, 2)
  const saved = await resolveConflictRegions(dir, {
    path: 'shared.txt',
    fingerprint: file.fingerprint as string,
    choices: ['theirs', 'theirs']
  })
  assert.equal(saved.staged, true)
  assert.equal(readFileSync(join(dir, 'shared.txt'), 'utf8'), withEdits('stashed'))
  assert.equal((await getStatus(dir)).entries.filter((e) => e.conflicted).length, 0)
})

test('edited text containing a marker line is saved but not staged', async () => {
  const dir = mergeConflict()
  await merge(dir, 'feature')
  const file = await getConflictFile(dir, 'shared.txt')
  const saved = await resolveConflictRegions(dir, {
    path: 'shared.txt',
    fingerprint: file.fingerprint as string,
    choices: [{ text: '<<<<<<< not really\n' }, 'ours']
  })
  assert.equal(saved.open, 0)
  assert.equal(saved.staged, false)
})
