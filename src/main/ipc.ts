import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { Api, CloneProgress } from '../shared/api'
import type { Account, AccountInput, Repo } from '../shared/types'
import { buildGitAuthEnv } from './gitAuth'
import { HASH_RE, cloneRepo, getCommitDetail, getGraph, getLocalInfo, gitFetch, repoRoot } from './git'
import { createProvider, normalizeBaseUrl } from './providers'
import type { Store } from './store'
import { setInsecureHosts, withTemporaryInsecureHost } from './tls'

/** Message safe to show the user: no Electron prefix, no token material. */
function plainMessage(e: unknown, secrets: string[] = []): string {
  let msg = e instanceof Error ? e.message : String(e)
  msg = msg.replace(/^Error invoking remote method '[^']*':\s*(Error:\s*)?/, '')
  for (const s of secrets) if (s) msg = msg.split(s).join('***')
  return msg
}

function isHttpUrl(url: string): boolean {
  try {
    const p = new URL(url).protocol
    return p === 'http:' || p === 'https:'
  } catch {
    return false
  }
}

/** Single-flight: concurrent callers with the same key share one promise. */
function dedupe<T>(inflight: Map<string, Promise<T>>, key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing
  const p = run().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

const sanitizeName = (name: string): string => name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '') || 'repo'

function validateInput(input: AccountInput): AccountInput & { host: string } {
  if (!input || (input.type !== 'github' && input.type !== 'gitlab')) throw new Error('Unknown provider type')
  const token = String(input.token ?? '').trim()
  if (!token) throw new Error('A token is required')
  const baseUrl = normalizeBaseUrl(input.type, String(input.baseUrl ?? ''))
  const host = new URL(baseUrl).hostname
  const label = String(input.label ?? '').trim() || host
  return { type: input.type, label, baseUrl, token, allowInsecureTls: Boolean(input.allowInsecureTls), host }
}

