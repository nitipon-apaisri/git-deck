// Split View state: a pure reducer with no DOM, so it runs under tsx tests.

export type PaneId = 0 | 1
export type TabName = 'overview' | 'graph' | 'info'
export type Orientation = 'horizontal' | 'vertical' // horizontal = side by side

export interface PaneState {
  repoKey: string | null
  tab: TabName
}

export interface SplitState {
  enabled: boolean
  orientation: Orientation
  /** Size of pane 0 as a share of the space, clamped to 0.25 to 0.75. */
  ratio: number
  panes: [PaneState, PaneState]
  /** The pane that sidebar selection loads into. With split off, the one on screen. */
  active: PaneId
}

export const SPLIT_KEY = 'gitdeck.split.v1'
export const RATIO_MIN = 0.25
export const RATIO_MAX = 0.75
/** What one arrow key press moves the divider. */
export const RATIO_STEP = 0.02

const TABS: readonly TabName[] = ['overview', 'graph', 'info']

export const emptyPane = (): PaneState => ({ repoKey: null, tab: 'overview' })

export const defaultSplit = (): SplitState => ({
  enabled: false,
  orientation: 'horizontal',
  ratio: 0.5,
  panes: [emptyPane(), emptyPane()],
  active: 0
})

export type SplitAction =
  | { type: 'select'; repoKey: string }
  | { type: 'openInSplit'; repoKey: string }
  | { type: 'setActive'; pane: PaneId }
  | { type: 'setTab'; pane: PaneId; tab: TabName }
  | { type: 'close'; pane: PaneId }
  | { type: 'swap' }
  | { type: 'setOrientation'; orientation: Orientation }
  | { type: 'setRatio'; ratio: number }
  | { type: 'pruneRepos'; validKeys: ReadonlySet<string> }
  | { type: 'toggle' }

export const otherPane = (pane: PaneId): PaneId => (pane === 0 ? 1 : 0)

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5
  return Math.min(RATIO_MAX, Math.max(RATIO_MIN, ratio))
}

/** The pane that shows `repoKey`, if any. */
export function paneShowing(state: SplitState, repoKey: string): PaneId | null {
  if (state.panes[0].repoKey === repoKey) return 0
  if (state.panes[1].repoKey === repoKey) return 1
  return null
}

function withPane(state: SplitState, pane: PaneId, change: Partial<PaneState>): SplitState {
  const panes: [PaneState, PaneState] = [state.panes[0], state.panes[1]]
  panes[pane] = { ...panes[pane], ...change }
  return { ...state, panes }
}

export function splitReducer(state: SplitState, action: SplitAction): SplitState {
  switch (action.type) {
    case 'select': {
      // A repository is never in both panes: focus the pane that already has it.
      const shown = paneShowing(state, action.repoKey)
      if (shown !== null) return shown === state.active ? state : { ...state, active: shown }
      return withPane(state, state.active, { repoKey: action.repoKey })
    }
    case 'openInSplit': {
      const shown = paneShowing(state, action.repoKey)
      if (shown !== null) return { ...state, enabled: true, active: shown }
      const target = otherPane(state.active)
      return {
        ...withPane(state, target, { repoKey: action.repoKey }),
        enabled: true,
        active: target
      }
    }
    case 'setActive':
      return action.pane === state.active ? state : { ...state, active: action.pane }
    case 'setTab':
      return state.panes[action.pane].tab === action.tab
        ? state
        : withPane(state, action.pane, { tab: action.tab })
    case 'close': {
      // Closing a pane leaves the other one on screen, alone, in the first slot.
      const keep = state.panes[otherPane(action.pane)]
      return { ...state, enabled: false, panes: [keep, emptyPane()], active: 0 }
    }
    case 'swap':
      return { ...state, panes: [state.panes[1], state.panes[0]], active: otherPane(state.active) }
    case 'setOrientation':
      return action.orientation === state.orientation
        ? state
        : { ...state, orientation: action.orientation }
    case 'setRatio': {
      if (!Number.isFinite(action.ratio)) return state
      const ratio = clampRatio(action.ratio)
      return ratio === state.ratio ? state : { ...state, ratio }
    }
    case 'pruneRepos': {
      let next = state
      for (const pane of [0, 1] as const) {
        const key = next.panes[pane].repoKey
        if (key !== null && !action.validKeys.has(key)) next = withPane(next, pane, emptyPane())
      }
      return next
    }
    case 'toggle': {
      if (state.enabled) return { ...state, enabled: false }
      // An empty pane is where the user is about to pick a repository.
      const empty =
        state.panes[state.active].repoKey === null ? state.active : otherPane(state.active)
      const active = state.panes[empty].repoKey === null ? empty : state.active
      return { ...state, enabled: true, active }
    }
  }
}

// Persistence

export const serializeSplit = (state: SplitState): string => JSON.stringify(state)

function parsePane(value: unknown): PaneState | null {
  if (typeof value !== 'object' || value === null) return null
  const { repoKey, tab } = value as Record<string, unknown>
  if (repoKey !== null && typeof repoKey !== 'string') return null
  if (typeof tab !== 'string' || !TABS.includes(tab as TabName)) return null
  return { repoKey, tab: tab as TabName }
}

/** The stored state, or the default when it is missing, unreadable or the wrong shape. */
export function parseSplit(raw: string | null): SplitState {
  if (raw === null) return defaultSplit()
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return defaultSplit()
    const { enabled, orientation, ratio, panes, active } = value as Record<string, unknown>
    if (typeof enabled !== 'boolean') return defaultSplit()
    if (orientation !== 'horizontal' && orientation !== 'vertical') return defaultSplit()
    if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return defaultSplit()
    if (active !== 0 && active !== 1) return defaultSplit()
    if (!Array.isArray(panes) || panes.length !== 2) return defaultSplit()
    const first = parsePane(panes[0])
    const second = parsePane(panes[1])
    if (!first || !second) return defaultSplit()
    // One repository in both panes would break the "never twice" rule.
    if (first.repoKey !== null && first.repoKey === second.repoKey) return defaultSplit()
    return { enabled, orientation, ratio: clampRatio(ratio), panes: [first, second], active }
  } catch {
    return defaultSplit()
  }
}

// Pruning

/**
 * Whether a pane's repository should stay. It stays when it is in the loaded lists.
 * It also stays when its account's list failed to load, because then the list cannot
 * say it is gone. `accounts` holds the accounts that still exist: a removed account has
 * no entry, so its repositories go.
 */
export function stillValid(
  repoKey: string,
  known: ReadonlySet<string>,
  accounts: Readonly<Record<string, { error: string | null } | undefined>>
): boolean {
  if (known.has(repoKey)) return true
  const accountId = repoKey.slice(0, Math.max(0, repoKey.indexOf(':')))
  const account = accounts[accountId]
  return account !== undefined && account.error !== null
}
