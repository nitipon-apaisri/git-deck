// Local git service. No electron import, so it runs under tsx tests.
import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { Semaphore } from './semaphore'
import { hunkFingerprint, parseUnifiedDiff, splitPatch } from '../shared/diff'
import type {
  BranchList,
  ChangeKind,
  CheckoutTarget,
  CommitDetail,
  CommitFile,
  DiffRequest,
  FileDiff,
  GraphCommit,
  GraphRef,
  HunkRequest,
  LocalBranch,
  LocalInfo,
  LocalRemote,
  OperationKind,
  OperationResult,
  OperationState,
  PullMode,
  RepoStatus,
  ResetImpact,
  ResetMode,
  StashEntry,
  StatusEntry,
  TagEntry
} from '../shared/types'

const MAX_BUFFER = 64 * 1024 * 1024
const HASH_RE = /^[0-9a-f]{7,64}$/i
const FS = '\x1f'
const RS = '\x1e'

// Two panes and "Fetch all" can start work together, so cap child processes.
const MAX_GIT_PROCESSES = 4
const slots = new Semaphore(MAX_GIT_PROCESSES)

function gitEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  // Optional locks off: a background `git status` must not rewrite the index, or the file
  // watcher would see our own read as a change.
  return {
    ...process.env,
    ...extra,
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    LC_ALL: 'C'
  }
}

interface RunOptions {
  env?: Record<string, string>
  /** Written to the process's stdin, then closed. */
  stdin?: string
  /** Milliseconds before the process is killed. None by default: hooks can be slow. */
  timeout?: number
  /** Exit codes that are not failures, for example 1 from `git diff --no-index`. */
  okCodes?: number[]
}

// execFile, never a shell: arguments are not interpreted.
function exec(cwd: string, args: string[], options: RunOptions = {}): Promise<string> {
  return slots.run(
    () =>
      new Promise((resolve, reject) => {
        const child = execFile(
          'git',
          args,
          {
            cwd,
            env: gitEnv(options.env),
            maxBuffer: MAX_BUFFER,
            encoding: 'utf8',
            timeout: options.timeout
          },
          (err, stdout, stderr) => {
            const code = err ? (err as { code?: unknown }).code : 0
            if (err && !(typeof code === 'number' && options.okCodes?.includes(code))) {
              // `git commit` explains "nothing to commit" on stdout, not stderr.
              reject(new Error(stderr.trim() || stdout.trim() || err.message))
            } else {
              resolve(stdout)
            }
          }
        )
        if (options.stdin !== undefined) {
          // A process that exits early closes the pipe; the callback reports why.
          child.stdin?.on('error', () => {})
          child.stdin?.end(options.stdin)
        }
      })
  )
}

function run(cwd: string, args: string[], env: Record<string, string> = {}): Promise<string> {
  return exec(cwd, args, { env })
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

/** The git directory and the common one (they differ in a linked worktree), absolute. */
export async function gitDirs(dir: string): Promise<{ gitDir: string; commonDir: string } | null> {
  const out = await tryRun(dir, ['rev-parse', '--absolute-git-dir', '--git-common-dir'])
  if (out === null) return null
  const [gitDir, common] = out.split('\n')
  if (!gitDir || !common) return null
  return { gitDir, commonDir: resolve(dir, common) }
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
  return slots.run(() =>
    progressProcess(undefined, ['clone', '--progress', '--', url, dest], env, onLine)
  )
}

// Lines git prints while it works. They are progress, not the reason a command failed.
const PROGRESS_RE =
  /^(remote: )?(Enumerating|Counting|Compressing|Writing|Receiving|Resolving|Total|Delta compression|Cloning into|Updating files|Unpacking|Checking out)/i

/**
 * Runs git and reports each stderr line as it arrives (git rewrites progress with a carriage return).
 * A failure carries the last few lines that are not progress, so a rejected push says why.
 */
function progressProcess(
  cwd: string | undefined,
  args: string[],
  env: Record<string, string>,
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env: gitEnv(env) })
    let buffer = ''
    let last = ''
    const reasons: string[] = []
    const take = (line: string): void => {
      if (!line) return
      last = line
      if (!PROGRESS_RE.test(line)) reasons.push(line)
      onLine(line)
    }
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      buffer += chunk
      const parts = buffer.split(/[\r\n]/)
      buffer = parts.pop() ?? ''
      for (const line of parts) take(line)
    })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      take(buffer)
      if (code === 0) resolve()
      else {
        const why = reasons.slice(-5).join('\n') || last
        reject(new Error(why || `git ${args[0]} exited with code ${code}`))
      }
    })
  })
}

// Branches, checkout, pull and push

/** Throws unless `name` is a valid short branch name that does not look like an option. */
export async function assertBranchName(cwd: string, name: string): Promise<void> {
  if (typeof name !== 'string' || !name || name.length > 255 || name.startsWith('-')) {
    throw new Error(`"${String(name).slice(0, 60)}" is not a valid branch name`)
  }
  if ((await tryRun(cwd, ['check-ref-format', '--branch', name])) === null || /^@/.test(name)) {
    throw new Error(`"${name}" is not a valid branch name`)
  }
}

async function refExists(cwd: string, ref: string): Promise<boolean> {
  return (await tryRun(cwd, ['show-ref', '--verify', '--quiet', ref])) !== null
}

async function currentBranch(cwd: string): Promise<string | null> {
  return tryRun(cwd, ['symbolic-ref', '--short', '-q', 'HEAD'])
}