export function registerIpc(store: Store, getWindow: () => BrowserWindow | null): void {
  const syncInsecureHosts = (): void =>
    setInsecureHosts(store.listAccounts().filter((a) => a.allowInsecureTls).map((a) => a.host))
  syncInsecureHosts()

  const repoFetches = new Map<string, Promise<ReturnType<Store['setRepos']>>>()
  const summaryFetches = new Map<string, Promise<ReturnType<Store['setSummary']>>>()
  const localFetches = new Map<string, Promise<void>>()
  const cloning = new Set<string>()

  const tokenFor = (account: Account): string => {
    const token = store.getToken(account.id)
    if (!token) throw new Error('The stored token could not be read. Remove and re-add this account.')
    return token
  }
  const accountFor = (id: string): Account => {
    const a = store.getAccount(id)
    if (!a) throw new Error('Unknown account')
    return a
  }
  const repoFor = (key: string): Repo => {
    const r = store.findRepo(key)
    if (!r) throw new Error('Repository not found. Reload the repository list and try again.')
    return r
  }
  /** Returns the stored link whose path equals `path`; throws otherwise. */
  const linkedRepoKey = (path: string): string => {
    const entry = Object.entries(store.getLinks()).find(([, p]) => p === path)
    if (typeof path !== 'string' || !entry) throw new Error('This folder is not linked to a repository')
    return entry[0]
  }
  const authEnvFor = (repoKey: string): Record<string, string> => {
    const account = store.getAccount(repoKey.split(':', 1)[0])
    return account ? buildGitAuthEnv(account, tokenFor(account)) : {}
  }
  const secretsFor = (repoKey: string): string[] => {
    const account = store.getAccount(repoKey.split(':', 1)[0])
    return account ? [store.getToken(account.id) ?? ''] : []
  }

  const handlers: Api = {
    secureStorageAvailable: async () => store.secureStorageAvailable(),

    accounts: {
      list: async () => store.listAccounts(),

      test: async (raw) => {
        const input = validateInput(raw)
        try {
          return await withTemporaryInsecureHost(input.host, input.allowInsecureTls, () =>
            createProvider({ id: 'test', type: input.type, baseUrl: input.baseUrl }, input.token).verify()
          )
        } catch (e) {
          throw new Error(plainMessage(e, [input.token]))
        }
      },

      add: async (raw) => {
        const input = validateInput(raw)
        let user
        try {
          user = await withTemporaryInsecureHost(input.host, input.allowInsecureTls, () =>
            createProvider({ id: 'new', type: input.type, baseUrl: input.baseUrl }, input.token).verify()
          )
        } catch (e) {
          throw new Error(plainMessage(e, [input.token]))
        }
        const duplicate = store
          .listAccounts()
          .some(
            (a) =>
              a.type === input.type &&
              a.baseUrl === input.baseUrl &&
              a.username.toLowerCase() === user.username.toLowerCase()
          )
        if (duplicate) throw new Error(`${user.username} is already connected to ${input.baseUrl}`)
        const account: Account = {
          id: randomUUID(),
          type: input.type,
          label: input.label,
          baseUrl: input.baseUrl,
          host: input.host,
          username: user.username,
          avatarUrl: user.avatarUrl,
          allowInsecureTls: input.allowInsecureTls
        }
        store.addAccount(account, input.token)
        syncInsecureHosts()
        return account
      },

      remove: async (id) => {
        store.removeAccount(String(id))
        syncInsecureHosts()
      }
    },

    repos: {
      cached: async (accountId) => store.getRepos(String(accountId)),
      fetch: (accountId) =>
        dedupe(repoFetches, String(accountId), async () => {
          const account = accountFor(String(accountId))
          const token = tokenFor(account)
          try {
            return store.setRepos(account.id, await createProvider(account, token).listRepos())
          } catch (e) {
            throw new Error(plainMessage(e, [token]))
          }
        })
    },

    summary: {
      cached: async (repoKey) => store.getSummary(String(repoKey)),
      fetch: (repoKey) =>
        dedupe(summaryFetches, String(repoKey), async () => {
          const repo = repoFor(String(repoKey))
          const account = accountFor(repo.accountId)
          const token = tokenFor(account)
          try {
            return store.setSummary(repo.key, await createProvider(account, token).getSummary(repo))
          } catch (e) {
            throw new Error(plainMessage(e, [token]))
          }
        })
    },

    local: {
      links: async () => store.getLinks(),

      link: async (repoKey) => {
        const repo = repoFor(String(repoKey))
        const win = getWindow()
        const opts = { title: `Select the local folder for ${repo.fullName}`, properties: ['openDirectory' as const] }
        const picked = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
        if (picked.canceled || !picked.filePaths[0]) return null
        let root: string
        try {
          root = await repoRoot(picked.filePaths[0])
        } catch {
          throw new Error('That folder is not inside a git repository')
        }
        const info = await getLocalInfo(root)
        const needle = repo.fullName.toLowerCase()
        if (!info.remotes.some((r) => r.url.toLowerCase().includes(needle))) {
          const ask = {
            type: 'question' as const,
            buttons: ['Link anyway', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
            message: 'This folder has no remote that matches this repository.',
            detail: `Expected a remote containing "${repo.fullName}".`
          }
          const answer = win ? await dialog.showMessageBox(win, ask) : await dialog.showMessageBox(ask)
          if (answer.response !== 0) return null
        }
        store.setLink(repo.key, root)
        return root
      },

      unlink: async (repoKey) => store.removeLink(String(repoKey)),

      clone: async (repoKey, protocol) => {
        const repo = repoFor(String(repoKey))
        if (protocol !== 'https' && protocol !== 'ssh') throw new Error('Unknown clone protocol')
        if (cloning.has(repo.key)) throw new Error('This repository is already being cloned')
        const win = getWindow()
        const opts = { title: `Choose a parent folder for ${repo.name}`, properties: ['openDirectory' as const, 'createDirectory' as const] }
        const picked = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
        if (picked.canceled || !picked.filePaths[0]) return null
        const dest = resolve(join(picked.filePaths[0], sanitizeName(repo.name)))
        if (existsSync(dest) && readdirSync(dest).length > 0) {
          throw new Error(`${basename(dest)} already exists in that folder and is not empty`)
        }
        cloning.add(repo.key)
        try {
          const env = protocol === 'https' ? authEnvFor(repo.key) : {}
          await cloneRepo(protocol === 'https' ? repo.httpUrl : repo.sshUrl, dest, env, (line) => {
            const m = /(\d{1,3})%/.exec(line)
            const progress: CloneProgress = { repoKey: repo.key, line, percent: m ? Math.min(100, Number(m[1])) : null }
            getWindow()?.webContents.send('clone:progress', progress)
          })
          store.setLink(repo.key, dest)
          return dest
        } catch (e) {
          throw new Error(plainMessage(e, secretsFor(repo.key)))
        } finally {
          cloning.delete(repo.key)
        }
      },

      info: async (path) => {
        linkedRepoKey(path)
        return getLocalInfo(path)
      },

      graph: async (path, skip, limit) => {
        linkedRepoKey(path)
        if (!Number.isInteger(skip) || skip < 0 || !Number.isInteger(limit) || limit < 1 || limit > 5000) {
          throw new Error('Invalid paging arguments')
        }
        return getGraph(path, skip, limit)
      },

      commit: async (path, hash) => {
        linkedRepoKey(path)
        if (!HASH_RE.test(String(hash))) throw new Error('Invalid commit hash')
        return getCommitDetail(path, hash)
      },

      fetch: (path) => {
        const repoKey = linkedRepoKey(path)
        return dedupe(localFetches, repoKey, async () => {
          try {
            await gitFetch(path, authEnvFor(repoKey))
          } catch (e) {
            throw new Error(plainMessage(e, secretsFor(repoKey)))
          }
        })
      },

      reveal: async (path) => {
        linkedRepoKey(path)
        const err = await shell.openPath(path)
        if (err) throw new Error(err)
      },

      // Replaced by the preload's event subscription; never called over IPC.
      onCloneProgress: () => () => {}
    },

    openExternal: async (url) => {
      if (!isHttpUrl(String(url))) throw new Error('Only http and https links can be opened')
      await shell.openExternal(url)
    }
  }

  const reg = (channel: string, fn: (...a: never[]) => unknown): void => {
    ipcMain.handle(channel, (_e, ...args) => (fn as (...a: unknown[]) => unknown)(...args))
  }
  reg('secure:available', handlers.secureStorageAvailable)
  reg('accounts:list', handlers.accounts.list)
  reg('accounts:test', handlers.accounts.test)
  reg('accounts:add', handlers.accounts.add)
  reg('accounts:remove', handlers.accounts.remove)
  reg('repos:cached', handlers.repos.cached)
  reg('repos:fetch', handlers.repos.fetch)
  reg('summary:cached', handlers.summary.cached)
  reg('summary:fetch', handlers.summary.fetch)
  reg('local:links', handlers.local.links)
  reg('local:link', handlers.local.link)
  reg('local:unlink', handlers.local.unlink)
  reg('local:clone', handlers.local.clone)
  reg('local:info', handlers.local.info)
  reg('local:graph', handlers.local.graph)
  reg('local:commit', handlers.local.commit)
  reg('local:fetch', handlers.local.fetch)
  reg('local:reveal', handlers.local.reveal)
  reg('openExternal', handlers.openExternal)
}
