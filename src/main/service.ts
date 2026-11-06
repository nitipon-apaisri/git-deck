// The logic behind every IPC call. No electron import: dialogs, shell and event
// delivery are injected (`Ui`, `emitProgress`), so this runs under tsx tests.
import { randomUUID } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import type { Api, CloneProtocol, GitProgress, GitProgressOp } from '../shared/api'
import {
  addRepos,
  createProject,
  removeRepos,
  updateProject,
  type ProjectInput,
  type ProjectPatch
} from '../shared/projects'
import type {
  Account,
  AccountInput,
  Cached,
  CheckoutTarget,
  ConflictAction,
  ConflictChoice,
  ConflictRequest,
  HunkRequest,
  DiffRequest,
  PullMode,
  Repo,
  RepoSummary
} from '../shared/types'
import * as realGit from './git'
import { NO_OPERATION } from './git'
import { MAX_REGION_TEXT } from '../shared/conflict'
import { gitAuthEnv } from './gitAuth'
import { watchRepo as realWatchRepo } from './watcher'
import { createProvider as realCreateProvider, normalizeBaseUrl } from './providers'
import type { GitProvider } from './providers/types'
import type { Store } from './store'
import { allowHostTemporarily, setInsecureHosts } from './tls'
import { isHttp } from './urls'

/** `Api` minus the renderer-only event subscription. */
export type MainApi = Omit<Api, 'local'> & {
  local: Omit<Api['local'], 'onGitProgress' | 'onRepoChanged'>
}

export interface Ui {
  /** `null` when cancelled. */
  pickFolder(title: string): Promise<string | null>
  confirm(options: { message: string; detail: string; confirmLabel: string }): Promise<boolean>
  reveal(path: string): void
  openExternal(url: string): Promise<void>
}

export type GitOps = Pick<
  typeof realGit,
  | 'repoRoot'
  | 'getRemotes'
  | 'getLocalInfo'
  | 'getGraph'
  | 'getCommitDetail'
  | 'gitFetch'
  | 'cloneRepo'
  | 'getStatus'
  | 'getDiff'
  | 'stagePaths'
  | 'stageAll'
  | 'unstagePaths'
  | 'discardPaths'
  | 'createCommit'
  | 'listBranches'
  | 'checkout'
  | 'createBranch'
  | 'renameBranch'
  | 'deleteBranch'
  | 'getRemoteTarget'
  | 'pull'
  | 'push'
  | 'listStashes'
  | 'stashPush'
  | 'stashApply'
  | 'stashPop'
  | 'stashDrop'
  | 'cherryPick'
  | 'merge'
  | 'getOperation'
  | 'continueOperation'
  | 'abortOperation'
  | 'listTags'
  | 'createTag'
  | 'deleteTag'
  | 'getTagRemote'
  | 'pushTag'
  | 'deleteRemoteTag'
  | 'revert'
  | 'getResetImpact'
  | 'reset'
  | 'getRemotes'
  | 'addRemote'
  | 'renameRemote'
  | 'removeRemote'
  | 'rebase'
  | 'skipOperation'
  | 'stageHunk'
  | 'unstageHunk'
  | 'getConflictFile'
  | 'resolveConflictRegions'
  | 'resolveConflictFile'
>

export interface ServiceDeps {
  store: Store
  ui: Ui
  emitProgress(progress: GitProgress): void
  emitRepoChanged(path: string): void
  /** Replaceable in tests. */
  watchRepo?: typeof realWatchRepo
  createProvider?: (account: Pick<Account, 'id' | 'type' | 'baseUrl'>, token: string) => GitProvider
  git?: GitOps
}

const MAX_GRAPH_PAGE = 2000
const MAX_TOKEN_LENGTH = 512
const MAX_FILES_PER_CALL = 5000
const MAX_PATH_LENGTH = 4096
const MAX_MESSAGE_LENGTH = 100_000
const MAX_LABEL_LENGTH = 60
/** The account id of repositories opened from a folder. A real account id is a UUID. */
export const LOCAL_ACCOUNT = 'local'
const REPO_KEY_RE = /^([A-Za-z0-9_-]+):([A-Za-z0-9_.-]+)$/

const UNKNOWN_ERROR = 'Something went wrong'

/** Strips known tokens and URL credentials from a message before it leaves main. */
export function cleanMessage(err: unknown, secrets: readonly string[]): string {
  let message = err instanceof Error ? err.message : UNKNOWN_ERROR
  for (const secret of secrets) {
    if (secret.length >= 4) message = message.split(secret).join('[token]')
  }
  message = message.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, '$1')
  return message.trim() || UNKNOWN_ERROR
}

export function parseRepoKey(key: unknown): { accountId: string; remoteId: string } {
  const match = typeof key === 'string' ? REPO_KEY_RE.exec(key) : null
  if (!match) throw new Error('Invalid repository key')
  return { accountId: match[1], remoteId: match[2] }
}

/** Folder name for a clone: no separators, no leading dots, never empty. */
export function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '')
  return cleaned.slice(0, 100) || 'repo'
}

function percentOf(line: string): number | null {
  const match = /(\d{1,3})%/.exec(line)
  return match ? Math.min(100, Number(match[1])) : null
}

