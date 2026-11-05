// Channel to handler table and the result envelope. No electron import, so a test
// can prove every channel is wired.
import { IPC, type IpcResult } from '../shared/api'
import type { CloneProtocol, ProjectCreateInput, ProjectPatchInput } from '../shared/api'
import type { AccountInput } from '../shared/types'
import type { MainApi } from './service'

export type Handler = (args: unknown[]) => Promise<unknown>

export type RequestChannel = Exclude<keyof typeof IPC, 'cloneProgress'>

// The casts mark the trust boundary: the service validates every argument at runtime.
export function buildHandlers(api: MainApi): Record<RequestChannel, Handler> {
  return {
    secureStorageAvailable: () => api.secureStorageAvailable(),
    accountsList: () => api.accounts.list(),
    accountsTest: ([input]) => api.accounts.test(input as AccountInput),
    accountsAdd: ([input]) => api.accounts.add(input as AccountInput),
    accountsRemove: ([id]) => api.accounts.remove(id as string),
    reposCached: ([id]) => api.repos.cached(id as string),
    reposFetch: ([id]) => api.repos.fetch(id as string),
    summaryCached: ([key]) => api.summary.cached(key as string),
    summaryFetch: ([key]) => api.summary.fetch(key as string),
    localLinks: () => api.local.links(),
    localLink: ([key]) => api.local.link(key as string),
    localUnlink: ([key]) => api.local.unlink(key as string),
    localClone: ([key, protocol]) => api.local.clone(key as string, protocol as CloneProtocol),
    localInfo: ([path]) => api.local.info(path as string),
    localGraph: ([path, skip, limit]) =>
      api.local.graph(path as string, skip as number, limit as number),
    localCommit: ([path, hash]) => api.local.commit(path as string, hash as string),
    localFetch: ([path]) => api.local.fetch(path as string),
    localReveal: ([path]) => api.local.reveal(path as string),
    openExternal: ([url]) => api.openExternal(url as string),
    projectsList: () => api.projects.list(),
    projectsCreate: ([input]) => api.projects.create(input as ProjectCreateInput),
    projectsUpdate: ([id, patch]) => api.projects.update(id as string, patch as ProjectPatchInput),
    projectsRemove: ([id]) => api.projects.remove(id as string),
    projectsAddRepos: ([id, keys]) => api.projects.addRepos(id as string, keys as string[]),
    projectsRemoveRepos: ([id, keys]) => api.projects.removeRepos(id as string, keys as string[])
  }
}

export async function respond(handler: Handler, args: unknown[]): Promise<IpcResult<unknown>> {
  try {
    return { ok: true, value: await handler(args) }
  } catch (err) {
    // The service already scrubbed the message. Never send a stack.
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}
