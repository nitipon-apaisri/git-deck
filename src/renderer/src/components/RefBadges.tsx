import type { GraphRef } from '@shared/types'

const MAX = 4

export function RefBadges({ refs }: { refs: GraphRef[] }): React.JSX.Element | null {
  if (refs.length === 0) return null
  const shown = refs.slice(0, MAX)
  const rest = refs.slice(MAX)
  return (
    <span className="refs">
      {shown.map((r) => (
        <span key={`${r.kind}:${r.name}`} className={`ref ref-${r.kind}${r.current ? ' ref-current' : ''}`} title={r.name}>
          {r.name}
        </span>
      ))}
      {rest.length > 0 && (
        <span className="ref ref-more" title={rest.map((r) => r.name).join('\n')}>
          +{rest.length}
        </span>
      )}
    </span>
  )
}
