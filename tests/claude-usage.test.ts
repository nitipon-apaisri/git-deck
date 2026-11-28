import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  loadStore,
  machineId,
  mergeMachine,
  renderBlock,
  sumUsage,
  totalOf,
  type Usage
} from '../scripts/claude-usage'

const line = (id: string, out: number): string =>
  JSON.stringify({
    type: 'assistant',
    message: {
      id,
      usage: {
        output_tokens: out,
        input_tokens: 1,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 100
      }
    }
  })

test('sums once per message id, includes subagents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'usage-'))
  writeFileSync(
    join(dir, 's1.jsonl'),
    [line('a', 5), line('a', 5), 'not json', line('b', 7)].join('\n')
  )
  mkdirSync(join(dir, 's1', 'subagents'), { recursive: true })
  writeFileSync(join(dir, 's1', 'subagents', 'agent-x.jsonl'), line('c', 3))
  const u = sumUsage(dir)
  assert.deepEqual([u.output, u.input, u.cacheWrite, u.cacheRead], [15, 3, 30, 300])
  assert.deepEqual([u.sessions, u.subagents], [1, 1])
  assert.match(renderBlock(u, '2026-01-01'), /1 sessions and 1 subagent runs/)
})

test('missing folder fails clearly', () => {
  assert.throws(() => sumUsage(join(tmpdir(), 'no-such-usage-dir')), /No Claude Code transcripts/)
})

const u = (n: number, since = '2026-11-05'): Usage => ({
  output: n,
  input: n,
  cacheWrite: n,
  cacheRead: n,
  sessions: n,
  subagents: n,
  since
})

test('merge keeps the larger count and leaves other machines alone', () => {
  const a = mergeMachine({ machines: { other: u(9) } }, 'me', u(5))
  const b = mergeMachine(a, 'me', u(3, '2026-12-01'))
  assert.equal(b.machines['me'].output, 5)
  assert.equal(b.machines['me'].since, '2026-11-05')
  assert.deepEqual(b.machines['other'], u(9))
})

test('total sums machines and takes the earliest date', () => {
  const t = totalOf({ machines: { a: u(2, '2026-11-09'), b: u(3, '2026-11-02') } })
  assert.deepEqual([t.output, t.sessions, t.since], [5, 5, '2026-11-02'])
  assert.match(renderBlock(t, '2026-01-01', 2), /on 2 machines on/)
})

test('machine id is stable and hides the hostname', () => {
  assert.equal(machineId('my-mac'), machineId('my-mac'))
  assert.notEqual(machineId('my-mac'), machineId('other-mac'))
  assert.match(machineId('my-mac'), /^[0-9a-f]{6}$/)
})

test('invalid store file fails clearly', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'store-')), 'u.json')
  writeFileSync(f, '{nope')
  assert.throws(() => loadStore(f), /not a valid token-usage file/)
  assert.deepEqual(loadStore(join(tmpdir(), 'missing-store.json')), { machines: {} })
})
