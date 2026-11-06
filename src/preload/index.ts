// The only bridge between the sandboxed page and main. Every call is a fixed
// channel with plain data, so the page never gets ipcRenderer itself.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api, type CloneProgress, type IpcResult } from '../shared/api'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) throw new Error(result.error)
  return result.value
}

const api: Api = {
  secureStorageAvailable: () => call(IPC.secureStorageAvailable),
  accounts: {
    list: () => call(IPC.accountsList),
    test: (input) => call(IPC.accountsTest, input),
    add: (input) => call(IPC.accountsAdd, input),
    remove: (id) => call(IPC.accountsRemove, id)
  },
  repos: {
    cached: (accountId) => call(IPC.reposCached, accountId),
    fetch: (accountId) => call(IPC.reposFetch, accountId)
  },
  summary: {
    cached: (repoKey) => call(IPC.summaryCached, repoKey),
    fetch: (repoKey) => call(IPC.summaryFetch, repoKey)
  },
  local: {
    links: () => call(IPC.localLinks),
    link: (repoKey) => call(IPC.localLink, repoKey),
    unlink: (repoKey) => call(IPC.localUnlink, repoKey),
    clone: (repoKey, protocol) => call(IPC.localClone, repoKey, protocol),
    info: (path) => call(IPC.localInfo, path),
    graph: (path, skip, limit) => call(IPC.localGraph, path, skip, limit),
    commit: (path, hash) => call(IPC.localCommit, path, hash),
    fetch: (path) => call(IPC.localFetch, path),
    reveal: (path) => call(IPC.localReveal, path),
    status: (path) => call(IPC.localStatus, path),
    diff: (path, request) => call(IPC.localDiff, path, request),
    stage: (path, files) => call(IPC.localStage, path, files),
    unstage: (path, files) => call(IPC.localUnstage, path, files),
    stageAll: (path) => call(IPC.localStageAll, path),
    discard: (path, files) => call(IPC.localDiscard, path, files),
    createCommit: (path, message, amend) => call(IPC.localCreateCommit, path, message, amend),
    repos: () => call(IPC.localRepos),
    open: () => call(IPC.localOpen),
    remove: (repoKey) => call(IPC.localRemove, repoKey),
    onCloneProgress: (cb) => {
      const listener = (_event: unknown, progress: CloneProgress): void => cb(progress)
      ipcRenderer.on(IPC.cloneProgress, listener)
      return () => {
        ipcRenderer.removeListener(IPC.cloneProgress, listener)
      }
    }
  },
  openExternal: (url) => call(IPC.openExternal, url),
  projects: {
    list: () => call(IPC.projectsList),
    create: (input) => call(IPC.projectsCreate, input),
    update: (id, patch) => call(IPC.projectsUpdate, id, patch),
    remove: (id) => call(IPC.projectsRemove, id),
    addRepos: (id, repoKeys) => call(IPC.projectsAddRepos, id, repoKeys),
    removeRepos: (id, repoKeys) => call(IPC.projectsRemoveRepos, id, repoKeys)
  }
}

contextBridge.exposeInMainWorld('api', api)