function parseTrack(track: string): { ahead: number; behind: number; gone: boolean } {
  const ahead = /ahead (\d+)/.exec(track)
  const behind = /behind (\d+)/.exec(track)
  return {
    ahead: ahead ? Number(ahead[1]) : 0,
    behind: behind ? Number(behind[1]) : 0,
    gone: track.trim() === 'gone'
  }
}

export async function listBranches(cwd: string): Promise<BranchList> {
  const current = await currentBranch(cwd)
  const format = ['%(refname:short)', '%(upstream:short)', '%(upstream:track,nobracket)'].join(FS)
  const localRaw = (await tryRun(cwd, ['for-each-ref', 'refs/heads', `--format=${format}`])) ?? ''
  const local: LocalBranch[] = []
  for (const line of localRaw.split('\n')) {
    if (!line) continue
    const [name, upstream, track] = line.split(FS)
    local.push({
      name,
      upstream: upstream || null,
      ...parseTrack(track ?? ''),
      current: name === current
    })
  }
  local.sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name))
  const remoteRaw =
    (await tryRun(cwd, ['for-each-ref', 'refs/remotes', '--format=%(refname)'])) ?? ''
  const remote = remoteRaw
    .split('\n')
    .filter((ref) => ref && !ref.endsWith('/HEAD'))
    .map((ref) => ref.slice('refs/remotes/'.length))
    .sort()
  const remotesRaw = (await tryRun(cwd, ['remote'])) ?? ''
  return {
    current,
    detached:
      current === null && (await tryRun(cwd, ['rev-parse', '--verify', '-q', 'HEAD'])) !== null,
    local,
    remote,
    remotes: remotesRaw.split('\n').filter(Boolean)
  }
}

export async function checkout(cwd: string, target: CheckoutTarget): Promise<void> {
  if (target.kind === 'commit') {
    if (!HASH_RE.test(target.hash)) throw new Error('Invalid commit hash')
    await run(cwd, ['checkout', '--detach', target.hash, '--'])
    return
  }
  if (target.kind === 'branch') {
    if (!(await refExists(cwd, `refs/heads/${target.name}`))) {
      throw new Error(`There is no branch named "${target.name}"`)
    }
    await run(cwd, ['checkout', target.name, '--'])
    return
  }
  if (target.kind !== 'remote') throw new Error('Unknown checkout target')
  if (!(await refExists(cwd, `refs/remotes/${target.name}`))) {
    throw new Error(`There is no remote branch named "${target.name}"`)
  }
  const slash = target.name.indexOf('/')
  const localName = target.name.slice(slash + 1)
  if (slash < 1 || !localName) throw new Error('Not a remote branch')
  await assertBranchName(cwd, localName)
  if (await refExists(cwd, `refs/heads/${localName}`)) {
    // Already have it: switch to it instead of failing on a name clash.
    await run(cwd, ['checkout', localName, '--'])
    return
  }
  await run(cwd, ['checkout', '--track', '-b', localName, target.name])
}

export async function createBranch(
  cwd: string,
  name: string,
  startPoint: string | null,
  switchTo: boolean
): Promise<void> {
  await assertBranchName(cwd, name)
  if (await refExists(cwd, `refs/heads/${name}`)) {
    throw new Error(`A branch named "${name}" already exists`)
  }
  let start: string[] = []
  if (startPoint !== null) {
    const isHash = HASH_RE.test(startPoint)
    const isRef =
      (await refExists(cwd, `refs/heads/${startPoint}`)) ||
      (await refExists(cwd, `refs/remotes/${startPoint}`))
    if (!isHash && !isRef) throw new Error('The starting point is not a branch or a commit')
    start = [startPoint]
  }
  if (switchTo) await run(cwd, ['checkout', '-b', name, ...start])
  else await run(cwd, ['branch', '--', name, ...start])
}

export async function renameBranch(cwd: string, from: string, to: string): Promise<void> {
  if (!(await refExists(cwd, `refs/heads/${from}`))) {
    throw new Error(`There is no branch named "${from}"`)
  }
  await assertBranchName(cwd, to)
  await run(cwd, ['branch', '-m', '--', from, to])
}

/** Safe delete: git refuses a branch with commits that are not merged anywhere else. */
export async function deleteBranch(cwd: string, name: string): Promise<void> {
  if (!(await refExists(cwd, `refs/heads/${name}`))) {
    throw new Error(`There is no branch named "${name}"`)
  }
  if (name === (await currentBranch(cwd))) {
    throw new Error(
      'You cannot delete the branch that is checked out. Switch to another one first.'
    )
  }
  await run(cwd, ['branch', '-d', '--', name])
}

export interface RemoteTarget {
  remote: string
  /** Credentials already stripped. */
  url: string
  /** The checked-out branch already tracks a branch on `remote`. */
  hasUpstream: boolean
  branch: string
}

/**
 * The remote a pull or push talks to: the upstream's remote, else `origin`, else the only
 * remote. Never a guess between several.
 */
export async function getRemoteTarget(cwd: string): Promise<RemoteTarget> {
  const branch = await currentBranch(cwd)
  if (!branch) throw new Error('Check out a branch first. HEAD is detached.')
  const remotes = await getRemotes(cwd)
  if (remotes.length === 0) throw new Error('This repository has no remote')
  const tracked = await tryRun(cwd, ['config', '--get', `branch.${branch}.remote`])
  const merge = await tryRun(cwd, ['config', '--get', `branch.${branch}.merge`])
  const hasUpstream = !!tracked && tracked !== '.' && !!merge
  const name = hasUpstream
    ? tracked
    : (remotes.find((r) => r.name === 'origin') ?? (remotes.length === 1 ? remotes[0] : null))?.name
  if (!name)
    throw new Error('Several remotes exist and none is named origin. Set an upstream first.')
  const remote = remotes.find((r) => r.name === name)
  if (!remote) throw new Error(`The remote "${name}" is not configured`)
  return { remote: remote.name, url: remote.url, hasUpstream, branch }
}

