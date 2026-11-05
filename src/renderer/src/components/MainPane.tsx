import type { ReactNode } from 'react'
import type { Account, Repo } from '@shared/types'
import type { PaneId } from '../lib/splitState'
import type { Split } from '../state/useSplit'
import { RepoPane } from './repo/RepoPane'
import { EmptyPane, type EmptyKind } from './split/EmptyPane'
import { SplitView } from './split/SplitView'
import { Island } from './ui'
import styles from './MainPane.module.css'

interface MainPaneProps {
  split: Split
  hasAccounts: boolean
  repos: Repo[]
  accounts: Account[]
  /** repo key -> local folder */
  links: Record<string, string>
  /** Some account is still loading its repositories. */
  loading: boolean
  onLinksChanged: () => void
  /** The project overview. It replaces the panes while it shows. */
  overview: ReactNode
}

/**
 * One repository, or two in Split View. Each pane is a `RepoPane` keyed by its
 * repository, so a swap moves a pane (graph, scroll and all) instead of rebuilding it.
 */
export function MainPane({
  split,
  hasAccounts,
  repos,
  accounts,
  links,
  loading,
  onLinksChanged,
  overview
}: MainPaneProps) {
  const { state } = split

  function pane(id: PaneId) {
    const { repoKey, tab } = state.panes[id]
    const repo = repoKey ? repos.find((r) => r.key === repoKey) : undefined
    const active = state.active === id
    if (repo) {
      return (
        <RepoPane
          key={repo.key}
          repo={repo}
          account={accounts.find((a) => a.id === repo.accountId) ?? null}
          linkedPath={links[repo.key]}
          active={active}
          tab={tab}
          onTabChange={(next) => split.setTab(id, next)}
          onActivate={() => split.setActive(id)}
          onLinksChanged={onLinksChanged}
          paneNumber={id === 0 ? 1 : 2}
          split={state.enabled}
          onClose={() => split.close(id)}
        />
      )
    }
    const waiting = repoKey !== null && loading
    const kind: EmptyKind = waiting
      ? 'loading'
      : !hasAccounts
        ? 'connect'
        : state.enabled
          ? 'pick'
          : 'select'
    return (
      <EmptyPane
        key={`empty-${id}`}
        pane={id}
        kind={kind}
        active={active}
        onActivate={() => split.setActive(id)}
        onClose={state.enabled ? () => split.close(id) : undefined}
      />
    )
  }

  if (overview) {
    return (
      <main className={styles.main} aria-label="Project overview">
        <Island className={styles.overview}>{overview}</Island>
      </main>
    )
  }

  return (
    <main className={styles.main} aria-label="Repositories">
      <SplitView
        enabled={state.enabled}
        orientation={state.orientation}
        ratio={state.ratio}
        onRatioChange={split.setRatio}
        first={pane(state.enabled ? 0 : state.active)}
        second={state.enabled ? pane(1) : null}
      />
    </main>
  )
}
