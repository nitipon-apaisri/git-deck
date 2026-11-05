import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Repo } from '@shared/types'
import { AccountsDialog } from './components/AccountsDialog'
import { MainPane } from './components/MainPane'
import { PreferencesDialog } from './components/PreferencesDialog'
import { ManageProjectsDialog } from './components/projects/ManageProjectsDialog'
import { ProjectFormDialog } from './components/projects/ProjectFormDialog'
import { ProjectOverview } from './components/projects/ProjectOverview'
import { Rail } from './components/Rail'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { ALL_SCOPE, SCOPE_KEY, parseScope, projectView, resolveScope } from './lib/projectScope'
import type { ShortcutAction } from './lib/splitLayout'
import { stillValid, type PaneId } from './lib/splitState'
import { errorMessage } from './lib/errors'
import { useProjectSummaries } from './state/projectSummaries'
import { useProjects } from './state/projects'
import { readStored, writeStored } from './state/storage'
import { useShortcuts } from './state/useShortcuts'
import { useSplit } from './state/useSplit'
import { useTheme } from './state/theme'
import { useWorkspace } from './state/workspace'
import styles from './App.module.css'

type DialogName = 'accounts' | 'preferences' | 'projects' | null

const SIDEBAR_KEY = 'gitdeck.sidebar'

export function App() {
  const { state, refresh, refreshAll, refreshLinks, accountAdded, removeAccount } = useWorkspace()
  const split = useSplit()
  const { state: layout } = split
  const projectsApi = useProjects()
  const [scopeId, setScopeId] = useState(() => parseScope(readStored(SCOPE_KEY)))
  const [overviewOn, setOverviewOn] = useState(false)
  const [form, setForm] = useState<{ editId: string | null; repoKeys: string[] } | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
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

  // Projects
  const { projects, ready: projectsReady } = projectsApi
  const scope = projectsReady ? resolveScope(scopeId, projects) : null
  const reposByAccount = useMemo(
    () => Object.fromEntries(Object.entries(state.byAccount).map(([id, a]) => [id, a.repos])),
    [state.byAccount]
  )
  const repoByKey = useMemo(
    () =>
      new Map<string, Repo>(Object.values(reposByAccount).flatMap((l) => l.map((r) => [r.key, r]))),
    [reposByAccount]
  )
  const view = useMemo(() => {
    if (!scope) return null
    const loads = Object.fromEntries(
      state.accounts.map((a) => {
        const entry = state.byAccount[a.id]
        return [
          a.id,
          { settled: entry !== undefined && (entry.fetchedAt !== null || entry.error !== null) }
        ]
      })
    )
    return projectView(scope, reposByAccount, loads, state.ready)
  }, [scope, reposByAccount, state.accounts, state.byAccount, state.ready])
  const overviewVisible =
    scope !== null && (overviewOn || (!layout.enabled && selectedKey === null))
  // Summaries load only while the overview is on screen, but stay held for the next visit.
  const summaries = useProjectSummaries(
    overviewVisible && scope ? scope.repoKeys : [],
    useMemo(() => new Set(repoByKey.keys()), [repoByKey])
  )

  function chooseScope(id: string | null): void {
    const next = id ?? ALL_SCOPE
    setScopeId(next)
    writeStored(SCOPE_KEY, next)
    setOverviewOn(id !== null)
  }
  // A deleted project resolves to "all" above. Drop the stale id so it is not kept.
  useEffect(() => {
    if (projectsReady && scopeId !== ALL_SCOPE && resolveScope(scopeId, projects) === null) {
      writeStored(SCOPE_KEY, ALL_SCOPE)
    }
  }, [projectsReady, scopeId, projects])

  function selectRepo(key: string): void {
    setOverviewOn(false)
    split.select(key)
  }
  function openRepoInSplit(key: string): void {
    setOverviewOn(false)
    split.openInSplit(key)
  }
  async function guarded(work: Promise<unknown>): Promise<void> {
    try {
      await work
      setProjectError(null)
    } catch (err) {
      setProjectError(errorMessage(err))
    }
  }
  async function removeAccountAndPrune(accountId: string): Promise<void> {
    await removeAccount(accountId)
    // Main dropped that account's repositories from every project.
    await projectsApi.reload()
  }
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
          onOpenProjects={() => setDialog('projects')}
          onOpenPreferences={() => setDialog('preferences')}
        />
        {sidebarOpen ? (
          <Sidebar
            accounts={state.accounts}
            byAccount={state.byAccount}
            links={state.links}
            selectedKey={selectedKey}
            paneMarks={paneMarks}
            onSelect={selectRepo}
            onOpenInSplit={openRepoInSplit}
            onConnect={() => setDialog('accounts')}
            onRefresh={(id) => void refresh(id)}
            onRefreshAll={() => void refreshAll()}
            projects={{
              projects,
              scope,
              view,
              overviewActive: overviewVisible,
              error: projectError,
              onDismissError: () => setProjectError(null),
              onScope: chooseScope,
              onNewProject: (repoKeys = []) => setForm({ editId: null, repoKeys }),
              onManage: () => setDialog('projects'),
              onEditScope: () => scope && setForm({ editId: scope.id, repoKeys: [] }),
              onOverview: () => setOverviewOn(true),
              onToggleMember: (projectId, repoKey, member) =>
                void guarded(
                  member
                    ? projectsApi.addRepos(projectId, [repoKey])
                    : projectsApi.removeRepos(projectId, [repoKey])
                ),
              onRemoveUnavailable: (repoKey) =>
                scope && void guarded(projectsApi.removeRepos(scope.id, [repoKey]))
            }}
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
          overview={
            overviewVisible && scope && view ? (
              <ProjectOverview
                project={scope}
                accounts={state.accounts}
                repos={repoByKey}
                links={state.links}
                summaries={summaries}
                unavailable={new Set(view.unavailable)}
                pending={new Set(view.pending)}
                onOpen={selectRepo}
                onOpenInSplit={openRepoInSplit}
                onEdit={() => setForm({ editId: scope.id, repoKeys: [] })}
                onRemoveRepo={(key) => void guarded(projectsApi.removeRepos(scope.id, [key]))}
              />
            ) : null
          }
        />
      </div>

      {dialog === 'accounts' ? (
        <AccountsDialog
          accounts={state.accounts}
          secureStorage={state.secureStorage}
          onClose={() => setDialog(null)}
          onAdded={accountAdded}
          onRemove={removeAccountAndPrune}
        />
      ) : null}
      {dialog === 'projects' ? (
        <ManageProjectsDialog
          projects={projects}
          onNew={() => setForm({ editId: null, repoKeys: [] })}
          onEdit={(id) => setForm({ editId: id, repoKeys: [] })}
          onDelete={projectsApi.remove}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {form ? (
        <ProjectFormDialog
          projects={projects}
          editing={form.editId ? (projects.find((p) => p.id === form.editId) ?? null) : null}
          initialRepoKeys={form.repoKeys}
          accounts={state.accounts}
          reposByAccount={reposByAccount}
          onSave={async (value) => {
            const saved = await projectsApi.save(form.editId, value)
            if (form.editId === null) chooseScope(saved.id)
          }}
          onClose={() => setForm(null)}
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
