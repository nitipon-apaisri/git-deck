import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Repo } from '@shared/types'
import { MainPane } from './components/MainPane'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { ManageProjectsDialog } from './components/projects/ManageProjectsDialog'
import { ProjectFormDialog } from './components/projects/ProjectFormDialog'
import { ProjectOverview } from './components/projects/ProjectOverview'
import { Rail } from './components/Rail'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { hasInsetTitleBar } from './lib/platform'
import type { SettingsSection } from './lib/settingsSections'
import { ALL_SCOPE, SCOPE_KEY, parseScope, projectView, resolveScope } from './lib/projectScope'
import type { ShortcutAction } from './lib/splitLayout'
import { stillValid, type PaneId } from './lib/splitState'
import { errorMessage } from './lib/errors'
import { LOCAL_ACCOUNT_ID, LOCAL_GROUP } from './lib/localRepos'
import { useProjectSummaries } from './state/projectSummaries'
import { useProjects } from './state/projects'
import { readStored, writeStored } from './state/storage'
import { useShortcuts } from './state/useShortcuts'
import { useSplit } from './state/useSplit'
import { useTheme } from './state/theme'
import { useWorkspace } from './state/workspace'

type DialogName = 'settings' | 'projects' | null

const SIDEBAR_KEY = 'gitdeck.sidebar'

export function App() {
  const {
    state,
    refresh,
    refreshAll,
    refreshLinks,
    accountAdded,
    removeAccount,
    openLocal,
    removeLocal,
    retryLoad
  } = useWorkspace()
  const split = useSplit()
  const { state: layout } = split
  const projectsApi = useProjects()
  const [scopeId, setScopeId] = useState(() => parseScope(readStored(SCOPE_KEY)))
  const [overviewOn, setOverviewOn] = useState(false)
  const [form, setForm] = useState<{ editId: string | null; repoKeys: string[] } | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const { setting, setSetting } = useTheme()
  const [dialog, setDialog] = useState<DialogName>(null)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('appearance')
  const openSettings = (section: SettingsSection): void => {
    setSettingsSection(section)
    setDialog('settings')
  }
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
    // Local repositories load with the first read, before any host is asked.
    loads[LOCAL_ACCOUNT_ID] = { settled: state.byAccount[LOCAL_ACCOUNT_ID]?.fetchedAt != null }
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
  async function openLocalRepo(): Promise<void> {
    try {
      const repo = await openLocal()
      if (repo) selectRepo(repo.key)
      setProjectError(null)
    } catch (err) {
      setProjectError(errorMessage(err))
    }
  }
  async function removeLocalRepo(key: string): Promise<void> {
    try {
      await removeLocal(key)
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
      if (action === 'search') {
        // A modal dialog owns the keyboard: leave it alone.
        if (document.querySelector('dialog[open]')) return
        setSidebarOpen(true)
        writeStored(SIDEBAR_KEY, 'open')
        // After React has drawn the sidebar, if it was closed.
        requestAnimationFrame(() => {
          const input = document.querySelector<HTMLInputElement>('[data-search-input]')
          input?.focus()
          input?.select()
        })
        return
      }
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
    <div className="flex h-full flex-col bg-background text-foreground">
      <Toolbar
        insetTitleBar={hasInsetTitleBar(navigator.userAgent)}
        accounts={state.accounts}
        onOpenAccounts={() => openSettings('integrations')}
        splitEnabled={layout.enabled}
        orientation={layout.orientation}
        onToggleSplit={split.toggle}
        onToggleOrientation={() =>
          split.setOrientation(layout.orientation === 'horizontal' ? 'vertical' : 'horizontal')
        }
        onSwap={split.swap}
      />
      <div className="flex min-h-0 flex-1 gap-1.5 px-1.5 pb-1.5">
        <Rail
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          onOpenAccounts={() => openSettings('integrations')}
          onOpenProjects={() => setDialog('projects')}
          onOpenPreferences={() => openSettings('appearance')}
        />
        {sidebarOpen ? (
          <Sidebar
            loading={!state.ready}
            loadError={state.loadError}
            onRetryLoad={retryLoad}
            accounts={state.accounts}
            byAccount={state.byAccount}
            links={state.links}
            selectedKey={selectedKey}
            paneMarks={paneMarks}
            onSelect={selectRepo}
            onOpenInSplit={openRepoInSplit}
            onConnect={() => openSettings('integrations')}
            onOpenLocal={() => void openLocalRepo()}
            onRemoveLocal={(key) => void removeLocalRepo(key)}
            onRefresh={(id) => void refresh(id)}
            onRefreshAll={() => void refreshAll()}
            projects={{
              projects,
              scope,
              view,
              overviewActive: overviewVisible,
              error: projectError,
              loadError: projectsApi.loadError,
              onRetryLoad: () => void projectsApi.reload(),
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
          accounts={
            (reposByAccount[LOCAL_ACCOUNT_ID]?.length ?? 0) > 0
              ? [LOCAL_GROUP, ...state.accounts]
              : state.accounts
          }
          reposByAccount={reposByAccount}
          onSave={async (value) => {
            const saved = await projectsApi.save(form.editId, value)
            if (form.editId === null) chooseScope(saved.id)
          }}
          onClose={() => setForm(null)}
        />
      ) : null}
      {dialog === 'settings' ? (
        <SettingsDialog
          section={settingsSection}
          onSection={setSettingsSection}
          onClose={() => setDialog(null)}
          theme={setting}
          onThemeChange={setSetting}
          accounts={state.accounts}
          secureStorage={state.secureStorage}
          onAccountAdded={accountAdded}
          onAccountRemove={removeAccountAndPrune}
        />
      ) : null}
    </div>
  )
}
