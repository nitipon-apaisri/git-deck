import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'
import type { CloneProtocol, GitProgress } from '@shared/api'
import type { CheckoutTarget, PullMode } from '@shared/types'

export type LocalBusy = 'clone' | 'link' | 'fetch' | 'pull' | 'push' | 'branch' | null

export interface LocalActions {
  busy: LocalBusy
  /** Latest line of a clone, pull or push for this repository only, while it runs. */
  progress: GitProgress | null
  error: string | null
  /** Changes after a fetch, a clone or a link, so tabs that read the folder reload. */
  reloadToken: number
  /** Changes when files or refs change on disk: status, branches and stashes reload. */
  watchToken: number
  clone: (protocol: CloneProtocol) => void
  link: () => void
  unlink: () => void
  fetch: () => void
  pull: (mode: PullMode) => void
  /** `force` is a force push with lease: main asks the user first. */
  push: (force: boolean) => void
  checkout: (target: CheckoutTarget) => void
  deleteBranch: (name: string) => void
  /** These two resolve with the problem, so a dialog can show it beside the field. */
  createBranch: (
    name: string,
    startPoint: string | null,
    checkout: boolean
  ) => Promise<string | null>
  renameBranch: (from: string, to: string) => Promise<string | null>
  openFolder: () => void
  /** The folder changed (stage, commit, …): graph, Info and Changes read it again. */
  refresh: () => void
  /** A conflict does not fail: the pane's banner (from `operation`) takes it from there. */
  cherryPick: (hash: string) => void
  merge: (branch: string, noFf: boolean) => void
  continueOperation: () => void
  /** Main asks first. */
  abortOperation: () => void
}

/**
 * Clone, link, unlink, fetch and open for ONE repository. All state lives here, in
 * the pane that calls it. `onLinksChanged` tells the workspace to re-read the links
 * so the sidebar dot stays right.
 */
