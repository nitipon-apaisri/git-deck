// Pure: no DOM, so it runs under tsx tests. Turns the ref menu layout into `Menu` entries.
import { menuLayout, type RefActionItem, type RefAction } from './branchView'

/** The part of the `Menu` entry type a ref menu uses, so this file needs no React types. */
export type RefMenuEntry =
  | { kind: 'separator'; id: string }
  | {
      kind: 'item'
      id: string
      label: string
      danger?: boolean
      disabled?: boolean
      onSelect: () => void
    }
  | { kind: 'submenu'; id: string; label: string; disabled?: boolean; entries: RefMenuEntry[] }

/**
 * Entries for a ref or commit menu. `busy` switches off everything but copying, which works
 * while a write runs.
 */
export function refMenuEntries(
  items: RefActionItem[],
  currentBranch: string | null,
  busy: boolean,
  run: (action: RefAction) => void
): RefMenuEntry[] {
  const toEntry = (item: RefActionItem): RefMenuEntry => ({
    kind: 'item',
    id: item.id,
    label: item.label,
    danger: item.danger,
    disabled: busy && item.action.type !== 'copy',
    onSelect: () => run(item.action)
  })
  return menuLayout(items, currentBranch).map((row): RefMenuEntry => {
    if (row.kind === 'separator') return row
    if (row.kind === 'item') return toEntry(row.item)
    return {
      kind: 'submenu',
      id: row.id,
      label: row.label,
      // A Reset submenu stays shut while a write runs; Copy stays open.
      disabled: busy && row.items.some((i) => i.action.type !== 'copy'),
      entries: row.items.map(toEntry)
    }
  })
}