function normaliseInput(raw: unknown): AccountInput {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid account details')
  const input = raw as Record<string, unknown>
  if (input['type'] !== 'github' && input['type'] !== 'gitlab') {
    throw new Error('Account type must be GitHub or GitLab')
  }
  const type = input['type']
  const baseUrl = normalizeBaseUrl(
    type,
    typeof input['baseUrl'] === 'string' ? input['baseUrl'] : ''
  )
  const token = typeof input['token'] === 'string' ? input['token'].trim() : ''
  if (!token) throw new Error('Access token is required')
  if (/\s/.test(token)) throw new Error('Access token must not contain spaces or line breaks')
  if (token.length > MAX_TOKEN_LENGTH) throw new Error('Access token is too long')
  const label =
    (typeof input['label'] === 'string' ? input['label'].trim() : '') || new URL(baseUrl).host
  if (label.length > MAX_LABEL_LENGTH) {
    throw new Error(`Account name must be at most ${MAX_LABEL_LENGTH} characters`)
  }
  return { type, label, baseUrl, token, allowInsecureTls: input['allowInsecureTls'] === true }
}

function cloneUrlFor(repo: Repo, protocol: CloneProtocol): string {
  if (protocol === 'https') {
    if (!isHttp(repo.httpUrl)) throw new Error('This repository has no HTTPS clone URL')
    return repo.httpUrl
  }
  if (protocol === 'ssh') {
    if (!/^(ssh:\/\/|[\w.-]+@[\w.-]+:)/.test(repo.sshUrl)) {
      throw new Error('This repository has no SSH clone URL')
    }
    return repo.sshUrl
  }
  throw new Error('Clone protocol must be https or ssh')
}

function checkFileList(files: unknown): string[] {
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES_PER_CALL) {
    throw new Error('Choose at least one file')
  }
  for (const file of files) {
    if (typeof file !== 'string' || !file || file.length > MAX_PATH_LENGTH || file.includes('\0')) {
      throw new Error('A file name is not valid')
    }
  }
  return files as string[]
}

function checkBranchName(name: unknown): string {
  if (typeof name !== 'string' || !name || name.length > 255 || name.includes('\0')) {
    throw new Error('The branch name is not valid')
  }
  return name
}

const MAX_STASH_MESSAGE_LENGTH = 500
const MAX_TAG_MESSAGE_LENGTH = 5000

function checkTagName(name: unknown): string {
  if (typeof name !== 'string' || !name || name.length > 255 || name.includes('\0')) {
    throw new Error('The tag name is not valid')
  }
  return name
}

function checkHunk(value: unknown): HunkRequest {
  const h = value as Partial<HunkRequest> | null
  if (
    typeof h !== 'object' ||
    h === null ||
    typeof h.path !== 'string' ||
    !h.path ||
    h.path.length > MAX_PATH_LENGTH ||
    h.path.includes('\0') ||
    (h.source !== 'worktree' && h.source !== 'staged') ||
    typeof h.index !== 'number' ||
    typeof h.fingerprint !== 'string'
  ) {
    throw new Error('The hunk is not valid')
  }
  return { path: h.path, source: h.source, index: h.index, fingerprint: h.fingerprint }
}

const CONFLICT_ACTIONS = new Set(['ours', 'theirs', 'keep', 'delete', 'mark-resolved'])
const MAX_CONFLICT_CHOICES = 10_000
const CONFLICT_WORDS = new Set(['ours', 'theirs', 'both', 'base'])

function checkConflictPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > MAX_PATH_LENGTH ||
    value.includes('\0')
  ) {
    throw new Error('The file path is not valid')
  }
  return value
}

function checkConflictRequest(value: unknown): ConflictRequest {
  const r = value as Partial<ConflictRequest> | null
  if (
    typeof r !== 'object' ||
    r === null ||
    typeof r.fingerprint !== 'string' ||
    !/^[0-9a-f]{40}$/.test(r.fingerprint) ||
    !Array.isArray(r.choices) ||
    r.choices.length > MAX_CONFLICT_CHOICES
  ) {
    throw new Error('The conflict request is not valid')
  }
  const choices = r.choices.map((c: unknown): ConflictChoice => {
    if (c === null) return null
    if (typeof c === 'string' && CONFLICT_WORDS.has(c)) return c as ConflictChoice
    const text = (c as { text?: unknown } | null)?.text
    if (typeof text === 'string' && text.length <= MAX_REGION_TEXT) return { text }
    throw new Error('The conflict request is not valid')
  })
  return { path: checkConflictPath(r.path), fingerprint: r.fingerprint, choices }
}

function checkRemoteText(value: unknown, what: string, max: number): string {
  if (typeof value !== 'string' || !value || value.length > max || value.includes('\0')) {
    throw new Error(`The ${what} is not valid`)
  }
  return value
}

function checkStashRef(index: unknown, hash: unknown): { index: number; hash: string } {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 10_000) {
    throw new Error('The stash is not valid')
  }
  if (typeof hash !== 'string' || !/^[0-9a-f]{7,64}$/i.test(hash)) {
    throw new Error('The stash is not valid')
  }
  return { index, hash }
}

function checkTarget(target: unknown): CheckoutTarget {
  const t = target as Partial<Record<string, unknown>> | null
  if (!t || typeof t !== 'object') throw new Error('The checkout target is not valid')
  if (t['kind'] === 'commit') {
    if (typeof t['hash'] !== 'string') throw new Error('Invalid commit hash')
    return { kind: 'commit', hash: t['hash'] }
  }
  if (t['kind'] === 'branch' || t['kind'] === 'remote') {
    return { kind: t['kind'], name: checkBranchName(t['name']) }
  }
  throw new Error('The checkout target is not valid')
}

