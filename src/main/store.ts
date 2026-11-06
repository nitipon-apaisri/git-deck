// JSON-file persistence. No electron import: the encryptor is injected so tests
// can use a fake and main/index.ts passes `safeStorage`.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pruneAccount, removeRepos } from '../shared/projects'
import type { Account, Cached, Project, Repo, RepoSummary } from '../shared/types'

export interface TokenCrypto {
  isAvailable(): boolean
  encrypt(plain: string): Buffer
  decrypt(data: Buffer): string
}

interface Config {
  accounts: Account[]
  /** base64 of the encrypted token, keyed by account id */
  tokens: Record<string, string>
  /** repo key -> local folder */
  links: Record<string, string>
  projects: Project[]
  /** Folders opened without an account. Their links are in `links` too. */
  localRepos: Repo[]
}

interface CacheFile {
  repos: Record<string, Cached<Repo[]>>
  summaries: Record<string, Cached<RepoSummary>>
}

const emptyConfig = (): Config => ({
  accounts: [],
  tokens: {},
  links: {},
  projects: [],
  localRepos: []
})
const emptyCache = (): CacheFile => ({ repos: {}, summaries: {} })

async function readJson<T>(path: string, fallback: () => T): Promise<T> {
  try {
    return { ...fallback(), ...(JSON.parse(await readFile(path, 'utf8')) as Partial<T>) }
  } catch {
    return fallback()
  }
}

// Temp file then rename, so a crash never leaves a half-written file.
async function writeAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(tmp, path)
}

export class Store {
  private config: Config = emptyConfig()
  private cache: CacheFile = emptyCache()
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly dir: string,
    private readonly crypto: TokenCrypto
  ) {}

  private get configPath(): string {
    return join(this.dir, 'config.json')
  }
  private get cachePath(): string {
    return join(this.dir, 'cache.json')
  }

  async load(): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    this.config = await readJson(this.configPath, emptyConfig)
    this.cache = await readJson(this.cachePath, emptyCache)
  }

  // Serialise writes so concurrent callers cannot interleave file replacements.
  private persist(which: 'config' | 'cache' | 'both'): Promise<void> {
    const next = this.queue.then(async () => {
      if (which !== 'cache') await writeAtomic(this.configPath, this.config)
      if (which !== 'config') await writeAtomic(this.cachePath, this.cache)
    })
    this.queue = next.catch(() => {})
    return next
  }

  secureStorageAvailable(): boolean {
    return this.crypto.isAvailable()
  }

  // Accounts and tokens

  listAccounts(): Account[] {
    return structuredClone(this.config.accounts)
  }

  async saveAccount(account: Account, token: string): Promise<void> {
    if (!this.crypto.isAvailable()) {
      throw new Error('Secure storage is unavailable, so the token cannot be stored safely')
    }
    const encrypted = this.crypto.encrypt(token).toString('base64')
    const others = this.config.accounts.filter((a) => a.id !== account.id)
    this.config.accounts = [...others, account]
    this.config.tokens[account.id] = encrypted
    await this.persist('config')
  }

  getToken(accountId: string): string | null {
    const stored = this.config.tokens[accountId]
    if (!stored || !this.crypto.isAvailable()) return null
    try {
      return this.crypto.decrypt(Buffer.from(stored, 'base64'))
    } catch {
      return null
    }
  }

  async removeAccount(accountId: string): Promise<void> {
    const prefix = `${accountId}:`
    this.config.accounts = this.config.accounts.filter((a) => a.id !== accountId)
    delete this.config.tokens[accountId]
    this.config.links = Object.fromEntries(
      Object.entries(this.config.links).filter(([k]) => !k.startsWith(prefix))
    )
    this.config.projects = pruneAccount(this.config.projects, accountId)
    delete this.cache.repos[accountId]
    this.cache.summaries = Object.fromEntries(
      Object.entries(this.cache.summaries).filter(([k]) => !k.startsWith(prefix))
    )
    await this.persist('both')
  }

  // Local links

  getLinks(): Record<string, string> {
    return { ...this.config.links }
  }

  async setLink(repoKey: string, path: string): Promise<void> {
    this.config.links[repoKey] = path
    await this.persist('config')
  }

  async removeLink(repoKey: string): Promise<void> {
    delete this.config.links[repoKey]
    await this.persist('config')
  }

  // Local-only repositories

  getLocalRepos(): Repo[] {
    return structuredClone(this.config.localRepos)
  }

  /** Same key twice keeps one entry. The folder is linked in the same write. */
  async addLocalRepo(repo: Repo, path: string): Promise<void> {
    this.config.localRepos = [...this.config.localRepos.filter((r) => r.key !== repo.key), repo]
    this.config.links[repo.key] = path
    await this.persist('config')
  }

  async removeLocalRepo(repoKey: string): Promise<void> {
    this.config.localRepos = this.config.localRepos.filter((r) => r.key !== repoKey)
    delete this.config.links[repoKey]
    // A forgotten folder leaves every project too, so none keeps an "unavailable" entry.
    this.config.projects = this.config.projects.map((p) =>
      p.repoKeys.includes(repoKey) ? removeRepos(p, [repoKey]) : p
    )
    await this.persist('config')
  }

  // Projects

  getProjects(): Project[] {
    return structuredClone(this.config.projects)
  }

  async setProjects(projects: Project[]): Promise<void> {
    this.config.projects = projects
    await this.persist('config')
  }

  // Cache

  getCachedRepos(accountId: string): Cached<Repo[]> | null {
    return this.cache.repos[accountId] ?? null
  }

  async setCachedRepos(accountId: string, repos: Repo[]): Promise<void> {
    this.cache.repos[accountId] = { data: repos, fetchedAt: Date.now() }
    await this.persist('cache')
  }

  getCachedSummary(repoKey: string): Cached<RepoSummary> | null {
    return this.cache.summaries[repoKey] ?? null
  }

  async setCachedSummary(repoKey: string, summary: RepoSummary): Promise<void> {
    this.cache.summaries[repoKey] = { data: summary, fetchedAt: Date.now() }
    await this.persist('cache')
  }
}