export function useLocalActions(
  repoKey: string,
  linkedPath: string | undefined,
  onLinksChanged: () => void
): LocalActions {
  const [busy, setBusy] = useState<LocalBusy>(null)
  const [progress, setProgress] = useState<GitProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  // Bumped when files or refs change on disk. Separate from `reloadToken` so a plain edit
  // refreshes status and branches without resetting the graph's pages and scroll.
  const [watchToken, setWatchToken] = useState(0)
  const busyRef = useRef<LocalBusy>(null)
  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  useEffect(() => {
    if (!linkedPath) return
    const bump = (): void => {
      // An app action refreshes everything when it ends.
      if (busyRef.current === null) setWatchToken((n) => n + 1)
    }
    void window.api.local.watch(linkedPath).catch(() => {})
    const off = window.api.local.onRepoChanged((p) => {
      if (p === linkedPath) bump()
    })
    // Safety net for folders that cannot be watched: look again when the window returns.
    let last = 0
    const onFocus = (): void => {
      const now = Date.now()
      if (now - last < 1000) return
      last = now
      bump()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      off()
      window.removeEventListener('focus', onFocus)
      void window.api.local.unwatch(linkedPath).catch(() => {})
    }
  }, [linkedPath])

  // Several panes may clone, pull or push at once: each keeps only its own repository's lines.
  useEffect(
    () =>
      window.api.local.onGitProgress((p) => {
        if (p.repoKey === repoKey) setProgress(p)
      }),
    [repoKey]
  )

  const run = useCallback(async (kind: LocalBusy, work: () => Promise<void>): Promise<void> => {
    setBusy(kind)
    setError(null)
    try {
      await work()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }, [])

  const clone = useCallback(
    (protocol: CloneProtocol) =>
      void run('clone', async () => {
        const path = await window.api.local.clone(repoKey, protocol)
        if (path === null) return // the folder picker was cancelled
        onLinksChanged()
        setReloadToken((n) => n + 1)
      }),
    [run, repoKey, onLinksChanged]
  )

  const link = useCallback(
    () =>
      void run('link', async () => {
        const path = await window.api.local.link(repoKey)
        if (path === null) return
        onLinksChanged()
        setReloadToken((n) => n + 1)
      }),
    [run, repoKey, onLinksChanged]
  )

  // Unlinking only forgets the folder. Nothing is deleted from disk.
  const unlink = useCallback(
    () =>
      void run(null, async () => {
        await window.api.local.unlink(repoKey)
        onLinksChanged()
      }),
    [run, repoKey, onLinksChanged]
  )

  const fetch = useCallback(() => {
    if (!linkedPath) return
    void run('fetch', async () => {
      await window.api.local.fetch(linkedPath)
      setReloadToken((n) => n + 1)
    })
  }, [run, linkedPath])

  const openFolder = useCallback(() => {
    if (!linkedPath) return
    void run(null, () => window.api.local.reveal(linkedPath))
  }, [run, linkedPath])

  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  const pull = useCallback(
    (mode: PullMode) => {
      if (!linkedPath) return
      void run('pull', async () => {
        try {
          await window.api.local.pull(linkedPath, mode)
        } finally {
          // A failed merge pull can still have moved things.
          setReloadToken((n) => n + 1)
        }
      })
    },
    [run, linkedPath]
  )

  const push = useCallback(
    (force: boolean) => {
      if (!linkedPath) return
      void run('push', async () => {
        await window.api.local.push(linkedPath, force) // false: the user declined the confirm
        setReloadToken((n) => n + 1)
      })
    },
    [run, linkedPath]
  )

  const checkout = useCallback(
    (target: CheckoutTarget) => {
      if (!linkedPath) return
      void run('branch', async () => {
        try {
          await window.api.local.checkout(linkedPath, target)
        } finally {
          setReloadToken((n) => n + 1)
        }
      })
    },
    [run, linkedPath]
  )

  const deleteBranch = useCallback(
    (name: string) => {
      if (!linkedPath) return
      void run('branch', async () => {
        await window.api.local.deleteBranch(linkedPath, name)
        setReloadToken((n) => n + 1)
      })
    },
    [run, linkedPath]
  )

  // Merge and cherry-pick may stop on conflicts, which is a result, not an error.
  const operate = useCallback(
    (work: (path: string) => Promise<unknown>) => {
      if (!linkedPath) return
      void run('branch', async () => {
        try {
          await work(linkedPath)
        } finally {
          setReloadToken((n) => n + 1)
        }
      })
    },
    [run, linkedPath]
  )

  const cherryPick = useCallback(
    (hash: string) => operate((path) => window.api.local.cherryPick(path, hash)),
    [operate]
  )
  const merge = useCallback(
    (branch: string, noFf: boolean) =>
      operate((path) => window.api.local.merge(path, branch, noFf)),
    [operate]
  )
  const continueOperation = useCallback(
    () => operate((path) => window.api.local.continueOperation(path)),
    [operate]
  )
  const abortOperation = useCallback(
    () => operate((path) => window.api.local.abortOperation(path)),
    [operate]
  )

  const attempt = useCallback(
    async (work: (path: string) => Promise<void>): Promise<string | null> => {
      if (!linkedPath) return 'This repository is not on this computer'
      setBusy('branch')
      try {
        await work(linkedPath)
        setError(null)
        return null
      } catch (err) {
        return errorMessage(err)
      } finally {
        setBusy(null)
        setReloadToken((n) => n + 1)
      }
    },
    [linkedPath]
  )

  const createBranch = useCallback(
    (name: string, startPoint: string | null, checkoutNew: boolean) =>
      attempt((path) => window.api.local.createBranch(path, name, startPoint, checkoutNew)),
    [attempt]
  )

  const renameBranch = useCallback(
    (from: string, to: string) => attempt((path) => window.api.local.renameBranch(path, from, to)),
    [attempt]
  )

  return {
    busy,
    progress,
    error,
    reloadToken,
    watchToken,
    clone,
    link,
    unlink,
    fetch,
    pull,
    push,
    checkout,
    deleteBranch,
    createBranch,
    renameBranch,
    openFolder,
    refresh,
    cherryPick,
    merge,
    continueOperation,
    abortOperation
  }
}
