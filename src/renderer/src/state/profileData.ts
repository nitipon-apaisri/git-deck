import { useCallback, useEffect, useReducer, useState } from 'react'
import { emptyResource, resourceReducer } from '../lib/resource'
import { errorMessage } from '../lib/errors'
import type { ProfileInfo } from '@shared/types'

export interface ProfileState {
  profile: ProfileInfo | null
  loading: boolean
  error: string | null
  reload: () => void
}

/** The Home profile of one account. Switching account starts clean; a reload keeps what shows. */
export function useProfile(accountId: string | null): ProfileState {
  const [state, dispatch] = useReducer(resourceReducer<ProfileInfo>, emptyResource<ProfileInfo>())
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (accountId === null) return
    let cancelled = false
    dispatch({ type: 'start', key: accountId })
    window.api.profile
      .get(accountId)
      .then((data) => {
        if (!cancelled)
          dispatch({ type: 'data', key: accountId, data, fetchedAt: Date.now(), done: true })
      })
      .catch((err: unknown) => {
        if (!cancelled) dispatch({ type: 'failed', key: accountId, error: errorMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [accountId, nonce])

  const mine = accountId !== null && state.key === accountId
  return {
    profile: mine ? state.data : null,
    loading: accountId !== null && (!mine || state.loading),
    error: mine ? state.error : null,
    reload
  }
}
