// Pure: the per-repo list of hidden refs. It is a view filter kept in the UI store; git never
// hears of it. Keyed by repo path, values are full ref names (`refs/heads/x`).

export type HiddenMap = Record<string, string[]>

export const HIDDEN_KEY = 'gitdeck.hiddenRefs'

export function parseHidden(raw: string | null): HiddenMap {
  try {
    const value: unknown = JSON.parse(raw ?? '{}')
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    const out: HiddenMap = {}
    for (const [path, list] of Object.entries(value)) {
      if (Array.isArray(list)) out[path] = list.filter((n): n is string => typeof n === 'string')
    }
    return out
  } catch {
    return {}
  }
}

/** Hide or unhide one ref. Returns a new map; an empty list drops the repo's entry. */
export function setHidden(map: HiddenMap, path: string, ref: string, hidden: boolean): HiddenMap {
  const rest = (map[path] ?? []).filter((n) => n !== ref)
  const list = hidden ? [...rest, ref] : rest
  const others = { ...map }
  delete others[path]
  return list.length > 0 ? { ...others, [path]: list } : others
}
