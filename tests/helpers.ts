import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null'
    }
  }).trim()
}

export function tempDir(prefix = 'gitdeck-'): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function emptyRepo(): string {
  const dir = tempDir()
  git(dir, 'init', '-q', '-b', 'main')
  return dir
}

export function commit(dir: string, file: string, message: string): string {
  writeFileSync(join(dir, file), `${message}\n`)
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', message)
  return git(dir, 'rev-parse', 'HEAD')
}

/** main with a feature branch merged back (true merge commit), plus tags. */
export function branchyRepo(): string {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'first')
  git(dir, 'tag', 'v1.0')
  git(dir, 'checkout', '-q', '-b', 'feature')
  commit(dir, 'b.txt', 'feature work')
  git(dir, 'checkout', '-q', 'main')
  commit(dir, 'c.txt', 'main work')
  git(dir, 'merge', '-q', '--no-ff', '-m', 'merge feature', 'feature')
  git(dir, 'tag', '-a', 'v2.0', '-m', 'release 2')
  writeFileSync(join(dir, 'bin.dat'), Buffer.from([0, 1, 2, 0, 255]))
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'add binary')
  return dir
}