function explainPull(message: string): Error {
  if (/not possible to fast-forward|diverging branches|cannot fast-forward/i.test(message)) {
    return new Error(
      'The branches have diverged: this branch and its upstream each have commits the other lacks. Pull and merge instead, or push after resolving it elsewhere.'
    )
  }
  return new Error(message)
}

export async function pull(
  cwd: string,
  mode: PullMode,
  env: Record<string, string> = {},
  onLine: (line: string) => void = () => {}
): Promise<void> {
  if (mode !== 'ff-only' && mode !== 'merge') throw new Error('Unknown pull mode')
  const target = await getRemoteTarget(cwd)
  if (!target.hasUpstream) {
    throw new Error(`"${target.branch}" has no upstream branch to pull from. Push it first.`)
  }
  // `--no-rebase` and `--no-edit` keep a user's pull.rebase setting and an editor out of it.
  const flags = mode === 'ff-only' ? ['--ff-only'] : ['--no-rebase', '--no-edit']
  try {
    await slots.run(() => progressProcess(cwd, ['pull', '--progress', ...flags], env, onLine))
  } catch (err) {
    throw explainPull(err instanceof Error ? err.message : String(err))
  }
}

export interface PushOptions {
  /** `--force-with-lease`: refuses if the remote moved since the last fetch. */
  forceWithLease?: boolean
}

export async function push(
  cwd: string,
  options: PushOptions = {},
  env: Record<string, string> = {},
  onLine: (line: string) => void = () => {}
): Promise<void> {
  const target = await getRemoteTarget(cwd)
  const args = ['push', '--progress']
  if (options.forceWithLease) args.push('--force-with-lease')
  // Remote and branch come from git's own config, never from the caller. Plain `git push`
  // follows the upstream and refuses when its branch name differs.
  if (!target.hasUpstream) args.push('--set-upstream', target.remote, target.branch)
  await slots.run(() => progressProcess(cwd, args, env, onLine))
}

// Working tree: status, diff, stage, unstage, discard, commit

const KIND: Record<string, ChangeKind> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  T: 'typechange'
}

const kindOf = (letter: string): ChangeKind | null => KIND[letter] ?? null

/** Parses `git status --porcelain=v2 -z --branch`. Entries are sorted by path. */
export function parseStatus(raw: string): RepoStatus {
  let branch: string | null = null
  let head: string | null = null
  const entries: StatusEntry[] = []
  const fields = raw.split('\0')
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    if (!field) continue
    if (field.startsWith('# branch.oid ')) {
      const oid = field.slice('# branch.oid '.length)
      // "(initial)" is a repository with no commits yet.
      head = oid === '(initial)' ? null : oid
    } else if (field.startsWith('# branch.head ')) {
      const name = field.slice('# branch.head '.length)
      branch = name === '(detached)' ? null : name
    } else if (field.startsWith('# ')) {
      continue
    } else if (field.startsWith('1 ')) {
      // 1 XY sub mH mI mW hH hI path
      const parts = field.split(' ')
      const xy = parts[1]
      entries.push({
        path: parts.slice(8).join(' '),
        origPath: null,
        index: kindOf(xy[0]),
        worktree: kindOf(xy[1]),
        untracked: false,
        conflicted: false
      })
    } else if (field.startsWith('2 ')) {
      // 2 XY sub mH mI mW hH hI Xscore path, then the old path as the next field
      const parts = field.split(' ')
      const xy = parts[1]
      entries.push({
        path: parts.slice(9).join(' '),
        origPath: fields[++i] ?? null,
        index: kindOf(xy[0]),
        worktree: kindOf(xy[1]),
        untracked: false,
        conflicted: false
      })
    } else if (field.startsWith('u ')) {
      // u XY sub m1 m2 m3 mW h1 h2 h3 path
      const parts = field.split(' ')
      entries.push({
        path: parts.slice(10).join(' '),
        origPath: null,
        index: null,
        worktree: null,
        untracked: false,
        conflicted: true
      })
    } else if (field.startsWith('? ')) {
      entries.push({
        path: field.slice(2),
        origPath: null,
        index: null,
        worktree: null,
        untracked: true,
        conflicted: false
      })
    }
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { branch, head, entries }
}

export async function getStatus(cwd: string): Promise<RepoStatus> {
  // `all` lists untracked files one by one instead of as a folder.
  const out = await run(cwd, [
    '-c',
    'core.quotepath=false',
    'status',
    '--porcelain=v2',
    '-z',
    '--branch',
    '--untracked-files=all'
  ])
  return parseStatus(out)
}

/** Every path must be one `git status` lists (or the old path of a rename). */
async function knownPaths(cwd: string, paths: string[]): Promise<StatusEntry[]> {
  if (paths.length === 0) throw new Error('No files selected')
  const status = await getStatus(cwd)
  const byPath = new Map<string, StatusEntry>()
  for (const entry of status.entries) {
    byPath.set(entry.path, entry)
    if (entry.origPath) byPath.set(entry.origPath, entry)
  }
  const found: StatusEntry[] = []
  for (const path of paths) {
    const entry = byPath.get(path)
    if (!entry) throw new Error(`${path} has no changes`)
    if (!found.includes(entry)) found.push(entry)
  }
  return found
}

