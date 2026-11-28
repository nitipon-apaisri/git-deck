// Prints the README "Built with Claude Code" block from local Claude Code transcripts.
// Totals only: no paths, prompts or session ids. Run: pnpm usage
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'

export interface Usage {
  output: number
  input: number
  cacheWrite: number
  cacheRead: number
  sessions: number
  subagents: number
  since: string
}

function jsonlFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
}

/** Sums usage once per message id (a streamed reply is logged several times). */
export function sumUsage(dir: string): Usage {
  if (!existsSync(dir)) throw new Error('No Claude Code transcripts found for this folder')
  const seen = new Set<string>()
  const u: Usage = {
    output: 0,
    input: 0,
    cacheWrite: 0,
    cacheRead: 0,
    sessions: 0,
    subagents: 0,
    since: ''
  }
  let first = Infinity
  const read = (file: string): void => {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('"usage"')) continue
      let e: { type?: string; message?: { id?: string; usage?: Record<string, number> } }
      try {
        e = JSON.parse(line)
      } catch {
        continue
      }
      const id = e.message?.id
      const use = e.message?.usage
      if (e.type !== 'assistant' || !id || !use || seen.has(id)) continue
      seen.add(id)
      u.output += use['output_tokens'] ?? 0
      u.input += use['input_tokens'] ?? 0
      u.cacheWrite += use['cache_creation_input_tokens'] ?? 0
      u.cacheRead += use['cache_read_input_tokens'] ?? 0
    }
    first = Math.min(first, statSync(file).birthtimeMs)
  }
  for (const f of jsonlFiles(dir)) {
    u.sessions++
    read(join(dir, f))
  }
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const sub = join(dir, d.name, 'subagents')
    if (!d.isDirectory() || !existsSync(sub)) continue
    for (const f of jsonlFiles(sub)) {
      u.subagents++
      read(join(sub, f))
    }
  }
  u.since = first === Infinity ? '' : new Date(first).toISOString().slice(0, 10)
  return u
}

const fmt = (n: number): string =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 2)}M`
    : n >= 1e3
      ? `${(n / 1e3).toFixed(1)}K`
      : `${n}`

export function renderBlock(u: Usage, today: string, machines = 1): string {
  const total = u.output + u.input + u.cacheWrite + u.cacheRead
  const rows: [string, string][] = [
    ['Output', fmt(u.output)],
    ['Fresh input', fmt(u.input)],
    ['Cache write', fmt(u.cacheWrite)],
    ['Cache read', fmt(u.cacheRead)],
    ['**Total**', `**${fmt(total)}**`]
  ]
  return [
    `GitDeck was written with Claude Code. Token use for this repository, read from Claude Code transcripts on ${machines} machine${machines === 1 ? '' : 's'} on ${today} (${u.sessions} sessions and ${u.subagents} subagent runs since ${u.since}):`,
    '',
    '| Tokens | Amount |',
    '| --- | ---: |',
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
    '',
    'Most of the total is cache reads, which are billed at a much lower rate, so the total is not a measure of cost. This is a snapshot, refreshed on each README sync.'
  ].join('\n')
}

export interface Store {
  machines: Record<string, Usage>
}

/** Short, stable id from the hostname: distinct per machine, never the hostname itself. */
export const machineId = (host = hostname()): string =>
  createHash('sha1').update(host).digest('hex').slice(0, 6)

export function loadStore(file: string): Store {
  if (!existsSync(file)) return { machines: {} }
  try {
    const s = JSON.parse(readFileSync(file, 'utf8')) as Store
    if (typeof s.machines !== 'object' || s.machines === null) throw new Error()
    return s
  } catch {
    throw new Error(`${file} is not a valid token-usage file; fix or delete it`)
  }
}

/** Writes one machine's entry. Each count keeps its larger value: cleaned-up transcripts never lower it. */
export function mergeMachine(store: Store, id: string, local: Usage): Store {
  const old = store.machines[id]
  const max = (
    k: 'output' | 'input' | 'cacheWrite' | 'cacheRead' | 'sessions' | 'subagents'
  ): number => Math.max(old?.[k] ?? 0, local[k])
  const since = [old?.since, local.since].filter(Boolean).sort()[0] ?? ''
  const entry: Usage = {
    output: max('output'),
    input: max('input'),
    cacheWrite: max('cacheWrite'),
    cacheRead: max('cacheRead'),
    sessions: max('sessions'),
    subagents: max('subagents'),
    since
  }
  return { machines: { ...store.machines, [id]: entry } }
}

export function totalOf(store: Store): Usage {
  const t: Usage = {
    output: 0,
    input: 0,
    cacheWrite: 0,
    cacheRead: 0,
    sessions: 0,
    subagents: 0,
    since: ''
  }
  for (const m of Object.values(store.machines)) {
    t.output += m.output
    t.input += m.input
    t.cacheWrite += m.cacheWrite
    t.cacheRead += m.cacheRead
    t.sessions += m.sessions
    t.subagents += m.subagents
    if (m.since && (!t.since || m.since < t.since)) t.since = m.since
  }
  return t
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const flag = process.argv.indexOf('--machine')
    const id = flag > 0 ? process.argv[flag + 1] : machineId()
    const dir = join(homedir(), '.claude', 'projects', process.cwd().replace(/[/.]/g, '-'))
    const file = join(process.cwd(), 'docs', 'token-usage.json')
    const merged = mergeMachine(loadStore(file), id, sumUsage(dir))
    const sorted: Store = {
      machines: Object.fromEntries(
        Object.entries(merged.machines).sort(([a], [b]) => a.localeCompare(b))
      )
    }
    writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n')
    console.log(
      renderBlock(
        totalOf(merged),
        new Date().toISOString().slice(0, 10),
        Object.keys(merged.machines).length
      )
    )
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }
}
