import { join } from 'node:path'
import { app, BrowserWindow, net, safeStorage, session, shell } from 'electron'
import { configureFetch } from './http'
import { registerIpc } from './ipc'
import { Store, type TokenCrypto } from './store'
import { installCertVerifyProc } from './tls'
import { isAppUrl as isAppUrlFor, isHttp } from './urls'

// Only the dev server origin (dev) or our own bundle (prod) may be navigated to.
const devUrl = process.env['ELECTRON_RENDERER_URL']
const isAppUrl = (url: string): boolean => isAppUrlFor(url, devUrl)

// Linux without a keyring falls back to a plaintext "basic_text" backend. That is
// not safe storage for a token, so treat it as unavailable.
const tokenCrypto: TokenCrypto = {
  isAvailable: () =>
    safeStorage.isEncryptionAvailable() &&
    !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text'),
  encrypt: (plain) => safeStorage.encryptString(plain),
  decrypt: (data) => safeStorage.decryptString(data)
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'GitDeck',
    backgroundColor: '#000000',
    // On macOS the toolbar doubles as the title bar, beside the traffic lights.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 18 } }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttp(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    if (isHttp(url)) void shell.openExternal(url)
  })

  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  void app.whenReady().then(async () => {
    // net.fetch uses the OS certificate store, so internal CAs work.
    configureFetch((input, init) => net.fetch(input, init))
    installCertVerifyProc(session.defaultSession)
    const store = new Store(app.getPath('userData'), tokenCrypto)
    await store.load()
    // Register before the window exists so the first renderer call finds a handler.
    registerIpc(store)()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
