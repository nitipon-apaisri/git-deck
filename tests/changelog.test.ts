import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseChangelog } from '../src/shared/changelog'

const file = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')

test('parseChangelog: versions, sections and items; stray text is ignored', () => {
  const md =
    '# Title\n\nintro\n\n## 1.0.0\n\n### Fixes\n\n- a\n- b\n\n### Contents\n\n- c\n\n## 0.9.0\n'
  assert.deepEqual(parseChangelog(md), [
    {
      version: '1.0.0',
      sections: [
        { title: 'Fixes', items: ['a', 'b'] },
        { title: 'Contents', items: ['c'] }
      ]
    },
    { version: '0.9.0', sections: [] }
  ])
  assert.deepEqual(parseChangelog(''), [])
})

test('CHANGELOG.md: the newest entry is the package.json version, each has all three sections', () => {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const entries = parseChangelog(file)
  // A release candidate is written up only when it is promoted.
  assert.equal(entries[0].version, version.replace(/-rc\.\d+$/, ''))
  for (const entry of entries) {
    assert.deepEqual(
      entry.sections.map((s) => s.title),
      ['Fixes', 'Contents', 'Known limits'],
      entry.version
    )
    assert.ok(
      entry.sections.every((s) => s.items.length > 0),
      entry.version
    )
  }
})
