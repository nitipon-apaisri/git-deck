import { contextBridge, ipcRenderer } from 'electron'
import type { Api, CloneProgress } from '../shared/api'

const call =
  <T>(channel: string) =>
  (...args: unknown[]): Promise<T> =>
    ipcRenderer.invoke(channel, ...args) as Promise<T>

const api: Api = {
  secureStorageAvailable: call('secure:available'),
  accounts: {
    list: call('accounts:list'),
    test: call('accounts:test'),
    add: call('accounts:add'),
    remove: call('accounts:remove')
  },
  repos: { cached: call('repos:cached'), fetch: call('repos:fetch') },
  summary: { cached: call('summary:cached'), fetch: call('summary:fetch') },
  local: {
    links: call('local:links'),
    link: call('local:link'),
    unlink: call('local:unlink'),
    clone: call('local:clone'),
    info: call('local:info'),
    graph: call('local:graph'),
    commit: call('local:commit'),
    fetch: call('local:fetch'),
    reveal: call('local:reveal'),
    onCloneProgress(cb) {
      const handler = (_e: unknown, p: CloneProgress): void => cb(p)
      ipcRenderer.on('clone:progress', handler)
      return () => {
        ipcRenderer.removeListener('clone:progress', handler)
      }
    }
  },
  openExternal: call('openExternal')
}

contextBridge.exposeInMainWorld('api', api)
