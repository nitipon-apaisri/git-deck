// Local git service. No electron import, so it runs under tsx tests.
import { execFile, spawn } from 'node:child_process'
import { Semaphore } from './semaphore'
import type {
  CommitDetail,
  CommitFile,
  GraphCommit,
  GraphRef,
  LocalInfo,
  LocalRemote
} from '../shared/types'

const MAX_BUFFER = 64 * 1024 * 1024
const HASH_RE = /^[0-9a-f]{7,64}$/i
const FS = '\x1f'
const RS = '\x1e'

// Two panes and "Fetch all" can start work together, so cap child processes.
const MAX_GIT_PROCESSES = 4
const slots = new Semaphore(MAX_GIT_PROCESSES)

function gitEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, ...extra, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }
}

// execFile, never a shell: arguments are not interpreted.
function run(cwd: string, args: string[], env: Record<string, string> = {}): Promise<string> {
  return slots.run(
    () =>
      new Promise((resolve, reject) => {
        execFile(
          'git',
          args,
          { cwd, env: gitEnv(env), maxBuffer: MAX_BUFFER, encoding: 'utf8' },
          (err, stdout, stderr) => {
            if (err) reject(new Error(stderr.trim() || err.message))
            else resolve(stdout)
          }
        )
      })
  )
}

async function tryRun(cwd: string, args: string[]): Promise<string | null> {
  try {
    return (await run(cwd, args)).trim()
  } catch {
    return null
  }
}

const toInt = (v: string | null): number | null =>
  v !== null && /^\d+$/.test(v) ? Number(v) : null

export async function repoRoot(dir: string): Promise<string | null> {
  return tryRun(dir, ['rev-parse', '--show-toplevel'])
}

export function parseDecorations(raw: string): GraphRef[] {
  const refs: GraphRef[] = []
  for (const part of raw.split(', ')) {
    const item = part.trim()
    if (!item) continue
    if (item === 'HEAD') {
      refs.push({ name: 'HEAD', kind: 'head' })
    } else if (item.startsWith('HEAD -> ')) {
      refs.push({ name: 'HEAD', kind: 'head' })
      refs.push({ name: item.slice('HEAD -> refs/heads/'.length), kind: 'branch', current: true })
    } else if (item.startsWith('tag: refs/tags/')) {
      refs.push({ name: item.slice('tag: refs/tags/'.length), kind: 'tag' })
    } else if (item.startsWith('refs/heads/')) {
      refs.push({ name: item.slice('refs/heads/'.length), kind: 'branch' })
    } else if (item.startsWith('refs/remotes/')) {
      const name = item.slice('refs/remotes/'.length)
      if (name.endsWith('/HEAD')) continue
      refs.push({ name, kind: 'remote' })
    }
    // Anything else (refs/stash, refs/notes, ...) is dropped.
  }
  return refs
}

export async function getGraph(cwd: string, skip: number, limit: number): Promise<GraphCommit[]> {
  const format = ['%H', '%P', '%an', '%ae', '%at', '%D', '%s'].join('%x1f') + '%x1e'
  let out: string
  try {
    out = await run(cwd, [
      'log',
      '--branches',
      '--remotes',
      '--tags',
      '--topo-order',
      '--decorate=full',
      `--format=${format}`,
      '--skip',
      String(Math.max(0, Math.floor(skip))),
      '-n',
      String(Math.max(0, Math.floor(limit)))
    ])
  } catch (err) {
    // An empty repository has no refs to log.
    if (/does not have any commits|unknown revision|bad default revision/i.test(String(err)))
      return []
    throw err
  }
  const commits: GraphCommit[] = []
  for (const record of out.split(RS)) {
    const rec = record.replace(/^\n/, '')
    if (!rec) continue
    const [hash, parents, author, email, date, deco, ...subject] = rec.split(FS)
    commits.push({
      hash,
      parents: parents ? parents.split(' ') : [],
      author,
      email,
      date: Number(date),
      refs: parseDecorations(deco ?? ''),
      subject: subject.join(FS)
    })
  }
  return commits
}

export function stripCredentials(url: string): string {
  return url.replace(/^(https?:\/\/)[^/@]*@/i, '$1')
}

async function countLines(cwd: string, args: string[]): Promise<number | null> {
  const out = await tryRun(cwd, args)
  return out === null ? null : out.split('\n').filter(Boolean).length
}