/** Paths to hand to git for the entries: a rename needs both sides. */
function pathsOf(entries: StatusEntry[]): string[] {
  const paths = new Set<string>()
  for (const entry of entries) {
    paths.add(entry.path)
    if (entry.origPath) paths.add(entry.origPath)
  }
  return [...paths]
}

export async function getDiff(cwd: string, request: DiffRequest): Promise<FileDiff> {
  const { source, path } = request
  const base = ['-c', 'core.quotepath=false']
  const flags = ['--no-color', '--no-ext-diff', '--no-textconv', '--unified=3']
  let patch: string
  if (source === 'commit') {
    if (!request.hash || !HASH_RE.test(request.hash)) throw new Error('Invalid commit hash')
    patch = await run(cwd, [
      ...base,
      'show',
      '-m',
      '--first-parent',
      '--format=',
      ...flags,
      request.hash,
      '--',
      path
    ])
  } else if (source === 'staged') {
    await knownPaths(cwd, [path])
    patch = await run(cwd, [...base, 'diff', '--cached', ...flags, '--', path])
  } else {
    const [entry] = await knownPaths(cwd, [path])
    patch = entry.untracked
      ? await exec(cwd, [...base, 'diff', '--no-index', ...flags, '--', '/dev/null', path], {
          okCodes: [1]
        })
      : await run(cwd, [...base, 'diff', ...flags, '--', path])
  }
  return parseUnifiedDiff(path, patch)
}

export async function stagePaths(cwd: string, paths: string[]): Promise<void> {
  const entries = await knownPaths(cwd, paths)
  await run(cwd, ['add', '-A', '--', ...pathsOf(entries)])
}

export async function stageAll(cwd: string): Promise<void> {
  await run(cwd, ['add', '-A'])
}

export async function unstagePaths(cwd: string, paths: string[]): Promise<void> {
  const entries = await knownPaths(cwd, paths)
  const targets = pathsOf(entries)
  const hasHead = (await tryRun(cwd, ['rev-parse', '--verify', '-q', 'HEAD'])) !== null
  // Before the first commit there is no HEAD to restore from.
  if (hasHead) await run(cwd, ['restore', '--staged', '--', ...targets])
  else await run(cwd, ['rm', '--cached', '-r', '-q', '--', ...targets])
}

/**
 * Throws away work-tree changes. Untracked files are deleted, tracked files go back
 * to what the index holds. Staged changes are kept.
 */
export async function discardPaths(cwd: string, paths: string[]): Promise<void> {
  const entries = await knownPaths(cwd, paths)
  if (entries.some((e) => e.conflicted)) throw new Error('Resolve the conflict before discarding')
  const untracked = entries.filter((e) => e.untracked).map((e) => e.path)
  const tracked = entries.filter((e) => !e.untracked && e.worktree).map((e) => e.path)
  if (tracked.length > 0) await run(cwd, ['restore', '--', ...tracked])
  if (untracked.length > 0) await run(cwd, ['clean', '-f', '-q', '--', ...untracked])
}

export async function createCommit(cwd: string, message: string, amend: boolean): Promise<void> {
  const text = message.trim()
  if (!text && !amend) throw new Error('Write a commit message')
  const args = ['commit']
  if (amend) args.push('--amend')
  if (text) args.push('-F', '-')
  else args.push('--no-edit')
  // The message goes in on stdin, so it never appears in a process list.
  await exec(cwd, args, { stdin: text ? `${text}\n` : undefined })
}

// Stash, cherry-pick and merge

const MAX_STASH_MESSAGE = 500

function stashRef(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 10_000) throw new Error('Invalid stash')
  return `stash@{${index}}`
}

/** `%gs` reads "On main: message" or "WIP on main: abc1234 subject". */
export function parseStashSubject(subject: string): { branch: string | null; message: string } {
  const named = /^On ([^:]+): ([\s\S]*)$/.exec(subject)
  if (named) return { branch: named[1], message: named[2] }
  const wip = /^WIP on ([^:]+): ([\s\S]*)$/.exec(subject)
  if (wip) return { branch: wip[1], message: `WIP: ${wip[2]}` }
  return { branch: null, message: subject }
}

export async function listStashes(cwd: string): Promise<StashEntry[]> {
  const format = ['%H', '%ct', '%gs'].join('%x1f') + '%x1e'
  const out = (await tryRun(cwd, ['stash', 'list', `--format=${format}`])) ?? ''
  const entries: StashEntry[] = []
  for (const row of out.split(RS)) {
    const text = row.replace(/^\n/, '')
    if (!text) continue
    const [hash, at, subject] = text.split(FS)
    entries.push({
      index: entries.length,
      hash,
      createdAt: toInt(at) ?? 0,
      ...parseStashSubject(subject ?? '')
    })
  }
  return entries
}

/** The stash must still be at `index` with the hash the user saw. */
async function checkStash(cwd: string, index: number, hash: string): Promise<string> {
  const ref = stashRef(index)
  if (typeof hash !== 'string' || !HASH_RE.test(hash)) throw new Error('Invalid stash')
  const now = await tryRun(cwd, ['rev-parse', '--verify', '-q', ref])
  if (!now || !now.toLowerCase().startsWith(hash.toLowerCase())) {
    throw new Error('The stash list changed. Reload it and try again.')
  }
  return ref
}

export async function stashPush(
  cwd: string,
  message: string,
  includeUntracked: boolean
): Promise<void> {
  const text = message.trim()
  if (text.length > MAX_STASH_MESSAGE) throw new Error('The stash message is too long')
  const args = ['stash', 'push']
  if (includeUntracked) args.push('--include-untracked')
  // The message is the value of -m, so it cannot be read as an option.
  if (text) args.push('-m', text)
  const out = await run(cwd, args)
  // Git exits 0 and says so on stdout when there was nothing to save.
  if (/no local changes to save/i.test(out)) throw new Error('There are no changes to stash')
}

