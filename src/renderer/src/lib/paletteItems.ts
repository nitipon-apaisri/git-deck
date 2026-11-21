// Pure: no DOM, so it runs under tsx tests. Builds and filters the command palette's items.

export type PaletteGroup = 'action' | 'repo' | 'branch' | 'tag'

export interface PaletteItem {
  id: string
  label: string
  /** Dim text after the label: the repo's host, a tag's commit. */
  hint?: string
  group: PaletteGroup
  run: () => void
}

/** What the pane that had focus can do. It registers this while active. */
export interface PaneCommands {
  /** Absent while the repository is not cloned or linked: then only its summary exists. */
  linked: boolean
  /** The checked-out branch, left out of the list. */
  currentBranch: string | null
  branches: readonly string[]
  fetch: () => void
  pull: () => void
  checkout: (branch: string) => void
  toggleTerminal: () => void
  /** Selects the commit in the pane's graph. */
  reveal: (hash: string) => void
  /** Read when the palette opens, so the pane does not keep its tags loaded. */
  loadTags: () => Promise<readonly { name: string; hash: string }[]>
}

export interface PaletteInput {
  repos: readonly { key: string; fullName: string }[]
  /** `null` when no repository is open. */
  pane: PaneCommands | null
  tags: readonly { name: string; hash: string }[]
  openRepo: (key: string) => void
  openSettings: () => void
  switchTheme: () => void
  /** Shown after "Switch theme", e.g. "Dark". */
  themeLabel: string
}

export const PALETTE_LIMIT = 50
const GROUP_ORDER: readonly PaletteGroup[] = ['action', 'repo', 'branch', 'tag']

export function buildPaletteItems(input: PaletteInput): PaletteItem[] {
  const { pane } = input
  const items: PaletteItem[] = []
  if (pane?.linked) {
    items.push(
      { id: 'fetch', label: 'Fetch', group: 'action', run: pane.fetch },
      { id: 'pull', label: 'Pull', group: 'action', run: pane.pull },
      { id: 'terminal', label: 'Toggle terminal', group: 'action', run: pane.toggleTerminal }
    )
  }
  items.push(
    { id: 'settings', label: 'Open Settings', group: 'action', run: input.openSettings },
    {
      id: 'theme',
      label: 'Switch theme',
      hint: input.themeLabel,
      group: 'action',
      run: input.switchTheme
    }
  )
  for (const repo of input.repos) {
    items.push({
      id: `repo:${repo.key}`,
      label: repo.fullName,
      group: 'repo',
      run: () => input.openRepo(repo.key)
    })
  }
  if (pane?.linked) {
    for (const name of pane.branches) {
      if (name === pane.currentBranch) continue
      items.push({
        id: `branch:${name}`,
        label: name,
        hint: 'Switch branch',
        group: 'branch',
        run: () => pane.checkout(name)
      })
    }
    for (const tag of input.tags) {
      items.push({
        id: `tag:${tag.name}`,
        label: tag.name,
        hint: 'Show tag',
        group: 'tag',
        run: () => pane.reveal(tag.hash)
      })
    }
  }
  return items
}

/** 0 = starts with the query, 1 = a word does, 2 = it appears inside, -1 = no match. */
function tier(label: string, needle: string): number {
  const text = label.toLowerCase()
  const at = text.indexOf(needle)
  if (at < 0) return -1
  if (at === 0) return 0
  return /[\s/\-_.:]/.test(text[at - 1]) ? 1 : 2
}

/**
 * Items whose label has the query, best match first (prefix, word start, inside), in input
 * order within a tier. An empty query lists actions, repos, branches, then tags.
 */
export function filterPaletteItems(items: readonly PaletteItem[], query: string): PaletteItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return GROUP_ORDER.flatMap((g) => items.filter((i) => i.group === g)).slice(0, PALETTE_LIMIT)
  }
  const ranked: { item: PaletteItem; rank: number; at: number }[] = []
  items.forEach((item, at) => {
    const rank = tier(item.label, needle)
    if (rank >= 0) ranked.push({ item, rank, at })
  })
  ranked.sort((a, b) => a.rank - b.rank || a.at - b.at)
  return ranked.slice(0, PALETTE_LIMIT).map((r) => r.item)
}
