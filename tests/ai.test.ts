import assert from 'node:assert/strict'
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  CLAUDE_NOT_FOUND,
  MAX_DIFF_BYTES,
  buildPrompt,
  cleanReply,
  findCommand,
  runCli,
  suggest,
  truncateDiff,
  type SuggestOptions
} from '../src/main/ai'
import { getStagedDiff } from '../src/main/git'
import { checkAiConfig, createService, type Ui } from '../src/main/service'
import { Store, type TokenCrypto } from '../src/main/store'
import { commit, emptyRepo, git, tempDir } from './helpers'

process.env.GIT_AUTHOR_NAME = 'Test'
process.env.GIT_AUTHOR_EMAIL = 'test@example.com'
process.env.GIT_COMMITTER_NAME = 'Test'
process.env.GIT_COMMITTER_EMAIL = 'test@example.com'
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

function fakeClaude(script: string, name = 'claude'): string {
  const file = join(tempDir(), name)
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

test('findCommand uses PATH first and returns null when nothing exists', () => {
  assert.equal(
    findCommand('claude', { PATH: '/x:/y' }, (p) => p === '/y/claude'),
    '/y/claude'
  )
  assert.equal(
    findCommand('codex', { PATH: '/x' }, () => false),
    null
  )
})

test('the Claude CLI gets the prompt on stdin and returns the cleaned reply', async () => {
  const bin = fakeClaude('cat >/dev/null; echo "✨ (feat): add thing"')
  assert.equal(await runCli('claude', 'prompt', { bin }), '✨ (feat): add thing')
  const echo = fakeClaude('cat')
  assert.equal(
    await runCli('claude', '✨ (feat): from stdin', { bin: echo }),
    '✨ (feat): from stdin'
  )
})

test('the Claude CLI reports a failure, a timeout, an empty reply and a missing CLI', async () => {
  await assert.rejects(
    runCli('claude', 'p', { bin: fakeClaude('echo "not signed in" >&2; exit 1') }),
    /not signed in/
  )
  await assert.rejects(
    runCli('claude', 'p', { bin: fakeClaude('sleep 5'), timeout: 100 }),
    /too long/
  )
  await assert.rejects(runCli('claude', 'p', { bin: fakeClaude('cat >/dev/null') }), /empty/)
  await assert.rejects(
    runCli('claude', 'p', { bin: '/nonexistent/claude' }),
    new RegExp(CLAUDE_NOT_FOUND)
  )
})

for (const [id, label, expected] of [
  [
    'codex',
    'Codex CLI',
    'exec --sandbox read-only --skip-git-repo-check --ephemeral --color never --model gpt-x -'
  ],
  ['opencode', 'OpenCode CLI', 'run --archived --model gpt-x']
] as const) {
  test(`${label}: argument array, prompt on stdin, failure and missing command`, async () => {
    const out = join(tempDir(), 'args')
    const bin = fakeClaude(`printf '%s ' "$@" > ${out}; read line; echo "✨ (feat): $line"`, id)
    assert.equal(
      await suggest(id, 'from stdin\n', { bin, model: 'gpt-x' }),
      '✨ (feat): from stdin'
    )
    assert.equal(readFileSync(out, 'utf8').trim(), expected)

    await assert.rejects(
      suggest(id, 'p', { bin: fakeClaude('echo "please log in" >&2; exit 2', id) }),
      new RegExp(`${label} could not write a message: please log in`)
    )
    await assert.rejects(
      suggest(id, 'p', { bin: `/nonexistent/${id}` }),
      new RegExp(`${label} not found\\. Install it and sign in`)
    )
  })
}

// HTTP providers against a local mock server.

interface Seen {
  url: string
  headers: IncomingMessage['headers']
  body: string
}

async function mockServer(
  reply: (req: Seen, res: ServerResponse) => void
): Promise<{ base: string; seen: Seen[]; close: () => Promise<void> }> {
  const seen: Seen[] = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c: Buffer) => (body += c.toString()))
    req.on('end', () => {
      const s = { url: req.url ?? '', headers: req.headers, body }
      seen.push(s)
      reply(s, res)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    base: `http://127.0.0.1:${port}/v1`,
    seen,
    close: () => {
      server.closeAllConnections()
      return new Promise((resolve) => server.close(() => resolve()))
    }
  }
}

const json = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const KEY = 'sk-test-secret-123456'