export async function stashApply(cwd: string, index: number, hash: string): Promise<void> {
  await run(cwd, ['stash', 'apply', '--quiet', await checkStash(cwd, index, hash)])
}

export async function stashPop(cwd: string, index: number, hash: string): Promise<void> {
  await run(cwd, ['stash', 'pop', '--quiet', await checkStash(cwd, index, hash)])
}

export async function stashDrop(cwd: string, index: number, hash: string): Promise<void> {
  await run(cwd, ['stash', 'drop', '--quiet', await checkStash(cwd, index, hash)])
}

async function gitPathExists(cwd: string, name: string): Promise<string | null> {
  const rel = await tryRun(cwd, ['rev-parse', '--git-path', name])
  if (!rel) return null
  const full = resolve(cwd, rel)
  return existsSync(full) ? full : null
}

const OPERATION_FILES: [string, OperationKind][] = [
  ['MERGE_HEAD', 'merge'],
  ['CHERRY_PICK_HEAD', 'cherry-pick'],
  ['REVERT_HEAD', 'revert']
]

export const NO_OPERATION = 'There is no merge, cherry-pick, revert or rebase in progress'

const REBASE_DIRS = ['rebase-merge', 'rebase-apply']

/** The rebase directory of a running rebase. `git am` also uses rebase-apply: not ours. */
async function rebaseDir(cwd: string): Promise<string | null> {
  for (const name of REBASE_DIRS) {
    const dir = await gitPathExists(cwd, name)
    if (dir && !existsSync(resolve(dir, 'applying'))) return dir
  }
  return null
}

/** The merge, cherry-pick, revert or rebase waiting for the user, or `null`. */
export async function getOperation(cwd: string): Promise<OperationState | null> {
  let kind: OperationKind | null = null
  let file: string | null = null
  // A rebase replays commits one by one and may leave CHERRY_PICK_HEAD too: it wins.
  const dir = await rebaseDir(cwd)
  if (dir) {
    kind = 'rebase'
    file = resolve(dir, 'onto')
  }
  for (const [name, candidate] of kind ? [] : OPERATION_FILES) {
    file = await gitPathExists(cwd, name)
    if (file) {
      kind = candidate
      break
    }
  }
  if (!file || !kind) return null
  let target: string | null
  try {
    const first = readFileSync(file, 'utf8').split('\n')[0].trim()
    target = HASH_RE.test(first) ? first.slice(0, 7) : null
  } catch {
    target = null
  }
  const status = await getStatus(cwd)
  return {
    kind,
    target,
    conflicted: status.entries.filter((e) => e.conflicted).map((e) => e.path)
  }
}

async function assertNoOperation(cwd: string): Promise<void> {
  const state = await getOperation(cwd)
  if (state) {
    throw new Error(
      `A ${state.kind} is already in progress. Continue or abort it before starting another.`
    )
  }
}

/** After a stop: conflicts mean the user decides, anything else is an error to report. */
async function settle(cwd: string, abort: string[], failure: unknown): Promise<OperationResult> {
  const state = await getOperation(cwd)
  if (state && state.conflicted.length > 0) return { conflicted: true }
  if (state) {
    // Stopped without conflicts, for example a cherry-pick that became empty.
    await tryRun(cwd, abort)
  }
  throw failure instanceof Error ? failure : new Error(String(failure))
}

export async function cherryPick(cwd: string, hash: string): Promise<OperationResult> {
  if (typeof hash !== 'string' || !HASH_RE.test(hash)) throw new Error('Invalid commit hash')
  if ((await tryRun(cwd, ['cat-file', '-e', `${hash}^{commit}`])) === null) {
    throw new Error('That commit does not exist in this repository')
  }
  await assertNoOperation(cwd)
  const parents = (await tryRun(cwd, ['rev-list', '--parents', '-n', '1', hash])) ?? ''
  if (parents.split(' ').length > 2) {
    throw new Error(
      'This is a merge commit. Cherry-picking a merge needs a mainline, which is not supported.'
    )
  }
  try {
    await run(cwd, ['cherry-pick', hash])
    return { conflicted: false }
  } catch (err) {
    const state = await getOperation(cwd)
    if (state && state.conflicted.length === 0) {
      // Stopped with nothing to resolve: the changes are already in the branch.
      await tryRun(cwd, ['cherry-pick', '--abort'])
      throw new Error('Nothing to apply: the changes of this commit are already in the branch.', {
        cause: err
      })
    }
    return settle(cwd, ['cherry-pick', '--abort'], err)
  }
}

export async function merge(
  cwd: string,
  branch: string,
  options: { noFf?: boolean } = {}
): Promise<OperationResult> {
  if (typeof branch !== 'string' || !branch || branch.startsWith('-')) {
    throw new Error('Invalid branch name')
  }
  const isLocal = await refExists(cwd, `refs/heads/${branch}`)
  if (!isLocal && !(await refExists(cwd, `refs/remotes/${branch}`))) {
    throw new Error(`There is no branch named "${branch}"`)
  }
  await assertNoOperation(cwd)
  // `--no-edit` keeps an editor out of it. Without `--no-ff` git may fast-forward.
  const args = ['merge', '--no-edit', options.noFf ? '--no-ff' : '--ff', branch]
  try {
    await run(cwd, args)
    return { conflicted: false }
  } catch (err) {
    return settle(cwd, ['merge', '--abort'], err)
  }
}

const CONFLICT_MARKER = /^(<{7}|>{7})( |$)/m
const MAX_SCAN_BYTES = 5 * 1024 * 1024

