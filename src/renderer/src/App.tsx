import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account, Repo } from '@shared/types'
import { AccountsDialog } from './components/AccountsDialog'
import { RepoView } from './components/RepoView'
import { Sidebar, type AccountState } from './components/Sidebar'
import { errorMessage } from './lib/errors'

const SELECTED_KEY = 'gitdeck.selectedRepo'

function loadSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

export default function App(): React.JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [states, setStates] = useState<Record<string, AccountState>>({})
  const [links, setLinks] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(loadSelected)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(false)
  const [ready, setReady] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const patch = useCallback((id: string, change: Partial<AccountState>): void => {
    setStates((s) => ({ ...s, [id]: { ...(s[id] ?? { repos: [], loading: false, error: null }), ...change } }))
  }, [])

  /** Show cached repos immediately, then refresh from the network. */
  const loadAccount = useCallback(
    async (id: string): Promise<void> => {
      const cached = await window.api.repos.cached(id)
      patch(id, { repos: cached?.data ?? [], loading: true, error: null })
      try {
        const fresh = await window.api.repos.fetch(id)
        patch(id, { repos: fresh.data, loading: false, error: null })
      } catch (e) {
        patch(id, { loading: false, error: errorMessage(e) })
      }
    },
    [patch]
  )

  useEffect(() => {
    void (async () => {
      const [list, l] = await Promise.all([window.api.accounts.list(), window.api.local.links()])
      setAccounts(list)
      setLinks(l)
      setReady(true)
      list.forEach((a) => void loadAccount(a.id))
    })()
  }, [loadAccount])

  useEffect(() => {
    try {
      if (selected) localStorage.setItem(SELECTED_KEY, selected)
      else localStorage.removeItem(SELECTED_KEY)
    } catch {
      /* storage unavailable */
    }
  }, [selected])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const allRepos: Repo[] = Object.values(states).flatMap((s) => s.repos)
  const repo = allRepos.find((r) => r.key === selected && accounts.some((a) => a.id === r.accountId)) ?? null

  return (
    <div className="app">
      <Sidebar
        accounts={accounts}
        states={states}
        links={links}
        selected={selected}
        search={search}
        searchRef={searchRef}
        onSearch={setSearch}
        onSelect={setSelected}
        onManageAccounts={() => setDialog(true)}
        onRetry={(id) => void loadAccount(id)}
      />
      <main className="main">
        {!ready ? null : repo ? (
          <RepoView
            key={repo.key}
            repo={repo}
            account={accounts.find((a) => a.id === repo.accountId)!}
            linkedPath={links[repo.key] ?? null}
            onLinkChange={(key, path) =>
              setLinks((l) => {
                const { [key]: _old, ...rest } = l
                return path ? { ...rest, [key]: path } : rest
              })
            }
          />
        ) : (
          <div className="placeholder muted">Select a repository</div>
        )}
      </main>
      {dialog && (
        <AccountsDialog
          accounts={accounts}
          onClose={() => setDialog(false)}
          onAdded={(a) => {
            setAccounts((list) => [...list, a])
            void loadAccount(a.id)
          }}
          onRemoved={(id) => {
            setAccounts((list) => list.filter((a) => a.id !== id))
            setStates(({ [id]: _gone, ...rest }) => rest)
            setLinks((l) => Object.fromEntries(Object.entries(l).filter(([k]) => !k.startsWith(`${id}:`))))
            if (selected?.startsWith(`${id}:`)) setSelected(null)
          }}
        />
      )}
    </div>
  )
}
