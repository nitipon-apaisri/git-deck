import { useCallback, useEffect, useReducer } from 'react'
import { errorMessage } from '../lib/errors'
import { reducer, initial } from '../lib/workspaceReducer'
import type { Account } from '@shared/types'

export type { AccountRepos, WorkspaceState } from '../lib/workspaceReducer'
import type { WorkspaceState } from '../lib/workspaceReducer'

export interface Workspace {
  state: WorkspaceState
  /** Re-fetch one account's repositories from the host. */
  refresh: (accountId: string) => Promise<void>
  refreshAll: () => Promise<void>
  /** Re-read which repositories are linked to a folder, after a clone, link or unlink. */
  refreshLinks: () => Promise<void>
  /** Call after the dialog added an account: shows it and loads its repositories. */
  accountAdded: (account: Account) => void
  /** Removes through main, then forgets the account here. Rejects with a plain message. */
  removeAccount: (accountId: string) => Promise<void>
}

export function useWorkspace(): Workspace {
  const [state, dispatch] = useReducer(reducer, initial)

  const refresh = useCallback(async (accountId: string) => {
    dispatch({ type: 'loading', accountId })
    try {
      const fresh = await window.api.repos.fetch(accountId)
      dispatch({ type: 'repos', accountId, repos: fresh.data, fetchedAt: fresh.fetchedAt })
    } catch (err) {
      dispatch({ type: 'failed', accountId, error: errorMessage(err) })
    }
  }, [])

  // Stale-while-revalidate: show what is cached now, then replace it from the host.
  const loadAccount = useCallback(
    async (accountId: string) => {
      try {
        const cached = await window.api.repos.cached(accountId)
        if (cached) {
          dispatch({ type: 'repos', accountId, repos: cached.data, fetchedAt: cached.fetchedAt })
        }
      } catch {
        // No cache is not an error: the network fetch below fills the list.
      }
      await refresh(accountId)
    },
    [refresh]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [secureStorage, accounts, links] = await Promise.all([
          window.api.secureStorageAvailable(),
          window.api.accounts.list(),
          window.api.local.links()
        ])
        if (cancelled) return
        dispatch({ type: 'loaded', secureStorage, accounts, links })
        await Promise.all(accounts.map((a) => loadAccount(a.id)))
      } catch (err) {
        if (!cancelled) dispatch({ type: 'loadFailed', error: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadAccount])

  const refreshAll = useCallback(
    () => Promise.all(state.accounts.map((a) => refresh(a.id))).then(() => undefined),
    [state.accounts, refresh]
  )

  const refreshLinks = useCallback(async () => {
    try {
      dispatch({ type: 'links', links: await window.api.local.links() })
    } catch {
      // Keep the links we have: the sidebar dot is a hint, not something to fail on.
    }
  }, [])

  const accountAdded = useCallback(
    (account: Account) => {
      dispatch({ type: 'accountAdded', account })
      void loadAccount(account.id)
    },
    [loadAccount]
  )

  const removeAccount = useCallback(async (accountId: string) => {
    try {
      await window.api.accounts.remove(accountId)
    } catch (err) {
      throw new Error(errorMessage(err), { cause: err })
    }
    dispatch({ type: 'accountRemoved', accountId })
  }, [])

  return { state, refresh, refreshAll, refreshLinks, accountAdded, removeAccount }
}
