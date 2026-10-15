import { execFile, spawn } from 'node:child_process'
import type { CommitDetail, GraphCommit, GraphRef, LocalInfo } from '../shared/types'

const BASE_ENV = { GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }
const MAX_BUFFER = 64 * 1024 * 1024

export const HASH_RE = /^[0-9a-f]{7,64}$/i

/** Runs git without a shell. Error messages never include the environment. */
function git(args: string[], cwd: string | undefined, extraEnv: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, env: { ...process.env, ...BASE_ENV, ...extraEnv }, maxBuffer: MAX_BUFFER, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err) {
          const msg = stderr.trim() || (err as Error).message
          reject(new Error(stripUrlCredentials(msg.split('\n')[0]) || 'git failed'))
        } else resolve(stdout)
      }
    )
  })
}

export async function repoRoot(dir: string): Promise<string> {
  return (await git(['rev-parse', '--show-toplevel'], dir)).trim()
}

const FIELD = '\x1f'
const RECORD = '\x1e'
const LOG_FORMAT = ['%H', '%P', '%an', '%ae', '%at', '%D', '%s'].join('%x1f') + '%x1e'

export function parseRefs(decoration: string): GraphRef[] {
  const refs: GraphRef[] = []
  let current: string | null = null
  for (let part of decoration.split(',').map((s) => s.trim())) {
    if (!part) continue
    let isHead = false
    if (part.startsWith('HEAD -> ')) {
      part = part.slice('HEAD -> '.length)
      isHead = true
    }
    if (part === 'HEAD') {
      refs.push({ name: 'HEAD', kind: 'head' })
    } else if (part.startsWith('tag: refs/tags/')) {
      refs.push({ name: part.slice('tag: refs/tags/'.length), kind: 'tag' })
    } else if (part.startsWith('refs/heads/')) {
      const name = part.slice('refs/heads/'.length)
      refs.push({ name, kind: 'branch', ...(isHead ? { current: true } : {}) })
      if (isHead) current = name
    } else if (part.startsWith('refs/remotes/')) {
      const name = part.slice('refs/remotes/'.length)
      if (!name.endsWith('/HEAD')) refs.push({ name, kind: 'remote' })
    }
    // refs/stash and anything else is dropped
  }
  if (current) refs.sort((a, b) => Number(b.current === true) - Number(a.current === true))
  return refs
}

export async function getGraph(cwd: string, skip: number, limit: number): Promise<GraphCommit[]> {
  let out: string
  try {
    out = await git(
      [
        'log', '--branches', '--remotes', '--tags', '--topo-order', '--decorate=full',
        `--format=${LOG_FORMAT}`, '--skip', String(skip), '-n', String(limit)
      ],
      cwd
    )
  } catch (e) {
    // An empty repository has no commits to log.
    if (/does not have any commits|unknown revision|bad default revision/i.test((e as Error).message)) return []
    throw e
  }
  const commits: GraphCommit[] = []
  for (const rec of out.split(RECORD)) {
    const text = rec.replace(/^\n/, '')
    if (!text) continue
    const [hash, parents, author, email, date, deco, subject] = text.split(FIELD)
    commits.push({
      hash,
      parents: parents ? parents.split(' ') : [],
      author,
      email,
      date: Number(date),
      refs: parseRefs(deco ?? ''),
      subject: subject ?? ''
    })
  }
  return commits
}

export function stripCredentials(url: string): string {
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i, '$1')
}

const stripUrlCredentials = (text: string): string => text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s]*@/gi, '$1')

async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}

const countLines = (s: string): number => s.split('\n').filter(Boolean).length

