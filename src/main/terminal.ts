// Integrated terminal sessions. No electron import, and `node-pty` is loaded only when a
// session really starts, so tests inject a fake and never touch the native module.
import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/** The part of a node-pty process this module uses. */
export interface PtyProcess {
  onData(cb: (data: string) => void): void
  onExit(cb: (event: { exitCode: number }) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

export interface PtyOptions {
  cwd: string
  cols: number
  rows: number
  env: Record<string, string>
}

export type SpawnPty = (shell: string, args: string[], options: PtyOptions) => Promise<PtyProcess>

export interface TerminalEvents {
  data(id: string, data: string): void
  exit(id: string, exitCode: number): void
}

const MIN = 2
const MAX = 1000
/** One input chunk (a paste) is capped, so a runaway page cannot flood the shell. */
const MAX_WRITE = 1_000_000

function size(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN || value > MAX) {
    throw new Error(`Invalid terminal ${name}`)
  }
  return value
}

/** The user's login shell, with a sane fallback per platform. */
export function defaultShell(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): { shell: string; args: string[] } {
  if (platform === 'win32') return { shell: env['COMSPEC'] ?? 'powershell.exe', args: [] }
  const shell = env['SHELL'] && existsSync(env['SHELL']) ? env['SHELL'] : '/bin/zsh'
  return { shell, args: ['-l'] }
}

/** The environment a shell starts with: ours, plus a terminal type that xterm understands. */
export function shellEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value
  }
  out['TERM'] = 'xterm-256color'
  out['COLORTERM'] = 'truecolor'
  // Electron sets this for the app itself; a user's node must not inherit it.
  delete out['ELECTRON_RUN_AS_NODE']
  return out
}

/**
 * node-pty starts a shell through a small `spawn-helper` binary. A package manager may
 * unpack it without the execute bit, and then every spawn fails with `posix_spawnp failed`.
 */
export function ensureHelperExecutable(ptyDir: string): void {
  if (process.platform === 'win32') return
  const roots = [join(ptyDir, 'prebuilds'), join(ptyDir, 'build', 'Release')]
  for (const root of roots) {
    if (!existsSync(root)) continue
    const candidates = [root, ...readdirSync(root).map((d) => join(root, d))]
    for (const dir of candidates) {
      const helper = join(dir, 'spawn-helper')
      try {
        if (existsSync(helper)) chmodSync(helper, 0o755)
      } catch {
        // read-only install: spawn reports the real failure
      }
    }
  }
}

const realSpawn: SpawnPty = async (shell, args, options) => {
  ensureHelperExecutable(dirname(createRequire(__filename).resolve('node-pty/package.json')))
  const pty = await import('node-pty')
  return pty.spawn(shell, args, { name: 'xterm-256color', ...options })
}

export class TerminalManager {
  private readonly sessions = new Map<string, { proc: PtyProcess; path: string }>()

  constructor(
    private readonly events: TerminalEvents,
    private readonly spawn: SpawnPty = realSpawn
  ) {}

  /** Starts a shell in `cwd`. The caller has already checked that the folder is allowed. */
  async create(cwd: string, cols: unknown, rows: unknown): Promise<string> {
    const c = size(cols, 'width')
    const r = size(rows, 'height')
    if (!existsSync(cwd)) throw new Error('The folder no longer exists')
    const { shell, args } = defaultShell()
    let proc: PtyProcess
    try {
      proc = await this.spawn(shell, args, { cwd, cols: c, rows: r, env: shellEnv() })
    } catch (err) {
      throw new Error(
        `Could not start the shell: ${err instanceof Error ? err.message : 'error'}`,
        {
          cause: err
        }
      )
    }
    const id = randomUUID()
    this.sessions.set(id, { proc, path: cwd })
    proc.onData((data) => this.events.data(id, data))
    proc.onExit(({ exitCode }) => {
      this.sessions.delete(id)
      this.events.exit(id, exitCode)
    })
    return id
  }

  private get(id: unknown): { proc: PtyProcess; path: string } {
    const session = typeof id === 'string' ? this.sessions.get(id) : undefined
    if (!session) throw new Error('The terminal is not running')
    return session
  }

  write(id: unknown, data: unknown): void {
    if (typeof data !== 'string' || data.length > MAX_WRITE) throw new Error('Invalid input')
    this.get(id).proc.write(data)
  }

  resize(id: unknown, cols: unknown, rows: unknown): void {
    this.get(id).proc.resize(size(cols, 'width'), size(rows, 'height'))
  }

  /** Quietly does nothing for a session that already ended. */
  kill(id: unknown): void {
    const session = typeof id === 'string' ? this.sessions.get(id) : undefined
    if (!session) return
    this.sessions.delete(id as string)
    try {
      session.proc.kill()
    } catch {
      // already gone
    }
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id)
  }

  /** Sessions whose shell started in `path` (used when a folder is unlinked). */
  idsFor(path: string): string[] {
    return [...this.sessions].filter(([, s]) => s.path === path).map(([id]) => id)
  }
}
