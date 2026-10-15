import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'gitdeck-'))
}

export function rm(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com'
    }
  }).trim()
}

export function emptyRepo(): string {
  const dir = tmpDir()
  git(dir, 'init', '-q', '-b', 'main')
  return dir
}

export function commit(dir: string, file: string, content: string, message: string): void {
  writeFileSync(join(dir, file), content)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
}

/** main: A - B - M(merge) - D ; feature: B - C ; tag v1 on A */
export function branchyRepo(): string {
  const dir = emptyRepo()
  commit(dir, 'a.txt', 'a\n', 'A')
  git(dir, 'tag', 'v1')
  commit(dir, 'b.txt', 'b\nb\n', 'B')
  git(dir, 'checkout', '-q', '-b', 'feature')
  commit(dir, 'c.txt', 'c\n', 'C')
  git(dir, 'checkout', '-q', 'main')
  git(dir, 'merge', '-q', '--no-ff', 'feature', '-m', 'M')
  commit(dir, 'd.txt', 'd\n', 'D')
  return dir
}
