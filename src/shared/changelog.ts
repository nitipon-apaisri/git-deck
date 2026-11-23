// Pure change log grouping. No electron, no git: it runs under tsx tests.

export interface ChangelogCommit {
  hash: string
  author: string
  /** Unix seconds. */
  at: number
  subject: string
  /** Two or more parents. */
  merge: boolean
}

export interface ChangelogGroup {
  type: string
  title: string
  commits: ChangelogCommit[]
}

/** Group order and headings. A type not listed here lands in "Other". */
const GROUPS: [type: string, title: string][] = [
  ['feat', 'Features'],
  ['bug', 'Bug fixes'],
  ['improve', 'Performance'],
  ['ui', 'UI and style'],
  ['refactor', 'Refactoring'],
  ['docs', 'Documentation'],
  ['test', 'Tests'],
  ['deps', 'Dependencies'],
  ['config', 'Config and tooling'],
  ['ci', 'CI'],
  ['lint', 'Lint'],
  ['remove', 'Removals'],
  ['security', 'Security'],
  ['breaking', 'Breaking changes'],
  ['hotfix', 'Hotfixes'],
  ['merge', 'Merges'],
  ['other', 'Other']
]

/** Conventional Commits names and common gitmoji names onto the group types. */
const ALIASES: Record<string, string> = {
  fix: 'bug',
  bugfix: 'bug',
  perf: 'improve',
  style: 'ui',
  build: 'deps',
  chore: 'config',
  revert: 'other'
}

// `✨ (feat): x`, `feat(scope): x`, `feat!: x`. A leading emoji is optional, so both forms match.
const SUBJECT_RE = /^(?:\P{L}+\s*)?\(?([a-z]+)\)?(?:\([^)]*\))?!?:\s*(.*)$/iu

/** The group type of a subject, and the subject without its prefix. */
export function parseSubject(subject: string): { type: string; text: string } {
  const m = SUBJECT_RE.exec(subject)
  if (!m) return { type: 'other', text: subject }
  const word = m[1].toLowerCase()
  const type = ALIASES[word] ?? word
  return GROUPS.some(([t]) => t === type)
    ? { type, text: m[2] || subject }
    : { type: 'other', text: subject }
}

/** Non-empty groups, in the fixed order. A merge commit goes to "Merges" whatever its subject. */
export function groupChangelog(commits: ChangelogCommit[]): ChangelogGroup[] {
  const byType = new Map<string, ChangelogCommit[]>()
  for (const commit of commits) {
    const type = commit.merge ? 'merge' : parseSubject(commit.subject).type
    byType.set(type, [...(byType.get(type) ?? []), commit])
  }
  return GROUPS.filter(([type]) => byType.has(type)).map(([type, title]) => ({
    type,
    title,
    commits: byType.get(type) ?? []
  }))
}

/** A Markdown release note. `from` is `null` when the range starts at the first commit. */
export function changelogMarkdown(
  from: string | null,
  to: string,
  groups: ChangelogGroup[]
): string {
  const lines = [`## ${to}`, '', from ? `Changes since ${from}.` : 'All changes.']
  if (groups.length === 0) lines.push('', 'No changes.')
  for (const group of groups) {
    lines.push('', `### ${group.title}`, '')
    for (const c of group.commits) {
      const text = c.merge ? c.subject : parseSubject(c.subject).text
      lines.push(`- ${text} (${c.hash.slice(0, 7)})`)
    }
  }
  return `${lines.join('\n')}\n`
}
