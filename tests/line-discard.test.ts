// Phase 27: line-level discard. Runs git in temp repos.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { discardLines, getDiff } from '../src/main/git'
import { hunkFingerprint } from '../src/shared/diff'
import type { HunkRequest } from '../src/shared/types'
import { emptyRepo, git } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

const BASE = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`)
const NEXT = [...BASE.slice(0, 5), 'new A', 'new B', 'new C', ...BASE.slice(7)]

/** Committed BASE, work tree NEXT. Hunk positions: 3 -line 6, 4 -line 7, 5 +A, 6 +B, 7 +C. */
function repo(eol = '\n'): string {
  const dir = emptyRepo()
  git(dir, 'config', 'core.autocrlf', 'false')
  writeFileSync(join(dir, 'f.txt'), BASE.join(eol) + eol)
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'base')
  writeFileSync(join(dir, 'f.txt'), NEXT.join(eol) + eol)
  return dir
}

async function request(dir: string, lines?: number[], path = 'f.txt'): Promise<HunkRequest> {
  const diff = await getDiff(dir, { source: 'worktree', path })
  const base: HunkRequest = {
    path,
    source: 'worktree',
    index: 0,
    fingerprint: hunkFingerprint(diff.hunks[0].lines)
  }
  return lines ? { ...base, lines } : base
}

const text = (dir: string) => readFileSync(join(dir, 'f.txt'), 'utf8')

test('discard one added line', async () => {
  const dir = repo()
  await discardLines(dir, await request(dir, [6]))
  assert.equal(text(dir), [...NEXT.slice(0, 6), ...NEXT.slice(7)].join('\n') + '\n')
  assert.equal(git(dir, 'diff', '--cached'), '')
})

test('discard a mixed add and delete selection keeps the other changes', async () => {
  const dir = repo()
  // Bring back "line 6" and drop "new C"; "line 7" stays deleted, A and B stay.
  await discardLines(dir, await request(dir, [3, 7]))
  const expected = [...BASE.slice(0, 6), 'new A', 'new B', ...BASE.slice(7)]
  assert.equal(text(dir), expected.join('\n') + '\n')
})

test('discard every changed line restores the committed file', async () => {
  const dir = repo()
  await discardLines(dir, await request(dir, [3, 4, 5, 6, 7]))
  assert.equal(text(dir), BASE.join('\n') + '\n')
  assert.equal(git(dir, 'status', '--porcelain'), '')
})

test('discard works on a CRLF file and keeps its line endings', async () => {
  const dir = repo('\r\n')
  await discardLines(dir, await request(dir, [5]))
  assert.equal(text(dir), [...NEXT.slice(0, 5), ...NEXT.slice(6)].join('\r\n') + '\r\n')
})

test('a file that changed since the diff was read is refused and left alone', async () => {
  const dir = repo()
  const req = await request(dir, [6])
  const edited = NEXT.join('\n').replace('new B', 'edited') + '\n'
  writeFileSync(join(dir, 'f.txt'), edited)
  await assert.rejects(discardLines(dir, req), /changed since/)
  assert.equal(text(dir), edited)
})

test('an untracked file, a staged request and a missing selection are refused', async () => {
  const dir = repo()
  writeFileSync(join(dir, 'new.txt'), 'a\n')
  await assert.rejects(
    discardLines(dir, {
      path: 'new.txt',
      source: 'worktree',
      index: 0,
      fingerprint: '00000000',
      lines: [0]
    })
  )
  await assert.rejects(discardLines(dir, await request(dir)), /Select unstaged lines/)
  await assert.rejects(
    discardLines(dir, { ...(await request(dir, [6])), source: 'staged' }),
    /Select unstaged lines/
  )
  assert.equal(text(dir), NEXT.join('\n') + '\n')
})
