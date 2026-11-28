import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { renderBlock, sumUsage } from '../scripts/claude-usage'

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