export async function getLocalInfo(cwd: string): Promise<LocalInfo> {
  const [branch, head, remotesOut, locals, remotes, tagCount, tagList, count, firstOut, lastOut, status, aheadBehind, sizes] =
    await Promise.all([
      attempt(() => git(['symbolic-ref', '--short', '-q', 'HEAD'], cwd)),
      attempt(() => git(['rev-parse', 'HEAD'], cwd)),
      attempt(() => git(['remote', '-v'], cwd)),
      attempt(() => git(['for-each-ref', '--format=x', 'refs/heads'], cwd)),
      attempt(() => git(['for-each-ref', '--format=%(refname)', 'refs/remotes'], cwd)),
      attempt(() => git(['tag'], cwd)),
      attempt(() => git(['tag', '--sort=-creatordate'], cwd)),
      attempt(() => git(['rev-list', '--count', 'HEAD'], cwd)),
      attempt(() => git(['log', '--reverse', '--format=%at', '--max-parents=0', 'HEAD'], cwd)),
      attempt(() => git(['log', '-1', '--format=%at', 'HEAD'], cwd)),
      attempt(() => git(['status', '--porcelain'], cwd)),
      attempt(() => git(['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], cwd)),
      attempt(() => git(['count-objects', '-v'], cwd))
    ])

  const remoteMap = new Map<string, string>()
  for (const line of (remotesOut ?? '').split('\n')) {
    const m = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line.trim())
    if (m) remoteMap.set(m[1], stripCredentials(m[2]))
  }

  let ahead: number | null = null
  let behind: number | null = null
  if (aheadBehind) {
    const [b, a] = aheadBehind.trim().split(/\s+/).map(Number)
    behind = b
    ahead = a
  }

  let sizeKb: number | null = null
  if (sizes) {
    const kb = (key: string): number => Number(new RegExp(`^${key}: (\\d+)`, 'm').exec(sizes)?.[1] ?? 0)
    sizeKb = kb('size') + kb('size-pack')
  }

  const num = (s: string | null): number | null => {
    const n = Number(s?.trim().split('\n')[0])
    return s && Number.isFinite(n) && s.trim() ? n : null
  }
  const branchName = branch?.trim() || null

  return {
    path: cwd,
    currentBranch: branchName,
    headHash: head?.trim() || null,
    detached: head !== null && branchName === null,
    remotes: [...remoteMap].map(([name, url]) => ({ name, url })),
    localBranches: locals === null ? null : countLines(locals),
    remoteBranches:
      remotes === null ? null : remotes.split('\n').filter((l) => l && !l.endsWith('/HEAD')).length,
    tags: tagCount === null ? null : countLines(tagCount),
    latestTags: (tagList ?? '').split('\n').filter(Boolean).slice(0, 5),
    commitCount: num(count),
    firstCommitAt: num(firstOut),
    lastCommitAt: num(lastOut),
    dirtyFiles: status === null ? null : countLines(status),
    ahead,
    behind,
    sizeKb
  }
}

export async function getCommitDetail(cwd: string, hash: string): Promise<CommitDetail> {
  if (!HASH_RE.test(hash)) throw new Error('Invalid commit hash')
  const [body, stat] = await Promise.all([
    git(['show', '-s', '--format=%B', hash], cwd),
    git(['-c', 'core.quotepath=false', 'show', '-m', '--first-parent', '--numstat', '--format=', hash], cwd)
  ])
  const files = stat
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [add, del, ...rest] = line.split('\t')
      const binary = add === '-' && del === '-'
      return { path: rest.join('\t'), additions: binary ? null : Number(add), deletions: binary ? null : Number(del) }
    })
  return { hash, body: body.trim(), files }
}

export async function gitFetch(cwd: string, env: Record<string, string> = {}): Promise<void> {
  await git(['fetch', '--all', '--prune'], cwd, env)
}

export function cloneRepo(
  url: string,
  dest: string,
  env: Record<string, string>,
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['clone', '--progress', '--', url, dest], {
      env: { ...process.env, ...BASE_ENV, ...env },
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let tail = ''
    let lastLine = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      const parts = (tail + chunk).split(/[\r\n]/)
      tail = parts.pop() ?? ''
      for (const p of parts) {
        if (!p.trim()) continue
        lastLine = p
        onLine(p)
      }
    })
    child.on('error', (e) => reject(new Error(`Could not run git: ${e.message}`)))
    child.on('close', (code) => {
      if (tail.trim()) lastLine = tail
      if (code === 0) resolve()
      else reject(new Error(lastLine.trim() || `git clone failed (exit ${code})`))
    })
  })
}
