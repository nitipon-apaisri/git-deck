import assert from 'node:assert/strict'
import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  CLAUDE_NOT_FOUND,
  MAX_DIFF_BYTES,
  buildPrompt,
  cleanReply,
  findClaude,
  runClaude,
  truncateDiff
} from '../src/main/ai'
import { getStagedDiff } from '../src/main/git'
import { createService, type Ui } from '../src/main/service'
import { Store, type TokenCrypto } from '../src/main/store'
import { commit, emptyRepo, git, tempDir } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

function fakeClaude(script: string): string {
  const file = join(tempDir(), 'claude')
  writeFileSync(file, `#!/bin/sh\n${script}\n`)
  chmodSync(file, 0o755)
  return file
}

test('buildPrompt holds the gitmoji table, the summary and the diff', () => {
  const prompt = buildPrompt(' a.txt | 1 +\n', 'diff --git a/a.txt b/a.txt\n+hello\n')
  assert.match(prompt, /\{emoji\} \(\{type\}\)/)
  assert.match(prompt, /✨ \(feat\)/)
  assert.match(prompt, /a\.txt \| 1 \+/)
  assert.match(prompt, /\+hello/)
})

test('a long diff is cut and says so', () => {
  const cut = truncateDiff('é'.repeat(MAX_DIFF_BYTES))
  assert.ok(Buffer.byteLength(cut) <= MAX_DIFF_BYTES + 20)
  assert.match(cut, /\[truncated\]\n$/)
  assert.equal(truncateDiff('short'), 'short')
})

test('cleanReply drops fences and quotes but keeps a body', () => {
  assert.equal(cleanReply('```\n✨ (feat): add x\n```\n'), '✨ (feat): add x')
  assert.equal(cleanReply('"✨ (feat): add x"'), '✨ (feat): add x')
  assert.equal(cleanReply('  ✨ (feat): add x\n\nWhy.\n'), '✨ (feat): add x\n\nWhy.')
})

test('findClaude uses PATH first and returns null when nothing exists', () => {
  assert.equal(
    findClaude({ PATH: '/x:/y' }, (p) => p === '/y/claude'),
    '/y/claude'
  )
  assert.equal(
    findClaude({ PATH: '/x' }, () => false),
    null
  )
})

test('runClaude sends the prompt on stdin and returns the cleaned reply', async () => {
  const bin = fakeClaude('cat >/dev/null; echo "✨ (feat): add thing"')
  assert.equal(await runClaude('prompt', { bin }), '✨ (feat): add thing')
  const echo = fakeClaude('cat')
  assert.equal(await runClaude('✨ (feat): from stdin', { bin: echo }), '✨ (feat): from stdin')
})

test('runClaude reports a failure, a timeout, an empty reply and a missing CLI', async () => {
  await assert.rejects(
    runClaude('p', { bin: fakeClaude('echo "not signed in" >&2; exit 1') }),
    /not signed in/
  )
  await assert.rejects(runClaude('p', { bin: fakeClaude('sleep 5'), timeout: 100 }), /too long/)
  await assert.rejects(runClaude('p', { bin: fakeClaude('cat >/dev/null') }), /empty/)
  await assert.rejects(runClaude('p', { bin: '/nonexistent/claude' }), new RegExp(CLAUDE_NOT_FOUND))
})

test('getStagedDiff covers a first commit with no HEAD and ignores unstaged edits', async () => {
  const dir = emptyRepo()
  writeFileSync(join(dir, 'a.txt'), 'one\n')
  git(dir, 'add', 'a.txt')
  writeFileSync(join(dir, 'b.txt'), 'unstaged\n')
  const { stat, diff } = await getStagedDiff(dir)
  assert.match(stat, /a\.txt/)
  assert.match(diff, /\+one/)
  assert.doesNotMatch(diff, /unstaged/)
})

const crypto: TokenCrypto = {
  isAvailable: () => true,
  encrypt: (s) => Buffer.from(s),
  decrypt: (b) => b.toString()
}

async function setup(suggestMessage: (prompt: string) => Promise<string>) {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'base')
  const store = new Store(tempDir(), crypto)
  await store.load()
  await store.setLink('local:1', dir)
  const ui: Ui = {
    pickFolder: async () => null,
    confirm: async () => false,
    reveal: () => {},
    openExternal: async () => {}
  }
  const { api } = createService({
    store,
    ui,
    emitProgress: () => {},
    emitRepoChanged: () => {},
    suggestMessage
  })
  return { api, dir }
}

test('suggestCommitMessage needs a linked folder and staged changes', async () => {
  const s = await setup(async () => 'unused')
  await assert.rejects(s.api.local.suggestCommitMessage(emptyRepo()), /not linked/)
  await assert.rejects(s.api.local.suggestCommitMessage(s.dir), /Stage some changes/)
})

test('suggestCommitMessage sends the staged diff only and does not commit', async () => {
  let seen = ''
  const s = await setup(async (prompt) => {
    seen = prompt
    return '✨ (feat): change a'
  })
  writeFileSync(join(s.dir, 'a.txt'), 'staged change\n')
  git(s.dir, 'add', 'a.txt')
  writeFileSync(join(s.dir, 'c.txt'), 'untracked secret\n')
  const before = git(s.dir, 'rev-parse', 'HEAD')
  assert.equal(await s.api.local.suggestCommitMessage(s.dir), '✨ (feat): change a')
  assert.match(seen, /staged change/)
  assert.doesNotMatch(seen, /untracked secret/)
  assert.equal(git(s.dir, 'rev-parse', 'HEAD'), before)
})
