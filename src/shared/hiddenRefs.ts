// Pure: used by main (git log arguments) and the renderer (the hidden-refs store).
import type { GraphRef } from './types'

const NAMESPACE = { branch: 'refs/heads/', remote: 'refs/remotes/', tag: 'refs/tags/' } as const

/** The full ref name, the key a hidden ref is stored under. HEAD has none: it cannot be hidden. */
export function refFullName(kind: GraphRef['kind'], name: string): string | null {
  return kind === 'head' ? null : NAMESPACE[kind] + name
}

/** Refs that are not hidden. */
export function visibleRefs(refs: readonly GraphRef[], hidden: ReadonlySet<string>): GraphRef[] {
  return hidden.size === 0
    ? [...refs]
    : refs.filter((r) => {
        const full = refFullName(r.kind, r.name)
        return full === null || !hidden.has(full)
      })
}

/**
 * `git log` ref arguments that leave the hidden refs out. `--exclude` takes the name without its
 * namespace and only reaches the next `--branches`/`--remotes`/`--tags`, so each gets its own.
 */
export function refArgs(hidden: readonly string[]): string[] {
  const args: string[] = []
  for (const [flag, prefix] of [
    ['--branches', NAMESPACE.branch],
    ['--remotes', NAMESPACE.remote],
    ['--tags', NAMESPACE.tag]
  ] as const) {
    for (const full of hidden) {
      if (full.startsWith(prefix)) args.push(`--exclude=${full.slice(prefix.length)}`)
    }
    args.push(flag)
  }
  return args
}
