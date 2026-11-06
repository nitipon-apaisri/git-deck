import { useCallback, useEffect, useReducer, useState } from 'react'
import { emptyResource, resourceReducer } from '../lib/resource'
import { errorMessage } from '../lib/errors'
import type { ConflictFile } from '@shared/types'

export interface ConflictFileState {
  file: ConflictFile | null
  loading: boolean
  error: string | null
  reload: () => void
}

const keyOf = (path: string, file: string): string => `${path}\n${file}`

/**
 * One conflicted file of one repository. The key is an argument and the state stays in the
 * calling component, like `useDiff`, so two panes never share a file. `file` of `null` loads
 * nothing. It reads again when `reloadToken` changes.
 */
export function useConflictFile(
  path: string | null,
  file: string | null,
  reloadToken = 0
): ConflictFileState {
  const [state, dispatch] = useReducer(resourceReducer<ConflictFile>, emptyResource<ConflictFile>())
  const [nonce, setNonce] = useState(0)
  const key = path !== null && file !== null ? keyOf(path, file) : null

  useEffect(() => {
    if (path === null || file === null || key === null) return
    let cancelled = false
    void (async () => {
      dispatch({ type: 'start', key })
      try {
        const data = await window.api.local.conflictFile(path, file)
        if (!cancelled) dispatch({ type: 'data', key, data, fetchedAt: null, done: true })
      } catch (err) {
        if (!cancelled) dispatch({ type: 'failed', key, error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, file, key, reloadToken, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  if (key === null || state.key !== key) {
    return { file: null, loading: key !== null, error: null, reload }
  }
  return { file: state.data, loading: state.loading, error: state.error, reload }
}
