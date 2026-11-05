import { useCallback, useEffect, useState } from 'react'
import { AccountsDialog } from './components/AccountsDialog'
import { MainPane } from './components/MainPane'
import { PreferencesDialog } from './components/PreferencesDialog'
import { Rail } from './components/Rail'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import type { ShortcutAction } from './lib/splitLayout'
import { stillValid, type PaneId } from './lib/splitState'
import { readStored, writeStored } from './state/storage'
import { useShortcuts } from './state/useShortcuts'
import { useSplit } from './state/useSplit'
import { useTheme } from './state/theme'
import { useWorkspace } from './state/workspace'
import styles from './App.module.css'

type DialogName = 'accounts' | 'preferences' | null

const SIDEBAR_KEY = 'gitdeck.sidebar'

export function App() {
  const { state, refresh, refreshAll, refreshLinks, accountAdded, removeAccount } = useWorkspace()
  const split = useSplit()
  const { state: layout } = split
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
  const anyLoading = Object.values(state.byAccount).some((a) => a.loading)
  const selectedKey = layout.panes[layout.active].repoKey
  const paneMarks: Record<string, 1 | 2> = {}
  if (layout.enabled) {
    const [first, second] = layout.panes
    if (first.repoKey) paneMarks[first.repoKey] = 1
    if (second.repoKey) paneMarks[second.repoKey] = 2
  }

  // Forget a pane's repository once the lists say it is gone (account removed, repo
  // deleted). Not while a list is still loading or has never loaded, and not when an
  // account's list failed: then the list cannot say it is gone.
  const paneKeys = layout.panes.map((p) => p.repoKey ?? '').join('|')
  const { pruneRepos } = split
  useEffect(() => {
    if (!state.ready || anyLoading) return
    const known = new Set(Object.values(state.byAccount).flatMap((a) => a.repos.map((r) => r.key)))
    const accounts = Object.fromEntries(
      state.accounts.map((a) => {
        const entry = state.byAccount[a.id]
        const settled = entry !== undefined && (entry.fetchedAt !== null || entry.error !== null)
        return [a.id, { error: settled ? entry.error : 'not loaded yet' }]
      })
    )
    const valid = new Set(
      paneKeys.split('|').filter((key) => key !== '' && stillValid(key, known, accounts))
    )
    pruneRepos(valid)
  }, [state.ready, anyLoading, state.byAccount, state.accounts, paneKeys, pruneRepos])

  const { toggle, setActive } = split
  const enabled = layout.enabled
  const active = layout.active
  const onShortcut = useCallback(
    (action: ShortcutAction) => {
      if (action === 'toggle') {
        toggle()
        return
      }
      const target: PaneId = !enabled ? active : action === 'pane1' ? 0 : 1
      setActive(target)
      document.querySelector<HTMLElement>(`[data-pane="${target}"]`)?.focus()
    },
    [toggle, setActive, enabled, active]
  )
  useShortcuts(onShortcut)

  return (
    <div className={styles.app}>
      <Toolbar
        accounts={state.accounts}
        onOpenAccounts={() => setDialog('accounts')}
        splitEnabled={layout.enabled}
        orientation={layout.orientation}
        onToggleSplit={split.toggle}
        onToggleOrientation={() =>
          split.setOrientation(layout.orientation === 'horizontal' ? 'vertical' : 'horizontal')
        }
        onSwap={split.swap}
      />
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
            paneMarks={paneMarks}
            onSelect={split.select}
            onOpenInSplit={split.openInSplit}
            onConnect={() => setDialog('accounts')}
            onRefresh={(id) => void refresh(id)}
            onRefreshAll={() => void refreshAll()}
          />
        ) : null}
        <MainPane
          split={split}
          hasAccounts={state.accounts.length > 0}
          repos={repos}
          accounts={state.accounts}
          links={state.links}
          loading={anyLoading}
          onLinksChanged={() => void refreshLinks()}
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
