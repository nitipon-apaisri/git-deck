// The Electron side of IPC: dialogs, shell, sender checks and handler registration.
import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron'
import { IPC } from '../shared/api'
import { buildHandlers, respond, type RequestChannel } from './ipcTable'
import { createService, type Ui } from './service'
import type { Store } from './store'
import { isAppUrl } from './urls'

const electronUi: Ui = {
  async pickFolder(title) {
    const parent = BrowserWindow.getFocusedWindow() ?? undefined
    const options = {
      title,
      properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[]
    }
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  },
  async confirm({ message, detail, confirmLabel }) {
    const parent = BrowserWindow.getFocusedWindow() ?? undefined
    const options = {
      type: 'question' as const,
      message,
      detail,
      buttons: [confirmLabel, 'Cancel'],
      defaultId: 1,
      cancelId: 1
    }
    const result = parent
      ? await dialog.showMessageBox(parent, options)
      : await dialog.showMessageBox(options)
    return result.response === 0
  },
  reveal: (path) => shell.showItemInFolder(path),
  openExternal: (url) => shell.openExternal(url),
  version: app.getVersion()
}

// A notification with no reference can be garbage-collected and lose its click handler.
const shownNotes = new Set<Notification>()

/** Returns a function that re-syncs the insecure-TLS allowlist from stored accounts. */
export function registerIpc(store: Store): () => void {
  const { api, syncInsecureHosts } = createService({
    store,
    ui: electronUi,
    // Every window gets the event; it carries the repoKey so the right pane filters.
    emitProgress: (progress) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IPC.gitProgress, progress)
      }
    },
    emitTerminalData: (id, data) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IPC.terminalData, id, data)
      }
    },
    emitTerminalExit: (id, code) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IPC.terminalExit, id, code)
      }
    },
    emitRepoChanged: (path) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IPC.repoChanged, path)
      }
    },
    emitNotify: ({ repoKey, projectId, title, body }) => {
      if (!Notification.isSupported()) return false
      const note = new Notification({ title, body })
      shownNotes.add(note)
      if (shownNotes.size > 50) shownNotes.delete(shownNotes.values().next().value as Notification)
      note.on('close', () => shownNotes.delete(note))
      note.on('click', () => {
        shownNotes.delete(note)
        const [win] = BrowserWindow.getAllWindows()
        if (!win) return
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
        // The test notification has no repository: focusing is all it does.
        if (repoKey) win.webContents.send(IPC.notifyOpen, { repoKey, projectId })
      })
      note.show()
      return true
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const handlers = buildHandlers(api)
  for (const name of Object.keys(handlers) as RequestChannel[]) {
    ipcMain.handle(IPC[name], async (event, ...args: unknown[]) => {
      // Only our own pages may call in, never a navigated-to foreign frame.
      const sender = event.senderFrame?.url ?? ''
      if (!isAppUrl(sender, devUrl)) return { ok: false, error: 'Request was not sent by the app' }
      return respond(handlers[name], args)
    })
  }
  return syncInsecureHosts
}
