import { app, BrowserWindow, net, safeStorage, session, shell } from 'electron'
import { join } from 'node:path'
import { configureFetch } from './http'
import { registerIpc } from './ipc'
import { Store } from './store'
import { installCertificateVerifier } from './tls'

const isHttpUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 560,
    show: false,
    backgroundColor: '#0d1117',
    title: 'GitDeck',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow = win
  win.on('closed', () => {
    mainWindow = null
  })
  win.once('ready-to-show', () => win.show())

  // Never open new windows; send http(s) links to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Block navigation away from the app's own page.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = devUrl ? new URL(url).origin === new URL(devUrl).origin : url.startsWith('file://')
    if (allowed) return
    event.preventDefault()
    if (isHttpUrl(url)) void shell.openExternal(url)
  })

  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    // net.fetch uses Chromium's network stack, so the OS certificate store applies.
    configureFetch((input, init) => net.fetch(input, init))
    installCertificateVerifier(session.defaultSession)
    registerIpc(new Store(app.getPath('userData'), safeStorage), () => mainWindow)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
