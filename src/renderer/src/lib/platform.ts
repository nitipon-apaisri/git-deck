// Platform checks that only need the user agent string, so they run under tsx tests.

/**
 * Whether the window has no native title bar of its own: macOS, where main uses
 * `hiddenInset` and the toolbar sits beside the traffic lights.
 */
export function hasInsetTitleBar(userAgent: string): boolean {
  return /\bMacintosh\b/.test(userAgent)
}
