// The logic behind every IPC call. No electron import: dialogs, shell and event
// delivery are injected (`Ui`, `emitCloneProgress`), so this runs under tsx tests.
import { randomUUID } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Api, CloneProgress, CloneProtocol } from '../shared/api'
import {
  addRepos,
  createProject,
  removeRepos,
  updateProject,
  type ProjectInput,
  type ProjectPatch
} from '../shared/projects'
import type { Account, AccountInput, Cached, Repo, RepoSummary } from '../shared/types'
import * as realGit from './git'
import { gitAuthEnv } from './gitAuth'
import { createProvider as realCreateProvider, normalizeBaseUrl } from './providers'
import type { GitProvider } from './providers/types'
import type { Store } from './store'
import { allowHostTemporarily, setInsecureHosts } from './tls'
import { isHttp } from './urls'

/** `Api` minus the renderer-only event subscription. */
export type MainApi = Omit<Api, 'local'> & { local: Omit<Api['local'], 'onCloneProgress'> }

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
>

export interface ServiceDeps {
  store: Store
  ui: Ui
  emitCloneProgress(progress: CloneProgress): void
  createProvider?: (account: Pick<Account, 'id' | 'type' | 'baseUrl'>, token: string) => GitProvider
  git?: GitOps
}

const MAX_GRAPH_PAGE = 2000
const MAX_TOKEN_LENGTH = 512
const MAX_LABEL_LENGTH = 60
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

export function createService(deps: ServiceDeps): { api: MainApi; syncInsecureHosts(): void } {
  const { store, ui } = deps
  const git: GitOps = deps.git ?? realGit
  const makeProvider = deps.createProvider ?? realCreateProvider

  const inflight = new Map<string, Promise<unknown>>()
  const cloning = new Set<string>()

  /** Callers that ask for the same thing while it is running share one request. */
  function once<T>(key: string, job: () => Promise<T>): Promise<T> {
    const running = inflight.get(key)
    if (running) return running as Promise<T>
    const promise = job().finally(() => inflight.delete(key))
    inflight.set(key, promise)
    return promise
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

  function fetchSummary(repoKey: string): Promise<Cached<RepoSummary>> {
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
        deps.emitCloneProgress({ repoKey, line, percent: percentOf(line) })
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
    const known = new Set(store.listAccounts().map((a) => a.id))
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
        parseRepoKey(repoKey)
        await store.removeLink(repoKey)
      }),
      clone: guard(cloneInto),
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
      reveal: guard(async (path) => {
        linkedRepoKey(path)
        ui.reveal(path)
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
