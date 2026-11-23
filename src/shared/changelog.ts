// Reads CHANGELOG.md. No electron, so it runs under tsx tests.

export interface ChangelogSection {
  title: string
  items: string[]
}

export interface ChangelogEntry {
  version: string
  sections: ChangelogSection[]
}

/** `## X.Y.Z` starts an entry, `### Title` a section, `- text` an item. Anything else is ignored. */
// Also reads a GitHub release body wrapped as `## X.Y.Z\n<body>`.
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  for (const line of markdown.split('\n')) {
    const version = /^## (\S+)\s*$/.exec(line)?.[1]
    if (version) {
      entries.push({ version, sections: [] })
      continue
    }
    const entry = entries.at(-1)
    if (!entry) continue
    // A release body on GitHub names its sections bare ("Fixes"), the file uses "### Fixes".
    const m = /^(?:###\s+(.+?)|\**(Fixes|Contents|Known limits)\**:?)\s*$/.exec(line)
    const title = m?.[1] ?? m?.[2]
    if (title) entry.sections.push({ title, items: [] })
    else if (/^[-*] /.test(line)) entry.sections.at(-1)?.items.push(line.slice(2))
  }
  return entries
}
