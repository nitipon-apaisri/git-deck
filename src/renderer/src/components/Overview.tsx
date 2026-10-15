import { useState } from 'react'
import type { ProviderType, Repo, RepoSummary } from '@shared/types'
import { formatCount } from '../lib/format'
import { Avatar } from './Avatar'

const LANG_COLORS = ['#539bf5', '#57ab5a', '#c69026', '#e275ad', '#986ee2', '#39c5cf', '#f69d50', '#e5534b']

export function Overview({ repo, summary, provider }: { repo: Repo; summary: RepoSummary | null; provider: ProviderType }): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const s = summary
  const stats: [string, number | null | undefined][] = [
    ['Commits', s?.commitCount],
    ['Contributors', s?.contributorCount],
    ['Branches', s?.branchCount],
    ['Tags', s?.tagCount],
    [provider === 'github' ? 'Open PRs' : 'Open MRs', s?.openChangeRequests],
    ['Stars', repo.stars],
    ['Forks', repo.forks],
    ['Open issues', repo.openIssues]
  ]
  const contributors = s?.contributors ?? []
  const shown = showAll ? contributors : contributors.slice(0, 10)
  const max = Math.max(1, ...contributors.map((c) => c.commits))
  const languages = s?.languages ?? []

  return (
    <div className="overview">
      <div className="stat-grid">
        {stats.map(([label, value]) => (
          <div className="stat" key={label}>
            <div className="stat-value">{formatCount(value)}</div>
            <div className="muted">{label}</div>
          </div>
        ))}
      </div>

      {languages.length > 0 && (
        <section>
          <h3>Languages</h3>
          <div className="lang-bar">
            {languages.map((l, i) => (
              <span key={l.name} title={`${l.name} ${l.percent.toFixed(1)}%`} style={{ width: `${l.percent}%`, background: LANG_COLORS[i % LANG_COLORS.length] }} />
            ))}
          </div>
          <div className="legend">
            {languages.map((l, i) => (
              <span key={l.name}>
                <i style={{ background: LANG_COLORS[i % LANG_COLORS.length] }} /> {l.name} <span className="muted">{l.percent.toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {contributors.length > 0 && (
        <section>
          <h3>Contributors</h3>
          <ul className="contributors">
            {shown.map((c) => (
              <li key={`${c.login}|${c.email}|${c.name}`}>
                <Avatar name={c.name || c.login} url={c.avatarUrl} size={22} />
                <span className="ellipsis contrib-name">{c.name || c.login}</span>
                <div className="contrib-bar">
                  <span style={{ width: `${(c.commits / max) * 100}%` }} />
                </div>
                <span className="muted contrib-count">{formatCount(c.commits)}</span>
              </li>
            ))}
          </ul>
          {contributors.length > 10 && (
            <button className="btn" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show less' : `Show more (${contributors.length - 10})`}
            </button>
          )}
        </section>
      )}

      {(s?.topics.length ?? 0) > 0 && (
        <section>
          <h3>Topics</h3>
          <div className="chips">
            {s?.topics.map((t) => (
              <span className="chip" key={t}>{t}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
