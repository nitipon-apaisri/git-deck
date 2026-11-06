// Tells the app when a repository changes on disk: edits in the worktree, and commits,
// checkouts, stages or merges made by other tools. Node's own `fs.watch`, so there is no
// native module and no runtime dependency. No electron import, so it runs under tsx.
import { watch, type FSWatcher } from 'node:fs'
import { gitDirs } from './git'

export const WATCH_DEBOUNCE_MS = 300

/** A path under the git dir that never means "the user did something". */
export function ignoredInGitDir(rel: string): boolean {
  const first = rel.split(/[\\/]/)[0]
  return (
    first === 'objects' ||
    first === 'logs' ||
    first === 'hooks' ||
    first === 'lfs' ||
    first === 'FETCH_HEAD' ||
    rel.endsWith('.lock')
  )
}

/** A path in the worktree that is either git's own folder or too noisy to follow. */
export function ignoredInWorktree(rel: string): boolean {
  const parts = rel.split(/[\\/]/)
  return parts[0] === '.git' || parts.includes('node_modules')
}

/**
 * Calls `onChange` once, after a quiet moment, whenever the folder or its git dir
 * changes. Resolves to the function that stops watching. Never rejects: a folder that
 * cannot be watched simply never fires, and the window-focus refresh still covers it.
 */
export async function watchRepo(path: string, onChange: () => void): Promise<() => void> {
  const watchers: FSWatcher[] = []
  let timer: NodeJS.Timeout | null = null
  let closed = false

  const fire = (): void => {
    if (closed) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (!closed) onChange()
    }, WATCH_DEBOUNCE_MS)
  }

  const add = (dir: string, ignored: (rel: string) => boolean): void => {
    try {
      const w = watch(dir, { recursive: true }, (_event, name) => {
        if (name === null || !ignored(String(name))) fire()
      })
      // ENOENT after a delete, EMFILE on a huge tree: not worth an error dialog.
      w.on('error', () => {})
      watchers.push(w)
    } catch {
      // Unsupported or too many files: fall back to the focus refresh.
    }
  }

  add(path, ignoredInWorktree)
  const dirs = await gitDirs(path)
  if (dirs && !closed) {
    add(dirs.gitDir, ignoredInGitDir)
    if (dirs.commonDir !== dirs.gitDir) add(dirs.commonDir, ignoredInGitDir)
  }

  return () => {
    closed = true
    if (timer) clearTimeout(timer)
    for (const w of watchers) w.close()
  }
}
