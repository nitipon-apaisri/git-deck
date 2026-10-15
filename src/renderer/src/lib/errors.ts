/** Strips Electron's "Error invoking remote method '…':" prefix from IPC errors. */
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.replace(/^Error invoking remote method '[^']*':\s*(Error:\s*)?/, '')
}
