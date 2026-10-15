import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Account, Cached, Repo, RepoSummary } from '../shared/types'

/** Subset of Electron's safeStorage, injected so this module stays Electron-free. */
export interface SecretBox {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(encrypted: Buffer): string
}

interface Config {
  accounts: Account[]
  /** accountId -> base64 of the encrypted token */
  tokens: Record<string, string>
  /** repoKey -> local folder */
  links: Record<string, string>
}

interface CacheFile {
  repos: Record<string, Cached<Repo[]>>
  summaries: Record<string, Cached<RepoSummary>>
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return { ...fallback, ...(JSON.parse(readFileSync(file, 'utf8')) as object) } as T
  } catch {
    return fallback
  }
}

/** Write to a temp file, then rename, so a crash never leaves a half-written file. */
function writeAtomic(file: string, data: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  renameSync(tmp, file)
}

export class Store {
  private readonly configFile: string
  private readonly cacheFile: string
  private config: Config
  private cache: CacheFile

  constructor(
    dir: string,
    private readonly box: SecretBox
  ) {
    mkdirSync(dir, { recursive: true })
    this.configFile = join(dir, 'config.json')
    this.cacheFile = join(dir, 'cache.json')
    this.config = readJson<Config>(this.configFile, { accounts: [], tokens: {}, links: {} })
    this.cache = readJson<CacheFile>(this.cacheFile, { repos: {}, summaries: {} })
  }

  secureStorageAvailable(): boolean {
    return this.box.isEncryptionAvailable()
  }

  // accounts and tokens

  listAccounts(): Account[] {
    return this.config.accounts
  }

  getAccount(id: string): Account | undefined {
    return this.config.accounts.find((a) => a.id === id)
  }

  addAccount(account: Account, token: string): void {
    if (!this.box.isEncryptionAvailable()) {
      throw new Error('Secure storage is not available on this system, so the token cannot be stored safely.')
    }
    this.config.tokens[account.id] = this.box.encryptString(token).toString('base64')
    this.config.accounts.push(account)
    this.saveConfig()
  }

  getToken(accountId: string): string | null {
    const enc = this.config.tokens[accountId]
    if (!enc || !this.box.isEncryptionAvailable()) return null
    try {
      return this.box.decryptString(Buffer.from(enc, 'base64'))
    } catch {
      return null
    }
  }

  /** Removes the account together with its token, cached data and links. */
  removeAccount(id: string): void {
    this.config.accounts = this.config.accounts.filter((a) => a.id !== id)
    delete this.config.tokens[id]
    const prefix = `${id}:`
    for (const key of Object.keys(this.config.links)) {
      if (key.startsWith(prefix)) delete this.config.links[key]
    }
    delete this.cache.repos[id]
    for (const key of Object.keys(this.cache.summaries)) {
      if (key.startsWith(prefix)) delete this.cache.summaries[key]
    }
    this.saveConfig()
    this.saveCache()
  }

  // links

  getLinks(): Record<string, string> {
    return { ...this.config.links }
  }

  setLink(repoKey: string, path: string): void {
    this.config.links[repoKey] = path
    this.saveConfig()
  }

  removeLink(repoKey: string): void {
    delete this.config.links[repoKey]
    this.saveConfig()
  }

  // cache

  getRepos(accountId: string): Cached<Repo[]> | null {
    return this.cache.repos[accountId] ?? null
  }

  setRepos(accountId: string, data: Repo[]): Cached<Repo[]> {
    const entry = { data, fetchedAt: Date.now() }
    this.cache.repos[accountId] = entry
    this.saveCache()
    return entry
  }

  getSummary(repoKey: string): Cached<RepoSummary> | null {
    return this.cache.summaries[repoKey] ?? null
  }

  setSummary(repoKey: string, data: RepoSummary): Cached<RepoSummary> {
    const entry = { data, fetchedAt: Date.now() }
    this.cache.summaries[repoKey] = entry
    this.saveCache()
    return entry
  }

  /** Finds a cached repo by key; the renderer only ever sends keys. */
  findRepo(repoKey: string): Repo | undefined {
    const accountId = repoKey.split(':', 1)[0]
    return this.cache.repos[accountId]?.data.find((r) => r.key === repoKey)
  }

  private saveConfig(): void {
    writeAtomic(this.configFile, this.config)
  }

  private saveCache(): void {
    writeAtomic(this.cacheFile, this.cache)
  }
}
