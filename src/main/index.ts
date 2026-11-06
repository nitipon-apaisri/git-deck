import { join } from 'node:path'
import { app, BrowserWindow, net, safeStorage, screen, session, shell } from 'electron'
import { configureFetch } from './http'
import { registerIpc } from './ipc'
import { Store, type TokenCrypto } from './store'
import { installCertVerifyProc } from './tls'
import { isAppUrl as isAppUrlFor, isHttp } from './urls'
import { fitToDisplays, loadWindowState, saveWindowState, type WindowState } from './windowState'

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

// Source of the packaged icons too: build/icon.{icns,ico,png}. Used for the window on Windows/Linux
// and the dock in dev on macOS (packaged macOS builds take icon.icns from the bundle).
const iconPath = join(app.getAppPath(), 'build', 'icon.png')

function createWindow(saved: WindowState): BrowserWindow {
  const dir = app.getPath('userData')
  const start = fitToDisplays(
    saved,
    screen.getAllDisplays().map((d) => d.workArea)
  )
  const win = new BrowserWindow({
    width: start.width,
    height: start.height,
    ...(start.x !== undefined && start.y !== undefined ? { x: start.x, y: start.y } : {}),
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'GitDeck',
    icon: iconPath,
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

  if (start.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())

  // Remember the normal (un-maximized) bounds, debounced while the user drags or resizes.
  let timer: NodeJS.Timeout | undefined
  const remember = (): void => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
    const { x, y, width, height } = win.getNormalBounds()
    void saveWindowState(dir, { x, y, width, height, maximized: win.isMaximized() })
  }
  const rememberSoon = (): void => {
    clearTimeout(timer)
    timer = setTimeout(remember, 500)
  }
  win.on('resize', rememberSoon)
  win.on('move', rememberSoon)
  win.on('maximize', remember)
  win.on('unmaximize', remember)
  win.on('close', remember)

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
    if (process.platform === 'darwin') app.dock?.setIcon(iconPath)
    // net.fetch uses the OS certificate store, so internal CAs work.
    configureFetch((input, init) => net.fetch(input, init))
    installCertVerifyProc(session.defaultSession)
    const store = new Store(app.getPath('userData'), tokenCrypto)
    await store.load()
    // Register before the window exists so the first renderer call finds a handler.
    registerIpc(store)()
    const saved = await loadWindowState(app.getPath('userData'))
    createWindow(saved)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void loadWindowState(app.getPath('userData')).then(createWindow)
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
