import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

const MARK = '__GITDECK_PATH__'

/** The PATH value between two markers, so rc-file chatter on stdout is ignored. */
export function parsePath(out: string): string | null {
  const m = new RegExp(`${MARK}(.*?)${MARK}`, 's').exec(out)
  return m && m[1].trim() ? m[1].trim() : null
}

/**
 * An app started from Finder has a minimal PATH, so hooks that call `pnpm` or `node` fail with
 * "command not found". Ask the login shell for its PATH once and use it for every child process.
 */
export async function loadLoginPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): Promise<void> {
  if (platform === 'win32') return
  const shell = env['SHELL'] && existsSync(env['SHELL']) ? env['SHELL'] : '/bin/zsh'
  const out = await new Promise<string>((resolve) => {
    // execFile, never a shell string. -i for ~/.zshrc, where nvm and pnpm usually set PATH.
    // Braces matter: `$PATH__X__` would be read as one (empty) variable name.
    execFile(
      shell,
      ['-ilc', `printf %s "${MARK}\${PATH}${MARK}"`],
      { timeout: 5000, env: { ...env, TERM: 'dumb' } },
      (err, stdout) => resolve(err ? '' : stdout)
    )
  })
  const path = parsePath(out)
  // shortcut: replaces PATH, does not merge; fine since the login PATH is a superset in practice.
  if (path) env['PATH'] = path
}
