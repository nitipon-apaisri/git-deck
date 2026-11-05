// Pure workspace state: a reducer with no DOM, so it runs under tsx tests.
import type { Account, Repo } from '../../../shared/types'

export interface AccountRepos {
  repos: Repo[]
  loading: boolean
  /** Plain message, or `null`. Cached repos stay visible when a refresh fails. */
  error: string | null
  fetchedAt: number | null
}

export interface WorkspaceState {
  ready: boolean
  /** `null` until main has answered. */
  secureStorage: boolean | null
  accounts: Account[]
  /** repo key -> local folder */
  links: Record<string, string>
  byAccount: Record<string, AccountRepos>
  loadError: string | null
}

export type Action =
  | { type: 'loaded'; secureStorage: boolean; accounts: Account[]; links: Record<string, string> }
  | { type: 'loadStart' }
  | { type: 'loadFailed'; error: string }
  | { type: 'repos'; accountId: string; repos: Repo[]; fetchedAt: number }
  | { type: 'loading'; accountId: string }
  | { type: 'failed'; accountId: string; error: string }
  | { type: 'accountAdded'; account: Account }
  | { type: 'accountRemoved'; accountId: string }
  | { type: 'links'; links: Record<string, string> }

const empty = (): AccountRepos => ({ repos: [], loading: false, error: null, fetchedAt: null })

export const initial: WorkspaceState = {
  ready: false,
  secureStorage: null,
  accounts: [],
  links: {},
  byAccount: {},
  loadError: null
}

function patch(
  state: WorkspaceState,
  accountId: string,
  change: Partial<AccountRepos>
): WorkspaceState {
  return {
    ...state,
    byAccount: {
      ...state.byAccount,
      [accountId]: { ...(state.byAccount[accountId] ?? empty()), ...change }
    }
  }
}

export function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'loaded':
      return {
        ...state,
        ready: true,
        secureStorage: action.secureStorage,
        accounts: action.accounts,
        links: action.links,
        loadError: null
      }
    case 'loadStart':
      // A retry of the first load: show the loading state again, not the old error.
      return { ...state, ready: false, loadError: null }
    case 'loadFailed':
      return { ...state, ready: true, loadError: action.error }
    case 'repos':
      return patch(state, action.accountId, {
        repos: action.repos,
        fetchedAt: action.fetchedAt,
        loading: false,
        error: null
      })
    case 'loading':
      return patch(state, action.accountId, { loading: true })
    case 'failed':
      return patch(state, action.accountId, { loading: false, error: action.error })
    case 'accountAdded':
      return {
        ...state,
        accounts: [...state.accounts.filter((a) => a.id !== action.account.id), action.account]
      }
    case 'accountRemoved': {
      const prefix = `${action.accountId}:`
      const { [action.accountId]: _gone, ...byAccount } = state.byAccount
      void _gone
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.accountId),
        byAccount,
        links: Object.fromEntries(
          Object.entries(state.links).filter(([k]) => !k.startsWith(prefix))
        )
      }
    }
    case 'links':
      return { ...state, links: action.links }
  }
}
