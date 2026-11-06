// Repositories opened from a folder, without an account. Main gives them the account
// id `local`; a real account id is a UUID, so the two cannot collide.
import type { Account, Repo } from '../../../shared/types'

export const LOCAL_ACCOUNT_ID = 'local'

export const isLocalKey = (repoKey: string): boolean => repoKey.startsWith(`${LOCAL_ACCOUNT_ID}:`)
export const isLocalRepo = (repo: Pick<Repo, 'accountId'>): boolean =>
  repo.accountId === LOCAL_ACCOUNT_ID

/** Stands in for an account where the sidebar tree needs one. It is never stored. */
export const LOCAL_GROUP: Account = {
  id: LOCAL_ACCOUNT_ID,
  type: 'github',
  label: 'Local',
  baseUrl: '',
  host: 'This computer',
  username: '',
  allowInsecureTls: false
}