function checkDiffRequest(request: unknown): DiffRequest {
  const r = request as Partial<DiffRequest> | null
  if (!r || typeof r !== 'object') throw new Error('The diff request is not valid')
  if (r.source !== 'worktree' && r.source !== 'staged' && r.source !== 'commit') {
    throw new Error('The diff source is not valid')
  }
  const [path] = checkFileList([r.path])
  if (r.source === 'commit' && typeof r.hash !== 'string') throw new Error('Invalid commit hash')
  return { source: r.source, path, hash: r.source === 'commit' ? r.hash : undefined }
}

export function createService(deps: ServiceDeps): { api: MainApi; syncInsecureHosts(): void } {
  const { store, ui } = deps
  const git: GitOps = deps.git ?? realGit
  const makeProvider = deps.createProvider ?? realCreateProvider

  const inflight = new Map<string, Promise<unknown>>()
  const writeQueues = new Map<string, Promise<unknown>>()
  const cloning = new Set<string>()
  /** Folders with a pull or push running: one network write at a time per folder. */
  const remoteBusy = new Set<string>()
  const watchRepo = deps.watchRepo ?? realWatchRepo
  /** One watcher per folder, shared by every pane that shows it. */
  const watched = new Map<string, { count: number; stop: Promise<() => void> }>()

  /** Callers that ask for the same thing while it is running share one request. */
  function once<T>(key: string, job: () => Promise<T>): Promise<T> {
    const running = inflight.get(key)
    if (running) return running as Promise<T>
    const promise = job().finally(() => inflight.delete(key))
    inflight.set(key, promise)
    return promise
  }

  /**
   * Writes to one repository run one after another, so two of them never fight over
   * `index.lock`. Unlike `once`, every call runs, with its own arguments.
   */
  function serial<T>(path: string, job: () => Promise<T>): Promise<T> {
    const previous = writeQueues.get(path) ?? Promise.resolve()
    const result = previous.catch(() => {}).then(job)
    const tail = result.catch(() => {})
    writeQueues.set(path, tail)
    void tail.then(() => {
      if (writeQueues.get(path) === tail) writeQueues.delete(path)
    })
    return result
  }

  function syncInsecureHosts(): void {
    setInsecureHosts(
      store
        .listAccounts()
        .filter((a) => a.allowInsecureTls)
        .map((a) => new URL(a.baseUrl).hostname)
    )
  }

  function allTokens(): string[] {
    return store
      .listAccounts()
      .map((a) => store.getToken(a.id))
      .filter((t): t is string => typeof t === 'string')
  }

  /** Every error leaves main with a plain, token-free message. */
  function guard<A extends unknown[], R>(
    fn: (...args: A) => Promise<R>,
    secretsOf?: (...args: A) => unknown[]
  ): (...args: A) => Promise<R> {
    return async (...args) => {
      try {
        return await fn(...args)
      } catch (err) {
        const extra = (secretsOf?.(...args) ?? []).filter((s): s is string => typeof s === 'string')
        // No `cause`: the original error may carry a token, and only the message leaves main.
        // eslint-disable-next-line preserve-caught-error
        throw new Error(cleanMessage(err, [...allTokens(), ...extra]))
      }
    }
  }
  const tokenOfInput = (input: unknown): unknown[] => [(input as { token?: unknown } | null)?.token]

  // Lookups

  function requireAccount(accountId: string): Account {
    const account = store.listAccounts().find((a) => a.id === accountId)
    if (!account) throw new Error('Account not found')
    return account
  }

  function requireToken(account: Account): string {
    const token = store.getToken(account.id)
    if (!token)
      throw new Error('The saved token cannot be read. Remove the account and add it again.')
    return token
  }

  function requireRepo(repoKey: unknown): Repo {
    const { accountId } = parseRepoKey(repoKey)
    requireAccount(accountId)
    const repo = store.getCachedRepos(accountId)?.data.find((r) => r.key === repoKey)
    if (!repo) throw new Error('Repository not found. Refresh the repository list and try again.')
    return repo
  }

  /** A path argument must be a folder the user linked, never an arbitrary path. */
  function linkedRepoKey(path: unknown): string {
    const entry = Object.entries(store.getLinks()).find(([, linked]) => linked === path)
    if (!entry) throw new Error('This folder is not linked to a repository')
    return entry[0]
  }

  function authEnvFor(account: Account): Record<string, string> {
    return gitAuthEnv({
      type: account.type,
      baseUrl: account.baseUrl,
      token: requireToken(account),
      allowInsecureTls: account.allowInsecureTls
    })
  }

  // Accounts

  async function verify(input: AccountInput) {
    const host = new URL(input.baseUrl).hostname
    // An unsaved account is not in the allowlist yet, so allow its host for this call.
    const release = input.allowInsecureTls ? allowHostTemporarily(host) : () => {}
    try {
      return await makeProvider(
        { id: 'pending', type: input.type, baseUrl: input.baseUrl },
        input.token
      ).verify()
    } finally {
      release()
    }
  }

  async function addAccount(raw: AccountInput): Promise<Account> {
    const input = normaliseInput(raw)
    const user = await verify(input)
    const duplicate = store
      .listAccounts()
      .some(
        (a) =>
          a.type === input.type &&
          a.baseUrl === input.baseUrl &&
          a.username.toLowerCase() === user.username.toLowerCase()
      )
    if (duplicate) throw new Error('This account is already added')
    if (!store.secureStorageAvailable()) {
      throw new Error('Secure storage is unavailable, so the token cannot be stored safely')
    }
    const account: Account = {
      id: randomUUID(),
      type: input.type,
      label: input.label,
      baseUrl: input.baseUrl,
      host: new URL(input.baseUrl).host,
      username: user.username,
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
      allowInsecureTls: input.allowInsecureTls
    }
    await store.saveAccount(account, input.token)
    syncInsecureHosts()
    return account
  }

  // Repos and summaries

  function fetchRepos(accountId: string): Promise<Cached<Repo[]>> {
    return once(`repos:${accountId}`, async () => {
      const account = requireAccount(accountId)
      const repos = await makeProvider(account, requireToken(account)).listRepos()
      // The account may have been removed while the request ran.
      requireAccount(accountId)
      await store.setCachedRepos(accountId, repos)
      return store.getCachedRepos(accountId) ?? { data: repos, fetchedAt: Date.now() }
    })
  }

  /** A summary for a repository opened from a folder, read from git alone. */
  function fetchLocalSummary(repoKey: string): Promise<Cached<RepoSummary>> {
    return once(`summary:${repoKey}`, async () => {
      const path = store.getLinks()[repoKey]
      if (!store.getLocalRepos().some((r) => r.key === repoKey) || !path) {
        throw new Error('Repository not found. Open the folder again and try again.')
      }
      const info = await git.getLocalInfo(path)
      const summary: RepoSummary = {
        commitCount: info.commitCount,
        contributorCount: null,
        contributors: [],
        branchCount: info.localBranches,
        tagCount: info.tags,
        openChangeRequests: null,
        languages: [],
        license: null,
        createdAt: info.firstCommitAt ? new Date(info.firstCommitAt * 1000).toISOString() : null,
        lastActivityAt: info.lastCommitAt ? new Date(info.lastCommitAt * 1000).toISOString() : null,
        sizeKb: info.sizeKb,
        topics: []
      }
      await store.setCachedSummary(repoKey, summary)
      return store.getCachedSummary(repoKey) ?? { data: summary, fetchedAt: Date.now() }
    })
  }

  function fetchSummary(repoKey: string): Promise<Cached<RepoSummary>> {
    if (parseRepoKey(repoKey).accountId === LOCAL_ACCOUNT) return fetchLocalSummary(repoKey)
    const repo = requireRepo(repoKey)
    return once(`summary:${repoKey}`, async () => {
      const account = requireAccount(repo.accountId)
      const summary = await makeProvider(account, requireToken(account)).getSummary(repo)
      requireAccount(repo.accountId)
      await store.setCachedSummary(repoKey, summary)
      return store.getCachedSummary(repoKey) ?? { data: summary, fetchedAt: Date.now() }
    })
  }

  // Local repositories

  async function linkRepo(repoKey: string): Promise<string | null> {
    const repo = requireRepo(repoKey)
    const picked = await ui.pickFolder(`Select the local folder of ${repo.fullName}`)
    if (!picked) return null
    const root = await git.repoRoot(picked)
    if (!root) throw new Error('The selected folder is not inside a git repository')
    const needle = repo.fullName.toLowerCase()
    const remotes = await git.getRemotes(root)
    if (!remotes.some((r) => r.url.toLowerCase().includes(needle))) {
      const proceed = await ui.confirm({
        message: 'Link anyway?',
        detail: `None of this folder's remotes mention ${repo.fullName}.`,
        confirmLabel: 'Link anyway'
      })
      if (!proceed) return null
    }
    await store.setLink(repoKey, root)
    return root
  }

  async function openLocal(): Promise<Repo | null> {
    const picked = await ui.pickFolder('Select a Git repository to open')
    if (!picked) return null
    const root = await git.repoRoot(picked)
    if (!root) throw new Error('That folder is not a Git repository')
    const id = createHash('sha1').update(root).digest('hex').slice(0, 12)
    const info = await git.getLocalInfo(root)
    const name = basename(root) || 'repository'
    const repo: Repo = {
      key: `${LOCAL_ACCOUNT}:${id}`,
      accountId: LOCAL_ACCOUNT,
      remoteId: id,
      name,
      fullName: name,
      namespace: LOCAL_ACCOUNT,
      description: root,
      visibility: 'private',
      defaultBranch: info.currentBranch ?? '',
      webUrl: '',
      httpUrl: '',
      sshUrl: '',
      stars: 0,
      forks: 0,
      openIssues: 0,
      updatedAt: info.lastCommitAt ? new Date(info.lastCommitAt * 1000).toISOString() : '',
      archived: false,
      fork: false
    }
    await store.addLocalRepo(repo, root)
    return repo
  }

  async function cloneInto(repoKey: string, protocol: CloneProtocol): Promise<string | null> {
    const repo = requireRepo(repoKey)
    const url = cloneUrlFor(repo, protocol)
    if (cloning.has(repoKey)) throw new Error('This repository is already being cloned')
    cloning.add(repoKey)
    try {
      const account = requireAccount(repo.accountId)
      // Auth is only for HTTPS. SSH uses the user's own keys.
      const env = protocol === 'https' ? authEnvFor(account) : {}
      const parent = await ui.pickFolder(`Choose a folder to clone ${repo.fullName} into`)
      if (!parent) return null
      const dest = join(parent, sanitizeFolderName(repo.name))
      const entries = await readdir(dest).then(
        (names) => names,
        (err: NodeJS.ErrnoException) => {
          if (err.code === 'ENOENT') return null
          throw new Error(`${dest} already exists and is not a folder`)
        }
      )
      if (entries && entries.length > 0) throw new Error(`${dest} already exists and is not empty`)
      await git.cloneRepo(url, dest, env, (line) =>
        deps.emitProgress({ repoKey, op: 'clone', line, percent: percentOf(line) })
      )
      const root = (await git.repoRoot(dest)) ?? dest
      await store.setLink(repoKey, root)
      return root
    } finally {
      cloning.delete(repoKey)
    }
  }

  function fetchLocal(path: string): Promise<void> {
    const repoKey = linkedRepoKey(path)
    return once(`fetch:${path}`, async () => {
      const account = store.listAccounts().find((a) => a.id === parseRepoKey(repoKey).accountId)
      await git.gitFetch(path, account ? authEnvFor(account) : {})
    })
  }

  /**
   * Auth for a pull or push. Only the account's own origin gets a token, so a remote on
   * another host fails here with a plain message instead of a prompt. SSH remotes use the
   * user's own keys.
   */
  function remoteAuthEnv(repoKey: string, remoteUrl: string): Record<string, string> {
    if (!isHttp(remoteUrl)) return {}
    const account = store.listAccounts().find((a) => a.id === parseRepoKey(repoKey).accountId)
    if (!account) return {}
    const remoteOrigin = new URL(remoteUrl).origin
    if (remoteOrigin !== new URL(account.baseUrl).origin) {
      throw new Error(
        `This remote is on ${new URL(remoteUrl).host}, but the account for this repository is on ${account.host}. GitDeck only signs in to the account's own host.`
      )
    }
    return authEnvFor(account)
  }

  /** Pull or push for one folder, with progress lines tagged for its pane. */
  async function withRemote<T>(
    path: string,
    op: GitProgressOp,
    job: (env: Record<string, string>, onLine: (line: string) => void) => Promise<T>,
    pick: (cwd: string) => Promise<{ url: string }> = git.getRemoteTarget
  ): Promise<T> {
    const repoKey = linkedRepoKey(path)
    if (remoteBusy.has(path)) throw new Error('A pull or push is already running for this folder')
    remoteBusy.add(path)
    try {
      const target = await pick(path)
      const env = remoteAuthEnv(repoKey, target.url)
      return await job(env, (line) =>
        deps.emitProgress({ repoKey, op, line, percent: percentOf(line) })
      )
    } finally {
      remoteBusy.delete(path)
    }
  }

  // Projects

  /** Read, change and assign with no `await` between, so calls cannot interleave. */
  function mutateProjects<T>(
    change: (projects: ReturnType<Store['getProjects']>) => {
      next: ReturnType<Store['getProjects']>
      result: T
    }
  ): Promise<T> {
    const { next, result } = change(store.getProjects())
    return store.setProjects(next).then(() => result)
  }

  function checkKeys(keys: unknown, accountsMustExist: boolean): string[] {
    if (!Array.isArray(keys)) throw new Error('Invalid repository list')
    // A repository opened from a folder has the account id `local`, which always exists.
    const known = new Set([...store.listAccounts().map((a) => a.id), LOCAL_ACCOUNT])
    for (const key of keys) {
      const { accountId } = parseRepoKey(key)
      if (accountsMustExist && !known.has(accountId)) {
        throw new Error('A repository belongs to an account that no longer exists')
      }
    }
    return keys as string[]
  }

  const text = (value: unknown, what: string, optional = false): string | undefined => {
    if (value === undefined && optional) return undefined
    if (typeof value !== 'string') throw new Error(`Invalid ${what}`)
    return value
  }

  const api: MainApi = {
    secureStorageAvailable: guard(async () => store.secureStorageAvailable()),
    accounts: {
      list: guard(async () => store.listAccounts()),
      test: guard(async (input) => verify(normaliseInput(input)), tokenOfInput),
      add: guard(addAccount, tokenOfInput),
      remove: guard(async (id) => {
        requireAccount(id)
        await store.removeAccount(id)
        syncInsecureHosts()
      })
    },
    repos: {
      cached: guard(async (accountId) => {
        requireAccount(accountId)
        return store.getCachedRepos(accountId)
      }),
      fetch: guard(async (accountId) => fetchRepos(accountId))
    },
    summary: {
      cached: guard(async (repoKey) => {
        requireAccount(parseRepoKey(repoKey).accountId)
        return store.getCachedSummary(repoKey)
      }),
      fetch: guard(async (repoKey) => fetchSummary(repoKey))
    },
    local: {
      links: guard(async () => store.getLinks()),
      link: guard(linkRepo),
      unlink: guard(async (repoKey) => {
        if (parseRepoKey(repoKey).accountId === LOCAL_ACCOUNT) {
          throw new Error('Use Remove to forget a local repository')
        }
        await store.removeLink(repoKey)
      }),
      clone: guard(cloneInto),
      watch: guard(async (path) => {
        linkedRepoKey(path)
        const path_ = path as string
        const entry = watched.get(path_)
        if (entry) {
          entry.count += 1
          return
        }
        const stop = watchRepo(path_, () => deps.emitRepoChanged(path_)).catch(() => () => {})
        watched.set(path_, { count: 1, stop })
        await stop
      }),
      unwatch: guard(async (path) => {
        // No link check: closing must work even after the folder was unlinked.
        if (typeof path !== 'string') throw new Error('Invalid path')
        const entry = watched.get(path)
        if (!entry) return
        entry.count -= 1
        if (entry.count > 0) return
        watched.delete(path)
        ;(await entry.stop)()
      }),
      info: guard(async (path) => {
        linkedRepoKey(path)
        return git.getLocalInfo(path)
      }),
      graph: guard(async (path, skip, limit) => {
        linkedRepoKey(path)
        if (!Number.isInteger(skip) || skip < 0) throw new Error('Invalid graph offset')
        if (!Number.isInteger(limit) || limit < 1 || limit > MAX_GRAPH_PAGE) {
          throw new Error(`Graph page size must be between 1 and ${MAX_GRAPH_PAGE}`)
        }
        return git.getGraph(path, skip, limit)
      }),
      commit: guard(async (path, hash) => {
        linkedRepoKey(path)
        return git.getCommitDetail(path, hash)
      }),
      fetch: guard(async (path) => fetchLocal(path)),
      status: guard(async (path) => {
        linkedRepoKey(path)
        return git.getStatus(path)
      }),
      diff: guard(async (path, request) => {
        linkedRepoKey(path)
        return git.getDiff(path, checkDiffRequest(request))
      }),
      stage: guard(async (path, files) => {
        linkedRepoKey(path)
        const list = checkFileList(files)
        return serial(path, () => git.stagePaths(path, list))
      }),
      unstage: guard(async (path, files) => {
        linkedRepoKey(path)
        const list = checkFileList(files)
        return serial(path, () => git.unstagePaths(path, list))
      }),
      stageAll: guard(async (path) => {
        linkedRepoKey(path)
        return serial(path, () => git.stageAll(path))
      }),
      discard: guard(async (path, files) => {
        linkedRepoKey(path)
        const list = checkFileList(files)
        const ok = await ui.confirm({
          message:
            list.length === 1
              ? `Discard changes to ${list[0]}?`
              : `Discard changes to ${list.length} files?`,
          detail:
            'Changes that are not staged are lost, and new files are deleted. This cannot be undone.',
          confirmLabel: 'Discard'
        })
        if (!ok) return false
        await serial(path, () => git.discardPaths(path, list))
        return true
      }),
      createCommit: guard(async (path, message, amend) => {
        linkedRepoKey(path)
        if (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
          throw new Error('The commit message is not valid')
        }
        if (typeof amend !== 'boolean') throw new Error('Amend must be true or false')
        return serial(path, () => git.createCommit(path, message, amend))
      }),
      branches: guard(async (path) => {
        linkedRepoKey(path)
        return git.listBranches(path)
      }),
      checkout: guard(async (path, target) => {
        linkedRepoKey(path)
        const checked = checkTarget(target)
        return serial(path, () => git.checkout(path, checked))
      }),
      createBranch: guard(async (path, name, startPoint, checkout) => {
        linkedRepoKey(path)
        const branch = checkBranchName(name)
        const start = startPoint === null ? null : checkBranchName(startPoint)
        if (typeof checkout !== 'boolean') throw new Error('Checkout must be true or false')
        return serial(path, () => git.createBranch(path, branch, start, checkout))
      }),
      renameBranch: guard(async (path, from, to) => {
        linkedRepoKey(path)
        const oldName = checkBranchName(from)
        const newName = checkBranchName(to)
        return serial(path, () => git.renameBranch(path, oldName, newName))
      }),
      deleteBranch: guard(async (path, name) => {
        linkedRepoKey(path)
        const branch = checkBranchName(name)
        const ok = await ui.confirm({
          message: `Delete the branch ${branch}?`,
          detail:
            'Git refuses if it has commits that are not merged anywhere else. The remote branch is not touched.',
          confirmLabel: 'Delete'
        })
        if (!ok) return false
        await serial(path, () => git.deleteBranch(path, branch))
        return true
      }),
      pull: guard(async (path, mode) => {
        linkedRepoKey(path)
        if (mode !== 'ff-only' && mode !== 'merge') throw new Error('Unknown pull mode')
        const pullMode: PullMode = mode
        return serial(path, () =>
          withRemote(path, 'pull', (env, onLine) => git.pull(path, pullMode, env, onLine))
        )
      }),
      push: guard(async (path, force) => {
        linkedRepoKey(path)
        if (typeof force !== 'boolean') throw new Error('Force must be true or false')
        if (force) {
          const ok = await ui.confirm({
            message: 'Force push this branch?',
            detail:
              'This replaces the remote branch with yours. It is refused if someone pushed since your last fetch, but commits that only the remote has will be lost.',
            confirmLabel: 'Force push'
          })
          if (!ok) return false
        }
        await withRemote(path, 'push', (env, onLine) =>
          git.push(path, { forceWithLease: force }, env, onLine)
        )
        return true
      }),
      stashes: guard(async (path) => {
        linkedRepoKey(path)
        return git.listStashes(path)
      }),
      stashPush: guard(async (path, message, includeUntracked) => {
        linkedRepoKey(path)
        if (typeof message !== 'string' || message.length > MAX_STASH_MESSAGE_LENGTH) {
          throw new Error('The stash message is not valid')
        }
        if (typeof includeUntracked !== 'boolean') {
          throw new Error('Include untracked must be true or false')
        }
        return serial(path, () => git.stashPush(path, message, includeUntracked))
      }),
      stashApply: guard(async (path, index, hash) => {
        linkedRepoKey(path)
        const stash = checkStashRef(index, hash)
        return serial(path, () => git.stashApply(path, stash.index, stash.hash))
      }),
      stashPop: guard(async (path, index, hash) => {
        linkedRepoKey(path)
        const stash = checkStashRef(index, hash)
        return serial(path, () => git.stashPop(path, stash.index, stash.hash))
      }),
      stashDrop: guard(async (path, index, hash) => {
        linkedRepoKey(path)
        const stash = checkStashRef(index, hash)
        const ok = await ui.confirm({
          message: 'Drop this stash?',
          detail: 'The saved changes are deleted. This cannot be undone from the app.',
          confirmLabel: 'Drop'
        })
        if (!ok) return false
        await serial(path, () => git.stashDrop(path, stash.index, stash.hash))
        return true
      }),
      cherryPick: guard(async (path, hash) => {
        linkedRepoKey(path)
        if (typeof hash !== 'string') throw new Error('Invalid commit hash')
        return serial(path, () => git.cherryPick(path, hash))
      }),
      merge: guard(async (path, branch, noFf) => {
        linkedRepoKey(path)
        const name = checkBranchName(branch)
        if (typeof noFf !== 'boolean') throw new Error('No fast-forward must be true or false')
        return serial(path, () => git.merge(path, name, { noFf }))
      }),
      operation: guard(async (path) => {
        linkedRepoKey(path)
        return git.getOperation(path)
      }),
      continueOperation: guard(async (path) => {
        linkedRepoKey(path)
        return serial(path, () => git.continueOperation(path))
      }),
      abortOperation: guard(async (path) => {
        linkedRepoKey(path)
        const state = await git.getOperation(path)
        if (!state) throw new Error(NO_OPERATION)
        const ok = await ui.confirm({
          message: `Abort the ${state.kind}?`,
          detail: 'Everything the operation changed is undone, including your conflict fixes.',
          confirmLabel: 'Abort'
        })
        if (!ok) return false
        await serial(path, () => git.abortOperation(path))
        return true
      }),
      tags: guard(async (path) => {
        linkedRepoKey(path)
        return git.listTags(path)
      }),
      createTag: guard(async (path, name, hash, message) => {
        linkedRepoKey(path)
        const tag = checkTagName(name)
        if (hash !== null && typeof hash !== 'string') throw new Error('Invalid commit hash')
        if (
          message !== null &&
          (typeof message !== 'string' || message.length > MAX_TAG_MESSAGE_LENGTH)
        ) {
          throw new Error('The tag message is not valid')
        }
        return serial(path, () => git.createTag(path, tag, hash, message))
      }),
      deleteTag: guard(async (path, name) => {
        linkedRepoKey(path)
        const tag = checkTagName(name)
        const ok = await ui.confirm({
          message: `Delete the tag ${tag}?`,
          detail:
            'Only the local tag is deleted. A copy on the remote stays until you delete it there.',
          confirmLabel: 'Delete'
        })
        if (!ok) return false
        await serial(path, () => git.deleteTag(path, tag))
        return true
      }),
      pushTag: guard(async (path, name) => {
        linkedRepoKey(path)
        const tag = checkTagName(name)
        await withRemote(
          path,
          'push',
          (env, onLine) => git.pushTag(path, tag, env, onLine),
          git.getTagRemote
        )
      }),
      deleteRemoteTag: guard(async (path, name) => {
        linkedRepoKey(path)
        const tag = checkTagName(name)
        const ok = await ui.confirm({
          message: `Delete the tag ${tag} on the remote?`,
          detail: 'Anyone who already fetched it keeps their copy. The local tag is not touched.',
          confirmLabel: 'Delete on remote'
        })
        if (!ok) return false
        await withRemote(
          path,
          'push',
          (env, onLine) => git.deleteRemoteTag(path, tag, env, onLine),
          git.getTagRemote
        )
        return true
      }),
      revert: guard(async (path, hash) => {
        linkedRepoKey(path)
        if (typeof hash !== 'string') throw new Error('Invalid commit hash')
        return serial(path, () => git.revert(path, hash))
      }),
      reset: guard(async (path, hash, mode) => {
        linkedRepoKey(path)
        if (typeof hash !== 'string') throw new Error('Invalid commit hash')
        if (mode !== 'soft' && mode !== 'mixed' && mode !== 'hard') {
          throw new Error('Unknown reset mode')
        }
        if (mode === 'hard') {
          const impact = await git.getResetImpact(path, hash)
          const lost = [
            impact.commits > 0
              ? `${impact.commits} commit${impact.commits === 1 ? '' : 's'} leave this branch`
              : null,
            impact.files > 0
              ? `${impact.files} file${impact.files === 1 ? '' : 's'} with changes ${impact.files === 1 ? 'is' : 'are'} overwritten`
              : null
          ].filter(Boolean)
          const ok = await ui.confirm({
            message: `Hard reset to ${hash.slice(0, 7)}?`,
            detail: `${lost.length > 0 ? `${lost.join(' and ')}. ` : ''}Staged and unstaged changes to tracked files are lost. Commits can still be found in the reflog, changes cannot.`,
            confirmLabel: 'Hard reset'
          })
          if (!ok) return false
        }
        await serial(path, () => git.reset(path, hash, mode))
        return true
      }),
      remotes: guard(async (path) => {
        linkedRepoKey(path)
        return git.getRemotes(path)
      }),
      addRemote: guard(async (path, name, url) => {
        linkedRepoKey(path)
        const remote = checkRemoteText(name, 'remote name', 100)
        const address = checkRemoteText(url, 'remote URL', 2048)
        return serial(path, () => git.addRemote(path, remote, address))
      }),
      renameRemote: guard(async (path, from, to) => {
        linkedRepoKey(path)
        const oldName = checkRemoteText(from, 'remote name', 100)
        const newName = checkRemoteText(to, 'remote name', 100)
        return serial(path, () => git.renameRemote(path, oldName, newName))
      }),
      removeRemote: guard(async (path, name) => {
        linkedRepoKey(path)
        const remote = checkRemoteText(name, 'remote name', 100)
        const ok = await ui.confirm({
          message: `Remove the remote ${remote}?`,
          detail: 'Its remote-tracking branches are deleted here. Nothing changes on the server.',
          confirmLabel: 'Remove'
        })
        if (!ok) return false
        await serial(path, () => git.removeRemote(path, remote))
        return true
      }),
      rebase: guard(async (path, onto) => {
        linkedRepoKey(path)
        const target = checkBranchName(onto)
        return serial(path, () => git.rebase(path, target))
      }),
      skipOperation: guard(async (path) => {
        linkedRepoKey(path)
        const state = await git.getOperation(path)
        if (!state) throw new Error(NO_OPERATION)
        if (state.kind !== 'rebase') throw new Error('Only a rebase can skip a commit')
        const ok = await ui.confirm({
          message: 'Skip this commit?',
          detail: 'The commit the rebase stopped on is dropped, and its changes are not applied.',
          confirmLabel: 'Skip commit'
        })
        if (!ok) return false
        await serial(path, () => git.skipOperation(path))
        return true
      }),
      stageHunk: guard(async (path, hunk) => {
        linkedRepoKey(path)
        const request = checkHunk(hunk)
        return serial(path, () => git.stageHunk(path, request))
      }),
      unstageHunk: guard(async (path, hunk) => {
        linkedRepoKey(path)
        const request = checkHunk(hunk)
        return serial(path, () => git.unstageHunk(path, request))
      }),
      conflictFile: guard(async (path, file) => {
        linkedRepoKey(path)
        return git.getConflictFile(path, checkConflictPath(file))
      }),
      resolveConflict: guard(async (path, request) => {
        linkedRepoKey(path)
        const checked = checkConflictRequest(request)
        return serial(path, () => git.resolveConflictRegions(path, checked))
      }),
      resolveConflictFile: guard(async (path, file, action) => {
        linkedRepoKey(path)
        const name = checkConflictPath(file)
        if (typeof action !== 'string' || !CONFLICT_ACTIONS.has(action)) {
          throw new Error('The conflict action is not valid')
        }
        if (action === 'delete') {
          const ok = await ui.confirm({
            message: `Delete ${name}?`,
            detail:
              'The file is removed from the work tree and the conflict is resolved by deleting it.',
            confirmLabel: 'Delete'
          })
          if (!ok) return false
        }
        await serial(path, () => git.resolveConflictFile(path, name, action as ConflictAction))
        return true
      }),
      reveal: guard(async (path) => {
        linkedRepoKey(path)
        ui.reveal(path)
      }),
      repos: guard(async () => store.getLocalRepos()),
      open: guard(openLocal),
      remove: guard(async (repoKey) => {
        if (parseRepoKey(repoKey).accountId !== LOCAL_ACCOUNT) {
          throw new Error('Only a local repository can be removed this way')
        }
        await store.removeLocalRepo(repoKey as string)
      })
    },
    openExternal: guard(async (url) => {
      if (typeof url !== 'string' || !isHttp(url)) {
        throw new Error('Only http and https links can be opened')
      }
      await ui.openExternal(url)
    }),
    projects: {
      list: guard(async () => store.getProjects()),
      create: guard(async (input) => {
        const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<
          string,
          unknown
        >
        const projectInput: ProjectInput = {
          name: text(raw['name'], 'project name') as string,
          icon: text(raw['icon'], 'icon', true),
          color: text(raw['color'], 'color', true),
          repoKeys: raw['repoKeys'] === undefined ? undefined : checkKeys(raw['repoKeys'], true)
        }
        return mutateProjects((projects) => {
          const project = createProject(projects, projectInput)
          return { next: [...projects, project], result: project }
        })
      }),
      update: guard(async (id, patch) => {
        const raw = (typeof patch === 'object' && patch !== null ? patch : {}) as Record<
          string,
          unknown
        >
        const projectPatch: ProjectPatch = {
          name: text(raw['name'], 'project name', true),
          icon: text(raw['icon'], 'icon', true),
          color: text(raw['color'], 'color', true)
        }
        return mutateProjects((projects) => {
          const project = updateProject(projects, id, projectPatch)
          return { next: projects.map((p) => (p.id === id ? project : p)), result: project }
        })
      }),
      remove: guard(async (id) =>
        mutateProjects((projects) => {
          if (!projects.some((p) => p.id === id)) throw new Error('Project not found')
          return { next: projects.filter((p) => p.id !== id), result: undefined }
        })
      ),
      addRepos: guard(async (id, repoKeys) => {
        const keys = checkKeys(repoKeys, true)
        return mutateProjects((projects) => {
          const current = projects.find((p) => p.id === id)
          if (!current) throw new Error('Project not found')
          const project = addRepos(current, keys)
          return { next: projects.map((p) => (p.id === id ? project : p)), result: project }
        })
      }),
      removeRepos: guard(async (id, repoKeys) => {
        const keys = checkKeys(repoKeys, false)
        return mutateProjects((projects) => {
          const current = projects.find((p) => p.id === id)
          if (!current) throw new Error('Project not found')
          const project = removeRepos(current, keys)
          return { next: projects.map((p) => (p.id === id ? project : p)), result: project }
        })
      })
    }
  }

  return { api, syncInsecureHosts }
}
