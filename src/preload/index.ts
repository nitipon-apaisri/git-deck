// The only bridge between the sandboxed page and main. Every call is a fixed
// channel with plain data, so the page never gets ipcRenderer itself.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api, type GitProgress, type IpcResult } from '../shared/api'

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
    branches: (path) => call(IPC.localBranches, path),
    checkout: (path, target) => call(IPC.localCheckout, path, target),
    createBranch: (path, name, startPoint, checkout) =>
      call(IPC.localCreateBranch, path, name, startPoint, checkout),
    renameBranch: (path, from, to) => call(IPC.localRenameBranch, path, from, to),
    deleteBranch: (path, name) => call(IPC.localDeleteBranch, path, name),
    pull: (path, mode) => call(IPC.localPull, path, mode),
    push: (path, force) => call(IPC.localPush, path, force),
    stashes: (path) => call(IPC.localStashes, path),
    stashPush: (path, message, untracked) => call(IPC.localStashPush, path, message, untracked),
    stashApply: (path, index, hash) => call(IPC.localStashApply, path, index, hash),
    stashPop: (path, index, hash) => call(IPC.localStashPop, path, index, hash),
    stashDrop: (path, index, hash) => call(IPC.localStashDrop, path, index, hash),
    cherryPick: (path, hash) => call(IPC.localCherryPick, path, hash),
    merge: (path, branch, noFf) => call(IPC.localMerge, path, branch, noFf),
    operation: (path) => call(IPC.localOperation, path),
    continueOperation: (path) => call(IPC.localContinueOperation, path),
    abortOperation: (path) => call(IPC.localAbortOperation, path),
    repos: () => call(IPC.localRepos),
    open: () => call(IPC.localOpen),
    remove: (repoKey) => call(IPC.localRemove, repoKey),
    watch: (path) => call(IPC.localWatch, path),
    unwatch: (path) => call(IPC.localUnwatch, path),
    onRepoChanged: (cb) => {
      const listener = (_event: unknown, path: string): void => cb(path)
      ipcRenderer.on(IPC.repoChanged, listener)
      return () => {
        ipcRenderer.removeListener(IPC.repoChanged, listener)
      }
    },
    onGitProgress: (cb) => {
      const listener = (_event: unknown, progress: GitProgress): void => cb(progress)
      ipcRenderer.on(IPC.gitProgress, listener)
      return () => {
        ipcRenderer.removeListener(IPC.gitProgress, listener)
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
