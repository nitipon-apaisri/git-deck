import { useState } from 'react'
import { AccountsDialog } from './components/AccountsDialog'
import { MainPane } from './components/MainPane'
import { PreferencesDialog } from './components/PreferencesDialog'
import { Rail } from './components/Rail'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { readStored, writeStored } from './state/storage'
import { useSelection } from './state/useSelection'
import { useTheme } from './state/theme'
import { useWorkspace } from './state/workspace'
import styles from './App.module.css'

type DialogName = 'accounts' | 'preferences' | null

const SIDEBAR_KEY = 'gitdeck.sidebar'

export function App() {
  const { state, refresh, refreshAll, accountAdded, removeAccount } = useWorkspace()
  const { selectedKey, select } = useSelection()
  const { setting, setSetting } = useTheme()
  const [dialog, setDialog] = useState<DialogName>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => readStored(SIDEBAR_KEY) !== 'closed')

  function toggleSidebar(): void {
    setSidebarOpen((open) => {
      writeStored(SIDEBAR_KEY, open ? 'closed' : 'open')
      return !open
    })
  }

  const repos = Object.values(state.byAccount).flatMap((a) => a.repos)
  const selectedRepo = selectedKey ? (repos.find((r) => r.key === selectedKey) ?? null) : null
  const anyLoading = Object.values(state.byAccount).some((a) => a.loading)

  return (
    <div className={styles.app}>
      <Toolbar accounts={state.accounts} onOpenAccounts={() => setDialog('accounts')} />
      <div className={styles.body}>
        <Rail
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          onOpenAccounts={() => setDialog('accounts')}
          onOpenPreferences={() => setDialog('preferences')}
        />
        {sidebarOpen ? (
          <Sidebar
            accounts={state.accounts}
            byAccount={state.byAccount}
            links={state.links}
            selectedKey={selectedKey}
            onSelect={select}
            onConnect={() => setDialog('accounts')}
            onRefresh={(id) => void refresh(id)}
            onRefreshAll={() => void refreshAll()}
          />
        ) : null}
        <MainPane
          hasAccounts={state.accounts.length > 0}
          repo={selectedRepo}
          waiting={selectedKey !== null && selectedRepo === null && anyLoading}
          linkedPath={selectedRepo ? state.links[selectedRepo.key] : undefined}
        />
      </div>

      {dialog === 'accounts' ? (
        <AccountsDialog
          accounts={state.accounts}
          secureStorage={state.secureStorage}
          onClose={() => setDialog(null)}
          onAdded={accountAdded}
          onRemove={removeAccount}
        />
      ) : null}
      {dialog === 'preferences' ? (
        <PreferencesDialog
          setting={setting}
          onChange={setSetting}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}
