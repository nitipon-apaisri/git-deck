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
  return devUrl ? url.startsWith(devUrl) : url.startsWith('file://')
}
