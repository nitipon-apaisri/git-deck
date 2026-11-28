// Pure URL checks shared by the window guards and the IPC layer.
export function isHttp(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Only the dev server origin (dev) or our own bundle (prod) counts as the app. */
export function isAppUrl(url: string, devUrl: string | undefined): boolean {
  try {
    const u = new URL(url)
    // Compare origins, not prefixes: `http://localhost:5173.evil.com` starts with the dev URL.
    return devUrl ? u.origin === new URL(devUrl).origin : u.protocol === 'file:'
  } catch {
    return false
  }
}