/** Files that still carry conflict markers. Missing, huge and binary files are skipped. */
function stillMarked(cwd: string, paths: string[]): string[] {
  const marked: string[] = []
  for (const path of paths) {
    const full = resolve(cwd, path)
    if (full !== cwd && !full.startsWith(cwd + sep)) continue
    try {
      const info = statSync(full)
      if (!info.isFile() || info.size > MAX_SCAN_BYTES) continue
      if (CONFLICT_MARKER.test(readFileSync(full, 'utf8'))) marked.push(path)
    } catch {
      // Deleted by the user: that is a resolution.
    }
  }
  return marked
}

/**
 * Stages the files the user fixed, then finishes the merge, cherry-pick or revert. Refuses while a
 * file still holds conflict markers.
 */
export async function continueOperation(cwd: string): Promise<void> {
  const state = await getOperation(cwd)
  if (!state) throw new Error(NO_OPERATION)
  const marked = stillMarked(cwd, state.conflicted)
  if (marked.length > 0) {
    throw new Error(
      `These files still contain conflict markers: ${marked.slice(0, 5).join(', ')}${marked.length > 5 ? ', ...' : ''}`
    )
  }
  if (state.conflicted.length > 0) await run(cwd, ['add', '-A', '--', ...state.conflicted])
  // `true` as the editor accepts the message git prepared.
  const env = { GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true' }
  if (state.kind === 'merge') await run(cwd, ['commit', '--no-edit'], env)
  else if (state.kind === 'rebase') await rebaseStep(cwd, 'continue', env)
  else await run(cwd, [state.kind, '--continue'], env)
}

export async function abortOperation(cwd: string): Promise<void> {
  const state = await getOperation(cwd)
  if (!state) throw new Error(NO_OPERATION)
  await run(cwd, [state.kind, '--abort'])
}

// Tags, revert, reset and remotes

/** Throws unless `name` is a valid tag name that does not look like an option. */
export async function assertTagName(cwd: string, name: string): Promise<void> {
  if (typeof name !== 'string' || !name || name.length > 255 || name.startsWith('-')) {
    throw new Error(`"${String(name).slice(0, 60)}" is not a valid tag name`)
  }
  if ((await tryRun(cwd, ['check-ref-format', `refs/tags/${name}`])) === null) {
    throw new Error(`"${name}" is not a valid tag name`)
  }
}

async function assertCommit(cwd: string, hash: unknown): Promise<string> {
  if (typeof hash !== 'string' || !HASH_RE.test(hash)) throw new Error('Invalid commit hash')
  if ((await tryRun(cwd, ['cat-file', '-e', `${hash}^{commit}`])) === null) {
    throw new Error('That commit does not exist in this repository')
  }
  return hash
}

const MAX_TAG_MESSAGE = 5000

export async function listTags(cwd: string): Promise<TagEntry[]> {
  const format =
    [
      '%(refname)',
      '%(objecttype)',
      '%(*objectname)',
      '%(objectname)',
      '%(creatordate:unix)',
      '%(contents:subject)'
    ].join('%1f') + '%1e'
  const out =
    (await tryRun(cwd, [
      'for-each-ref',
      '--sort=-creatordate',
      `--format=${format}`,
      'refs/tags'
    ])) ?? ''
  const tags: TagEntry[] = []
  for (const row of out.split(RS)) {
    const text = row.replace(/^\n/, '')
    if (!text) continue
    const [ref, type, target, object, at, subject] = text.split(FS)
    const annotated = type === 'tag'
    tags.push({
      name: ref.replace(/^refs\/tags\//, ''),
      hash: annotated && target ? target : object,
      annotated,
      message: annotated ? subject || null : null,
      createdAt: toInt(at) ?? 0
    })
  }
  return tags
}

/** A tag at `hash`, or at HEAD when `hash` is `null`. A message makes it annotated. */
export async function createTag(
  cwd: string,
  name: string,
  hash: string | null,
  message: string | null
): Promise<void> {
  await assertTagName(cwd, name)
  const target = hash === null ? 'HEAD' : await assertCommit(cwd, hash)
  if (hash === null && (await tryRun(cwd, ['rev-parse', '--verify', '-q', 'HEAD'])) === null) {
    throw new Error('There is no commit to tag yet')
  }
  if (await refExists(cwd, `refs/tags/${name}`)) throw new Error(`The tag "${name}" already exists`)
  const text = (message ?? '').trim()
  if (text.length > MAX_TAG_MESSAGE) throw new Error('The tag message is too long')
  // The message goes in on stdin, never as an argument.
  if (text) await exec(cwd, ['tag', '-a', '-F', '-', name, target], { stdin: text + '\n' })
  else await run(cwd, ['tag', name, target])
}

export async function deleteTag(cwd: string, name: string): Promise<void> {
  await assertTagName(cwd, name)
  if (!(await refExists(cwd, `refs/tags/${name}`))) throw new Error(`There is no tag "${name}"`)
  await run(cwd, ['tag', '-d', name])
}

/**
 * The remote a tag goes to: `origin`, else the only remote. Unlike pull and push it does not
 * need a checked-out branch, because a tag belongs to no branch.
 */
export async function getTagRemote(cwd: string): Promise<RemoteTarget> {
  const remotes = await getRemotes(cwd)
  if (remotes.length === 0) throw new Error('This repository has no remote')
  const remote =
    remotes.find((r) => r.name === 'origin') ?? (remotes.length === 1 ? remotes[0] : null)
  if (!remote) throw new Error('Several remotes exist and none is named origin.')
  return { remote: remote.name, url: remote.url, hasUpstream: false, branch: '' }
}

async function tagRefspec(cwd: string, name: string, deleting: boolean): Promise<string[]> {
  await assertTagName(cwd, name)
  const target = await getTagRemote(cwd)
  // Deleting only needs the name, because the local tag may already be gone.
  if (!deleting && !(await refExists(cwd, `refs/tags/${name}`))) {
    throw new Error(`There is no tag "${name}"`)
  }
  const ref = `refs/tags/${name}`
  return ['push', '--progress', '--', target.remote, deleting ? `:${ref}` : ref]
}

export async function pushTag(
  cwd: string,
  name: string,
  env: Record<string, string> = {},
  onLine: (line: string) => void = () => {}
): Promise<void> {
  const args = await tagRefspec(cwd, name, false)
  await slots.run(() => progressProcess(cwd, args, env, onLine))
}

export async function deleteRemoteTag(
  cwd: string,
  name: string,
  env: Record<string, string> = {},
  onLine: (line: string) => void = () => {}
): Promise<void> {
  const args = await tagRefspec(cwd, name, true)
  await slots.run(() => progressProcess(cwd, args, env, onLine))
}

/** Reverts one commit onto the current branch. Stops on conflicts, like a cherry-pick. */
export async function revert(cwd: string, hash: string): Promise<OperationResult> {
  await assertCommit(cwd, hash)
  await assertNoOperation(cwd)
  const parents = (await tryRun(cwd, ['rev-list', '--parents', '-n', '1', hash])) ?? ''
  if (parents.split(' ').length > 2) {
    throw new Error(
      'This is a merge commit. Reverting a merge needs a mainline, which is not supported.'
    )
  }
  if ((await currentBranch(cwd)) === null) {
    throw new Error('Check out a branch first. HEAD is detached.')
  }
  try {
    await run(cwd, ['revert', '--no-edit', hash])
    return { conflicted: false }
  } catch (err) {
    const state = await getOperation(cwd)
    if (state && state.conflicted.length === 0) {
      // Stopped with nothing to resolve: the commit was already undone.
      await tryRun(cwd, ['revert', '--abort'])
      throw new Error('Nothing to revert: the changes of this commit are already undone.', {
        cause: err
      })
    }
    return settle(cwd, ['revert', '--abort'], err)
  }
}

/** What a hard reset to `hash` would lose, for the confirm. */
export async function getResetImpact(cwd: string, hash: string): Promise<ResetImpact> {
  await assertCommit(cwd, hash)
  const count = toInt(await tryRun(cwd, ['rev-list', '--count', `${hash}..HEAD`]))
  const status = await getStatus(cwd)
  return {
    commits: count ?? 0,
    files: status.entries.filter((e) => !e.untracked).length
  }
}

export async function reset(cwd: string, hash: string, mode: ResetMode): Promise<void> {
  if (mode !== 'soft' && mode !== 'mixed' && mode !== 'hard') throw new Error('Unknown reset mode')
  await assertCommit(cwd, hash)
  await assertNoOperation(cwd)
  await run(cwd, ['reset', `--${mode}`, hash])
}

const REMOTE_URL_RE =
  /^(?:(?:https?|ssh|git):\/\/[^\s/@:]+(?::\d+)?(?:\/\S*)?|(?:https?|ssh|git):\/\/[^\s/@]+@[^\s/@:]+(?::\d+)?(?:\/\S*)?|[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:\S+|\/\S*|[A-Za-z]:[\\/]\S*)$/

/** Throws unless `name` is a safe remote name that does not look like an option. */
export async function assertRemoteName(cwd: string, name: string): Promise<void> {
  if (typeof name !== 'string' || !name || name.length > 100 || name.startsWith('-')) {
    throw new Error('The remote name is not valid')
  }
  if (
    /\s/.test(name) ||
    (await tryRun(cwd, ['check-ref-format', `refs/remotes/${name}/x`])) === null
  ) {
    throw new Error('The remote name is not valid')
  }
}

/** Throws for a URL that carries a secret or could run a helper program. */
export function assertRemoteUrl(url: string): string {
  const value = typeof url === 'string' ? url.trim() : ''
  if (!value || value.length > 2048 || value.startsWith('-') || value.includes('::')) {
    throw new Error('The remote URL is not valid')
  }
  // `https://token@host` and `https://user:password@host` keep secrets out of .git/config.
  if (/^https?:\/\/[^/]*@/i.test(value) || /^[a-z]+:\/\/[^/@]*:[^/@]*@/i.test(value)) {
    throw new Error('Do not put a username, password or token in the URL. Sign in with an account.')
  }
  if (!REMOTE_URL_RE.test(value)) throw new Error('The remote URL is not valid')
  return value
}

async function remoteExists(cwd: string, name: string): Promise<boolean> {
  return (await getRemotes(cwd)).some((r) => r.name === name)
}

export async function addRemote(cwd: string, name: string, url: string): Promise<void> {
  await assertRemoteName(cwd, name)
  const clean = assertRemoteUrl(url)
  if (await remoteExists(cwd, name)) throw new Error(`The remote "${name}" already exists`)
  await run(cwd, ['remote', 'add', '--', name, clean])
}

export async function renameRemote(cwd: string, from: string, to: string): Promise<void> {
  await assertRemoteName(cwd, from)
  await assertRemoteName(cwd, to)
  if (!(await remoteExists(cwd, from))) throw new Error(`There is no remote "${from}"`)
  if (await remoteExists(cwd, to)) throw new Error(`The remote "${to}" already exists`)
  await run(cwd, ['remote', 'rename', '--', from, to])
}

export async function removeRemote(cwd: string, name: string): Promise<void> {
  await assertRemoteName(cwd, name)
  if (!(await remoteExists(cwd, name))) throw new Error(`There is no remote "${name}"`)
  await run(cwd, ['remote', 'remove', '--', name])
}

// Rebase and hunk staging

/**
 * `rebase --continue` or `--skip`. The next commit may conflict in turn: that is not a failure,
 * the banner shows the new files.
 */
async function rebaseStep(
  cwd: string,
  step: 'continue' | 'skip',
  env: Record<string, string>
): Promise<void> {
  try {
    await run(cwd, ['rebase', `--${step}`], env)
  } catch (err) {
    const next = await getOperation(cwd)
    if (next?.kind === 'rebase' && next.conflicted.length > 0) return
    throw err
  }
}

/** Drops the commit the rebase stopped on. Only a rebase can skip. */
export async function skipOperation(cwd: string): Promise<void> {
  const state = await getOperation(cwd)
  if (!state) throw new Error(NO_OPERATION)
  if (state.kind !== 'rebase') throw new Error('Only a rebase can skip a commit')
  await rebaseStep(cwd, 'skip', { GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true' })
}

/**
 * Replays the current branch on top of `onto`: a local branch, a remote branch (`origin/x`) or a
 * commit hash. Non-interactive only. Stops on conflicts, like a merge.
 */
export async function rebase(cwd: string, onto: string): Promise<OperationResult> {
  if (typeof onto !== 'string' || !onto || onto.length > 255 || onto.startsWith('-')) {
    throw new Error('Invalid branch or commit')
  }
  // First: during a rebase HEAD is detached, and "already in progress" is the useful answer.
  await assertNoOperation(cwd)
  const branch = await currentBranch(cwd)
  if (!branch) throw new Error('Check out a branch first. HEAD is detached.')
  let ref: string
  if (await refExists(cwd, `refs/heads/${onto}`)) ref = `refs/heads/${onto}`
  else if (await refExists(cwd, `refs/remotes/${onto}`)) ref = `refs/remotes/${onto}`
  else if (
    HASH_RE.test(onto) &&
    (await tryRun(cwd, ['cat-file', '-e', `${onto}^{commit}`])) !== null
  )
    ref = onto
  else throw new Error(`There is no branch or commit named "${onto}"`)
  if (ref === `refs/heads/${branch}`) throw new Error('A branch cannot be rebased onto itself')
  const status = await getStatus(cwd)
  if (status.entries.some((e) => !e.untracked)) {
    throw new Error('Commit or stash your changes before rebasing.')
  }
  const env = { GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true' }
  try {
    // Config that would stash, reorder or open an editor is switched off for this run.
    await exec(cwd, ['-c', 'rebase.autoStash=false', 'rebase', '--no-autosquash', ref], { env })
    return { conflicted: false }
  } catch (err) {
    return settle(cwd, ['rebase', '--abort'], err)
  }
}

/** Checks the request, re-reads the file's diff and returns the one hunk as a patch. */
async function hunkPatch(cwd: string, request: HunkRequest): Promise<string> {
  const { source, path, index, fingerprint } = request
  if (source !== 'worktree' && source !== 'staged') throw new Error('Invalid hunk')
  if (!Number.isInteger(index) || index < 0 || index > 100_000) throw new Error('Invalid hunk')
  if (typeof fingerprint !== 'string' || !/^[0-9a-f]{8}$/.test(fingerprint)) {
    throw new Error('Invalid hunk')
  }
  const [entry] = await knownPaths(cwd, [path])
  if (entry.conflicted) throw new Error('Resolve the conflict before staging parts of this file')
  if (entry.origPath) throw new Error('A renamed file is staged as a whole, not hunk by hunk')
  if (source === 'worktree' && (entry.untracked || !entry.worktree)) {
    throw new Error(
      'Only changes to a tracked file can be staged hunk by hunk. Stage the whole file.'
    )
  }
  if (source === 'staged' && !entry.index) throw new Error(`${path} has nothing staged`)
  const patch = await run(cwd, [
    '-c',
    'core.quotepath=false',
    'diff',
    ...(source === 'staged' ? ['--cached'] : []),
    '--no-color',
    '--no-ext-diff',
    '--no-textconv',
    '--unified=3',
    '--',
    path
  ])
  const parsed = parseUnifiedDiff(path, patch)
  if (parsed.binary || parsed.tooLarge) throw new Error('This file cannot be staged hunk by hunk')
  const parts = splitPatch(patch)
  const hunk = parsed.hunks[index]
  if (
    parts.hunks.length !== parsed.hunks.length ||
    !hunk ||
    hunkFingerprint(hunk.lines) !== fingerprint
  ) {
    throw new Error('The file changed since this diff was read. Reload the diff and try again.')
  }
  // The patch is rebuilt here from the file itself. Nothing from the renderer is applied.
  return parts.header + parts.hunks[index]
}

export async function stageHunk(cwd: string, request: HunkRequest): Promise<void> {
  if (request.source !== 'worktree') throw new Error('Only an unstaged hunk can be staged')
  const patch = await hunkPatch(cwd, request)
  await exec(cwd, ['apply', '--cached', '--whitespace=nowarn', '-'], { stdin: patch })
}

export async function unstageHunk(cwd: string, request: HunkRequest): Promise<void> {
  if (request.source !== 'staged') throw new Error('Only a staged hunk can be unstaged')
  const patch = await hunkPatch(cwd, request)
  await exec(cwd, ['apply', '--cached', '--reverse', '--whitespace=nowarn', '-'], { stdin: patch })
}