const HTTP_CASES = [
  {
    id: 'openai',
    label: 'OpenAI',
    path: '/v1/chat/completions',
    ok: (text: string) => ({ choices: [{ message: { content: text } }] }),
    keyHeader: (h: Seen['headers']) => h['authorization'] === `Bearer ${KEY}`
  },
  {
    id: 'compatible',
    label: 'OpenAI-compatible server',
    path: '/v1/chat/completions',
    ok: (text: string) => ({ choices: [{ message: { content: text } }] }),
    keyHeader: (h: Seen['headers']) => h['authorization'] === `Bearer ${KEY}`
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    path: '/v1/models/gemini-test:generateContent',
    ok: (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    keyHeader: (h: Seen['headers']) => h['x-goog-api-key'] === KEY
  }
] as const

for (const c of HTTP_CASES) {
  const opts = (base: string, extra: SuggestOptions = {}): SuggestOptions => ({
    baseUrl: base,
    key: KEY,
    model: c.id === 'gemini' ? 'gemini-test' : 'model-x',
    ...extra
  })

  test(`${c.label}: success sends the key in a header, never the URL`, async () => {
    const s = await mockServer((_req, res) => json(res, 200, c.ok('```\n✨ (feat): add x\n```')))
    try {
      assert.equal(await suggest(c.id, 'the prompt', opts(s.base)), '✨ (feat): add x')
      assert.equal(s.seen[0].url, c.path)
      assert.ok(c.keyHeader(s.seen[0].headers))
      assert.ok(!s.seen[0].url.includes(KEY))
      assert.match(s.seen[0].body, /the prompt/)
    } finally {
      await s.close()
    }
  })

  test(`${c.label}: 401, 429, timeout and other errors never carry the key`, async () => {
    let status = 401
    const s = await mockServer((_req, res) => {
      if (status === 0) return // never answers
      json(res, status, { error: { message: `bad key ${KEY}` } })
    })
    const check = async (pattern: RegExp, extra: SuggestOptions = {}): Promise<void> => {
      const err = await suggest(c.id, 'p', opts(s.base, extra)).then(
        () => assert.fail('should reject'),
        (e: Error) => e
      )
      assert.match(err.message, pattern)
      assert.ok(!err.message.includes(KEY), err.message)
    }
    try {
      await check(/rejected the API key/)
      status = 429
      await check(/rate limiting/)
      status = 500
      await check(new RegExp(`${c.label} could not write a message: 500 bad key \\[key\\]`))
      status = 0
      await check(/took too long/, { timeout: 100 })
    } finally {
      await s.close()
    }
  })

  test(`${c.label}: an oversized diff is truncated in the request body`, async () => {
    const s = await mockServer((_req, res) => json(res, 200, c.ok('✨ (feat): big')))
    try {
      const prompt = buildPrompt(' big.txt | 1 +', 'x'.repeat(MAX_DIFF_BYTES * 3))
      await suggest(c.id, prompt, opts(s.base))
      const sent = s.seen[0].body
      assert.ok(Buffer.byteLength(sent) < MAX_DIFF_BYTES + 5000, `${Buffer.byteLength(sent)}`)
      assert.match(sent, /\[truncated\]/)
    } finally {
      await s.close()
    }
  })
}

test('OpenAI and Gemini need a key; a compatible server works without one', async () => {
  await assert.rejects(suggest('openai', 'p', {}), /Add your OpenAI API key/)
  await assert.rejects(suggest('gemini', 'p', {}), /Add your Google Gemini API key/)
  const s = await mockServer((_req, res) =>
    json(res, 200, { choices: [{ message: { content: '✨ (feat): local' } }] })
  )
  try {
    assert.equal(
      await suggest('compatible', 'p', { baseUrl: s.base, model: 'llama' }),
      '✨ (feat): local'
    )
    assert.equal(s.seen[0].headers['authorization'], undefined)
  } finally {
    await s.close()
  }
})

test('checkAiConfig validates provider, model and the compatible URL', () => {
  assert.deepEqual(checkAiConfig({ provider: 'openai', model: ' gpt-5 ', baseUrl: 'x' }), {
    provider: 'openai',
    model: 'gpt-5'
  })
  assert.deepEqual(checkAiConfig({ provider: 'opencode', model: 'anthropic/claude#high' }), {
    provider: 'opencode',
    model: 'anthropic/claude#high'
  })
  assert.throws(() => checkAiConfig({ provider: 'nope' }), /Choose an AI provider/)
  assert.throws(() => checkAiConfig({ provider: 'codex', model: '--yolo' }), /model name/)
  assert.throws(
    () => checkAiConfig({ provider: 'compatible', baseUrl: 'http://example.com/v1' }),
    /https/
  )
  assert.throws(() => checkAiConfig({ provider: 'compatible', baseUrl: '' }), /server URL/)
  assert.deepEqual(
    checkAiConfig({ provider: 'compatible', baseUrl: 'http://localhost:11434/v1/' }),
    {
      provider: 'compatible',
      baseUrl: 'http://localhost:11434/v1'
    }
  )
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

type Suggest = (provider: string, prompt: string, options?: SuggestOptions) => Promise<string>

async function setup(suggestMessage: Suggest) {
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
  return { api, dir, store }
}

test('suggestCommitMessage needs a linked folder and staged changes', async () => {
  const s = await setup(async () => 'unused')
  const claude = { provider: 'claude' } as const
  await assert.rejects(s.api.local.suggestCommitMessage(emptyRepo(), claude), /not linked/)
  await assert.rejects(s.api.local.suggestCommitMessage(s.dir, claude), /Stage some changes/)
  await assert.rejects(
    s.api.local.suggestCommitMessage(s.dir, { provider: 'x' } as never),
    /Choose an AI provider/
  )
})

test('suggestCommitMessage sends the staged diff only and does not commit', async () => {
  let seen = ''
  const s = await setup(async (_provider, prompt) => {
    seen = prompt
    return '✨ (feat): change a'
  })
  writeFileSync(join(s.dir, 'a.txt'), 'staged change\n')
  git(s.dir, 'add', 'a.txt')
  writeFileSync(join(s.dir, 'c.txt'), 'untracked secret\n')
  const before = git(s.dir, 'rev-parse', 'HEAD')
  assert.equal(
    await s.api.local.suggestCommitMessage(s.dir, { provider: 'claude' }),
    '✨ (feat): change a'
  )
  assert.match(seen, /staged change/)
  assert.doesNotMatch(seen, /untracked secret/)
  assert.equal(git(s.dir, 'rev-parse', 'HEAD'), before)
})

test('the saved key reaches the provider but never the page', async () => {
  let got: { provider: string; options?: SuggestOptions } | null = null
  const s = await setup(async (provider, _prompt, options) => {
    got = { provider, options }
    return '✨ (feat): ok'
  })
  assert.equal(await s.api.ai.hasKey('openai'), false)
  await s.api.ai.saveKey('openai', `  ${KEY}  `)
  assert.equal(await s.api.ai.hasKey('openai'), true)
  assert.equal(await s.api.ai.test({ provider: 'openai', model: 'gpt-x' }), '✨ (feat): ok')
  assert.deepEqual(got, {
    provider: 'openai',
    options: { model: 'gpt-x', baseUrl: undefined, key: KEY }
  })
  await assert.rejects(s.api.ai.saveKey('claude', KEY), /takes no API key/)
  await assert.rejects(s.api.ai.saveKey('openai', 'has space'), /spaces/)
  await s.api.ai.removeKey('openai')
  assert.equal(await s.api.ai.hasKey('openai'), false)
})

test('a provider error that echoes a saved key is scrubbed by the service', async () => {
  const s = await setup(async () => {
    throw new Error(`upstream said ${KEY}`)
  })
  await s.api.ai.saveKey('gemini', KEY)
  const err = await s.api.ai.test({ provider: 'gemini' }).then(
    () => assert.fail('should reject'),
    (e: Error) => e
  )
  assert.ok(!err.message.includes(KEY), err.message)
})

test('Store keeps AI keys encrypted and refuses without secure storage', async () => {
  const dir = tempDir()
  const rot: TokenCrypto = {
    isAvailable: () => true,
    encrypt: (t) => Buffer.from([...t].reverse().join('')),
    decrypt: (b) => [...b.toString()].reverse().join('')
  }
  const store = new Store(dir, rot)
  await store.load()
  await store.saveAiKey('openai', KEY)
  assert.equal(store.getAiKey('openai'), KEY)
  assert.equal(store.hasAiKey('openai'), true)
  assert.ok(!readFileSync(join(dir, 'config.json'), 'utf8').includes(KEY))

  const reloaded = new Store(dir, rot)
  await reloaded.load()
  assert.equal(reloaded.getAiKey('openai'), KEY)
  await reloaded.removeAiKey('openai')
  assert.equal(reloaded.getAiKey('openai'), null)

  const locked = new Store(tempDir(), { ...rot, isAvailable: () => false })
  await locked.load()
  await assert.rejects(locked.saveAiKey('openai', KEY), /Secure storage is unavailable/)
  assert.equal(locked.hasAiKey('openai'), false)
})
