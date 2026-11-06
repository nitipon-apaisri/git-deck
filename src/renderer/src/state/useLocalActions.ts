import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../lib/errors'
import type { CloneProgress, CloneProtocol } from '@shared/api'

export type LocalBusy = 'clone' | 'link' | 'fetch' | null

export interface LocalActions {
  busy: LocalBusy
  /** Latest clone line for this repository only, while a clone runs. */
  progress: CloneProgress | null
  error: string | null
  /** Changes after a fetch, a clone or a link, so tabs that read the folder reload. */
  reloadToken: number
  clone: (protocol: CloneProtocol) => void
  link: () => void
  unlink: () => void
  fetch: () => void
  openFolder: () => void
  /** The folder changed (stage, commit, …): graph, Info and Changes read it again. */
  refresh: () => void
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
  const [progress, setProgress] = useState<CloneProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Several panes may clone at once: each keeps only the lines for its own repository.
  useEffect(
    () =>
      window.api.local.onCloneProgress((p) => {
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

  return { busy, progress, error, reloadToken, clone, link, unlink, fetch, openFolder, refresh }
}