/** Fetch remotes with credentials stripped. Empty when git cannot list them. */
export async function getRemotes(cwd: string): Promise<LocalRemote[]> {
  const raw = await tryRun(cwd, ['remote', '-v'])
  const remotes = new Map<string, string>()
  for (const line of (raw ?? '').split('\n')) {
    const m = /^(\S+)\t(\S+) \(fetch\)$/.exec(line)
    if (m) remotes.set(m[1], stripCredentials(m[2]))
  }
  return [...remotes].map(([name, url]) => ({ name, url }))
}

export async function getLocalInfo(cwd: string): Promise<LocalInfo> {
  const branch = await tryRun(cwd, ['symbolic-ref', '--short', '-q', 'HEAD'])
  const head = await tryRun(cwd, ['rev-parse', '--verify', '-q', 'HEAD'])
  const remotes = new Map((await getRemotes(cwd)).map((r) => [r.name, r.url] as const))

  const tagsRaw = await tryRun(cwd, ['tag', '--sort=-creatordate'])
  const tagList = tagsRaw ? tagsRaw.split('\n').filter(Boolean) : []

  const ab = await tryRun(cwd, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
  const [behind, ahead] = ab ? ab.split(/\s+/) : [null, null]

  const sizeRaw = await tryRun(cwd, ['count-objects', '-v'])
  let sizeKb: number | null = null
  if (sizeRaw) {
    const kv = Object.fromEntries(sizeRaw.split('\n').map((l) => l.split(': ')))
    sizeKb = (Number(kv['size']) || 0) + (Number(kv['size-pack']) || 0)
  }

  const roots = head ? await tryRun(cwd, ['log', '--max-parents=0', '--format=%at']) : null
  const rootDates = (roots ?? '').split('\n').filter(Boolean).map(Number)

  return {
    path: cwd,
    currentBranch: branch || null,
    headHash: head || null,
    detached: head !== null && !branch,
    remotes: [...remotes].map(([name, url]) => ({ name, url })),
    localBranches: await countLines(cwd, ['for-each-ref', 'refs/heads', '--format=%(refname)']),
    remoteBranches: await countLines(cwd, [
      'for-each-ref',
      'refs/remotes',
      '--format=%(refname)'
    ]).then(async (n) => {
      if (n === null) return null
      // Exclude the symbolic origin/HEAD entries.
      const heads = await countLines(cwd, [
        'for-each-ref',
        'refs/remotes/*/HEAD',
        '--format=%(refname)'
      ])
      return n - (heads ?? 0)
    }),
    tags: tagsRaw === null ? null : tagList.length,
    latestTags: tagList.slice(0, 5),
    commitCount: head ? toInt(await tryRun(cwd, ['rev-list', '--count', 'HEAD'])) : null,
    firstCommitAt: rootDates.length ? Math.min(...rootDates) : null,
    lastCommitAt: head ? toInt(await tryRun(cwd, ['log', '-1', '--format=%at'])) : null,
    dirtyFiles: await countLines(cwd, ['status', '--porcelain']),
    ahead: toInt(ahead ?? null),
    behind: toInt(behind ?? null),
    sizeKb
  }
}

export async function getCommitDetail(cwd: string, hash: string): Promise<CommitDetail> {
  if (!HASH_RE.test(hash)) throw new Error('Invalid commit hash')
  const body = (await run(cwd, ['show', '-s', '--format=%B', hash])).trim()
  const stat = await run(cwd, [
    '-c',
    'core.quotepath=false',
    'show',
    '-m',
    '--first-parent',
    '--numstat',
    '--format=',
    hash
  ])
  const files: CommitFile[] = []
  for (const line of stat.split('\n')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line)
    if (!m) continue
    files.push({
      path: m[3],
      additions: m[1] === '-' ? null : Number(m[1]),
      deletions: m[2] === '-' ? null : Number(m[2])
    })
  }
  return { hash, body, files }
}

export async function gitFetch(cwd: string, env: Record<string, string> = {}): Promise<void> {
  await run(cwd, ['fetch', '--all', '--prune'], env)
}

export function cloneRepo(
  url: string,
  dest: string,
  env: Record<string, string> = {},
  onLine: (line: string) => void = () => {}
): Promise<void> {
  return slots.run(() => cloneProcess(url, dest, env, onLine))
}

function cloneProcess(
  url: string,
  dest: string,
  env: Record<string, string>,
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['clone', '--progress', '--', url, dest], { env: gitEnv(env) })
    let buffer = ''
    let last = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      buffer += chunk
      const parts = buffer.split(/[\r\n]/)
      buffer = parts.pop() ?? ''
      for (const line of parts) {
        if (!line) continue
        last = line
        onLine(line)
      }
    })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (buffer) {
        last = buffer
        onLine(buffer)
      }
      if (code === 0) resolve()
      else reject(new Error(last || `git clone exited with code ${code}`))
    })
  })
}
